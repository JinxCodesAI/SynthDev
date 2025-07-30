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
        this.logger = getLogger();

        AgentManager.instance = this;
    }

    static getInstance() {
        if (!AgentManager.instance) {
            AgentManager.instance = new AgentManager();
        }
        return AgentManager.instance;
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

        // Get supervisor agent ID from context (null for main user)
        const supervisorAgentId = context?.currentAgentId || null;

        // Create new agent process
        const agent = new AgentProcess(
            workerRoleName,
            taskPrompt,
            supervisorAgentId, // Use actual agent ID as parent
            context.costsManager,
            context.toolManager
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

        if (agent.status === 'running') {
            throw new Error(`Agent ${agentId} is currently processing and should not be disturbed`);
        }

        // Add message to agent's conversation history
        agent.addMessage({ role: 'user', content: message });
        this.logger.debug(
            `💬 Added following message: ${message} \n to agent ${agentId} conversation`
        );

        // Set agent to running status before execution
        agent.status = 'running';

        // Execute agent asynchronously and handle status transitions
        this._executeAgentAsync(agent);

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
        if (!childAgent || !childAgent.parentId) {
            return; // No parent to notify (main user spawned this agent)
        }

        const parentAgent = this.activeAgents.get(childAgent.parentId);
        if (!parentAgent) {
            this.logger.warn(
                `Parent agent ${childAgent.parentId} not found for child ${childAgentId}`
            );
            return;
        }

        // Format result message for parent
        const resultMessage = {
            role: 'user',
            content:
                `Agent ${childAgent.roleName} (${childAgentId}) has completed its task.\n\n` +
                `Status: ${result.status}\n` +
                `Summary: ${result.summary}\n` +
                `Artifacts: ${result.artifacts?.length || 0} files\n` +
                `Known Issues: ${result.known_issues?.length || 0}\n\n` +
                'Full result details available via get_agents tool.',
        };

        // Add message to parent's conversation
        parentAgent.addMessage(resultMessage);

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
