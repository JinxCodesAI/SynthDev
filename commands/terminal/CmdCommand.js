import { InteractiveCommand } from '../base/BaseCommand.js';
import CommandGenerator from './CommandGenerator.js';
import { getLogger } from '../../src/core/managers/logger.js';
import executeTerminal from '../../tools/execute_terminal/implementation.js';
import { getUIConfigManager } from '../../uiConfigManager.js';

/**
 * Command for executing terminal commands with AI assistance
 * Supports both direct execution and AI-generated commands
 */
export class CmdCommand extends InteractiveCommand {
    constructor() {
        super('cmd', 'Execute terminal commands with AI assistance', ['command', 'terminal']);
        this.commandHistory = [];
        this.contextIntegrationEnabled = false; // Can be toggled by user
        this.uiConfig = getUIConfigManager();
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
            logger.raw(this.uiConfig.getMessage('cmd.context_enabled'));
            return true;
        }

        if (trimmedArgs === 'context off') {
            this.contextIntegrationEnabled = false;
            logger.raw(this.uiConfig.getMessage('cmd.context_disabled'));
            return true;
        }

        if (trimmedArgs.startsWith('context')) {
            const status = this.contextIntegrationEnabled ? 'enabled' : 'disabled';
            logger.raw(this.uiConfig.getMessage('cmd.context_status', { status }));
            logger.raw(this.uiConfig.getMessage('cmd.context_toggle_help'));
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
            logger.raw(this.uiConfig.getMessage('cmd.no_description'));
            logger.raw(this.uiConfig.getMessage('cmd.description_example'));
            return true;
        }

        logger.raw(this.uiConfig.getMessage('cmd.ai_generating'));

        // Initialize command generator
        const commandGenerator = new CommandGenerator(context.costsManager, context.toolManager);

        // Generate the command
        const result = await commandGenerator.generateCommand(description);

        if (!result.success) {
            logger.raw(this.uiConfig.getMessage('cmd.generation_failed', { error: result.error }));
            return true;
        }

        // Use prompt enhancement UX pattern - show generated command as editable input
        const originalInput = `/cmd ??? ${description}`;
        const generatedCommand = `/cmd ${result.command}`;

        logger.raw(this.uiConfig.getMessage('cmd.generation_instruction'));

        // Show the generated command as editable input
        const userPrompt = this.uiConfig.getMessage('prompts.user');
        const userInput = await context.consoleInterface.promptForEditableInput(
            userPrompt,
            generatedCommand,
            originalInput
        );

        if (userInput === null) {
            // User pressed Escape - revert to original
            logger.raw(this.uiConfig.getMessage('cmd.generation_cancelled'));
            return true;
        }

        // Parse the final user input
        const finalInput = userInput.trim();
        if (!finalInput.startsWith('/cmd ')) {
            logger.raw(this.uiConfig.getMessage('cmd.invalid_format'));
            return true;
        }

        // Extract the final command
        const finalCommand = finalInput.substring(5).trim(); // Remove '/cmd '

        if (!finalCommand) {
            logger.raw(this.uiConfig.getMessage('cmd.no_command'));
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

        logger.raw(this.uiConfig.getMessage('cmd.executing', { command }));

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
            const errorMessage = this.uiConfig.getMessage('cmd.execution_failed', { command });
            logger.error(error, errorMessage);
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
        const separator = this.uiConfig.getMessage('cmd.separator').repeat(50);

        if (result.success) {
            logger.raw(this.uiConfig.getMessage('cmd.success'));

            if (result.stdout && result.stdout.trim()) {
                logger.raw(this.uiConfig.getMessage('cmd.output_header'));
                logger.raw(separator);
                logger.raw(result.stdout.trim());
                logger.raw(separator);
            }

            if (result.stderr && result.stderr.trim()) {
                logger.raw(this.uiConfig.getMessage('cmd.warnings_header'));
                logger.raw(separator);
                logger.raw(result.stderr.trim());
                logger.raw(separator);
            }
        } else {
            logger.raw(this.uiConfig.getMessage('cmd.failed'));

            if (result.stdout && result.stdout.trim()) {
                logger.raw(this.uiConfig.getMessage('cmd.output_header'));
                logger.raw(separator);
                logger.raw(result.stdout.trim());
                logger.raw(separator);
            }

            if (result.stderr && result.stderr.trim()) {
                logger.raw(this.uiConfig.getMessage('cmd.error_header'));
                logger.raw(separator);
                logger.raw(result.stderr.trim());
                logger.raw(separator);
            }

            if (result.error) {
                logger.raw(this.uiConfig.getMessage('cmd.error_details', { error: result.error }));
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
            logger.raw(this.uiConfig.getMessage('cmd.context_auto_added'));
            return;
        }

        // Ask user if they want to add to context
        const shouldAdd = await this.promptForConfirmation(
            'Add command and results to chat history for AI context?',
            context
        );

        if (shouldAdd) {
            await this._addToContext(command, result, context, originalRequest);
            logger.raw(this.uiConfig.getMessage('cmd.context_auto_added'));
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
        const cmdHelp = this.uiConfig.getCommandHelp().cmd;

        logger.raw(`${cmdHelp.title}\n`);
        logger.raw('Usage:');
        cmdHelp.usage.forEach(usage => logger.raw(`  ${usage}`));
        logger.raw('');

        logger.raw('AI Generation:');
        cmdHelp.ai_generation.forEach(info => logger.raw(`  ${info}`));
        logger.raw('');

        logger.raw('Context Integration:');
        cmdHelp.context_integration.forEach(info => logger.raw(`  ${info}`));
        logger.raw('');

        logger.raw('Examples:');
        cmdHelp.examples.forEach(example => logger.raw(`  ${example}`));
        logger.raw('');
    }

    /**
     * Show command history
     * @private
     */
    _showHistory() {
        const logger = getLogger();

        if (this.commandHistory.length === 0) {
            logger.raw(this.uiConfig.getMessage('cmd.no_history'));
            return;
        }

        logger.raw(this.uiConfig.getMessage('cmd.history_title'));

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
