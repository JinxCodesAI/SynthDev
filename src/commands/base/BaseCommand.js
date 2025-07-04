/**
 * Base Command Class
 * Abstract base class for all command implementations in the command system
 */

import { getLogger } from '../../core/managers/logger.js';

export class BaseCommand {
    /**
     * Create a new command
     * @param {string} name - Command name (without the / prefix)
     * @param {string} description - Command description for help
     * @param {string[]} aliases - Alternative command names (optional)
     */
    constructor(name, description, aliases = []) {
        if (this.constructor === BaseCommand) {
            throw new Error('BaseCommand is abstract and cannot be instantiated directly');
        }

        this.name = name;
        this.description = description;
        this.aliases = aliases;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Execute the command with given arguments and context
     * @param {string} args - Command arguments (everything after the command name)
     * @param {Object} context - Execution context containing dependencies
     * @returns {Promise<any>} Command execution result
     */
    async execute(args, context) {
        try {
            // Validate context dependencies
            const validationError = this.validateContext(context);
            if (validationError) {
                throw new Error(validationError);
            }

            // Validate command arguments
            const argsValidationError = this.validateArgs(args);
            if (argsValidationError) {
                throw new Error(argsValidationError);
            }

            // Execute the command implementation
            return await this.implementation(args, context);
        } catch (error) {
            return this.handleError(error, args, context);
        }
    }

    /**
     * Implementation method to be overridden by concrete command classes
     * @param {string} _args - Command arguments
     * @param {Object} _context - Execution context
     * @returns {Promise<any>} Command execution result
     */
    async implementation(_args, _context) {
        throw new Error(`implementation method must be overridden by ${this.constructor.name}`);
    }

    /**
     * Validate the execution context contains required dependencies
     * @param {Object} context - Execution context
     * @returns {string|null} Error message if validation fails, null if valid
     */
    validateContext(context) {
        const requiredDependencies = this.getRequiredDependencies();

        for (const dependency of requiredDependencies) {
            if (!context[dependency]) {
                return `Missing required dependency: ${dependency}`;
            }
        }

        return null;
    }

    /**
     * Validate command arguments
     * @param {string} args - Command arguments
     * @returns {string|null} Error message if validation fails, null if valid
     */
    validateArgs(_args) {
        // Default implementation - no validation
        // Override in concrete classes if argument validation is needed
        return null;
    }

    /**
     * Get list of required dependencies for this command
     * @returns {string[]} Array of required dependency names
     */
    getRequiredDependencies() {
        // Default implementation - no dependencies required
        // Override in concrete classes to specify required dependencies
        return [];
    }

    /**
     * Handle command execution errors
     * @param {Error} error - The error that occurred
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {any} Error handling result
     */
    handleError(error, _args, _context) {
        const logger = getLogger();
        logger.error(error, `Error executing command '${this.name}'`);
        return 'error';
    }

    /**
     * Get help text for this command
     * @returns {string} Help text
     */
    getHelp() {
        let help = `/${this.name} - ${this.description}`;

        if (this.aliases.length > 0) {
            help += `\n   Aliases: ${this.aliases.map(alias => `/${alias}`).join(', ')}`;
        }

        const usage = this.getUsage();
        if (usage) {
            help += `\n   Usage: ${usage}`;
        }

        return help;
    }

    /**
     * Get usage information for this command
     * @returns {string} Usage text (override in concrete classes)
     */
    getUsage() {
        return `/${this.name}`;
    }

    /**
     * Check if this command matches the given command name
     * @param {string} commandName - Command name to check
     * @returns {boolean} True if this command matches
     */
    matches(commandName) {
        return this.name === commandName || this.aliases.includes(commandName);
    }

    /**
     * Create a standardized success response
     * @param {any} data - Success data to include in response
     * @returns {any} Success response
     */
    createSuccessResponse(data = true) {
        return data;
    }

    /**
     * Create a standardized error response
     * @param {string} message - Error message
     * @returns {string} Error response
     */
    createErrorResponse(message) {
        const logger = getLogger();
        logger.error(message);
        return 'error';
    }
}

/**
 * Simple Command Base Class
 * For commands that don't need complex argument parsing or async operations
 */
export class SimpleCommand extends BaseCommand {
    constructor(name, description, aliases = []) {
        super(name, description, aliases);
    }

    /**
     * Simple synchronous implementation
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {any} Command result
     */
    implementation(args, context) {
        return this.execute(args, context);
    }

    /**
     * Synchronous execute method for simple commands
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {any} Command result
     */
    execute(_args, _context) {
        throw new Error(`execute method must be overridden by ${this.constructor.name}`);
    }
}

/**
 * Interactive Command Base Class
 * For commands that require user interaction (like snapshots)
 */
export class InteractiveCommand extends BaseCommand {
    constructor(name, description, aliases = []) {
        super(name, description, aliases);
    }

    /**
     * Get required dependencies for interactive commands
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['consoleInterface', ...super.getRequiredDependencies()];
    }

    /**
     * Prompt user for input
     * @param {string} prompt - Prompt message
     * @param {Object} context - Execution context
     * @returns {Promise<string>} User input
     */
    async promptForInput(prompt, context) {
        return await context.consoleInterface.promptForInput(prompt);
    }

    /**
     * Prompt user for confirmation
     * @param {string} message - Confirmation message
     * @param {Object} context - Execution context
     * @returns {Promise<boolean>} User confirmation
     */
    async promptForConfirmation(message, context) {
        return await context.consoleInterface.promptForConfirmation(message);
    }
}

export default BaseCommand;
