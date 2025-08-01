/**
 * Role Command
 * Switches to a specific role
 */

import { BaseCommand } from '../base/BaseCommand.js';
import SystemMessages from '../../core/ai/systemMessages.js';
import { getLogger } from '../../core/managers/logger.js';

export class RoleCommand extends BaseCommand {
    constructor() {
        super('role', 'Switch to a specific role (coder, reviewer, architect)');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['apiClient'];
    }

    /**
     * Validate command arguments
     * @param {string} args - Command arguments
     * @returns {string|null} Error message if validation fails, null if valid
     */
    validateArgs(args) {
        if (!args || args.trim().length === 0) {
            return 'Role name is required. Usage: /role <name>';
        }
        return null;
    }

    /**
     * Execute the role command
     * @param {string} args - Role name (can include group prefix like 'testing.dude')
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { apiClient } = context;
        const roleSpec = args.trim();

        const logger = getLogger();

        try {
            // Resolve the role specification (handle group prefixes)
            const { roleName, group, found } = SystemMessages.resolveRole(roleSpec);

            if (!found) {
                logger.error(`Unknown role: ${roleSpec}`);

                if (roleSpec.includes('.')) {
                    // User specified a group, show roles in that group
                    const [specifiedGroup] = roleSpec.split('.', 1);
                    const rolesInGroup = SystemMessages.getRolesByGroup(specifiedGroup);
                    if (rolesInGroup.length > 0) {
                        logger.info(
                            `📖 Available roles in '${specifiedGroup}': ${rolesInGroup.join(', ')}`
                        );
                    } else {
                        logger.info(`📖 No roles found in group '${specifiedGroup}'`);
                        const availableGroups = SystemMessages.getAvailableGroups();
                        logger.info(`📖 Available groups: ${availableGroups.join(', ')}`);
                    }
                } else {
                    // Show global roles and suggest group syntax
                    const globalRoles = SystemMessages.getRolesByGroup('global');
                    logger.info(`📖 Available global roles: ${globalRoles.join(', ')}`);

                    const availableGroups = SystemMessages.getAvailableGroups().filter(
                        g => g !== 'global'
                    );
                    if (availableGroups.length > 0) {
                        logger.info('💡 For group-specific roles, use: /role <group>.<name>');
                        logger.info(`📖 Available groups: ${availableGroups.join(', ')}`);
                    }
                }

                logger.info('💡 Use /roles to see detailed role information\n');
                return true;
            }

            const previousRole = apiClient.getCurrentRole();
            const systemMessage = SystemMessages.getSystemMessage(roleName);

            await apiClient.setSystemMessage(systemMessage, roleName);

            const groupDisplay = group !== 'global' ? ` [${group}]` : '';
            const agenticDisplay = SystemMessages.isAgentic(roleName) ? ' [agentic]' : '';
            logger.user(
                `🎭 Role switched from '${previousRole || 'none'}' to '${roleName}'${groupDisplay}${agenticDisplay}`
            );
            logger.info(
                `🔧 Tools: ${apiClient.getFilteredToolCount()}/${apiClient.getTotalToolCount()} available`
            );

            const excludedTools = SystemMessages.getExcludedTools(roleName);
            if (excludedTools.length > 0) {
                logger.info(`🚫 Excluded tools for ${roleName}: ${excludedTools.join(', ')}`);
            }

            // If role is agentic, prepare for agent spawning on first input
            if (SystemMessages.isAgentic(roleName)) {
                // Clear current agent ID - will be set when agent is spawned on first input
                context.app.currentAgentId = null;
                logger.info('🤖 Agentic role ready - agent will be spawned on first input');
            } else {
                // Clear current agent ID for non-agentic roles
                context.app.currentAgentId = null;
            }

            logger.raw();

            return true;
        } catch (error) {
            logger.error(error, 'Error switching role');
            return true;
        }
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/role <name>';
    }

    /**
     * Get help text for this command
     * @returns {string} Help text
     */
    getHelp() {
        const globalRoles = SystemMessages.getRolesByGroup('global');
        const availableGroups = SystemMessages.getAvailableGroups().filter(g => g !== 'global');

        let help = super.getHelp();
        help += `\n   Global roles: ${globalRoles.join(', ')}`;

        if (availableGroups.length > 0) {
            help += `\n   Groups: ${availableGroups.join(', ')}`;
            help += '\n   Examples: /role coder, /role testing.dude';
        } else {
            help += '\n   Example: /role coder';
        }

        return help;
    }
}

export default RoleCommand;
