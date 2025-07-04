class CostsManager {
    constructor() {
        this.modelCosts = {}; // Use an object to store costs per model
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
    }

    getTotalCosts() {
        // This method will be used later to format and return the costs
        return this.modelCosts;
    }
}

const costsManager = new CostsManager();

export default costsManager;
