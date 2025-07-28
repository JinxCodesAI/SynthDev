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
        const agent = this.activeAgents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Add message to agent's conversation history
        agent.addMessage({ role: 'user', content: message });

        // Execute agent's API client to get response
        const response = await agent.execute();

        return {
            content: response,
            status: agent.status,
            agentId: agentId,
        };
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

        // TODO: In Phase 2, notify supervisor agent of completion
        // For now, just log the completion
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
