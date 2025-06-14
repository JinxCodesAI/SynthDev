import AIAPIClient from '../aiAPIClient.js';
import SystemMessages from '../systemMessages.js';
import { getLogger } from '../logger.js';

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

        // Create AIAPIClient instance for this agent
        this._initializeAPIClient();

        // Initialize agent with role-specific settings
        this._initializeAgent();

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
            if (parsingTools && parsingTools.length > 0) {
                this.apiClient.setCallbacks({
                    onParseResponse: message => {
                        return this._handleParsingResponse(message);
                    },
                });
                this.logger.debug(
                    `🔧 Agent ${this.agentRole} has ${parsingTools.length} parsing tools, handler enabled`
                );
            } else {
                this.logger.debug(
                    `🔧 Agent ${this.agentRole} has no parsing tools, no handler needed`
                );
            }

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

            // For workflow agents, we always call sendUserMessage to get AI response
            // The contextRole determines how the conversation history is presented to the AI
            this.logger.debug(
                `📤 Agent ${this.agentRole} calling sendUserMessage with: "${messageStr}"`
            );
            const response = await this.apiClient.sendUserMessage(messageStr);
            this.logger.debug(`📥 Agent ${this.agentRole} received response: "${response}"`);
            return response;
        } catch (error) {
            this.logger.error(
                error,
                `Agent ${this.agentRole} failed to send message: "${message}"`
            );
            throw error;
        }
    }

    /**
     * Add a user message without getting a response
     * @param {string} message - Message to add
     */
    async addUserMessage(message) {
        try {
            await this.apiClient.addUserMessage(message);
            this.logger.debug(`💬 Agent ${this.agentRole} added user message`);
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
     * Set the messages array for this agent (used by context)
     * @param {Array} messages - Messages array from context
     */
    setMessages(messages) {
        if (this.contextRole === 'user') {
            // For agents with contextRole 'user', reverse user/assistant roles
            // This makes the agent see the conversation from the user's perspective
            const reversedMessages = messages.map(msg => {
                if (msg.role === 'user') {
                    return { ...msg, role: 'assistant' };
                } else if (msg.role === 'assistant') {
                    return { ...msg, role: 'user' };
                } else {
                    return msg; // Keep system messages as-is
                }
            });
            this.apiClient.messages = reversedMessages;
            this.logger.debug(
                `🔄 Agent ${this.agentRole} (contextRole: user) using reversed message roles`
            );
        } else {
            // For agents with contextRole 'assistant', use messages as-is
            this.apiClient.messages = messages;
            this.logger.debug(
                `➡️ Agent ${this.agentRole} (contextRole: assistant) using original message roles`
            );
        }
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
