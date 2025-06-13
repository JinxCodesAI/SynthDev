import { existsSync } from 'fs';
import { platform } from 'os';
import { getConfigurationLoader } from './configurationLoader.js';

/**
 * System messages and role configurations for different AI personas
 * Loads role definitions from external configuration files
 */
class SystemMessages {
    constructor() {
        this.configLoader = getConfigurationLoader();
        this._environmentInfo = null;
        this._rolesConfig = null;
        this._environmentTemplate = null;
    }

    /**
     * Load role configurations from external files
     * @private
     */
    _loadRolesConfig() {
        if (this._rolesConfig) {
            return this._rolesConfig;
        }

        // Load roles from configuration file (required)
        this._rolesConfig = this.configLoader.loadConfig('roles/roles.json', {}, true);
        return this._rolesConfig;
    }

    /**
     * Load environment template configuration
     * @private
     */
    _loadEnvironmentTemplate() {
        if (this._environmentTemplate) {
            return this._environmentTemplate;
        }

        // Load environment template from configuration file (required)
        this._environmentTemplate = this.configLoader.loadConfig(
            'roles/environment-template.json',
            {},
            true
        );
        return this._environmentTemplate;
    }

    /**
     * Get all role configurations
     * @returns {Object} Role configurations object
     */
    get roles() {
        return this._loadRolesConfig();
    }

    /**
     * Generate environment information string
     * @private
     * @returns {string} Environment information
     */
    _generateEnvironmentInfo() {
        if (this._environmentInfo) {
            return this._environmentInfo;
        }

        const template = this._loadEnvironmentTemplate();
        const os = platform();
        const cwd = process.cwd();
        const indexExists = existsSync('.index');
        const currentDateTime = new Date().toLocaleString();

        // Replace template variables
        this._environmentInfo = template.template
            .replace('{os}', os)
            .replace('{cwd}', cwd)
            .replace('{indexExists}', indexExists ? 'Yes' : 'No')
            .replace('{currentDateTime}', currentDateTime);

        return this._environmentInfo;
    }

    /**
     * Get system message for a specific role
     * @param {string} role - The role name (coder, reviewer, architect)
     * @returns {string} The system message for the role
     */
    static getSystemMessage(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        // Append environment information to the system message
        const environmentInfo = instance._generateEnvironmentInfo();
        return roleConfig.systemMessage + environmentInfo;
    }

    /**
     * Get excluded tools for a specific role
     * @param {string} role - The role name (coder, reviewer, architect)
     * @returns {string[]} Array of tool names to exclude
     */
    static getExcludedTools(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        return roleConfig.excludedTools || [];
    }

    /**
     * Check if a tool matches an exclusion pattern
     * Supports:
     * - Exact string matching (backward compatibility)
     * - Wildcard patterns using * (e.g., "*file" matches "read_file", "write_file")
     * - Regular expression patterns enclosed in forward slashes (e.g., "/^(read|write)_/")
     * @private
     * @param {string} toolName - The tool name to check
     * @param {string} pattern - The exclusion pattern
     * @returns {boolean} True if the tool matches the pattern
     */
    static _matchesExclusionPattern(toolName, pattern) {
        if (toolName === undefined || toolName === null || !pattern) {
            return false;
        }

        // Exact string match (backward compatibility)
        if (toolName === pattern) {
            return true;
        }

        // Regular expression pattern (enclosed in forward slashes)
        if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
            try {
                const lastSlashIndex = pattern.lastIndexOf('/');
                const regexPattern = pattern.slice(1, lastSlashIndex);
                const flags = pattern.slice(lastSlashIndex + 1);
                const regex = new RegExp(regexPattern, flags);
                return regex.test(toolName);
            } catch (_error) {
                // Invalid regex - treat as literal string
                return toolName === pattern;
            }
        }

        // Wildcard pattern using *
        if (pattern.includes('*')) {
            // Convert wildcard pattern to regex
            // Escape special regex characters except *
            const escapedPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*');

            try {
                const regex = new RegExp(`^${escapedPattern}$`);
                return regex.test(toolName);
            } catch (_error) {
                // Invalid pattern - treat as literal string
                return toolName === pattern;
            }
        }

        // No pattern match
        return false;
    }

    /**
     * Check if a tool should be excluded for a specific role
     * Uses pattern matching to support wildcards and regular expressions
     * @param {string} role - The role name
     * @param {string} toolName - The tool name to check
     * @returns {boolean} True if the tool should be excluded
     */
    static isToolExcluded(role, toolName) {
        const excludedPatterns = SystemMessages.getExcludedTools(role);

        return excludedPatterns.some(pattern =>
            SystemMessages._matchesExclusionPattern(toolName, pattern)
        );
    }

    /**
     * Get role-specific tools for a specific role
     * @param {string} role - The role name (coder, reviewer, architect, prompt_enhancer)
     * @returns {Array} Array of role-specific tool definitions
     */
    static getParsingTools(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        return roleConfig.parsingTools || [];
    }

    /**
     * Get parsing-only tools for a specific role (tools that should not be executed)
     * @param {string} role - The role name
     * @returns {string[]} Array of tool names that are parsing-only
     */

    /**
     * Get all available roles
     * @returns {string[]} Array of available role names
     */
    static getAvailableRoles() {
        const instance = new SystemMessages();
        return Object.keys(instance.roles);
    }

    /**
     * Get the model level for a specific role
     * @param {string} role - The role name (coder, reviewer, architect, dude)
     * @returns {string} The model level ('base', 'smart', 'fast')
     */
    static getLevel(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        return roleConfig.level || 'base';
    }

    /**
     * Get reminder message for a specific role
     * @param {string} role - The role name (coder, reviewer, architect, dude)
     * @returns {string} The reminder message for the role
     */
    static getReminder(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        return roleConfig.reminder || '';
    }

    /**
     * Get examples for a specific role (for few-shot prompting)
     * @param {string} role - The role name
     * @returns {Array} Array of example messages for few-shot prompting
     */
    static getExamples(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        return roleConfig.examples || [];
    }

    /**
     * Check if a role exists
     * @param {string} role - The role name to check
     * @returns {boolean} True if role exists
     */
    static hasRole(role) {
        const instance = new SystemMessages();
        return role in instance.roles;
    }

    /**
     * Reload role configurations (clears cache)
     */
    static reloadRoles() {
        const instance = new SystemMessages();
        instance._rolesConfig = null;
        instance._environmentTemplate = null;
        instance._environmentInfo = null;
        instance.configLoader.clearCache();
    }
}

export default SystemMessages;
