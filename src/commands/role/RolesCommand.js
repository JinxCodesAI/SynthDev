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
            return this._showAllRoles(logger, apiClient);
        } else if (groupFilter === '') {
            return this._showGroupOverview(logger, apiClient);
        } else {
            return this._showSpecificGroup(groupFilter, logger, apiClient);
        }
    }

    /**
     * Show overview of all role groups
     * @param {Object} logger - Logger instance
     * @param {Object} apiClient - API client instance
     * @returns {boolean} Always returns true
     */
    _showGroupOverview(logger, apiClient) {
        const availableGroups = SystemMessages.getAvailableGroups();
        const currentRole = apiClient.getCurrentRole();

        logger.user('🎭 Available Role Groups:');
        logger.user('─'.repeat(50));

        // Sort groups to show global first
        const sortedGroups = availableGroups.sort((a, b) => {
            if (a === 'global') {
                return -1;
            }
            if (b === 'global') {
                return 1;
            }
            return a.localeCompare(b);
        });

        sortedGroups.forEach(group => {
            const roles = SystemMessages.getRolesByGroup(group);
            const groupIcon = this._getGroupIcon(group);

            logger.info(`${groupIcon} ${group.toUpperCase()} (${roles.length} roles)`);

            // Show first 4 roles, then "..." if more
            const displayRoles = roles.slice(0, 4);
            const hasMore = roles.length > 4;

            const rolesList = displayRoles
                .map(role => {
                    const isCurrentRole = role === currentRole;
                    const level = SystemMessages.getLevel(role);
                    const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';
                    const currentMarker = isCurrentRole ? ' 👑' : '';
                    return `${levelIcon} ${role}${currentMarker}`;
                })
                .join(', ');

            const moreText = hasMore ? `, ... (+${roles.length - 4} more)` : '';
            logger.info(`   ${rolesList}${moreText}`);
            logger.raw();
        });

        // Show usage information
        logger.info('💡 Use "/role <name>" to switch roles (e.g., "/role coder")');
        logger.info(`💡 Use "/roles <group>" for detailed info: ${availableGroups.join(', ')}`);
        logger.info('💡 Use "/roles all" to see all roles organized by groups');
        logger.raw();

        return true;
    }

    /**
     * Show all roles organized by groups
     * @param {Object} logger - Logger instance
     * @param {Object} apiClient - API client instance
     * @returns {boolean} Always returns true
     */
    _showAllRoles(logger, apiClient) {
        const availableGroups = SystemMessages.getAvailableGroups();
        const currentRole = apiClient.getCurrentRole();

        logger.user('🎭 All Available Roles (by Groups):');
        logger.user('─'.repeat(50));

        // Sort groups to show global first
        const sortedGroups = availableGroups.sort((a, b) => {
            if (a === 'global') {
                return -1;
            }
            if (b === 'global') {
                return 1;
            }
            return a.localeCompare(b);
        });

        sortedGroups.forEach((group, index) => {
            const roles = SystemMessages.getRolesByGroup(group);
            const groupIcon = this._getGroupIcon(group);

            if (index > 0) {
                logger.raw();
            } // Add spacing between groups

            logger.info(`${groupIcon} ${group.toUpperCase()} GROUP:`);
            logger.info('─'.repeat(30));

            roles.forEach(role => {
                const isCurrentRole = role === currentRole;
                const roleIcon = isCurrentRole ? '👑' : '🎭';
                const roleStatus = isCurrentRole ? ' (current)' : '';
                const displayName = group !== 'global' ? `${group}.${role}` : role;

                // Get role level and model info
                const level = SystemMessages.getLevel(role);
                const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';

                logger.info(`${roleIcon} ${displayName}${roleStatus}`);
                logger.info(`   ${levelIcon} Model Level: ${level}`);

                // Get system message preview (first line)
                const systemMessage = SystemMessages.getSystemMessage(role);
                const preview = systemMessage.split('\n')[0];
                logger.info(`   ${preview}`);
                logger.raw();
            });
        });

        // Show usage information
        logger.info(
            '💡 Use "/role <name>" for global roles or "/role <group>.<name>" for group-specific roles'
        );
        logger.info(
            `💡 Use "/roles <group>" for detailed group info: ${availableGroups.join(', ')}`
        );
        logger.raw();

        return true;
    }

    /**
     * Show detailed information for a specific group
     * @param {string} groupFilter - The group to show
     * @param {Object} logger - Logger instance
     * @param {Object} apiClient - API client instance
     * @returns {boolean} Always returns true
     */
    _showSpecificGroup(groupFilter, logger, apiClient) {
        const roles = SystemMessages.getRolesByGroup(groupFilter);

        if (roles.length === 0) {
            const availableGroups = SystemMessages.getAvailableGroups();
            logger.error(`No roles found in group '${groupFilter}'`);
            logger.info(`📖 Available groups: ${availableGroups.join(', ')}`);
            logger.info('💡 Use "/roles" for group overview or "/roles all" to see all roles');
            return true;
        }

        const currentRole = apiClient.getCurrentRole();
        const groupIcon = this._getGroupIcon(groupFilter);

        logger.user(`${groupIcon} ${groupFilter.toUpperCase()} Group Roles:`);
        logger.user('─'.repeat(50));

        roles.forEach(role => {
            const isCurrentRole = role === currentRole;
            const roleIcon = isCurrentRole ? '👑' : '🎭';
            const roleStatus = isCurrentRole ? ' (current)' : '';

            // Get role group for display
            const roleGroup = SystemMessages.getRoleGroup(role);
            const displayName = roleGroup !== 'global' ? `${roleGroup}.${role}` : role;

            // Get role level and model info
            const level = SystemMessages.getLevel(role);
            const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';

            logger.info(`${roleIcon} ${displayName}${roleStatus}`);
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
        logger.info(
            '💡 Use "/role <name>" for global roles or "/role <group>.<name>" for group-specific roles'
        );
        logger.info('💡 Use "/roles" for group overview or "/roles all" to see all roles');
        logger.raw();

        return true;
    }

    /**
     * Get icon for a role group
     * @param {string} group - The group name
     * @returns {string} Icon for the group
     */
    _getGroupIcon(group) {
        const groupIcons = {
            global: '🌐',
            testing: '🧪',
            agentic: '🤖',
            internal: '⚙️',
            specialized: '🎯',
        };
        return groupIcons[group] || '📁';
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/roles [group|all]';
    }
}

export default RolesCommand;
