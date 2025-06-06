/**
 * Cost Command
 * Shows accumulated API costs by model
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';

export class CostCommand extends BaseCommand {
    constructor() {
        super('cost', 'Show accumulated API costs');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['costsManager', 'consoleInterface'];
    }

    /**
     * Execute the cost command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { costsManager, consoleInterface } = context;
        
        const costs = costsManager.getTotalCosts();
        const modelNames = Object.keys(costs);

        if (modelNames.length === 0) {
            consoleInterface.showMessage('\n📊 No API usage data available yet.');
        } else {
            consoleInterface.showMessage('\n📊 Accumulated API Costs By Model:');
            consoleInterface.showMessage('─'.repeat(50));

            for (const modelName of modelNames) {
                const modelCost = costs[modelName];
                consoleInterface.showMessage(`
${modelName}:`, "Model:");
                consoleInterface.showMessage(`  Cached Tokens: ${modelCost.cached_tokens}`, " ");
                consoleInterface.showMessage(`  Prompt Tokens: ${modelCost.prompt_tokens}`, " ");
                consoleInterface.showMessage(`  Completion Tokens: ${modelCost.completion_tokens}`, " ");
                consoleInterface.showMessage(`  Total Tokens: ${modelCost.total_tokens}`, " ");
                consoleInterface.showMessage(`  Reasoning Tokens: ${modelCost.reasoning_tokens}`, " ");
            }
            consoleInterface.newLine();
        }

        return true;
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/cost';
    }
}

export default CostCommand;
