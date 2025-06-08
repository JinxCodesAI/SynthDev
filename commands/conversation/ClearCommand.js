/**
 * Clear Command
 * Clears the conversation history
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';

export class ClearCommand extends BaseCommand {
    constructor() {
        super('clear', 'Clear conversation history');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['apiClient'];
    }

    /**
     * Execute the clear command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {string} Returns 'clear' to indicate conversation should be cleared
     */
    async implementation(args, context) {
        const { apiClient } = context;

        apiClient.clearConversation();
        const logger = getLogger();
        logger.raw('🧹 Conversation cleared\n');

        return 'clear';
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/clear';
    }
}

export default ClearCommand;
