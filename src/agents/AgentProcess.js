import { randomUUID } from 'crypto';
import AIAPIClient from '../core/ai/aiAPIClient.js';
import SystemMessages from '../core/ai/systemMessages.js';
import { getLogger } from '../core/managers/logger.js';

/**
 * Represents a single, isolated agent instance with its own conversation context
 */
class AgentProcess {
    constructor(roleName, taskPrompt, parentId, costsManager, toolManager) {
        this.agentId = randomUUID();
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

        // Create isolated API client instance
        this.apiClient = new AIAPIClient(
            costsManager,
            process.env.OPENAI_API_KEY,
            process.env.OPENAI_BASE_URL,
            level
        );

        // Store references for tool execution context
        this.costsManager = costsManager;
        this.toolManager = toolManager;
    }

    /**
     * Initialize conversation with system message and task prompt
     * @private
     */
    _initializeConversation() {
        // Get role system message
        const systemMessage = SystemMessages.getSystemMessage(this.roleName);

        // Set system message for the agent
        this.apiClient.setSystemMessage(systemMessage);

        // Add initial task prompt as user message
        this.apiClient.addMessage({
            role: 'user',
            content: this.taskPrompt,
        });
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
