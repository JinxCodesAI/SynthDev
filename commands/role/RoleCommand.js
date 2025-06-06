/**
 * Role Command
 * Switches to a specific role
 */

import { BaseCommand } from '../base/BaseCommand.js';
import SystemMessages from '../../systemMessages.js';
import { getLogger } from '../../logger.js';

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
     * @param {string} args - Role name
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { apiClient } = context;
        const role = args.trim();

        const logger = getLogger();

        try {
            if (!SystemMessages.hasRole(role)) {
                logger.raw(`❌ Unknown role: ${role}`);
                logger.raw(`📖 Available roles: ${SystemMessages.getAvailableRoles().join(', ')}`);
                logger.raw('💡 Use /roles to see detailed role information\n');
                return true;
            }

            const previousRole = apiClient.getCurrentRole();
            const systemMessage = SystemMessages.getSystemMessage(role);

            await apiClient.setSystemMessage(systemMessage, role);

            logger.raw(`🎭 Role switched from '${previousRole || 'none'}' to '${role}'`);
            logger.raw(`🔧 Tools: ${apiClient.getFilteredToolCount()}/${apiClient.getTotalToolCount()} available`);

            const excludedTools = SystemMessages.getExcludedTools(role);
            if (excludedTools.length > 0) {
                logger.raw(`🚫 Excluded tools for ${role}: ${excludedTools.join(', ')}`);
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
        const availableRoles = SystemMessages.getAvailableRoles();
        let help = super.getHelp();
        help += `\n   Available roles: ${availableRoles.join(', ')}`;
        help += '\n   Example: /role coder';
        return help;
    }
}

export default RoleCommand;
