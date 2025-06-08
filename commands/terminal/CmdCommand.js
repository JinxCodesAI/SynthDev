import { InteractiveCommand } from '../base/BaseCommand.js';
import CommandGenerator from './CommandGenerator.js';
import { getLogger } from '../../logger.js';
import executeTerminal from '../../tools/execute_terminal/implementation.js';

/**
 * Command for executing terminal commands with AI assistance
 * Supports both direct execution and AI-generated commands
 */
export class CmdCommand extends InteractiveCommand {
    constructor() {
        super('cmd', 'Execute terminal commands with AI assistance', ['command', 'terminal']);
        this.commandHistory = [];
        this.contextIntegrationEnabled = false; // Can be toggled by user
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['toolManager', 'costsManager', 'apiClient', ...super.getRequiredDependencies()];
    }

    /**
     * Execute the cmd command
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command execution result
     */
    async implementation(args, context) {
        const logger = getLogger();

        if (!args || args.trim() === '') {
            this._showUsage();
            return true;
        }

        const trimmedArgs = args.trim();

        // Handle special commands
        if (trimmedArgs === 'history') {
            this._showHistory();
            return true;
        }

        if (trimmedArgs === 'context on') {
            this.contextIntegrationEnabled = true;
            logger.raw(
                '✅ Context integration enabled - commands and results will be added to chat history\n'
            );
            return true;
        }

        if (trimmedArgs === 'context off') {
            this.contextIntegrationEnabled = false;
            logger.raw('❌ Context integration disabled\n');
            return true;
        }

        if (trimmedArgs.startsWith('context')) {
            logger.raw(
                `ℹ️  Context integration is currently ${this.contextIntegrationEnabled ? 'enabled' : 'disabled'}`
            );
            logger.raw('   Use "/cmd context on" or "/cmd context off" to toggle\n');
            return true;
        }

        // Check if this is an AI generation request (contains ???)
        if (trimmedArgs.includes('???')) {
            return await this._handleAIGeneration(trimmedArgs, context);
        } else {
            // Direct command execution
            return await this._handleDirectExecution(trimmedArgs, context);
        }
    }

    /**
     * Handle AI-generated command execution
     * @private
     * @param {string} request - The request containing ???
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Execution result
     */
    async _handleAIGeneration(request, context) {
        const logger = getLogger();

        // Extract the description by removing ???
        const description = request.replace(/\?\?\?/g, '').trim();

        if (!description) {
            logger.raw('❌ Please provide a description of what you want to do after ???\n');
            logger.raw('   Example: /cmd ??? add all files to git\n');
            return true;
        }

        logger.raw('🤖 Generating command...\n');

        // Initialize command generator
        const commandGenerator = new CommandGenerator(context.costsManager, context.toolManager);

        // Generate the command
        const result = await commandGenerator.generateCommand(description);

        if (!result.success) {
            logger.raw(`❌ Failed to generate command: ${result.error}\n`);
            return true;
        }

        // Use prompt enhancement UX pattern - show generated command as editable input
        const originalInput = `/cmd ??? ${description}`;
        const generatedCommand = `/cmd ${result.command}`;

        logger.raw('🔄 Press Esc to revert to original or ENTER to submit current command');

        // Show the generated command as editable input
        const userInput = await context.consoleInterface.promptForEditableInput(
            '💭 You: ',
            generatedCommand,
            originalInput
        );

        if (userInput === null) {
            // User pressed Escape - revert to original
            logger.raw('🚫 Command generation cancelled\n');
            return true;
        }

        // Parse the final user input
        const finalInput = userInput.trim();
        if (!finalInput.startsWith('/cmd ')) {
            logger.raw('❌ Invalid command format\n');
            return true;
        }

        // Extract the final command
        const finalCommand = finalInput.substring(5).trim(); // Remove '/cmd '

        if (!finalCommand) {
            logger.raw('❌ No command to execute\n');
            return true;
        }

        // Execute the final command
        return await this._executeCommand(finalCommand, context, description);
    }

    /**
     * Handle direct command execution
     * @private
     * @param {string} command - The command to execute
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Execution result
     */
    async _handleDirectExecution(command, context) {
        return await this._executeCommand(command, context);
    }

    /**
     * Execute a terminal command
     * @private
     * @param {string} command - The command to execute
     * @param {Object} context - Execution context
     * @param {string} originalRequest - Original user request (for AI-generated commands)
     * @returns {Promise<any>} Execution result
     */
    async _executeCommand(command, context, originalRequest = null) {
        const logger = getLogger();

        logger.raw(`⚡ Executing: ${command}\n`);

        try {
            // Execute the command using the execute_terminal tool
            const result = await executeTerminal({ command });

            // Add to command history
            this.commandHistory.push({
                command,
                originalRequest,
                timestamp: new Date().toISOString(),
                success: result.success,
                stdout: result.stdout,
                stderr: result.stderr,
            });

            // Display results
            this._displayCommandResult(result);

            // Ask user if they want to add to chat context
            await this._handleContextIntegration(command, result, context, originalRequest);

            return true;
        } catch (error) {
            logger.error(error, `Failed to execute command: ${command}`);
            return true;
        }
    }

    /**
     * Display command execution results
     * @private
     * @param {Object} result - Command execution result
     */
    _displayCommandResult(result) {
        const logger = getLogger();

        if (result.success) {
            logger.raw('✅ Command completed successfully\n');

            if (result.stdout && result.stdout.trim()) {
                logger.raw('📤 Output:');
                logger.raw('─'.repeat(50));
                logger.raw(result.stdout.trim());
                logger.raw('─'.repeat(50));
            }

            if (result.stderr && result.stderr.trim()) {
                logger.raw('⚠️  Warnings/Info:');
                logger.raw('─'.repeat(50));
                logger.raw(result.stderr.trim());
                logger.raw('─'.repeat(50));
            }
        } else {
            logger.raw('❌ Command failed\n');

            if (result.stdout && result.stdout.trim()) {
                logger.raw('📤 Output:');
                logger.raw('─'.repeat(50));
                logger.raw(result.stdout.trim());
                logger.raw('─'.repeat(50));
            }

            if (result.stderr && result.stderr.trim()) {
                logger.raw('❌ Error:');
                logger.raw('─'.repeat(50));
                logger.raw(result.stderr.trim());
                logger.raw('─'.repeat(50));
            }

            if (result.error) {
                logger.raw(`💥 Error details: ${result.error}`);
            }
        }

        logger.raw(); // Add spacing
    }

    /**
     * Handle context integration - ask user if they want to save command and results
     * @private
     * @param {string} command - The executed command
     * @param {Object} result - Command execution result
     * @param {Object} context - Execution context
     * @param {string} originalRequest - Original user request (for AI-generated commands)
     */
    async _handleContextIntegration(command, result, context, originalRequest = null) {
        const logger = getLogger();

        // If context integration is enabled globally, add automatically
        if (this.contextIntegrationEnabled) {
            await this._addToContext(command, result, context, originalRequest);
            logger.raw('📝 Command and results added to chat history\n');
            return;
        }

        // Ask user if they want to add to context
        const shouldAdd = await this.promptForConfirmation(
            'Add command and results to chat history for AI context?',
            context
        );

        if (shouldAdd) {
            await this._addToContext(command, result, context, originalRequest);
            logger.raw('📝 Command and results added to chat history\n');
        }
    }

    /**
     * Add command and results to chat context
     * @private
     * @param {string} command - The executed command
     * @param {Object} result - Command execution result
     * @param {Object} context - Execution context
     * @param {string} originalRequest - Original user request (for AI-generated commands)
     */
    async _addToContext(command, result, context, originalRequest = null) {
        try {
            let contextMessage = 'Terminal command executed:\n';

            if (originalRequest) {
                contextMessage += `Original request: ${originalRequest}\n`;
            }

            contextMessage += `Command: ${command}\n`;
            contextMessage += `Success: ${result.success}\n`;

            if (result.stdout && result.stdout.trim()) {
                contextMessage += `Output:\n${result.stdout.trim()}\n`;
            }

            if (result.stderr && result.stderr.trim()) {
                contextMessage += `Stderr:\n${result.stderr.trim()}\n`;
            }

            if (result.error) {
                contextMessage += `Error: ${result.error}\n`;
            }

            // Add as user message to preserve context without triggering AI response
            context.apiClient.addUserMessage(contextMessage);
        } catch (error) {
            const logger = getLogger();
            logger.debug('Failed to add command to context:', error.message);
        }
    }

    /**
     * Show command usage information
     * @private
     */
    _showUsage() {
        const logger = getLogger();
        logger.raw('🔧 Terminal Command Execution\n');
        logger.raw('Usage:');
        logger.raw('  /cmd <command>           - Execute command directly');
        logger.raw('  /cmd ??? <description>    - Generate command with AI (editable)');
        logger.raw('  /cmd history             - Show command history');
        logger.raw('  /cmd context on/off      - Toggle auto context integration');
        logger.raw('  /cmd context             - Show context status\n');
        logger.raw('AI Generation:');
        logger.raw('  - Generated command replaces your input');
        logger.raw('  - Edit the command before pressing ENTER');
        logger.raw('  - Press ESC to cancel and revert\n');
        logger.raw('Context Integration:');
        logger.raw('  - When disabled: asks after each command');
        logger.raw('  - When enabled: automatically adds to chat history\n');
        logger.raw('Examples:');
        logger.raw('  /cmd git status');
        logger.raw('  /cmd ??? add all files to git');
        logger.raw('  /cmd ??? list all JavaScript files\n');
    }

    /**
     * Show command history
     * @private
     */
    _showHistory() {
        const logger = getLogger();

        if (this.commandHistory.length === 0) {
            logger.raw('📜 No commands in history\n');
            return;
        }

        logger.raw('📜 Command History:\n');

        this.commandHistory.slice(-10).forEach((entry, index) => {
            const timestamp = new Date(entry.timestamp).toLocaleTimeString();
            const status = entry.success ? '✅' : '❌';

            logger.raw(`${index + 1}. ${status} [${timestamp}] ${entry.command}`);

            if (entry.originalRequest) {
                logger.raw(`   Request: ${entry.originalRequest}`);
            }
        });

        logger.raw();
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/cmd <command> | /cmd ??? <description>';
    }
}

export default CmdCommand;
