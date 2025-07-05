/**
 * Cost Command
 * Shows accumulated API costs by model
 */

import { BaseCommand } from '../base/BaseCommand.js';

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

        const costSummary = costsManager.getCostSummary();
        const modelNames = Object.keys(costSummary.models);

        if (modelNames.length === 0) {
            consoleInterface.showMessage('\n📊 No API usage data available yet.');
        } else {
            consoleInterface.showMessage('\n💰 Accumulated API Costs & Usage:');
            consoleInterface.showMessage('═'.repeat(60));

            for (const modelName of modelNames) {
                const modelCost = costSummary.models[modelName];
                const pricing = costsManager.getModelPricing(modelName);

                consoleInterface.showMessage(`\n🤖 ${modelName}:`, 'Model:');

                // Token usage
                consoleInterface.showMessage('  📊 Token Usage:', ' ');
                consoleInterface.showMessage(
                    `    • Prompt Tokens: ${modelCost.prompt_tokens.toLocaleString()}`,
                    ' '
                );
                consoleInterface.showMessage(
                    `    • Completion Tokens: ${modelCost.completion_tokens.toLocaleString()}`,
                    ' '
                );
                if (modelCost.cached_tokens > 0) {
                    consoleInterface.showMessage(
                        `    • Cached Tokens: ${modelCost.cached_tokens.toLocaleString()}`,
                        ' '
                    );
                }
                if (modelCost.reasoning_tokens > 0) {
                    consoleInterface.showMessage(
                        `    • Reasoning Tokens: ${modelCost.reasoning_tokens.toLocaleString()}`,
                        ' '
                    );
                }
                consoleInterface.showMessage(
                    `    • Total Tokens: ${modelCost.total_tokens.toLocaleString()}`,
                    ' '
                );

                // Cost breakdown
                if (pricing && modelCost.totalCost > 0) {
                    consoleInterface.showMessage('  💵 Cost Breakdown:', ' ');
                    consoleInterface.showMessage(
                        `    • Input Cost: $${modelCost.inputCost.toFixed(6)}`,
                        ' '
                    );
                    consoleInterface.showMessage(
                        `    • Output Cost: $${modelCost.outputCost.toFixed(6)}`,
                        ' '
                    );
                    if (modelCost.cachedCost > 0) {
                        consoleInterface.showMessage(
                            `    • Cached Cost: $${modelCost.cachedCost.toFixed(6)}`,
                            ' '
                        );
                    }
                    consoleInterface.showMessage(
                        `    • Model Total: $${modelCost.totalCost.toFixed(6)}`,
                        ' '
                    );
                } else if (!pricing) {
                    consoleInterface.showMessage(
                        '  ⚠️  Pricing information not available for this model',
                        ' '
                    );
                }
            }

            // Grand total
            consoleInterface.showMessage(`\n${'─'.repeat(60)}`);
            if (costSummary.grandTotal > 0) {
                consoleInterface.showMessage(
                    `💰 Grand Total Cost: $${costSummary.grandTotal.toFixed(6)}`,
                    'Total:'
                );
            }
            consoleInterface.showMessage(`📈 Models Used: ${costSummary.modelCount}`, 'Summary:');
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
