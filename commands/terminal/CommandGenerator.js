import ConfigManager from '../../src/config/managers/configManager.js';
import AIAPIClient from '../../aiAPIClient.js';
import SystemMessages from '../../systemMessages.js';
import { getLogger } from '../../src/core/managers/logger.js';

/**
 * Handles AI-powered terminal command generation
 */
class CommandGenerator {
    constructor(costsManager, toolManager) {
        this.costsManager = costsManager;
        this.toolManager = toolManager;
        this.config = ConfigManager.getInstance();
        this.logger = getLogger();
    }

    /**
     * Generate a terminal command from natural language description
     * @param {string} description - Natural language description of what to do
     * @returns {Promise<{success: boolean, command?: string, error?: string}>}
     */
    async generateCommand(description) {
        if (!description || typeof description !== 'string' || description.trim() === '') {
            return { success: false, error: 'Invalid description provided' };
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

            // Set the command_generator role using SystemMessages
            const systemMessage = SystemMessages.getSystemMessage('command_generator');
            await aiClient.setSystemMessage(systemMessage, 'command_generator');

            // Create generation prompt
            const generationPrompt = this._createGenerationPrompt(description);

            // Set up response capture
            let responseContent = null;
            let responseError = null;

            aiClient.setCallbacks({
                onResponse: response => {
                    if (
                        response &&
                        response.choices &&
                        response.choices[0] &&
                        response.choices[0].message
                    ) {
                        responseContent = response.choices[0].message.content;
                    }
                },
                onError: error => {
                    responseError = error;
                },
                onReminder: reminder => {
                    return `${reminder}\n Original request was: ${description}`;
                },
            });

            // Send the generation request
            await aiClient.sendUserMessage(generationPrompt);

            // Check for errors
            if (responseError) {
                return { success: false, error: `AI processing failed: ${responseError.message}` };
            }

            // Check if we got a response
            if (!responseContent) {
                return { success: false, error: 'No response received from AI' };
            }

            // Extract the command from the response
            const command = this._extractCommand(responseContent);

            if (!command) {
                return { success: false, error: 'Failed to extract command from AI response' };
            }

            // Validate the command for basic safety
            const validationResult = this._validateCommand(command);
            if (!validationResult.safe) {
                return {
                    success: false,
                    error: `Generated command appears unsafe: ${validationResult.reason}`,
                };
            }

            return { success: true, command: command.trim() };
        } catch (error) {
            return { success: false, error: `Command generation failed: ${error.message}` };
        }
    }

    /**
     * Create the generation prompt to send to the AI
     * @private
     * @param {string} description - The natural language description
     * @returns {string} The prompt to send to the AI for command generation
     */
    _createGenerationPrompt(description) {
        const os = process.platform;
        const cwd = process.cwd();

        return `Generate a terminal command for the following request:

Request: "${description}"

Environment:
- Operating System: ${os}
- Current Directory: ${cwd}

Command:`;
    }

    /**
     * Extract the command from the AI response
     * @private
     * @param {string} response - The AI response
     * @returns {string|null} The extracted command or null if extraction failed
     */
    _extractCommand(response) {
        if (!response || typeof response !== 'string') {
            return null;
        }

        // Clean up the response - remove any potential formatting or extra text
        let cleaned = response.trim();

        // Remove common prefixes that the AI might add
        const prefixesToRemove = [
            'Command:',
            'Terminal command:',
            'The command is:',
            'Execute:',
            'Run:',
            '$',
            '> ',
        ];

        for (const prefix of prefixesToRemove) {
            if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
                cleaned = cleaned.substring(prefix.length).trim();
                break;
            }
        }

        // Remove code block formatting if present
        if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
            const lines = cleaned.split('\n');
            if (lines.length >= 3) {
                // Remove first and last lines (```bash or ``` markers)
                cleaned = lines.slice(1, -1).join('\n').trim();
            }
        }

        // Remove single backticks if the entire response is wrapped in them
        if (
            cleaned.startsWith('`') &&
            cleaned.endsWith('`') &&
            cleaned.indexOf('`', 1) === cleaned.length - 1
        ) {
            cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }

        return cleaned || null;
    }

    /**
     * Validate a command for basic safety
     * @private
     * @param {string} command - The command to validate
     * @returns {{safe: boolean, reason?: string}} Validation result
     */
    _validateCommand(command) {
        if (!command || typeof command !== 'string') {
            return { safe: false, reason: 'Empty or invalid command' };
        }

        const cmd = command.toLowerCase().trim();

        // List of potentially dangerous commands/patterns
        const dangerousPatterns = [
            /rm\s+-rf\s+\//, // rm -rf /
            /rm\s+-rf\s+\*/, // rm -rf *
            /:\(\)\{.*\}/, // Fork bomb pattern
            /sudo\s+rm/, // sudo rm commands
            /format\s+c:/, // Windows format command
            /del\s+\/s/, // Windows recursive delete
            /shutdown/, // System shutdown
            /reboot/, // System reboot
            /halt/, // System halt
            /init\s+0/, // System shutdown (Linux)
            /mkfs/, // Format filesystem
            /dd\s+if=.*of=\/dev/, // Direct disk write
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(cmd)) {
                return {
                    safe: false,
                    reason: 'Command contains potentially destructive operations',
                };
            }
        }

        // Check for command length (prevent extremely long commands)
        if (command.length > 500) {
            return { safe: false, reason: 'Command is too long' };
        }

        return { safe: true };
    }
}

export default CommandGenerator;
