/**
 * Help Command
 * Shows available commands and system information
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';

export class HelpCommand extends BaseCommand {
    constructor() {
        super('help', 'Show this help message');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['apiClient'];
    }

    /**
     * Execute the help command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { apiClient, commandRegistry } = context;

        // Generate help text from command registry if available
        let commandsHelp = '';
        if (commandRegistry) {
            commandsHelp = commandRegistry.generateHelpText();
        } else {
            // Fallback to basic command list
            commandsHelp = `
📖 Available Commands:
/help     - Show this help message
/tools    - List available tools
/roles    - Show available roles and current role
/role <name> - Switch to a specific role (coder, reviewer, architect)
/review   - Show raw content of last API request/response
/clear    - Clear conversation history
/cost     - Show accumulated API costs
/snapshots - Manage code checkpoints, revert AI changes
/index    - Index codebase with AI-powered summaries
/exit     - Exit the application
`;
        }

        // System information
        const systemInfo = `
🤖 AI Model: ${apiClient.getModel()}
🎭 Current Role: ${apiClient.getCurrentRole() || 'none'}
🔧 Tools loaded: ${apiClient.getFilteredToolCount()}/${apiClient.getTotalToolCount()}
💬 Messages in conversation: ${apiClient.getMessageCount()}
🛡️ Tool calls in current interaction: ${apiClient.getToolCallCount()}/${apiClient.getMaxToolCalls()}
`;

        const logger = getLogger();
        logger.raw(commandsHelp);
        logger.raw(systemInfo);

        return true;
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/help';
    }
}

export default HelpCommand;
