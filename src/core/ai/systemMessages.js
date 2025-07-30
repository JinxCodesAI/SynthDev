import { existsSync } from 'fs';
import { platform } from 'os';
import { getConfigurationLoader } from '../../config/validation/configurationLoader.js';

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

        // Load roles from multiple files in the roles directory
        const rolesData = this.configLoader.loadRolesFromDirectory('roles');

        // Extract roles and groups from the new structure
        this._rolesConfig = rolesData.roles || rolesData; // Backward compatibility
        this._roleGroups = rolesData.roleGroups || {};

        // Ensure we have at least some roles loaded
        if (!this._rolesConfig || Object.keys(this._rolesConfig).length === 0) {
            throw new Error(
                'No roles found in roles directory. At least one role configuration file is required.'
            );
        }

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

        // Try to load from new location first, then fall back to old location for backward compatibility
        try {
            this._environmentTemplate = this.configLoader.loadConfig(
                'defaults/environment-template.json',
                {},
                true
            );
        } catch (error) {
            // Fall back to old location for backward compatibility
            try {
                this._environmentTemplate = this.configLoader.loadConfig(
                    'roles/environment-template.json',
                    {},
                    true
                );
                // Log deprecation warning
                console.warn(
                    'DEPRECATION WARNING: environment-template.json should be moved from config/roles/ to config/defaults/'
                );
            } catch (fallbackError) {
                throw new Error(
                    `Failed to load environment template from both new location (defaults/environment-template.json) and old location (roles/environment-template.json): ${error.message}`
                );
            }
        }

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
     * Get included tools for a specific role
     * @param {string} role - The role name (coder, reviewer, architect)
     * @returns {string[]} Array of tool names to include
     */
    static getIncludedTools(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        const includedTools = [...(roleConfig.includedTools || [])];
        const excludedTools = roleConfig.excludedTools || [];

        // Automatically add agentic tools if enabled_agents is an array (even empty)
        if (Array.isArray(roleConfig.enabled_agents)) {
            const agenticTools = ['spawn_agent', 'speak_to_agent', 'get_agents'];
            agenticTools.forEach(tool => {
                // Add tool if not already included and not explicitly excluded
                if (!includedTools.includes(tool) && !excludedTools.includes(tool)) {
                    includedTools.push(tool);
                }
            });
        }

        // Automatically add task tools if can_create_tasks_for is a non-empty array
        if (
            Array.isArray(roleConfig.can_create_tasks_for) &&
            roleConfig.can_create_tasks_for.length > 0
        ) {
            const taskTools = ['list_tasks', 'edit_tasks', 'get_task'];
            taskTools.forEach(tool => {
                // Add tool if not already included and not explicitly excluded
                if (!includedTools.includes(tool) && !excludedTools.includes(tool)) {
                    includedTools.push(tool);
                }
            });
        }

        return includedTools;
    }

    /**
     * Validate that includedTools and excludedTools are mutually exclusive
     * @param {string} role - The role name
     * @throws {Error} If both includedTools and excludedTools are present
     * @private
     */
    static _validateToolConfiguration(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        const hasIncludedTools = roleConfig.includedTools && roleConfig.includedTools.length > 0;
        const hasExcludedTools = roleConfig.excludedTools && roleConfig.excludedTools.length > 0;

        if (hasIncludedTools && hasExcludedTools) {
            throw new Error(
                `Role '${role}' cannot have both 'includedTools' and 'excludedTools' properties. They are mutually exclusive.`
            );
        }
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
     * Check if a tool should be included for a specific role
     * Uses pattern matching to support wildcards and regular expressions
     * @param {string} role - The role name
     * @param {string} toolName - The tool name to check
     * @returns {boolean} True if the tool should be included
     */
    static isToolIncluded(role, toolName) {
        // Validate configuration first
        SystemMessages._validateToolConfiguration(role);

        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];
        const includedPatterns = SystemMessages.getIncludedTools(role);
        const excludedPatterns = SystemMessages.getExcludedTools(role);

        // Check if includedTools property exists (even if empty)
        const hasIncludedToolsProperty = roleConfig.hasOwnProperty('includedTools');
        // Check if excludedTools property exists (even if empty)
        const hasExcludedToolsProperty = roleConfig.hasOwnProperty('excludedTools');

        // If includedTools property exists, use inclusion logic
        if (hasIncludedToolsProperty) {
            return includedPatterns.some(pattern =>
                SystemMessages._matchesExclusionPattern(toolName, pattern)
            );
        }

        // If excludedTools property exists, use exclusion logic
        if (hasExcludedToolsProperty) {
            return !excludedPatterns.some(pattern =>
                SystemMessages._matchesExclusionPattern(toolName, pattern)
            );
        }

        // If neither property present, default to no tools available (includedTools: [])
        return false;
    }

    /**
     * Check if a tool should be excluded for a specific role
     * Uses pattern matching to support wildcards and regular expressions
     * @param {string} role - The role name
     * @param {string} toolName - The tool name to check
     * @returns {boolean} True if the tool should be excluded
     * @deprecated Use isToolIncluded() instead for more comprehensive logic
     */
    static isToolExcluded(role, toolName) {
        return !SystemMessages.isToolIncluded(role, toolName);
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
     * Get all available role groups
     * @returns {string[]} Array of available group names
     */
    static getAvailableGroups() {
        const instance = new SystemMessages();
        instance._loadRolesConfig(); // Ensure groups are loaded
        return Object.keys(instance._roleGroups || {});
    }

    /**
     * Get roles by group
     * @param {string} group - The group name ('global', 'testing', etc.)
     * @returns {string[]} Array of role names in the group
     */
    static getRolesByGroup(group) {
        const instance = new SystemMessages();
        instance._loadRolesConfig(); // Ensure groups are loaded
        return instance._roleGroups[group] || [];
    }

    /**
     * Get the group for a specific role
     * @param {string} role - The role name
     * @returns {string} The group name for the role
     */
    static getRoleGroup(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];
        return roleConfig?._group || 'global';
    }

    /**
     * Resolve a role name that might include a group prefix
     * @param {string} roleSpec - Role specification (e.g., 'coder' or 'testing.dude')
     * @returns {Object} Object with {roleName, group, found}
     */
    static resolveRole(roleSpec) {
        const instance = new SystemMessages();

        // Check if roleSpec contains a group prefix
        if (roleSpec.includes('.')) {
            const [group, roleName] = roleSpec.split('.', 2);

            // Check if role exists in the specified group
            const rolesInGroup = SystemMessages.getRolesByGroup(group);
            if (rolesInGroup.includes(roleName)) {
                return { roleName, group, found: true };
            }

            return { roleName, group, found: false };
        } else {
            // No group specified, look in global first, then any group
            const globalRoles = SystemMessages.getRolesByGroup('global');
            if (globalRoles.includes(roleSpec)) {
                return { roleName: roleSpec, group: 'global', found: true };
            }

            // Check if role exists in any group
            if (instance.roles[roleSpec]) {
                const group = SystemMessages.getRoleGroup(roleSpec);
                return { roleName: roleSpec, group, found: true };
            }

            return { roleName: roleSpec, group: 'global', found: false };
        }
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
     * Get enabled agents for a specific role
     * @param {string} role - The role name
     * @returns {string[]} Array of role names this role can spawn
     */
    static getEnabledAgents(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(`Unknown role: ${role}`);
        }

        return roleConfig.enabled_agents || [];
    }

    /**
     * Check if a role can spawn another role
     * @param {string} supervisorRole - The supervisor role name
     * @param {string} workerRole - The worker role name to spawn
     * @returns {boolean} True if spawning is allowed
     */
    static canSpawnAgent(supervisorRole, workerRole) {
        const enabledAgents = SystemMessages.getEnabledAgents(supervisorRole);
        return enabledAgents.includes(workerRole);
    }

    /**
     * Get roles that this role can create tasks for
     * @param {string} role - The role name
     * @returns {string[]} Array of role names this role can create tasks for
     */
    static getCanCreateTasksFor(role) {
        const instance = new SystemMessages();
        const roleConfig = instance.roles[role];

        if (!roleConfig) {
            throw new Error(`Unknown role: ${role}`);
        }

        return roleConfig.can_create_tasks_for || [];
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
