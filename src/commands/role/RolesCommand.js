/**
 * Roles Command
 * Shows available roles and current role information
 */

import { BaseCommand } from '../base/BaseCommand.js';
import SystemMessages from '../../core/ai/systemMessages.js';
import { getLogger } from '../../core/managers/logger.js';

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

        if (groupFilter === 'all') {
            // Show all roles with full details
            return this._showAllRoles(apiClient, logger);
        } else if (groupFilter === '') {
            // Show overview of all groups (new default behavior)
            return this._showGroupsOverview(apiClient, logger);
        } else {
            // Show detailed roles from specific group
            return this._showGroupRoles(groupFilter, apiClient, logger);
        }
    }

    /**
     * Show overview of all available groups with role counts
     */
    _showGroupsOverview(apiClient, logger) {
        const availableGroups = SystemMessages.getAvailableGroups();
        const currentRole = apiClient.getCurrentRole();

        logger.user('🎭 Available Role Groups:');
        logger.user('─'.repeat(50));

        availableGroups.forEach(group => {
            const roles = SystemMessages.getRolesByGroup(group);
            const groupIcon =
                group === 'global'
                    ? '🌍'
                    : group === 'agentic'
                      ? '🤖'
                      : group === 'testing'
                        ? '🧪'
                        : group === 'internal'
                          ? '⚙️'
                          : '📁';

            const roleText = roles.length === 1 ? 'role' : 'roles';
            logger.info(`${groupIcon} ${group} (${roles.length} ${roleText})`);

            const rolesList = roles
                .map(role => {
                    const isCurrentRole = role === currentRole;
                    const level = SystemMessages.getLevel(role);
                    const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';
                    const roleIcon = isCurrentRole ? '👑' : levelIcon;
                    return `${roleIcon} ${role}`;
                })
                .join(', ');

            logger.info(`   ${rolesList}`);
            logger.raw();
        });

        logger.info('💡 Use "/role <name>" to switch roles (e.g., "/role coder")');
        logger.info('💡 Use "/roles <group>" to see detailed information for a specific group');
        logger.info(`💡 Available groups: ${availableGroups.join(', ')}`);
        logger.info('💡 Use "/roles all" to see all roles with full details');
        logger.raw();

        return true;
    }

    /**
     * Show detailed roles from a specific group
     */
    _showGroupRoles(groupFilter, apiClient, logger) {
        const roles = SystemMessages.getRolesByGroup(groupFilter);

        if (roles.length === 0) {
            const availableGroups = SystemMessages.getAvailableGroups();
            logger.error(`No roles found in group '${groupFilter}'`);
            logger.info(`📖 Available groups: ${availableGroups.join(', ')}`);
            logger.info('💡 Use "/roles" to see group overview or "/roles all" to see all roles');
            return true;
        }

        const currentRole = apiClient.getCurrentRole();
        const groupIcon =
            groupFilter === 'global'
                ? '🌍'
                : groupFilter === 'agentic'
                  ? '🤖'
                  : groupFilter === 'testing'
                    ? '🧪'
                    : groupFilter === 'internal'
                      ? '⚙️'
                      : '📁';

        const roleText = roles.length === 1 ? 'role' : 'roles';
        logger.user(`${groupIcon} ${groupFilter} Group Roles (${roles.length} ${roleText}):`);
        logger.user('─'.repeat(50));

        roles.forEach(role => {
            const isCurrentRole = role === currentRole;
            const roleIcon = isCurrentRole ? '👑' : '🎭';
            const roleStatus = isCurrentRole ? ' (current)' : '';

            const level = SystemMessages.getLevel(role);
            const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';

            logger.info(`${roleIcon} ${role}${roleStatus}`);
            logger.info(`   ${levelIcon} Model Level: ${level}`);

            const systemMessage = SystemMessages.getSystemMessage(role);
            const preview = systemMessage.split('\n')[0];
            logger.info(`   ${preview}`);

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

        logger.info('💡 Use "/role <name>" to switch to a role');
        logger.info('💡 Use "/roles" to see all groups overview');
        logger.info('💡 Use "/roles all" to see all roles with full details');
        logger.raw();

        return true;
    }

    /**
     * Show all roles with full details
     */
    _showAllRoles(apiClient, logger) {
        const roles = SystemMessages.getAvailableRoles();
        const currentRole = apiClient.getCurrentRole();

        logger.user('🎭 All Available Roles:');
        logger.user('─'.repeat(50));

        roles.forEach(role => {
            const isCurrentRole = role === currentRole;
            const roleIcon = isCurrentRole ? '👑' : '🎭';
            const roleStatus = isCurrentRole ? ' (current)' : '';

            const roleGroup = SystemMessages.getRoleGroup(role);
            const displayName = roleGroup !== 'global' ? `${roleGroup}.${role}` : role;

            const level = SystemMessages.getLevel(role);
            const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';

            logger.info(`${roleIcon} ${displayName}${roleStatus}`);
            logger.info(`   ${levelIcon} Model Level: ${level}`);

            const systemMessage = SystemMessages.getSystemMessage(role);
            const preview = systemMessage.split('\n')[0];
            logger.info(`   ${preview}`);

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

        const availableGroups = SystemMessages.getAvailableGroups();
        logger.info('💡 Use "/role <name>" to switch roles');
        logger.info('💡 Use "/roles" to see groups overview');
        logger.info(`💡 Use "/roles <group>" for specific groups: ${availableGroups.join(', ')}`);
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
