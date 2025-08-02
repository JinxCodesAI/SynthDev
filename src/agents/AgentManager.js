import { getLogger } from '../core/managers/logger.js';
import SystemMessages from '../core/ai/systemMessages.js';
import AgentProcess from './AgentProcess.js';

/**
 * Singleton class to orchestrate all agent processes
 * Manages agent lifecycle, permissions, and communication
 */
class AgentManager {
    constructor() {
        if (AgentManager.instance) {
            return AgentManager.instance;
        }

        this.activeAgents = new Map(); // agentId -> AgentProcess
        this.agentHierarchy = new Map(); // parentId -> Set<childId>
        this.agentCounter = 0; // Counter for generating simple agent IDs
        this.logger = getLogger();
        this.onMaxToolCallsExceeded = null; // Callback for max tool calls exceeded

        AgentManager.instance = this;
    }

    static getInstance() {
        if (!AgentManager.instance) {
            AgentManager.instance = new AgentManager();
        }
        return AgentManager.instance;
    }

    /**
     * Set the callback for handling max tool calls exceeded
     * @param {Function} callback - Callback function that prompts user for confirmation
     */
    setMaxToolCallsExceededCallback(callback) {
        this.onMaxToolCallsExceeded = callback;
    }

    /**
     * Generate a simple sequential agent ID
     * @returns {string} Agent ID in format 'agent-N'
     */
    _generateAgentId() {
        this.agentCounter++;
        return `agent-${this.agentCounter}`;
    }

    /**
     * Spawn a new agent with permission validation
     * @param {string} supervisorRole - Role of the supervisor agent
     * @param {string} workerRoleName - Role name for the new worker agent
     * @param {string} taskPrompt - Initial task prompt for the worker
     * @param {Object} context - Shared context (costsManager, toolManager)
     * @returns {Promise<Object>} Created agent information
     */
    async spawnAgent(supervisorRole, workerRoleName, taskPrompt, context) {
        // Validate spawn permission
        if (!this._validateSpawnPermission(supervisorRole, workerRoleName)) {
            throw new Error(
                `Role '${supervisorRole}' is not authorized to spawn '${workerRoleName}' agents. ` +
                    "Check the 'enabled_agents' configuration for this role."
            );
        }

        // Validate the worker role name but preserve the original group-prefixed name
        if (typeof SystemMessages.resolveRole === 'function') {
            const workerResolution = SystemMessages.resolveRole(workerRoleName);
            if (workerResolution && workerResolution.ambiguous) {
                throw new Error(
                    `Role '${workerRoleName}' is ambiguous. Found in groups: ${workerResolution.availableGroups.join(', ')}. ` +
                        `Please specify group explicitly (e.g., '${workerResolution.availableGroups[0]}.${workerResolution.roleName}')`
                );
            }
            if (workerResolution && !workerResolution.found) {
                throw new Error(`Role '${workerRoleName}' not found`);
            }
            // Don't change actualWorkerRoleName - preserve the original group-prefixed name
            // The SystemMessages.getSystemMessage() method will handle the resolution
        }

        // Get supervisor agent ID from context (null for main user)
        const supervisorAgentId = context?.currentAgentId || null;

        // Generate simple agent ID
        const agentId = this._generateAgentId();

        // Create new agent process with the original role name (preserving group prefix)
        // Pass console interface for agents with parent 'user' (supervisorAgentId is null)
        const consoleInterface = supervisorAgentId === null ? context.app?.consoleInterface : null;

        const agent = new AgentProcess(
            agentId,
            workerRoleName, // Use original role name to preserve group prefix
            taskPrompt,
            supervisorAgentId, // Use actual agent ID as parent
            context.costsManager,
            context.toolManager,
            this, // Pass agentManager instance for tool access
            this.onMaxToolCallsExceeded, // Pass max tool calls callback
            consoleInterface // Pass console interface for user-spawned agents
        );

        // Register agent
        this.activeAgents.set(agent.agentId, agent);
        this._trackAgentHierarchy(supervisorAgentId, agent.agentId);

        this.logger.info(
            `Spawned ${workerRoleName} agent ${agent.agentId} for supervisor ${supervisorAgentId || 'user'}`
        );

        // Execute agent asynchronously to process the initial task prompt
        this._executeAgentAsync(agent);

        return {
            agentId: agent.agentId,
            status: agent.status,
            createdAt: agent.createdAt,
            roleName: workerRoleName,
        };
    }

    /**
     * Send message to a specific agent and get response
     * @param {string} agentId - Target agent ID
     * @param {string} message - Message to send
     * @returns {Promise<Object>} Agent response
     */
    async sendMessageToAgent(agentId, message) {
        this.logger.info(`Sending message to agent ${agentId}:`);
        const agent = this.activeAgents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Check if agent can receive messages
        if (agent.status === 'failed') {
            throw new Error(`Agent ${agentId} has failed and cannot process messages`);
        }

        // Add message to agent's conversation history
        agent.addMessage({ role: 'user', content: message });
        this.logger.debug(
            `💬 Added following message: ${message} \n to agent ${agentId} conversation`
        );

        if (agent.status !== 'running') {
            // Set agent to running status before execution
            agent.status = 'running';

            // Execute agent asynchronously and handle status transitions
            this._executeAgentAsync(agent);
        }

        return {
            message_sent: true,
            agent_id: agentId,
            status: 'running',
            message:
                'Message has been sent, response will be sent in future message. If response blocks your progress wait, otherwise continue operation.',
        };
    }

    /**
     * Execute agent asynchronously and handle status transitions
     * @param {AgentProcess} agent - Agent to execute
     * @private
     */
    async _executeAgentAsync(agent) {
        try {
            const response = await agent.execute();

            // Check if agent called return_results during execution
            if (agent.status !== 'completed') {
                agent.markInactive();
            }

            this.logger.info(
                `Agent ${agent.agentId} finished execution with status: ${agent.status}`
            );
        } catch (error) {
            agent.markFailed(error);
            this.logger.error(`Agent ${agent.agentId} execution failed: ${error.message}`);
        }
    }

    /**
     * Get agent status and metadata
     * @param {string} agentId - Agent ID to query
     * @returns {Object|null} Agent status or null if not found
     */
    getAgentStatus(agentId) {
        const agent = this.activeAgents.get(agentId);
        return agent ? agent.getStatus() : null;
    }

    /**
     * List agents spawned by a specific supervisor
     * @param {string|null} supervisorAgentId - Supervisor agent ID (null for main user)
     * @param {Object} options - Filtering options
     * @returns {Array} Array of agent status objects
     */
    listAgents(supervisorAgentId, options = {}) {
        const { include_completed = true } = options;
        // Use null for main user, actual agent ID for agent supervisors
        const childIds = this.agentHierarchy.get(supervisorAgentId) || new Set();

        const agents = [];
        for (const agentId of childIds) {
            const agent = this.activeAgents.get(agentId);
            if (agent) {
                const status = agent.getStatus();
                if (include_completed || status.status !== 'completed') {
                    agents.push(status);
                }
            }
        }

        return agents;
    }

    /**
     * List all agents in the system regardless of supervisor
     * @param {Object} options - Filtering options
     * @returns {Array} Array of agent status objects
     */
    listAllAgents(options = {}) {
        const { include_completed = true } = options;

        const agents = [];
        for (const agent of this.activeAgents.values()) {
            const status = agent.getStatus();
            if (include_completed || status.status !== 'completed') {
                agents.push(status);
            }
        }

        return agents;
    }

    /**
     * Handle agent completion and result storage
     * @param {string} workerId - Worker agent ID
     * @param {Object} result - Completion result
     * @returns {Promise<void>}
     */
    async reportResult(workerId, result) {
        const agent = this.activeAgents.get(workerId);
        if (!agent) {
            throw new Error(`Worker agent ${workerId} not found`);
        }

        // Mark agent as completed
        agent.markCompleted(result);

        this.logger.info(`Agent ${workerId} reported completion with status: ${result.status}`);

        // Notify parent agent of completion
        await this._notifyParentOfCompletion(workerId, result);
    }

    /**
     * Notify parent agent of child completion
     * @param {string} childAgentId - Child agent ID
     * @param {Object} result - Completion result
     * @private
     */
    async _notifyParentOfCompletion(childAgentId, result) {
        const childAgent = this.activeAgents.get(childAgentId);
        if (!childAgent) {
            return;
        }

        if (!childAgent.parentId) {
            // No parent to notify (main user spawned this agent) - display completion in console
            if (childAgent.consoleInterface) {
                const completionMessage = `🎯 Agent ${childAgent.roleName} (${childAgentId}) has completed its task with ${result.status} status.

📋 Summary: ${result.summary}

${result.artifacts?.length ? `📁 Modified files:\n${result.artifacts.map(a => `  • ${a.file_path}: ${a.description}`).join('\n')}\n` : ''}${result.known_issues?.length ? `⚠️  Known issues:\n${result.known_issues.map(issue => `  • ${issue}`).join('\n')}\n` : ''}You can use speak_to_agent tool to request clarifications or additional work from this agent.`;

                childAgent.consoleInterface.showMessage(completionMessage);
                childAgent.consoleInterface.newLine();
            }

            this.logger.info(
                `Agent ${childAgentId} completed task for user with status: ${result.status}`
            );
            return;
        }

        const parentAgent = this.activeAgents.get(childAgent.parentId);
        if (!parentAgent) {
            this.logger.warn(
                `Parent agent ${childAgent.parentId} not found for child ${childAgentId}`
            );
            return;
        }

        // Format result message for parent
        const resultMessage = `Agent ${childAgent.roleName} (${childAgentId}) has completed its task with ${result.status} status.

${result.summary}

${result.artifacts?.length ? `Modified files:\n${result.artifacts.map(a => `- ${a.file_path}: ${a.description}`).join('\n')}\n` : ''}
${result.known_issues?.length ? `Known issues:\n${result.known_issues.map(issue => `- ${issue}`).join('\n')}\n` : ''}

You can use task related tools and speak_to_agent tool to request clarifications or additional work from this agent.`;
        // Add message to parent's conversation
        parentAgent.sendUserMessage(resultMessage);

        this.logger.info(
            `Notified parent agent ${childAgent.parentId} of child ${childAgentId} completion`
        );
    }

    /**
     * Validate if supervisor role can spawn worker role
     * @param {string} supervisorRole - Supervisor role name
     * @param {string} workerRoleName - Worker role name
     * @returns {boolean} True if spawning is allowed
     * @private
     */
    _validateSpawnPermission(supervisorRole, workerRoleName) {
        try {
            // Allow 'user' to spawn any agentic role
            if (supervisorRole === 'user') {
                // For backward compatibility, try resolveRole if it exists, otherwise use direct lookup
                if (typeof SystemMessages.resolveRole === 'function') {
                    const workerResolution = SystemMessages.resolveRole(workerRoleName);
                    if (workerResolution && workerResolution.ambiguous) {
                        throw new Error(
                            `Role '${workerRoleName}' is ambiguous. Found in groups: ${workerResolution.availableGroups.join(', ')}. ` +
                                `Please specify group explicitly (e.g., '${workerResolution.availableGroups[0]}.${workerResolution.roleName}')`
                        );
                    }
                    if (workerResolution && !workerResolution.found) {
                        throw new Error(`Role '${workerRoleName}' not found`);
                    }
                    const actualRoleName =
                        workerResolution && workerResolution.found
                            ? workerResolution.roleName
                            : workerRoleName;
                    return SystemMessages.isAgentic(actualRoleName);
                } else {
                    // Fallback for tests or when resolveRole is not available
                    return SystemMessages.isAgentic(workerRoleName);
                }
            }

            // For agent supervisors, check spawn permissions
            return SystemMessages.canSpawnAgent(supervisorRole, workerRoleName);
        } catch (error) {
            this.logger.error(`Permission validation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Track parent-child relationships
     * @param {string} parentId - Parent agent/role ID
     * @param {string} childId - Child agent ID
     * @private
     */
    _trackAgentHierarchy(parentId, childId) {
        if (!this.agentHierarchy.has(parentId)) {
            this.agentHierarchy.set(parentId, new Set());
        }
        this.agentHierarchy.get(parentId).add(childId);
    }

    /**
     * Reset the agent manager (for testing)
     */
    reset() {
        this.activeAgents.clear();
        this.agentHierarchy.clear();
        AgentManager.instance = null;
    }
}

export default AgentManager;
