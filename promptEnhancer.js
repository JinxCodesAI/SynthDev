import ConfigManager from './configManager.js';
import AIAPIClient from './aiAPIClient.js';
import SystemMessages from './systemMessages.js';
import { getLogger } from './logger.js';

/**
 * Handles prompt enhancement using a fast AI model
 */
class PromptEnhancer {
    constructor(costsManager, toolManager) {
        this.costsManager = costsManager;
        this.toolManager = toolManager;
        this.config = ConfigManager.getInstance();
        this.logger = getLogger();
    }

    /**
     * Check if prompt enhancement is enabled
     * @returns {boolean} Whether prompt enhancement is enabled
     */
    isEnabled() {
        return this.config.getConfig().global.enablePromptEnhancement;
    }

    /**
     * Enhance a user prompt using the fast AI model
     * @param {string} originalPrompt - The original user prompt
     * @returns {Promise<{success: boolean, enhancedPrompt?: string, error?: string}>}
     */
    async enhancePrompt(originalPrompt) {
        if (!this.isEnabled()) {
            return { success: false, error: 'Prompt enhancement is disabled' };
        }

        if (!originalPrompt || typeof originalPrompt !== 'string' || originalPrompt.trim() === '') {
            return { success: false, error: 'Invalid prompt provided' };
        }

        try {
            // Initialize AI client with fast model configuration
            const modelConfig = this.config.hasFastModelConfig()
                ? this.config.getModel('fast')
                : this.config.getModel('base');

            const aiClient = new AIAPIClient(
                this.costsManager,
                modelConfig.apiKey,
                modelConfig.baseUrl,
                modelConfig.model || modelConfig.baseModel
            );

            // Set tools in AI client (role-specific tools will be added automatically)
            aiClient.setTools(this.toolManager.getTools());

            // Set the prompt_enhancer role using SystemMessages
            const systemMessage = SystemMessages.getSystemMessage('prompt_enhancer');
            await aiClient.setSystemMessage(systemMessage, 'prompt_enhancer');

            // Create enhancement prompt
            const enhancementPrompt = this._createEnhancementPrompt(originalPrompt);

            // Set up response capture
            let responseMessage = null;
            let responseError = null;

            aiClient.setCallbacks({
                onResponse: response => {
                    responseMessage = response;
                },
                onError: error => {
                    responseError = error;
                },
                onReminder: reminder => {
                    return `${reminder}\n Original prompt was: ${originalPrompt}`;
                },
                onParseResponse: message => {
                    if (
                        !message.tool_calls ||
                        !Array.isArray(message.tool_calls) ||
                        message.tool_calls.length === 0 ||
                        message.tool_calls[0].function.name !== 'submit_enhanced_prompt'
                    ) {
                        return { success: false, error: 'No tool calls found in AI response' };
                    }
                    const status = message.tool_calls[0].function.arguments['enhancement_needed'];
                    if (status === 'false') {
                        return { success: true, content: originalPrompt };
                    } else {
                        const enhancedPrompt =
                            message.tool_calls[0].function.arguments['enhanced_prompt'];
                        return { success: true, content: enhancedPrompt };
                    }
                },
            });

            // Send the enhancement request
            await aiClient.sendUserMessage(enhancementPrompt);

            // Check for errors
            if (responseError) {
                return { success: false, error: `AI processing failed: ${responseError.message}` };
            }

            // Check if we got a response
            if (!responseMessage) {
                return { success: false, error: 'No response received from AI' };
            }

            // Parse the tool call response
            const result = this._parseToolCallResponse(responseMessage, originalPrompt);

            if (!result.success) {
                return result;
            }

            return result;
        } catch (error) {
            return { success: false, error: `Enhancement failed: ${error.message}` };
        }
    }

    /**
     * Create the enhancement prompt to send to the AI
     * @private
     * @param {string} originalPrompt - The original user prompt
     * @returns {string} The prompt to send to the AI for enhancement
     */
    _createEnhancementPrompt(originalPrompt) {
        return `Please enhance the following user prompt to make it more clear, specific, and effective while preserving the original intent:

Original prompt: "${originalPrompt}"

Enhanced prompt:`;
    }
}

export default PromptEnhancer;
