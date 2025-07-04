import { getConfigurationLoader } from '../validation/configurationLoader.js';

/**
 * Tool Configuration Manager
 * Manages tool-related configuration including safety patterns and messages
 */
class ToolConfigManager {
    constructor() {
        this.configLoader = getConfigurationLoader();
        this._safetyPatterns = null;
        this._toolMessages = null;
    }

    /**
     * Load safety patterns configuration
     * @private
     */
    _loadSafetyPatterns() {
        if (this._safetyPatterns) {
            return this._safetyPatterns;
        }

        // Load safety patterns from configuration file (required)
        this._safetyPatterns = this.configLoader.loadConfig('tools/safety-patterns.json', {}, true);
        return this._safetyPatterns;
    }

    /**
     * Load tool messages configuration
     * @private
     */
    _loadToolMessages() {
        if (this._toolMessages) {
            return this._toolMessages;
        }

        // Load tool messages from configuration file (required)
        this._toolMessages = this.configLoader.loadConfig('tools/tool-messages.json', {}, true);
        return this._toolMessages;
    }

    /**
     * Get AI safety prompt for script validation
     * @param {string} script - Script to validate
     * @returns {string} Formatted safety prompt
     */
    getSafetyPrompt(script) {
        const patterns = this._loadSafetyPatterns();
        return patterns.ai_safety_prompt.replace('{script}', script);
    }

    /**
     * Get dangerous patterns for script validation
     * @returns {Array} Array of dangerous pattern objects
     */
    getDangerousPatterns() {
        const patterns = this._loadSafetyPatterns();
        return patterns.dangerous_patterns.map(p => ({
            pattern: new RegExp(p.pattern, 'i'),
            reason: p.reason,
        }));
    }

    /**
     * Get safety limits configuration
     * @returns {Object} Safety limits object
     */
    getSafetyLimits() {
        const patterns = this._loadSafetyPatterns();
        return patterns.limits;
    }

    /**
     * Get a tool error message with parameter substitution
     * @param {string} errorKey - Error message key
     * @param {Object} params - Parameters for substitution
     * @returns {string} Formatted error message
     */
    getErrorMessage(errorKey, params = {}) {
        const messages = this._loadToolMessages();
        const safetyPatterns = this._loadSafetyPatterns();

        // Check in tool messages first, then safety patterns
        const message =
            messages.common_errors?.[errorKey] || safetyPatterns.error_messages?.[errorKey];

        if (!message) {
            return `[Unknown error: ${errorKey}]`;
        }

        return this._formatMessage(message, params);
    }

    /**
     * Get a tool validation message with parameter substitution
     * @param {string} validationKey - Validation message key
     * @param {Object} params - Parameters for substitution
     * @returns {string} Formatted validation message
     */
    getValidationMessage(validationKey, params = {}) {
        const messages = this._loadToolMessages();

        const message = messages.validation_messages?.[validationKey];

        if (!message) {
            return `[Unknown validation: ${validationKey}]`;
        }

        return this._formatMessage(message, params);
    }

    /**
     * Get a success message with parameter substitution
     * @param {string} messageKey - Success message key
     * @param {Object} params - Parameters for substitution
     * @returns {string} Formatted success message
     */
    getSuccessMessage(messageKey, params = {}) {
        const messages = this._loadToolMessages();
        const message = messages.success_messages?.[messageKey];

        if (!message) {
            return `[Unknown success message: ${messageKey}]`;
        }

        return this._formatMessage(message, params);
    }

    /**
     * Get tool description
     * @param {string} toolName - Tool name
     * @returns {string} Tool description
     */
    getToolDescription(toolName) {
        const messages = this._loadToolMessages();
        return messages.tool_descriptions?.[toolName] || `Tool: ${toolName}`;
    }

    /**
     * Get parameter description
     * @param {string} paramName - Parameter name
     * @returns {string} Parameter description
     */
    getParameterDescription(paramName) {
        const messages = this._loadToolMessages();
        return messages.parameter_descriptions?.[paramName] || `Parameter: ${paramName}`;
    }

    /**
     * Format a message with parameter substitution
     * @private
     * @param {string} message - Message template
     * @param {Object} params - Parameters for substitution
     * @returns {string} Formatted message
     */
    _formatMessage(message, params) {
        if (typeof message !== 'string') {
            return message;
        }

        return message.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * Reload tool configurations (clears cache)
     */
    reloadConfigs() {
        this._safetyPatterns = null;
        this._toolMessages = null;
        this.configLoader.clearCache();
    }
}

// Export singleton instance
let toolConfigManagerInstance = null;

/**
 * Get the singleton ToolConfigManager instance
 * @returns {ToolConfigManager} ToolConfigManager instance
 */
export function getToolConfigManager() {
    if (!toolConfigManagerInstance) {
        toolConfigManagerInstance = new ToolConfigManager();
    }
    return toolConfigManagerInstance;
}

export default ToolConfigManager;
