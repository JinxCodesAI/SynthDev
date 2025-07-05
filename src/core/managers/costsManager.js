import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory where this module is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CostsManager {
    constructor() {
        this.modelCosts = {}; // Use an object to store costs per model
        this.pricingData = null; // Cache for pricing data
        this._loadPricingData();
    }

    /**
     * Load pricing data from providers.json
     * @private
     */
    _loadPricingData() {
        try {
            const providersPath = join(__dirname, '../../config/defaults/providers.json');
            const providersData = readFileSync(providersPath, 'utf8');
            const providers = JSON.parse(providersData);

            // Create a flat map of model name to pricing info
            this.pricingData = {};
            providers.providers.forEach(provider => {
                provider.models.forEach(model => {
                    this.pricingData[model.name] = {
                        inputPricePerMillionTokens: model.inputPricePerMillionTokens || 0,
                        outputPricePerMillionTokens: model.outputPricePerMillionTokens || 0,
                        cachedPricePerMillionTokens: model.cachedPricePerMillionTokens || 0,
                        provider: provider.name,
                    };
                });
            });
        } catch (error) {
            console.warn('Failed to load pricing data:', error.message);
            this.pricingData = {};
        }
    }

    /**
     * Get pricing information for a model
     * @param {string} modelName - Name of the model
     * @returns {Object|null} Pricing information or null if not found
     */
    getModelPricing(modelName) {
        return this.pricingData[modelName] || null;
    }

    /**
     * Calculate cost for token usage
     * @param {string} modelName - Name of the model
     * @param {Object} usage - Token usage data
     * @returns {Object} Cost breakdown
     */
    calculateCost(modelName, usage) {
        const pricing = this.getModelPricing(modelName);
        if (!pricing) {
            return {
                inputCost: 0,
                outputCost: 0,
                cachedCost: 0,
                totalCost: 0,
            };
        }

        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;

        const inputCost =
            ((inputTokens - cachedTokens) / 1000000) * pricing.inputPricePerMillionTokens;
        const outputCost = (outputTokens / 1000000) * pricing.outputPricePerMillionTokens;
        const cachedCost = (cachedTokens / 1000000) * pricing.cachedPricePerMillionTokens;

        return {
            inputCost,
            outputCost,
            cachedCost,
            totalCost: inputCost + outputCost + cachedCost,
        };
    }

    addUsage(model, usage) {
        if (!usage) {
            return;
        }

        // Initialize model entry if it doesn't exist
        if (!this.modelCosts[model]) {
            this.modelCosts[model] = {
                cached_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                reasoning_tokens: 0,
                inputCost: 0,
                outputCost: 0,
                cachedCost: 0,
                totalCost: 0,
            };
        }

        // Add usage to the specific model
        const modelCost = this.modelCosts[model];
        modelCost.prompt_tokens += usage.prompt_tokens || 0;
        modelCost.completion_tokens += usage.completion_tokens || 0;
        modelCost.total_tokens += usage.total_tokens || 0;

        if (usage.prompt_tokens_details) {
            modelCost.cached_tokens += usage.prompt_tokens_details.cached_tokens || 0;
        }

        if (usage.completion_tokens_details) {
            modelCost.reasoning_tokens += usage.completion_tokens_details.reasoning_tokens || 0;
        }

        // Calculate and add costs
        const costs = this.calculateCost(model, usage);
        modelCost.inputCost += costs.inputCost;
        modelCost.outputCost += costs.outputCost;
        modelCost.cachedCost += costs.cachedCost;
        modelCost.totalCost += costs.totalCost;
    }

    getTotalCosts() {
        // This method will be used later to format and return the costs
        return this.modelCosts;
    }

    /**
     * Get total cost across all models
     * @returns {number} Total cost in USD
     */
    getGrandTotalCost() {
        let total = 0;
        for (const modelName in this.modelCosts) {
            total += this.modelCosts[modelName].totalCost || 0;
        }
        return total;
    }

    /**
     * Get cost summary with totals
     * @returns {Object} Cost summary including per-model and grand total
     */
    getCostSummary() {
        const modelCosts = this.getTotalCosts();
        const grandTotal = this.getGrandTotalCost();

        return {
            models: modelCosts,
            grandTotal,
            modelCount: Object.keys(modelCosts).length,
        };
    }

    /**
     * Reset all costs (typically called on application exit)
     */
    resetCosts() {
        this.modelCosts = {};
    }
}

const costsManager = new CostsManager();

export default costsManager;
