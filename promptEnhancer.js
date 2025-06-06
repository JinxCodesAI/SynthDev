import ConfigManager from './configManager.js';
import AIAPIClient from './aiAPIClient.js';
import SystemMessages from './systemMessages.js';
import ToolManager from './toolManager.js';
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

            // Set tools in AI client (like explain_codebase does)
            aiClient.setTools(this.toolManager.getTools());

            // Set the prompt_enhancer role using SystemMessages
            const systemMessage = SystemMessages.getSystemMessage('prompt_enhancer');
            await aiClient.setSystemMessage(systemMessage, 'prompt_enhancer');

            // Create enhancement prompt
            const enhancementPrompt = this._createEnhancementPrompt(originalPrompt);

            // Set up response capture
            let responseContent = null;
            let responseError = null;

            aiClient.setCallbacks({
                onResponse: (response) => {
                    if (response && response.choices && response.choices[0] && response.choices[0].message) {
                        responseContent = response.choices[0].message.content;
                    }
                },
                onError: (error) => {
                    responseError = error;
                },
                onReminder: (reminder) => {
                    return reminder + `\n Original prompt was: ${originalPrompt}`;
                }
            });

            // Send the enhancement request
            await aiClient.sendUserMessage(enhancementPrompt);

            // Check for errors
            if (responseError) {
                return { success: false, error: `AI processing failed: ${responseError.message}` };
            }

            // Check if we got a response
            if (!responseContent) {
                return { success: false, error: 'No response received from AI' };
            }

            // Extract the enhanced prompt from the response
            const enhancedPrompt = this._extractEnhancedPrompt(responseContent);

            if (!enhancedPrompt) {
                return { success: false, error: 'Failed to extract enhanced prompt from AI response' };
            }

            return { success: true, enhancedPrompt: enhancedPrompt.trim() };

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

    /**
     * Extract the enhanced prompt from the AI response
     * @private
     * @param {string} response - The AI response
     * @returns {string|null} The extracted enhanced prompt or null if extraction failed
     */
    _extractEnhancedPrompt(response) {
        if (!response || typeof response !== 'string') {
            return null;
        }

        // Clean up the response - remove any potential formatting or extra text
        let cleaned = response.trim();
        
        // Remove common prefixes that the AI might add
        const prefixesToRemove = [
            'Enhanced prompt:',
            'Here is the enhanced prompt:',
            'The enhanced prompt is:',
            'Enhanced version:',
            'Improved prompt:'
        ];

        for (const prefix of prefixesToRemove) {
            if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
                cleaned = cleaned.substring(prefix.length).trim();
                break;
            }
        }

        // Remove quotes if the entire response is wrapped in them
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }

        return cleaned || null;
    }
}

export default PromptEnhancer;
