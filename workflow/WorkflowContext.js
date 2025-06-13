import { getLogger } from '../logger.js';

/**
 * Manages conversation context for workflow agents
 */
export default class WorkflowContext {
    constructor(contextConfig) {
        this.name = contextConfig.name;
        this.messages = [...(contextConfig.starting_messages || [])];
        this.maxLength = contextConfig.max_length || 50000;
        this.agents = new Map(); // Map of agent ID to {agent, role}
        this.logger = getLogger();

        this.logger.debug(`📝 Created context: ${this.name} (max length: ${this.maxLength})`);
    }

    /**
     * Add an agent to this context
     * @param {WorkflowAgent} agent - Agent instance
     * @param {string} role - Role of agent in context ('user' or 'assistant')
     */
    addAgent(agent, role) {
        this.agents.set(agent.getId(), { agent, role });

        // Share the actual message array for true context sharing
        agent.setMessages(this.messages);

        this.logger.debug(`👤 Added agent ${agent.getRole()} as ${role} to context ${this.name}`);
    }

    /**
     * Remove an agent from this context
     * @param {WorkflowAgent} agent - Agent instance
     */
    removeAgent(agent) {
        this.agents.delete(agent.getId());
        this.logger.debug(`👤 Removed agent ${agent.getRole()} from context ${this.name}`);
    }

    /**
     * Add a message to the context
     * @param {Object} message - Message object with role and content
     * @param {WorkflowAgent} fromAgent - Agent that sent the message (optional)
     */
    addMessage(message, fromAgent = null) {
        // Validate message structure
        if (!message || !message.role || !message.content) {
            throw new Error('Invalid message: must have role and content');
        }

        // Add message to shared context
        this.messages.push(message);

        // Log the message addition
        const agentInfo = fromAgent ? ` from ${fromAgent.getRole()}` : '';
        this.logger.debug(`💬 Added ${message.role} message to context ${this.name}${agentInfo}`);

        // Trim context if it exceeds max length
        if (this._getContextLength() > this.maxLength) {
            this._trimContext();
        }
    }

    /**
     * Get all messages in the context
     * @returns {Array} Array of message objects
     */
    getMessages() {
        return [...this.messages]; // Return a copy
    }

    /**
     * Get the last message in the context
     * @returns {Object|null} Last message or null if no messages
     */
    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    /**
     * Get messages from a specific role
     * @param {string} role - Message role ('user', 'assistant', 'system')
     * @returns {Array} Array of messages from the specified role
     */
    getMessagesByRole(role) {
        return this.messages.filter(msg => msg.role === role);
    }

    /**
     * Clear all messages from the context
     */
    clearMessages() {
        const messageCount = this.messages.length;
        this.messages.length = 0; // Clear the array while maintaining reference
        this.logger.debug(`🗑️ Cleared ${messageCount} messages from context ${this.name}`);
    }

    /**
     * Get context statistics
     * @returns {Object} Context statistics
     */
    getStats() {
        return {
            name: this.name,
            messageCount: this.messages.length,
            contextLength: this._getContextLength(),
            maxLength: this.maxLength,
            agentCount: this.agents.size,
            agents: Array.from(this.agents.values()).map(({ agent, role }) => ({
                agentRole: agent.getRole(),
                contextRole: role,
            })),
        };
    }

    /**
     * Get the total character length of all messages
     * @private
     * @returns {number} Total character length
     */
    _getContextLength() {
        return this.messages.reduce((total, msg) => {
            const contentLength = typeof msg.content === 'string' ? msg.content.length : 0;
            return total + contentLength;
        }, 0);
    }

    /**
     * Trim context to stay within max length limit
     * @private
     */
    _trimContext() {
        const originalLength = this.messages.length;

        // Keep system messages and recent messages within limit
        const systemMessages = this.messages.filter(msg => msg.role === 'system');
        const otherMessages = this.messages.filter(msg => msg.role !== 'system');

        // Remove oldest non-system messages until we're under the limit
        while (this._getContextLength() > this.maxLength && otherMessages.length > 10) {
            otherMessages.shift(); // Remove oldest non-system message
        }

        // Reconstruct the messages array
        this.messages.length = 0; // Clear while maintaining reference
        this.messages.push(...systemMessages, ...otherMessages);

        const removedCount = originalLength - this.messages.length;
        if (removedCount > 0) {
            this.logger.debug(
                `✂️ Trimmed ${removedCount} messages from context ${this.name} (length: ${this._getContextLength()}/${this.maxLength})`
            );
        }
    }

    /**
     * Export context data for serialization
     * @returns {Object} Serializable context data
     */
    export() {
        return {
            name: this.name,
            messages: this.getMessages(),
            maxLength: this.maxLength,
            stats: this.getStats(),
        };
    }

    /**
     * Import context data from serialized format
     * @param {Object} data - Serialized context data
     */
    import(data) {
        if (data.name !== this.name) {
            throw new Error(`Context name mismatch: expected ${this.name}, got ${data.name}`);
        }

        this.messages.length = 0; // Clear existing messages
        this.messages.push(...(data.messages || []));

        if (data.maxLength) {
            this.maxLength = data.maxLength;
        }

        this.logger.debug(`📥 Imported ${this.messages.length} messages to context ${this.name}`);
    }

    /**
     * Get context name
     * @returns {string} Context name
     */
    getName() {
        return this.name;
    }

    /**
     * Check if context has any messages
     * @returns {boolean} True if context has messages
     */
    hasMessages() {
        return this.messages.length > 0;
    }

    /**
     * Get agents in this context
     * @returns {Array} Array of agent information
     */
    getAgents() {
        return Array.from(this.agents.values()).map(({ agent, role }) => ({
            agent,
            role,
            agentRole: agent.getRole(),
        }));
    }
}
