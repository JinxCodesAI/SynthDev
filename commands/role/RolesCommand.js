/**
 * Roles Command
 * Shows available roles and current role information
 */

import { BaseCommand } from '../base/BaseCommand.js';
import SystemMessages from '../../systemMessages.js';
import { getLogger } from '../../logger.js';

export class RolesCommand extends BaseCommand {
    constructor() {
        super('roles', 'Show available roles and current role');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['apiClient'];
    }

    /**
     * Execute the roles command
     * @param {string} args - Command arguments (group filter)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { apiClient } = context;
        const logger = getLogger();

        const groupFilter = args ? args.trim() : '';
        let roles;
        let headerText;

        if (groupFilter === 'all') {
            // Show all roles regardless of group
            roles = SystemMessages.getAvailableRoles();
            headerText = '🎭 All Available Roles:';
        } else if (groupFilter === '') {
            // Show only global roles (default behavior)
            roles = SystemMessages.getRolesByGroup('global');
            headerText = '🎭 Available Roles (Global):';
        } else {
            // Show roles from specific group
            roles = SystemMessages.getRolesByGroup(groupFilter);
            headerText = `🎭 Available Roles (${groupFilter}):`;

            if (roles.length === 0) {
                const availableGroups = SystemMessages.getAvailableGroups();
                logger.error(`No roles found in group '${groupFilter}'`);
                logger.info(`📖 Available groups: ${availableGroups.join(', ')}`);
                logger.info('💡 Use "/roles all" to see all roles or "/roles" for global roles\n');
                return true;
            }
        }

        const currentRole = apiClient.getCurrentRole();

        logger.user(headerText);
        logger.user('─'.repeat(50));

        roles.forEach(role => {
            const isCurrentRole = role === currentRole;
            const roleIcon = isCurrentRole ? '👑' : '🎭';
            const roleStatus = isCurrentRole ? ' (current)' : '';

            // Get role group for display
            const roleGroup = SystemMessages.getRoleGroup(role);
            const groupDisplay = roleGroup !== 'global' ? ` [${roleGroup}]` : '';

            // Get role level and model info
            const level = SystemMessages.getLevel(role);
            const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';

            logger.info(
                `${roleIcon} ${role.charAt(0).toUpperCase() + role.slice(1)}${roleStatus}${groupDisplay}`
            );
            logger.info(`   ${levelIcon} Model Level: ${level}`);

            // Get system message preview (first line)
            const systemMessage = SystemMessages.getSystemMessage(role);
            const preview = systemMessage.split('\n')[0];
            logger.info(`   ${preview}`);

            // Get reminder message
            const reminder = SystemMessages.getReminder(role);
            if (reminder) {
                const reminderPreview =
                    reminder.length > 80 ? `${reminder.substring(0, 80)}...` : reminder;
                logger.info(`   💭 Reminder: ${reminderPreview}`);
            }

            const excludedTools = SystemMessages.getExcludedTools(role);
            if (excludedTools.length > 0) {
                logger.info(
                    `   🚫 Excludes: ${excludedTools.slice(0, 3).join(', ')}${excludedTools.length > 3 ? '...' : ''}`
                );
            }
            logger.raw();
        });

        // Show usage information
        if (groupFilter === '') {
            const availableGroups = SystemMessages.getAvailableGroups().filter(g => g !== 'global');
            logger.info('💡 Use "/role <name>" to switch roles (e.g., "/role coder")');
            if (availableGroups.length > 0) {
                logger.info(
                    `💡 Use "/roles <group>" to see roles in specific groups: ${availableGroups.join(', ')}`
                );
                logger.info('💡 Use "/roles all" to see all roles');
            }
        } else {
            logger.info(
                '💡 Use "/role <n>" for global roles or "/role <group>.<n>" for group-specific roles'
            );
        }
        logger.raw();

        return true;
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/roles';
    }
}

export default RolesCommand;
