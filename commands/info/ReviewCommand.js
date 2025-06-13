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
    async implementation(_args, context) {
        const { apiClient } = context;

        const lastCall = apiClient.getLastAPICall();
        const logger = getLogger();

        if (!lastCall.request || !lastCall.response) {
            logger.info('📋 No API calls have been made yet');
            return true;
        }

        logger.debug('\n📋 Last API Call Review');
        logger.debug('═'.repeat(80));
        logger.debug(`🕒 Timestamp: ${lastCall.timestamp}`);
        logger.raw();

        // Show Request
        logger.debug('📤 REQUEST:');
        logger.debug('─'.repeat(40));
        logger.debug(JSON.stringify(lastCall.request, null, 3));
        logger.raw();

        // Show Response
        logger.debug('📥 RESPONSE:');
        logger.debug('─'.repeat(40));
        logger.debug(JSON.stringify(lastCall.response, null, 3));
        logger.debug('═'.repeat(80));
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
