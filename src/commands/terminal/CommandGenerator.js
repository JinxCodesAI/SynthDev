import ConfigManager from '../../../src/config/managers/configManager.js';
import AIAPIClient from '../../core/ai/aiAPIClient.js';
import SystemMessages from '../../core/ai/systemMessages.js';
import { getLogger } from '../../core/managers/logger.js';
import { detectOS, detectShell, OS_TYPES, SHELL_TYPES } from '../../utils/shellDetection.js';

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
                modelConfig.model || modelConfig.baseModel,
                this.toolManager
            );

            // Set the command_generator role using SystemMessages
            const systemMessage = SystemMessages.getSystemMessage('command_generator');
            await aiClient.setSystemMessage(systemMessage, 'command_generator');

            // Create generation prompt
            const generationPrompt = await this._createGenerationPrompt(description);

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
     * @returns {Promise<string>} The prompt to send to the AI for command generation
     */
    async _createGenerationPrompt(description) {
        const os = detectOS();
        const cwd = process.cwd();

        let shellInfo = '';
        let osSpecificGuidance = '';

        try {
            const shellConfig = await detectShell();
            shellInfo = `- Shell: ${shellConfig.type} (${shellConfig.executable})`;

            // Add OS-specific guidance
            if (os === OS_TYPES.WINDOWS) {
                if (shellConfig.type === SHELL_TYPES.POWERSHELL) {
                    osSpecificGuidance = `
OS-Specific Guidelines for Windows PowerShell:
- Use PowerShell cmdlets (Get-ChildItem, Get-Content, etc.) when appropriate
- Use PowerShell parameters with dash syntax (-Path, -Recurse, -Filter, etc.)
- Use PowerShell operators (-eq, -like, -match, etc.) for comparisons
- Use PowerShell variables with $ prefix when needed
- Prefer PowerShell native commands over cmd.exe equivalents`;
                } else {
                    osSpecificGuidance = `
OS-Specific Guidelines for Windows Command Prompt:
- Use cmd.exe commands (dir, type, copy, etc.)
- Use Windows-style paths with backslashes
- Use cmd.exe syntax for parameters (/s, /q, etc.)`;
                }
            } else if (os === OS_TYPES.MACOS || os === OS_TYPES.LINUX) {
                osSpecificGuidance = `
OS-Specific Guidelines for Unix-like systems:
- Use standard Unix commands (ls, cat, grep, find, etc.)
- Use Unix-style paths with forward slashes
- Use standard Unix command options with dash syntax (-l, -a, -r, etc.)
- Consider using pipes and standard Unix text processing tools`;
            }
        } catch (error) {
            this.logger.debug(`Shell detection failed during prompt generation: ${error.message}`);
            shellInfo = '- Shell: Default system shell';
        }

        return `Generate a terminal command for the following request:

Request: "${description}"

Environment:
- Operating System: ${os}
- Current Directory: ${cwd}
${shellInfo}
${osSpecificGuidance}

Important: Generate a command that is appropriate for the detected operating system and shell. The command should be syntactically correct and use the proper command syntax for the target environment.

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

        // List of potentially dangerous commands/patterns (Unix/Linux)
        const dangerousUnixPatterns = [
            /rm\s+-rf\s+\//, // rm -rf /
            /rm\s+-rf\s+\*/, // rm -rf *
            /:\(\)\{.*\}/, // Fork bomb pattern
            /sudo\s+rm/, // sudo rm commands
            /shutdown/, // System shutdown
            /reboot/, // System reboot
            /halt/, // System halt
            /init\s+0/, // System shutdown (Linux)
            /mkfs/, // Format filesystem
            /dd\s+if=.*of=\/dev/, // Direct disk write
        ];

        // List of potentially dangerous Windows commands/patterns
        const dangerousWindowsPatterns = [
            /format\s+c:/, // Windows format command
            /del\s+\/s\s+\/q\s+\*/, // Windows recursive delete all
            /rmdir\s+\/s\s+\/q\s+c:\\/, // Remove system directory
            /shutdown\s+\/s/, // Windows shutdown
            /shutdown\s+\/r/, // Windows restart
            /diskpart/, // Disk partitioning tool
            /cipher\s+\/w/, // Secure delete
        ];

        // List of potentially dangerous PowerShell commands/patterns
        const dangerousPowerShellPatterns = [
            /remove-item\s+.*-recurse\s+.*-force\s+.*c:\\/i, // Remove-Item with force on system drive
            /format-volume\s+.*c:/i, // Format system volume
            /clear-disk/i, // Clear entire disk
            /stop-computer/i, // Shutdown computer
            /restart-computer/i, // Restart computer
            /invoke-expression\s+.*\$\(/i, // Potentially dangerous code execution
            /iex\s+.*\$\(/i, // Short form of Invoke-Expression
            /start-process\s+.*-verb\s+runas/i, // Elevation attempts
        ];

        // Check Unix/Linux patterns
        for (const pattern of dangerousUnixPatterns) {
            if (pattern.test(cmd)) {
                return {
                    safe: false,
                    reason: 'Command contains potentially destructive Unix/Linux operations',
                };
            }
        }

        // Check Windows patterns
        for (const pattern of dangerousWindowsPatterns) {
            if (pattern.test(cmd)) {
                return {
                    safe: false,
                    reason: 'Command contains potentially destructive Windows operations',
                };
            }
        }

        // Check PowerShell patterns
        for (const pattern of dangerousPowerShellPatterns) {
            if (pattern.test(cmd)) {
                return {
                    safe: false,
                    reason: 'Command contains potentially destructive PowerShell operations',
                };
            }
        }

        // Check for command length (prevent extremely long commands)
        if (command.length > 1000) {
            return { safe: false, reason: 'Command is too long' };
        }

        // Additional PowerShell-specific validation
        if (this._isPowerShellSyntax(command)) {
            return this._validatePowerShellSyntax(command);
        }

        return { safe: true };
    }

    /**
     * Check if command uses PowerShell syntax
     * @private
     * @param {string} command - The command to check
     * @returns {boolean} True if command appears to use PowerShell syntax
     */
    _isPowerShellSyntax(command) {
        const powerShellIndicators = [
            /Get-\w+/i, // Get-* cmdlets
            /Set-\w+/i, // Set-* cmdlets
            /New-\w+/i, // New-* cmdlets
            /Remove-\w+/i, // Remove-* cmdlets
            /-\w+\s+\w+/, // Parameters like -Path value
            /\$\w+/, // Variables
            /\|\s*Where-Object/i, // Pipeline operations
            /\|\s*ForEach-Object/i,
            /\|\s*Select-Object/i,
        ];

        return powerShellIndicators.some(pattern => pattern.test(command));
    }

    /**
     * Validate PowerShell-specific syntax
     * @private
     * @param {string} command - The PowerShell command to validate
     * @returns {{safe: boolean, reason?: string}} Validation result
     */
    _validatePowerShellSyntax(command) {
        // Check for balanced quotes
        const singleQuotes = (command.match(/'/g) || []).length;
        const doubleQuotes = (command.match(/"/g) || []).length;

        if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
            return { safe: false, reason: 'PowerShell command has unbalanced quotes' };
        }

        // Check for balanced parentheses and brackets
        const openParens = (command.match(/\(/g) || []).length;
        const closeParens = (command.match(/\)/g) || []).length;
        const openBrackets = (command.match(/\[/g) || []).length;
        const closeBrackets = (command.match(/\]/g) || []).length;
        const openBraces = (command.match(/\{/g) || []).length;
        const closeBraces = (command.match(/\}/g) || []).length;

        if (
            openParens !== closeParens ||
            openBrackets !== closeBrackets ||
            openBraces !== closeBraces
        ) {
            return {
                safe: false,
                reason: 'PowerShell command has unbalanced brackets or parentheses',
            };
        }

        return { safe: true };
    }
}

export default CommandGenerator;
