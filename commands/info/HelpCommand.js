/**
 * Help Command
 * Shows available commands and system information
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';
import { getUIConfigManager } from '../../uiConfigManager.js';

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
    async implementation(_args, context) {
        const { apiClient, commandRegistry } = context;
        const uiConfig = getUIConfigManager();

        // Generate help text from command registry if available
        let commandsHelp = '';
        if (commandRegistry) {
            commandsHelp = commandRegistry.generateHelpText();
        } else {
            // Fallback to basic command list from configuration
            const helpConfig = uiConfig.getCommandHelp();
            const title = helpConfig.help.title;
            const commands = helpConfig.help.commands;

            commandsHelp = `\n${title}`;
            for (const [command, description] of Object.entries(commands)) {
                commandsHelp += `\n/${command.padEnd(12)} - ${description}`;
            }
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
