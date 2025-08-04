import { getLogger } from './logger.js';
import WorkflowAgent from '../../workflow/WorkflowAgent.js';
import WorkflowContext from '../../workflow/WorkflowContext.js';

/**
 * Manages standalone agents outside of workflows
 * Provides spawning, despawning, and communication with individual agents
 */
class AgentManager {
    constructor(config, toolManager, snapshotManager, costsManager) {
        this.config = config;
        this.toolManager = toolManager;
        this.snapshotManager = snapshotManager;
        this.costsManager = costsManager;
        this.logger = getLogger();

        // Map of agent ID to agent instance
        this.agents = new Map();

        // Map of agent ID to spawn metadata (parent agent, creation time, etc.)
        this.agentMetadata = new Map();

        // Map of parent agent ID to set of spawned agent IDs
        this.parentChildMap = new Map();

        this.logger.debug('🤖 AgentManager initialized');
    }

    /**
     * Spawn a new standalone agent
     * @param {string} agentRole - Role of the agent to spawn
     * @param {string} parentAgentId - ID of the agent that spawned this one
     * @param {string} [contextName] - Optional context name, defaults to agent-specific context
     * @returns {Promise<{success: boolean, agentId?: string, error?: string}>}
     */
    async spawnAgent(agentRole, parentAgentId, contextName = null) {
        try {
            // Validate agent role exists in system
            const systemMessages = await import('../ai/systemMessages.js');
            const SystemMessages = systemMessages.default;

            if (!SystemMessages.hasRole(agentRole)) {
                return {
                    success: false,
                    error: `Unknown agent role: ${agentRole}. Available roles can be checked with /roles command.`,
                };
            }

            // Generate unique agent ID
            const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Create or get context for this agent
            const finalContextName = contextName || `${agentId}-context`;
            const context = this._createAgentContext(finalContextName);

            // Create agent configuration
            const agentConfig = {
                agent_role: agentRole,
                context: finalContextName,
                role: 'assistant', // Default to assistant role in context
            };

            // Create the agent instance
            const agent = new WorkflowAgent(
                agentConfig,
                context,
                this.config,
                this.toolManager,
                this.snapshotManager,
                this.costsManager
            );

            // Store agent and metadata
            this.agents.set(agentId, agent);
            this.agentMetadata.set(agentId, {
                agentRole,
                parentAgentId,
                contextName: finalContextName,
                createdAt: new Date().toISOString(),
                status: 'active',
            });

            // Track parent-child relationship
            if (!this.parentChildMap.has(parentAgentId)) {
                this.parentChildMap.set(parentAgentId, new Set());
            }
            this.parentChildMap.get(parentAgentId).add(agentId);

            this.logger.info(
                `🤖 Spawned agent ${agentId} (role: ${agentRole}) by parent ${parentAgentId}`
            );

            return {
                success: true,
                agentId,
                agentRole,
                contextName: finalContextName,
                createdAt: this.agentMetadata.get(agentId).createdAt,
            };
        } catch (error) {
            this.logger.error(error, `Failed to spawn agent with role ${agentRole}`);
            return {
                success: false,
                error: `Failed to spawn agent: ${error.message}`,
            };
        }
    }

    /**
     * Despawn an agent (can only be done by the parent that spawned it)
     * @param {string} agentId - ID of the agent to despawn
     * @param {string} requestingParentId - ID of the agent requesting despawn
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async despawnAgent(agentId, requestingParentId) {
        try {
            // Check if agent exists
            if (!this.agents.has(agentId)) {
                return {
                    success: false,
                    error: `Agent ${agentId} not found`,
                };
            }

            // Get agent metadata
            const metadata = this.agentMetadata.get(agentId);

            // Verify that the requesting parent is the one who spawned this agent
            if (metadata.parentAgentId !== requestingParentId) {
                return {
                    success: false,
                    error: `Access denied: Agent ${agentId} can only be despawned by its parent ${metadata.parentAgentId}, not ${requestingParentId}`,
                };
            }

            // Get agent instance
            const agent = this.agents.get(agentId);

            // Remove agent from its context
            if (agent.context) {
                agent.context.removeAgent(agent);
            }

            // Clean up agent resources
            if (agent.apiClient) {
                // No explicit cleanup needed for APIClient currently
            }

            // Remove from tracking maps
            this.agents.delete(agentId);
            this.agentMetadata.delete(agentId);

            // Remove from parent-child mapping
            if (this.parentChildMap.has(requestingParentId)) {
                this.parentChildMap.get(requestingParentId).delete(agentId);
                if (this.parentChildMap.get(requestingParentId).size === 0) {
                    this.parentChildMap.delete(requestingParentId);
                }
            }

            this.logger.info(
                `🗑️ Despawned agent ${agentId} (role: ${metadata.agentRole}) by parent ${requestingParentId}`
            );

            return {
                success: true,
                agentId,
                agentRole: metadata.agentRole,
                despawnedAt: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(error, `Failed to despawn agent ${agentId}`);
            return {
                success: false,
                error: `Failed to despawn agent: ${error.message}`,
            };
        }
    }

    /**
     * Send a message to a specific agent
     * @param {string} agentId - ID of the agent to send message to
     * @param {string} message - Message to send
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async sendMessageToAgent(agentId, message) {
        try {
            if (!this.agents.has(agentId)) {
                return {
                    success: false,
                    error: `Agent ${agentId} not found`,
                };
            }

            const agent = this.agents.get(agentId);
            const response = await agent.sendMessage(message);

            return {
                success: true,
                response,
                agentId,
            };
        } catch (error) {
            this.logger.error(error, `Failed to send message to agent ${agentId}`);
            return {
                success: false,
                error: `Failed to send message: ${error.message}`,
            };
        }
    }

    /**
     * Get list of agents spawned by a specific parent
     * @param {string} parentAgentId - ID of the parent agent
     * @returns {Array} List of spawned agent information
     */
    getSpawnedAgents(parentAgentId) {
        const spawnedIds = this.parentChildMap.get(parentAgentId) || new Set();
        return Array.from(spawnedIds).map(agentId => {
            const metadata = this.agentMetadata.get(agentId);
            return {
                agentId,
                agentRole: metadata.agentRole,
                contextName: metadata.contextName,
                createdAt: metadata.createdAt,
                status: metadata.status,
            };
        });
    }

    /**
     * Get information about a specific agent
     * @param {string} agentId - ID of the agent
     * @returns {Object|null} Agent information or null if not found
     */
    getAgentInfo(agentId) {
        if (!this.agents.has(agentId)) {
            return null;
        }

        const metadata = this.agentMetadata.get(agentId);
        const agent = this.agents.get(agentId);

        return {
            agentId,
            agentRole: metadata.agentRole,
            parentAgentId: metadata.parentAgentId,
            contextName: metadata.contextName,
            createdAt: metadata.createdAt,
            status: metadata.status,
            initialized: agent.initialized,
        };
    }

    /**
     * Create a context for an agent
     * @private
     * @param {string} contextName - Name of the context
     * @returns {WorkflowContext} Created context
     */
    _createAgentContext(contextName) {
        const contextConfig = {
            name: contextName,
            starting_messages: [],
            max_length: 50000,
        };

        return new WorkflowContext(contextConfig);
    }

    /**
     * Get total number of active agents
     * @returns {number} Number of active agents
     */
    getActiveAgentCount() {
        return this.agents.size;
    }

    /**
     * Get all active agents (for debugging/monitoring)
     * @returns {Array} List of all active agent information
     */
    getAllActiveAgents() {
        return Array.from(this.agents.keys()).map(agentId => this.getAgentInfo(agentId));
    }
}

export default AgentManager;
