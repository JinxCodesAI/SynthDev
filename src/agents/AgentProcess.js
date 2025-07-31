import AIAPIClient from '../core/ai/aiAPIClient.js';
import SystemMessages from '../core/ai/systemMessages.js';
import ConfigManager from '../config/managers/configManager.js';
import { getLogger } from '../core/managers/logger.js';

/**
 * Represents a single, isolated agent instance with its own conversation context
 */
class AgentProcess {
    constructor(agentId, roleName, taskPrompt, parentId, costsManager, toolManager) {
        this.agentId = agentId;
        this.roleName = roleName;
        this.taskPrompt = taskPrompt;
        this.parentId = parentId;
        this.status = 'running';
        this.createdAt = new Date();
        this.result = null;
        this.logger = getLogger();

        // Create isolated AIAPIClient instance
        this._initializeAPIClient(costsManager, toolManager);

        // Initialize conversation with role system message and task
        this._initializeConversation();
    }

    /**
     * Initialize isolated API client with role-appropriate model level
     * @param {Object} costsManager - Shared costs manager instance
     * @param {Object} toolManager - Shared tool manager instance
     * @private
     */
    _initializeAPIClient(costsManager, toolManager) {
        // Get role-specific model level
        const level = SystemMessages.getLevel(this.roleName);

        // Get configuration from ConfigManager
        const config = ConfigManager.getInstance();
        const modelConfig = config.getModel(level);

        // Create isolated API client instance
        this.apiClient = new AIAPIClient(
            costsManager,
            modelConfig.apiKey,
            modelConfig.baseUrl,
            modelConfig.model || modelConfig.baseModel
        );

        // Set tools in API client
        this.apiClient.setTools(toolManager.getTools());

        // Store references for tool execution context
        this.costsManager = costsManager;
        this.toolManager = toolManager;

        // Set up callbacks for tool execution
        this._setupAPIClientCallbacks();
    }

    /**
     * Set up callbacks for AIAPIClient to handle tool execution
     * @private
     */
    _setupAPIClientCallbacks() {
        this.apiClient.setCallbacks({
            onToolExecution: async toolCall => {
                // Log tool execution for agents to match main app logging
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);
                this.logger.toolExecutionDetailed(toolName, this.apiClient.role, toolArgs);

                // Prepare context for tool execution
                const toolContext = {
                    currentRole: this.apiClient.role,
                    currentAgentId: this.agentId,
                    agentManager: null, // Agents don't have access to agentManager to prevent recursion
                    costsManager: this.costsManager,
                    toolManager: this.toolManager,
                    app: null, // Agents don't have access to main app instance
                };

                // Create minimal console interface for agents (just logging, no UI)
                const agentConsoleInterface = {
                    showToolExecution: (toolName, args, role) => {
                        // Already logged above, no need to duplicate
                    },
                    showToolResult: result => {
                        this.logger.toolResult(result);
                    },
                    showToolCancelled: toolName => {
                        this.logger.debug(`Agent ${this.agentId} tool cancelled: ${toolName}`);
                    },
                    promptForConfirmation: async () => {
                        // Agents auto-approve all tools (no user interaction)
                        return true;
                    },
                };

                try {
                    const result = await this.toolManager.executeToolCall(
                        toolCall,
                        agentConsoleInterface,
                        null, // No snapshot manager
                        toolContext
                    );

                    return result;
                } catch (error) {
                    this.logger.error(
                        `Agent ${this.agentId} tool execution failed: ${error.message}`
                    );
                    throw error;
                }
            },

            onError: error => {
                this.logger.error(`Agent ${this.agentId} API error: ${error.message}`);
            },
        });
    }

    /**
     * Initialize conversation with system message and task prompt
     * @private
     */
    _initializeConversation() {
        // Get role system message
        const systemMessage = SystemMessages.getSystemMessage(this.roleName);

        // Set system message for the agent
        this.apiClient.setSystemMessage(systemMessage, this.roleName);

        // Add initial task prompt as user message to conversation history
        // Note: We use addMessage instead of sendUserMessage to avoid immediate execution
        this.apiClient.addMessage({ role: 'user', content: this.taskPrompt });
        this.logger.debug(
            `💬 Added initial task prompt to agent ${this.agentId} conversation: ${this.taskPrompt}`
        );
    }

    /**
     * Add message to agent's conversation history
     * @param {Object} message - Message object with role and content
     */
    addMessage(message) {
        this.apiClient.addMessage(message);
    }

    /**
     * Execute agent's API client to process current conversation state
     * @returns {Promise<string>} Agent's response
     */
    async execute() {
        try {
            // Set status to running at start of execution
            this.status = 'running';

            const response = await this.apiClient.sendMessage();

            // If execution completes without calling return_results, mark as inactive
            if (this.status === 'running') {
                this.markInactive();
            }

            return response;
        } catch (error) {
            this.logger.error(`Agent ${this.agentId} execution failed: ${error.message}`);
            this.markFailed(error);
            throw error;
        }
    }

    /**
     * Get current status and metadata
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            agentId: this.agentId,
            roleName: this.roleName,
            status: this.status,
            createdAt: this.createdAt,
            parentId: this.parentId,
            taskPrompt: this.taskPrompt,
            result: this.result,
        };
    }

    /**
     * Mark agent as completed with result
     * @param {Object} result - Completion result
     */
    markCompleted(result) {
        this.status = 'completed';
        this.result = result;
        this.logger.info(`Agent ${this.agentId} completed with status: ${result.status}`);
    }

    /**
     * Mark agent as failed with error details
     * @param {Error} error - Error that caused failure
     */
    markFailed(error) {
        this.status = 'failed';
        this.result = {
            status: 'failure',
            error: error.message,
            stack: error.stack,
        };
        this.logger.error(`Agent ${this.agentId} failed: ${error.message}`);
    }

    /**
     * Mark agent as inactive (finished response without return_results)
     */
    markInactive() {
        this.status = 'inactive';
        this.logger.info(`Agent ${this.agentId} marked as inactive`);
    }
}

export default AgentProcess;
