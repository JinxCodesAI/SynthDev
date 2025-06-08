/**
 * Review Command
 * Shows the raw content of the last API request/response
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';

export class ReviewCommand extends BaseCommand {
    constructor() {
        super('review', 'Show raw content of last API request/response');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['apiClient'];
    }

    /**
     * Execute the review command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { apiClient } = context;

        const lastCall = apiClient.getLastAPICall();
        const logger = getLogger();

        if (!lastCall.request || !lastCall.response) {
            logger.raw('📋 No API calls have been made yet');
            return true;
        }

        logger.raw('\n📋 Last API Call Review');
        logger.raw('═'.repeat(80));
        logger.raw(`🕒 Timestamp: ${lastCall.timestamp}`);
        logger.raw();

        // Show Request
        logger.raw('📤 REQUEST:');
        logger.raw('─'.repeat(40));
        logger.raw(JSON.stringify(lastCall.request, null, 3));
        logger.raw();

        // Show Response
        logger.raw('📥 RESPONSE:');
        logger.raw('─'.repeat(40));
        logger.raw(JSON.stringify(lastCall.response, null, 3));
        logger.raw('═'.repeat(80));
        logger.raw();

        return true;
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/review';
    }
}

export default ReviewCommand;
