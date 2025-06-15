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
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { apiClient } = context;

        const roles = SystemMessages.getAvailableRoles();
        const currentRole = apiClient.getCurrentRole();
        const logger = getLogger();

        logger.user('🎭 Available Roles:');
        logger.user('─'.repeat(50));

        roles.forEach(role => {
            const isCurrentRole = role === currentRole;
            const roleIcon = isCurrentRole ? '👑' : '🎭';
            const roleStatus = isCurrentRole ? ' (current)' : '';

            // Get role level and model info
            const level = SystemMessages.getLevel(role);
            const levelIcon = level === 'smart' ? '🧠' : level === 'fast' ? '⚡' : '🔧';

            logger.info(`${roleIcon} ${role.charAt(0).toUpperCase() + role.slice(1)}${roleStatus}`);
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

        logger.info('💡 Use "/role <name>" to switch roles (e.g., "/role reviewer")');
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
