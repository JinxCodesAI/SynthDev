import AIAPIClient from '../core/ai/aiAPIClient.js';
import SystemMessages from '../core/ai/systemMessages.js';
import { getLogger } from '../core/managers/logger.js';

/**
 * Represents an agent instance in a workflow with its own API client and context role
 */
export default class WorkflowAgent {
    constructor(agentConfig, context, config, toolManager, snapshotManager, costsManager) {
        this.agentRole = agentConfig.agent_role;
        this.contextRole = agentConfig.role; // 'user' or 'assistant'
        this.context = context;
        this.config = config;
        this.toolManager = toolManager;
        this.snapshotManager = snapshotManager;
        this.costsManager = costsManager;
        this.logger = getLogger();

        // Generate unique agent ID
        this.id = `${this.agentRole}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize response tracking
        this.lastParsingToolCall = null;
        this.lastResponseContent = null;
        this.lastRawResponse = null; // Store raw API response for workflow access

        // Track initialization state
        this.initialized = false;

        // Create AIAPIClient instance for this agent
        this._initializeAPIClient();

        // Connect to shared context
        context.addAgent(this, agentConfig.role);

        this.logger.debug(
            `🤖 Created agent: ${this.agentRole} (${this.contextRole} in ${context.getName()})`
        );
    }

    /**
     * Initialize the API client for this agent
     * @private
     */
    _initializeAPIClient() {
        const modelConfig = this.config.getModel(SystemMessages.getLevel(this.agentRole));

        this.apiClient = new AIAPIClient(
            this.costsManager,
            modelConfig.apiKey,
            modelConfig.baseUrl,
            modelConfig.model
        );
    }

    /**
     * Ensure agent is initialized (lazy initialization)
     * @private
     */
    async _ensureInitialized() {
        if (!this.initialized) {
            await this._initializeAgent();
            this.initialized = true;
        }
    }

    /**
     * Initialize agent with role-specific system message and tools
     * @private
     */
    async _initializeAgent() {
        try {
            // Set all tools first (before setting system message to avoid double filtering)
            const allTools = this.toolManager.getTools();
            this.apiClient.setTools(allTools);

            // Set role-specific system message (this will trigger _applyToolFiltering automatically)
            const systemMessage = SystemMessages.getSystemMessage(this.agentRole);
            await this.apiClient.setSystemMessage(systemMessage, this.agentRole);

            // Set up parsing response handler ONLY if this agent has parsing tools
            const parsingTools = SystemMessages.getParsingTools(this.agentRole);
            // Set up callbacks for all agents
            const callbacks = {
                onMessagePush: this._onMessagePush.bind(this),
                onResponse: this._onResponse.bind(this),
            };

            // Add parsing response handler if this agent has parsing tools
            if (parsingTools && parsingTools.length > 0) {
                callbacks.onParseResponse = message => {
                    return this._handleParsingResponse(message);
                };
                this.logger.debug(
                    `🔧 Agent ${this.agentRole} has ${parsingTools.length} parsing tools, handler enabled`
                );
            } else {
                this.logger.debug(
                    `🔧 Agent ${this.agentRole} has no parsing tools, no handler needed`
                );
            }

            this.apiClient.setCallbacks(callbacks);

            this.logger.debug(
                `🔧 Agent ${this.agentRole} initialized with ${this.apiClient.getFilteredToolCount()}/${this.apiClient.getTotalToolCount()} tools`
            );
        } catch (error) {
            this.logger.error(error, `Failed to initialize agent: ${this.agentRole}`);
            throw error;
        }
    }

    /**
     * Send a message based on the agent's context role
     * @param {string} message - Message to send
     * @returns {Promise<string>} Response from the agent
     */
    async sendMessage(message) {
        try {
            // Ensure agent is initialized
            await this._ensureInitialized();

            this.logger.debug(
                `💬 Agent ${this.agentRole} (${this.contextRole}) sending message: "${message}"`
            );

            // Validate input message
            if (message === undefined || message === null) {
                throw new Error(`Message cannot be undefined or null for agent ${this.agentRole}`);
            }

            // Convert to string if not already
            const messageStr = String(message);
            if (messageStr.trim() === '') {
                throw new Error(`Message cannot be empty for agent ${this.agentRole}`);
            }

            // Refresh agent's message array from context before API call
            this._refreshMessagesFromContext();

            // Clear previous response content
            this.lastResponseContent = null;

            // Get AI response
            this.logger.debug(
                `📤 Agent ${this.agentRole} calling sendUserMessage with: "${messageStr}"`
            );
            await this.apiClient.sendUserMessage(messageStr);

            // Return the captured response content
            const responseContent = this.lastResponseContent || '';
            this.logger.debug(`📥 Agent ${this.agentRole} received response: "${responseContent}"`);

            return responseContent;
        } catch (error) {
            this.logger.error(
                error,
                `Agent ${this.agentRole} failed to send message: "${message}"`
            );
            throw error;
        }
    }

    /**
     * Make an API call using the current context without adding a new message
     * Used by workflow state machine when context is managed by handlers
     * @returns {Promise<string>} Response from the agent
     */
    async makeContextCall() {
        try {
            // Ensure agent is initialized
            await this._ensureInitialized();

            this.logger.debug(
                `🔍 DEBUG: makeContextCall called for agent ${this.agentRole} (${this.contextRole})`
            );

            // Refresh agent's message array from context before API call
            this._refreshMessagesFromContext();

            // Clear previous response content
            this.lastResponseContent = null;

            // Make API call without adding a new message
            this.logger.debug(`📤 Agent ${this.agentRole} calling API with context messages`);
            await this.apiClient.sendMessage();

            // Return the captured response content
            const responseContent = this.lastResponseContent || '';
            this.logger.debug(`📥 Agent ${this.agentRole} received response: "${responseContent}"`);

            return responseContent;
        } catch (error) {
            this.logger.error(error, `Agent ${this.agentRole} failed to make context call`);
            throw error;
        }
    }

    /**
     * Add a user message without getting a response
     * @param {string} message - Message to add
     */
    async addUserMessage(message) {
        try {
            // Add message to shared context with correct role based on who is "speaking"
            const messageRole = this.contextRole === 'assistant' ? 'user' : 'assistant';
            const messageObj = { role: messageRole, content: message };
            this.context.addMessage(messageObj, this);
            this.logger.debug(
                `💬 Agent ${this.agentRole} added ${messageRole} message to shared context`
            );
        } catch (error) {
            this.logger.error(error, `Agent ${this.agentRole} failed to add user message`);
            throw error;
        }
    }

    /**
     * Clear the conversation history
     */
    async clearConversation() {
        try {
            await this.apiClient.clearConversation();
            this.logger.debug(`🗑️ Agent ${this.agentRole} cleared conversation`);
        } catch (error) {
            this.logger.error(error, `Agent ${this.agentRole} failed to clear conversation`);
            throw error;
        }
    }

    /**
     * Get tool calls from the last response
     * @returns {Array} Array of tool call objects
     */
    getToolCalls() {
        const messages = this.context.getMessages();
        const lastMessage = messages[messages.length - 1];
        return lastMessage?.tool_calls || [];
    }

    /**
     * Get parsing tool calls from the last response
     * @returns {Array} Array of parsing tool call objects
     */
    getParsingToolCalls() {
        // Return the stored parsing tool call if available
        if (this.lastParsingToolCall) {
            return [this.lastParsingToolCall];
        }

        // Fallback to checking context messages
        const toolCalls = this.getToolCalls();
        return toolCalls.filter(call => {
            // Check if this is a parsing tool based on the role configuration
            const parsingTools = SystemMessages.getParsingTools(this.agentRole);
            return parsingTools.some(tool => tool.function.name === call.function.name);
        });
    }

    /**
     * Get the last response from this agent
     * @returns {string|null} Last response content or null
     */
    getLastResponse() {
        const messages = this.context.getMessages();

        // Find the last assistant message (which would be from this agent if it's an assistant)
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === 'assistant') {
                return message.content;
            }
        }

        return null;
    }

    /**
     * Set the messages array for this agent (used by context) - DEPRECATED
     * This method is kept for compatibility but should not be used
     * Use _refreshMessagesFromContext() instead
     * @param {Array} _messages - Messages array from context (unused)
     */
    setMessages(_messages) {
        this.logger.debug(`⚠️ Agent ${this.agentRole} setMessages() called - this is deprecated`);
        // Don't do anything - messages should be refreshed from context dynamically
    }

    /**
     * Refresh agent's message array from shared context with proper role mapping
     * @private
     */
    _refreshMessagesFromContext() {
        const agentMessages = this.context.getMessagesForAgent(this.id);
        this.apiClient.messages = agentMessages;

        this.logger.debug(
            `🔄 Agent ${this.agentRole} refreshed ${agentMessages.length} messages from context`
        );
    }

    /**
     * Handle message push from API client to sync with shared context
     * @private
     * @param {Object} message - Message that was pushed to API client
     */
    _onMessagePush(message) {
        try {
            // Skip system messages as they shouldn't be in shared context
            if (message.role === 'system') {
                return;
            }

            // Skip messages with empty content
            if (!message.content || message.content.trim() === '') {
                return;
            }

            // In the new workflow pattern, message syncing is handled by script functions
            // Disable automatic syncing to prevent duplication
            this.logger.debug(
                `💬 Agent ${this.agentRole} skipping automatic message sync - handled by workflow scripts`
            );
        } catch (error) {
            this.logger.error(error, `Agent ${this.agentRole} failed to handle message push`);
        }
    }

    /**
     * Handle response from API client to capture content for workflow system
     * @private
     * @param {Object} response - API response object
     * @param {string} _role - Agent role (unused)
     */
    _onResponse(response, _role) {
        try {
            // Store the raw response for workflow script access
            this.lastRawResponse = response;

            // Extract the content from the response
            const message = response.choices?.[0]?.message;
            if (message && message.content) {
                this.lastResponseContent = message.content;
                this.logger.debug(
                    `📝 Agent ${this.agentRole} captured response content: "${message.content}"`
                );
            }
        } catch (error) {
            this.logger.error(error, `Agent ${this.agentRole} failed to capture response content`);
        }
    }

    /**
     * Get the last raw API response
     * @returns {Object|null} Last raw API response or null
     */
    getLastRawResponse() {
        return this.lastRawResponse;
    }

    /**
     * Get agent role name
     * @returns {string} Agent role name
     */
    getRole() {
        return this.agentRole;
    }

    /**
     * Get context role (user/assistant)
     * @returns {string} Context role
     */
    getContextRole() {
        return this.contextRole;
    }

    /**
     * Get unique agent ID
     * @returns {string} Agent ID
     */
    getId() {
        return this.id;
    }

    /**
     * Get agent statistics
     * @returns {Object} Agent statistics
     */
    getStats() {
        return {
            id: this.id,
            agentRole: this.agentRole,
            contextRole: this.contextRole,
            contextName: this.context.getName(),
            toolCount: this.apiClient.getFilteredToolCount(),
            totalToolCount: this.apiClient.getTotalToolCount(),
            model: this.apiClient.getModel(),
        };
    }

    /**
     * Export agent data for serialization
     * @returns {Object} Serializable agent data
     */
    export() {
        return {
            id: this.id,
            agentRole: this.agentRole,
            contextRole: this.contextRole,
            contextName: this.context.getName(),
            stats: this.getStats(),
        };
    }

    /**
     * Check if agent has any tool calls in the last response
     * @returns {boolean} True if agent has tool calls
     */
    hasToolCalls() {
        return this.getToolCalls().length > 0;
    }

    /**
     * Check if agent has any parsing tool calls in the last response
     * @returns {boolean} True if agent has parsing tool calls
     */
    hasParsingToolCalls() {
        return this.getParsingToolCalls().length > 0;
    }

    /**
     * Get the context this agent is connected to
     * @returns {WorkflowContext} Context instance
     */
    getContext() {
        return this.context;
    }

    /**
     * Handle parsing tool responses for workflow state transitions
     * @private
     * @param {Object} message - AI message with parsing tool calls
     * @returns {Object} Parsing result
     */
    _handleParsingResponse(message) {
        try {
            const toolCalls = message.tool_calls || [];
            const parsingTools = SystemMessages.getParsingTools(this.agentRole);
            const parsingToolNames = parsingTools.map(tool => tool.function.name);

            // Find parsing tool calls
            const parsingToolCalls = toolCalls.filter(call =>
                parsingToolNames.includes(call.function.name)
            );

            if (parsingToolCalls.length === 0) {
                return {
                    success: false,
                    error: 'No parsing tool calls found in response',
                };
            }

            if (parsingToolCalls.length > 1) {
                return {
                    success: false,
                    error: 'Multiple parsing tool calls not supported',
                };
            }

            const toolCall = parsingToolCalls[0];
            let parsedArguments;

            try {
                parsedArguments = JSON.parse(toolCall.function.arguments);
            } catch (parseError) {
                return {
                    success: false,
                    error: `Failed to parse tool arguments: ${parseError.message}`,
                };
            }

            // Store the parsed tool call for workflow state machine access
            this.lastParsingToolCall = {
                function: {
                    name: toolCall.function.name,
                    arguments: parsedArguments,
                },
            };

            this.logger.debug(
                `🔧 Agent ${this.agentRole} parsed tool call: ${toolCall.function.name}`,
                parsedArguments
            );

            // Return success with the content (if any) from the tool call
            return {
                success: true,
                content: message.content || '',
            };
        } catch (error) {
            this.logger.error(
                error,
                `Failed to handle parsing response for agent ${this.agentRole}`
            );
            return {
                success: false,
                error: `Parsing handler error: ${error.message}`,
            };
        }
    }
}
