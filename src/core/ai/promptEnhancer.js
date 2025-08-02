import ConfigManager from '../../config/managers/configManager.js';
import AIAPIClient from './aiAPIClient.js';
import SystemMessages from './systemMessages.js';
import { getLogger } from '../managers/logger.js';
import { type } from 'os';

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
                modelConfig.model || modelConfig.baseModel,
                this.toolManager
            );

            // Set tools in AI client (role-specific tools will be added automatically)
            aiClient.setTools(this.toolManager.getTools());

            // Set the prompt_enhancer role using SystemMessages
            const systemMessage = SystemMessages.getSystemMessage('prompt_enhancer');
            await aiClient.setSystemMessage(systemMessage, 'prompt_enhancer');

            // Create enhancement prompt
            const enhancementPrompt = this._createEnhancementPrompt(originalPrompt);

            // Set up response capture
            let responseError = null;
            let enhancedPrompt = null;

            aiClient.setCallbacks({
                onError: error => {
                    responseError = error;
                },
                onReminder: reminder => {
                    return `${reminder}\n Original prompt was: ${originalPrompt}`;
                },
                onParseResponse: message => {
                    this.logger.debug('Parsing AI response for prompt enhancement', message);
                    if (
                        !message.tool_calls ||
                        !Array.isArray(message.tool_calls) ||
                        message.tool_calls.length === 0 ||
                        message.tool_calls[0].function.name !== 'submit_enhanced_prompt'
                    ) {
                        return { success: false, error: 'No tool calls found in AI response' };
                    }
                    this.logger.debug('Function arguments:', message.tool_calls[0].function);
                    const args =
                        typeof message.tool_calls[0].function.arguments === 'string'
                            ? JSON.parse(message.tool_calls[0].function.arguments)
                            : message.tool_calls[0].function.arguments;
                    const status = args['enhancement_needed'];
                    if (status === false) {
                        enhancedPrompt = originalPrompt;
                        this.logger.debug('Enhancement not needed');
                        return { success: true, content: originalPrompt };
                    } else {
                        enhancedPrompt = args['enhanced_prompt'];
                        this.logger.debug('Enhancement needed');
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
            if (!enhancedPrompt) {
                return { success: false, error: 'No response received from AI' };
            }

            return { success: true, enhancedPrompt };
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
        return `Follow your system message and decide if and how you should enhance the following user prompt:
        "${originalPrompt}" \n\n Call tools to gather more information if needed, then call the submit_enhanced_prompt tool with your final decision.`;
    }
}

export default PromptEnhancer;
