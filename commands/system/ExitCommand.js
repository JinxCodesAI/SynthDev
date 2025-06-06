/**
 * Exit Command
 * Exits the application
 */

import { BaseCommand } from '../base/BaseCommand.js';

export class ExitCommand extends BaseCommand {
    constructor() {
        super('exit', 'Exit the application', ['quit']);
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['consoleInterface'];
    }

    /**
     * Execute the exit command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {void} This method doesn't return as it exits the process
     */
    async implementation(args, context) {
        const { consoleInterface } = context;
        
        consoleInterface.showGoodbye();
        process.exit(0);
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/exit or /quit';
    }
}

export default ExitCommand;
