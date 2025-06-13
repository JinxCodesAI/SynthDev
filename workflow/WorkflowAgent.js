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
            // Set role-specific system message
            const systemMessage = SystemMessages.getSystemMessage(this.agentRole);
            await this.apiClient.setSystemMessage(systemMessage, this.agentRole);

            // Apply role-based tool filtering
            const allTools = this.toolManager.getTools();
            const excludedTools = SystemMessages.getExcludedTools(this.agentRole);
            const agentTools = allTools.filter(
                tool => !excludedTools.includes(tool.function?.name || tool.name)
            );
            this.apiClient.setTools(agentTools);

            this.logger.debug(
                `🔧 Agent ${this.agentRole} initialized with ${agentTools.length}/${allTools.length} tools`
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
            if (this.contextRole === 'user') {
                // Agent acts as user in the context
                const response = await this.apiClient.sendUserMessage(message);
                this.logger.debug(
                    `💬 Agent ${this.agentRole} sent user message and received response`
                );
                return response;
            } else {
                // Agent acts as assistant - add assistant message directly
                const assistantMessage = { role: 'assistant', content: message };
                this.context.addMessage(assistantMessage, this);
                this.logger.debug(`💬 Agent ${this.agentRole} added assistant message`);
                return message;
            }
        } catch (error) {
            this.logger.error(error, `Agent ${this.agentRole} failed to send message`);
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
        this.apiClient.messages = messages;
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
}
