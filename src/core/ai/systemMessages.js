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
     * Generate role coordination information based on enabled_agents and can_create_tasks_for
     * @param {string} role - The role name
     * @param {Object} roleConfig - The role configuration
     * @returns {string|null} Role coordination information or null if not applicable
     * @private
     */
    _generateRoleCoordinationInfo(role, roleConfig) {
        const parts = [];

        // Add agent coordination instructions if enabled_agents exists
        if (Array.isArray(roleConfig.enabled_agents) && roleConfig.enabled_agents.length > 0) {
            const enabledAgents = roleConfig.enabled_agents;
            const agentDescriptions = enabledAgents
                .map(agentRole => {
                    // Try direct lookup first (handles both simple and group-prefixed roles)
                    let agentConfig = this.roles[agentRole];

                    if (!agentConfig) {
                        // If direct lookup fails, try resolving the role
                        const resolution = SystemMessages.resolveRole(agentRole);
                        if (resolution.found && !resolution.ambiguous) {
                            // Try to find the role config with the resolved information
                            const fullRoleKey =
                                resolution.group === 'global'
                                    ? resolution.roleName
                                    : `${resolution.group}.${resolution.roleName}`;
                            agentConfig =
                                this.roles[fullRoleKey] || this.roles[resolution.roleName];
                        }
                    }

                    const description =
                        agentConfig?.agent_description || 'No description available';

                    // Use the original role name for display
                    return `${agentRole} - ${description}`;
                })
                .join('\n');

            // Include current role's group in the message only if it's not in global group
            const currentRoleGroup = SystemMessages.getRoleGroup(role);
            const roleDisplayName = role; // Keep simple for backward compatibility

            parts.push(`Your role is ${roleDisplayName} and you need to coordinate with other roles like: ${enabledAgents.join(', ')} to accomplish given task. Agents you can interact with:
${agentDescriptions}

Use get_agents to understand what agents are already available, but avoid calling it repeatedly.
If agent you need is not available, use spawn_agent to initialize new agent that you need to do something for you. For existing agents use speak_to_agent to communicate with them.
If there is nothing useful you can do, and there is nothing to report back just wait.`);
        }

        // Add task creation instructions if can_create_tasks_for exists and is not empty
        if (
            Array.isArray(roleConfig.can_create_tasks_for) &&
            roleConfig.can_create_tasks_for.length > 0
        ) {
            // Resolve role names to include group information where applicable
            const taskRoles = roleConfig.can_create_tasks_for.map(taskRole => {
                const resolution = SystemMessages.resolveRole(taskRole);
                if (resolution.found && !resolution.ambiguous) {
                    // Use original spec if group-prefixed, otherwise use resolved name
                    return taskRole.includes('.') ? taskRole : resolution.roleName;
                }
                return taskRole; // Keep original if resolution failed
            });

            parts.push(
                `Create tasks for ${taskRoles.join(', ')} if role is more suitable to do the task than you.`
            );
        }

        // Add task management instructions if enabled_agents exists (agents might have tasks)
        if (Array.isArray(roleConfig.enabled_agents)) {
            parts.push(
                'Use list_tasks, get_task to validate if there are any tasks you should start working on.'
            );
        }

        // Add return_results instruction if enabled_agents exists
        if (Array.isArray(roleConfig.enabled_agents)) {
            parts.push(
                'After you finish work, use return_results to give your supervisor detailed report about your progress.'
            );
        }

        return parts.length > 0 ? parts.join('\n\n') : null;
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
        const indexExists = existsSync('.synthdev/index');
        const today = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const currentDateTime = today.toLocaleDateString('en-GB', options);

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
     * @param {string} role - The role name (coder, reviewer, architect) or group-prefixed (agentic.architect)
     * @returns {string} The system message for the role
     */
    static getSystemMessage(role) {
        const instance = new SystemMessages();

        // Handle null/undefined roles
        if (!role || typeof role !== 'string') {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        // Handle group-prefixed roles - try direct lookup first
        let roleConfig = instance.roles[role];
        let actualRoleName = role;
        let roleGroup = null;

        if (roleConfig) {
            // Direct lookup succeeded
            actualRoleName = roleConfig._originalName || role;
            roleGroup = roleConfig._group;
        } else if (role.includes('.')) {
            // Group-prefixed role that wasn't found directly - this shouldn't happen with new structure
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        } else {
            // Simple role name that wasn't found - might be ambiguous
            const resolution = SystemMessages.resolveRole(role);
            if (!resolution.found) {
                if (resolution.ambiguous) {
                    throw new Error(
                        `Role '${role}' is ambiguous. Found in groups: ${resolution.availableGroups.join(', ')}. ` +
                            `Please specify group explicitly (e.g., '${resolution.availableGroups[0]}.${resolution.roleName}')`
                    );
                } else {
                    throw new Error(
                        `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
                    );
                }
            }

            // This shouldn't happen with the new structure, but handle it anyway
            actualRoleName = resolution.roleName;
            roleGroup = resolution.group;
            const fullRoleKey =
                roleGroup === 'global' ? actualRoleName : `${roleGroup}.${actualRoleName}`;
            roleConfig = instance.roles[fullRoleKey];
        }

        if (!roleConfig) {
            throw new Error(
                `Unknown role: ${role}. Available roles: ${Object.keys(instance.roles).join(', ')}`
            );
        }

        // Build the complete system message
        let systemMessage = roleConfig.systemMessage;

        // Add role coordination instructions - but only for agentic roles
        const isAgenticRole =
            roleGroup === 'agentic' ||
            (roleGroup === null && SystemMessages.isAgentic(actualRoleName));
        if (isAgenticRole) {
            const roleCoordinationInfo = instance._generateRoleCoordinationInfo(
                actualRoleName,
                roleConfig
            );
            if (roleCoordinationInfo) {
                systemMessage += `\n\n${roleCoordinationInfo}`;
            }
        }

        // Append environment information to the system message
        const environmentInfo = instance._generateEnvironmentInfo();
        return systemMessage + environmentInfo;
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
            const agenticTools = ['spawn_agent', 'speak_to_agent', 'get_agents', 'return_results'];
            agenticTools.forEach(tool => {
                // Add tool if not already included and not explicitly excluded
                if (!includedTools.includes(tool) && !excludedTools.includes(tool)) {
                    includedTools.push(tool);
                }
            });
        }

        // Automatically add task management tools if can_create_tasks_for is a non-empty array
        if (
            Array.isArray(roleConfig.can_create_tasks_for) &&
            roleConfig.can_create_tasks_for.length > 0
        ) {
            const taskManagementTools = ['list_tasks', 'edit_tasks', 'get_task'];
            taskManagementTools.forEach(tool => {
                // Add tool if not already included and not explicitly excluded
                if (!includedTools.includes(tool) && !excludedTools.includes(tool)) {
                    includedTools.push(tool);
                }
            });
        }

        // Automatically add task viewing tools if enabled_agents is an array (agents might have tasks assigned)
        if (Array.isArray(roleConfig.enabled_agents)) {
            const taskViewingTools = ['list_tasks', 'get_task'];
            taskViewingTools.forEach(tool => {
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
     * @returns {Object} Object with {roleName, group, found, ambiguous}
     */
    static resolveRole(roleSpec) {
        const instance = new SystemMessages();

        // Check if roleSpec contains a group prefix
        if (roleSpec.includes('.')) {
            const [group, roleName] = roleSpec.split('.', 2);

            // Check if role exists in the specified group
            const rolesInGroup = SystemMessages.getRolesByGroup(group);
            if (rolesInGroup.includes(roleName)) {
                return { roleName, group, found: true, ambiguous: false };
            }

            return { roleName, group, found: false, ambiguous: false };
        } else {
            // No group specified, look in global first, then any group
            const globalRoles = SystemMessages.getRolesByGroup('global');
            if (globalRoles.includes(roleSpec)) {
                return { roleName: roleSpec, group: 'global', found: true, ambiguous: false };
            }

            // Check if role exists in any group
            if (instance.roles[roleSpec]) {
                const group = SystemMessages.getRoleGroup(roleSpec);

                // Check for ambiguity: same role in multiple non-global groups
                const allGroups = Object.keys(instance._roleGroups || {});
                const groupsWithRole = allGroups.filter(g => {
                    if (g === 'global') {
                        return false;
                    } // Skip global as it's already checked
                    const rolesInGroup = SystemMessages.getRolesByGroup(g);
                    return rolesInGroup.includes(roleSpec);
                });

                if (groupsWithRole.length > 1) {
                    // Ambiguous: role exists in multiple non-global groups
                    return {
                        roleName: roleSpec,
                        group: null,
                        found: false,
                        ambiguous: true,
                        availableGroups: groupsWithRole,
                    };
                }

                return { roleName: roleSpec, group, found: true, ambiguous: false };
            }

            return { roleName: roleSpec, group: 'global', found: false, ambiguous: false };
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
     * Resolve an array of role specifications to actual role names
     * @param {string[]} roleSpecs - Array of role specifications (e.g., ['coder', 'testing.dude'])
     * @returns {Object} Object with {resolved: string[], errors: string[]}
     */
    static resolveRoleArray(roleSpecs) {
        const resolved = [];
        const errors = [];

        for (const roleSpec of roleSpecs) {
            const resolution = SystemMessages.resolveRole(roleSpec);

            if (resolution.ambiguous) {
                errors.push(
                    `Role '${roleSpec}' is ambiguous. Found in groups: ${resolution.availableGroups.join(', ')}. ` +
                        `Please specify group explicitly (e.g., '${resolution.availableGroups[0]}.${roleSpec}')`
                );
            } else if (!resolution.found) {
                errors.push(`Role '${roleSpec}' not found`);
            } else {
                // Use the original roleSpec if it was group-prefixed, otherwise use just the role name
                resolved.push(roleSpec.includes('.') ? roleSpec : resolution.roleName);
            }
        }

        return { resolved, errors };
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

        // Check direct match first
        if (enabledAgents.includes(workerRole)) {
            return true;
        }

        // Resolve the worker role to get its actual name and group
        const workerResolution = SystemMessages.resolveRole(workerRole);
        if (!workerResolution.found || workerResolution.ambiguous) {
            return false;
        }

        // Check if any enabled agent matches the worker role
        for (const enabledAgent of enabledAgents) {
            // Direct match already checked above
            if (enabledAgent === workerRole) {
                continue;
            }

            const enabledResolution = SystemMessages.resolveRole(enabledAgent);
            if (!enabledResolution.found || enabledResolution.ambiguous) {
                continue;
            }

            // Check if the role names match (regardless of group specification)
            if (enabledResolution.roleName === workerResolution.roleName) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a role is agentic (has enabled_agents configured)
     * @param {string} role - The role name
     * @returns {boolean} True if role is agentic
     */
    static isAgentic(role) {
        const enabledAgents = SystemMessages.getEnabledAgents(role);
        return Array.isArray(enabledAgents) && enabledAgents.length > 0;
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
