/**
 * Tools Command
 * Shows available tools and their information
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../src/core/managers/logger.js';

export class ToolsCommand extends BaseCommand {
    constructor() {
        super('tools', 'List available tools');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['toolManager'];
    }

    /**
     * Execute the tools command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { toolManager } = context;

        const tools = toolManager.getTools();

        const logger = getLogger();

        if (tools.length === 0) {
            logger.info('🔧 No tools available');
            return true;
        }

        logger.user('🔧 Available Tools:');
        logger.user('─'.repeat(50));

        tools.forEach(tool => {
            const toolName = tool.function.name;
            const toolDefinition = toolManager.getToolDefinition(toolName);
            const autoRun = toolDefinition?.auto_run !== false; // Default to true if not specified
            const autoRunIcon = autoRun ? '🟢' : '🔴';
            const autoRunText = autoRun ? 'Auto-run' : 'Requires confirmation';

            logger.info(`📍 ${tool.function.name} ${autoRunIcon} ${autoRunText}`);
            logger.info(`   Description: ${tool.function.description}`);
            if (tool.function.parameters?.properties) {
                logger.info(
                    `   Parameters: ${Object.keys(tool.function.parameters.properties).join(', ')}`
                );
            }
            logger.raw();
        });

        return true;
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/tools';
    }
}

export default ToolsCommand;
