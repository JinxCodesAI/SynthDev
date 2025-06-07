import AIAPIClient from '../core/ai/aiAPIClient.js';
import SystemMessages from '../core/ai/systemMessages.js';
import ConfigManager from '../config/managers/configManager.js';
import { getLogger } from '../core/managers/logger.js';

/**
 * Represents a single, isolated agent instance with its own conversation context
 */
class AgentProcess {
    constructor(
        agentId,
        roleName,
        taskPrompt,
        parentId,
        costsManager,
        toolManager,
        agentManager,
        onMaxToolCallsExceeded = null,
        consoleInterface = null
    ) {
        this.agentId = agentId;
        this.roleName = roleName;
        this.taskPrompt = taskPrompt;
        this.parentId = parentId;
        this.status = 'running';
        this.createdAt = new Date();
        this.result = null;
        this.logger = getLogger();

        // Store references for tool execution context
        this.costsManager = costsManager;
        this.toolManager = toolManager;
        this.agentManager = agentManager;
        this.onMaxToolCallsExceeded = onMaxToolCallsExceeded;
        this.consoleInterface = consoleInterface; // For agents with parent 'user' to display messages

        // Message queuing system
        this.messageQueue = [];
        this.isProcessingQueue = false;

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
            modelConfig.model || modelConfig.baseModel,
            toolManager
        );

        // Set tools in API client
        this.apiClient.setTools(toolManager.getTools());

        // Set up callbacks for tool execution
        this._setupAPIClientCallbacks();
    }

    /**
     * Set up callbacks for AIAPIClient to handle tool execution
     * @private
     */
    _setupAPIClientCallbacks() {
        const callbacks = {
            onToolExecution: async toolCall => {
                // Log tool execution for agents to match main app logging
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);
                this.logger.toolExecutionDetailed(toolName, this.apiClient.role, toolArgs);

                // Prepare context for tool execution
                const toolContext = {
                    currentRole: this.apiClient.role,
                    currentAgentId: this.agentId,
                    agentManager: this.agentManager, // Provide agentManager - permissions are handled by AgentManager itself
                    costsManager: this.costsManager,
                    toolManager: this.toolManager,
                    app: null, // Agents don't have access to main app instance
                };

                // Create minimal console interface for agents (just logging, no UI)
                const agentConsoleInterface = {
                    showToolExecution: (_toolName, _args, _role) => {
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

            onMaxToolCallsExceeded: this.onMaxToolCallsExceeded
                ? async maxToolCalls => {
                      this.logger.warn(
                          `Agent ${this.agentId} exceeded max tool calls limit (${maxToolCalls}). ` +
                              'Requesting user confirmation...'
                      );
                      return await this.onMaxToolCallsExceeded(maxToolCalls);
                  }
                : null,
        };

        // Add console display callbacks for agents with parent 'user' (no parent)
        if (!this.parentId && this.consoleInterface) {
            callbacks.onContentDisplay = (content, role = null) => {
                if (content) {
                    this.consoleInterface.showMessage(
                        content,
                        role ? `🤖 ${role}:` : `🤖 ${this.roleName} (${this.agentId}):`
                    );
                    this.consoleInterface.newLine();
                }
            };

            callbacks.onResponse = (response, role = null) => {
                const content =
                    response &&
                    response.choices &&
                    response.choices[0] &&
                    response.choices[0].message &&
                    response.choices[0].message.content;
                if (content) {
                    this.consoleInterface.showMessage(
                        content,
                        role ? `🤖 ${role}:` : `🤖 ${this.roleName} (${this.agentId}):`
                    );
                    this.consoleInterface.newLine();
                }
            };
        }

        this.apiClient.setCallbacks(callbacks);
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

        const message = `You had been spawned to perform following task:\n\n ${this.taskPrompt}\n\n, please start working on it. use return_results tool when you are done. Pay attention to your system message and task prompt. `;

        this.apiClient.addMessage({ role: 'user', content: message });
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
     * Queue a message for processing when the API client becomes ready
     * @param {string} message - The message to queue
     * @private
     */
    _queueMessage(message) {
        this.messageQueue.push(message);
        this.logger.debug(
            `Agent ${this.agentId} queued message. Queue length: ${this.messageQueue.length}`
        );

        // Start processing queue if not already processing
        if (!this.isProcessingQueue) {
            this._processMessageQueue();
        }
    }

    /**
     * Process queued messages when API client becomes ready
     * @private
     */
    async _processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        this.logger.debug(
            `Agent ${this.agentId} starting queue processing. Queue length: ${this.messageQueue.length}`
        );

        while (this.messageQueue.length > 0) {
            // Wait for API client to be ready
            await this._waitForAPIClientReady();

            // Get the next message from queue
            const message = this.messageQueue.shift();

            this.logger.debug(`Agent ${this.agentId} processing queued message: "${message}"`);

            try {
                // Process the message (don't await to avoid blocking queue processing)
                this.apiClient.sendUserMessage(message).catch(error => {
                    this.logger.error(
                        `Agent ${this.agentId} failed to process queued message: ${error.message}`
                    );
                });

                // Small delay to prevent overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                this.logger.error(
                    `Agent ${this.agentId} error processing queued message: ${error.message}`
                );
            }
        }

        this.isProcessingQueue = false;
        this.logger.debug(`Agent ${this.agentId} finished queue processing`);
    }

    /**
     * Wait for API client to be ready to accept new requests
     * @private
     */
    async _waitForAPIClientReady() {
        const maxWaitTime = 30000; // 30 seconds max wait
        const checkInterval = 100; // Check every 100ms
        const startTime = Date.now();

        while (!this.apiClient.canAcceptNewRequest()) {
            if (Date.now() - startTime > maxWaitTime) {
                this.logger.warn(
                    `Agent ${this.agentId} timed out waiting for API client to be ready`
                );
                break;
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
    }

    /**
     * Send a user message to the agent, using appropriate method based on current processing state
     * @param {string} message - The message to send
     * @returns {Promise<string>|void} Response if sent immediately, void if queued
     */
    sendUserMessage(message) {
        const processingState = this.apiClient.getProcessingState();

        // Log the decision for debugging
        this.logger.debug(
            `Agent ${this.agentId} sendUserMessage: state=${processingState}, ` +
                `canAcceptNewRequest=${this.apiClient.canAcceptNewRequest()}`
        );

        if (this.apiClient.canAcceptNewRequest()) {
            // State is IDLE - safe to force a new request
            this.logger.debug(
                `Agent ${this.agentId} forcing new request (state: ${processingState})`
            );
            return this.apiClient.sendUserMessage(message);
        } else {
            // State is PREPARING, API_CALLING, PROCESSING_TOOLS, or FINALIZING
            // Queue the message for processing when API client becomes ready
            this.logger.debug(
                `Agent ${this.agentId} queuing message for later processing (state: ${processingState})`
            );
            this._queueMessage(message);
        }
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
