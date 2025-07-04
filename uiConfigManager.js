import { getConfigurationLoader } from './src/config/validation/configurationLoader.js';
import ConfigManager from './configManager.js';

/**
 * UI Configuration Manager
 * Manages user interface text and messages from external configuration files
 */
class UIConfigManager {
    constructor() {
        this.configLoader = getConfigurationLoader();
        this._consoleMessages = null;
        this._commandHelp = null;
    }

    /**
     * Load console messages configuration
     * @private
     */
    _loadConsoleMessages() {
        if (this._consoleMessages) {
            return this._consoleMessages;
        }

        // Load console messages from configuration file (required)
        this._consoleMessages = this.configLoader.loadConfig('ui/console-messages.json', {}, true);
        return this._consoleMessages;
    }

    /**
     * Load command help configuration
     * @private
     */
    _loadCommandHelp() {
        if (this._commandHelp) {
            return this._commandHelp;
        }

        // Load command help from configuration file (required)
        this._commandHelp = this.configLoader.loadConfig('ui/command-help.json', {}, true);
        return this._commandHelp;
    }

    /**
     * Get a console message with optional parameter substitution
     * @param {string} path - Dot-separated path to the message (e.g., 'startup.title')
     * @param {Object} params - Parameters for message substitution
     * @returns {string} The formatted message
     */
    getMessage(path, params = {}) {
        const messages = this._loadConsoleMessages();

        // Override prompt prefix with application config
        if (path === 'prompts.user') {
            const configManager = ConfigManager.getInstance();
            const config = configManager.getConfig();
            return config.ui.promptPrefix;
        }

        const message = this._getNestedValue(messages, path);

        if (!message) {
            return `[Missing message: ${path}]`;
        }

        return this._formatMessage(message, params);
    }

    /**
     * Get command help text
     * @param {string} command - Command name (optional, returns all if not specified)
     * @returns {string|Object} Help text or help object
     */
    getCommandHelp(command = null) {
        const help = this._loadCommandHelp();

        if (command) {
            return help.help?.commands?.[command] || `[No help available for: ${command}]`;
        }

        return help;
    }

    /**
     * Get CLI help text
     * @returns {Object} CLI help configuration
     */
    getCliHelp() {
        const help = this._loadCommandHelp();
        return help.cli_help || {};
    }

    /**
     * Get startup messages
     * @returns {Object} Startup message configuration
     */
    getStartupMessages() {
        const messages = this._loadConsoleMessages();
        return messages.startup || {};
    }

    /**
     * Get error messages
     * @returns {Object} Error message configuration
     */
    getErrorMessages() {
        const messages = this._loadConsoleMessages();
        return messages.errors || {};
    }

    /**
     * Get a nested value from an object using dot notation
     * @private
     * @param {Object} obj - Object to search
     * @param {string} path - Dot-separated path
     * @returns {*} The value at the path
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
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
     * Reload UI configurations (clears cache)
     */
    reloadConfigs() {
        this._consoleMessages = null;
        this._commandHelp = null;
        this.configLoader.clearCache();
    }
}

// Export singleton instance
let uiConfigManagerInstance = null;

/**
 * Get the singleton UIConfigManager instance
 * @returns {UIConfigManager} UIConfigManager instance
 */
export function getUIConfigManager() {
    if (!uiConfigManagerInstance) {
        uiConfigManagerInstance = new UIConfigManager();
    }
    return uiConfigManagerInstance;
}

export default UIConfigManager;
