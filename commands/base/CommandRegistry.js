/**
 * Command Registry
 * Manages command registration, discovery, and execution routing
 */

import { getLogger } from '../../src/core/managers/logger.js';
import { getUIConfigManager } from '../../uiConfigManager.js';

export class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
    }

    /**
     * Register a command in the registry
     * @param {BaseCommand} command - Command instance to register
     */
    register(command) {
        if (!command || typeof command.execute !== 'function') {
            throw new Error('Invalid command: must have an execute method');
        }

        // Register main command name
        this.commands.set(command.name, command);

        // Register aliases
        if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
                if (this.aliases.has(alias)) {
                    throw new Error(`Alias '${alias}' is already registered`);
                }
                this.aliases.set(alias, command.name);
            }
        }
    }

    /**
     * Unregister a command from the registry
     * @param {string} commandName - Name of command to unregister
     */
    unregister(commandName) {
        const command = this.commands.get(commandName);
        if (command) {
            // Remove aliases
            if (command.aliases) {
                for (const alias of command.aliases) {
                    this.aliases.delete(alias);
                }
            }
            // Remove main command
            this.commands.delete(commandName);
        }
    }

    /**
     * Get a command by name or alias
     * @param {string} commandName - Command name or alias
     * @returns {BaseCommand|null} Command instance or null if not found
     */
    getCommand(commandName) {
        // Check direct command name first
        let command = this.commands.get(commandName);

        // If not found, check aliases
        if (!command) {
            const aliasTarget = this.aliases.get(commandName);
            if (aliasTarget) {
                command = this.commands.get(aliasTarget);
            }
        }

        return command || null;
    }

    /**
     * Check if a command exists
     * @param {string} commandName - Command name or alias
     * @returns {boolean} True if command exists
     */
    hasCommand(commandName) {
        return this.getCommand(commandName) !== null;
    }

    /**
     * Execute a command with given arguments and context
     * @param {string} commandName - Command name (without / prefix)
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context with dependencies
     * @returns {Promise<any>} Command execution result
     */
    async executeCommand(commandName, args, context) {
        const command = this.getCommand(commandName);

        if (!command) {
            const logger = getLogger();
            const uiConfig = getUIConfigManager();
            const errorMessage = uiConfig.getMessage('errors.command_error', {
                command: commandName,
            });
            logger.user(errorMessage);
            return 'invalid';
        }

        try {
            return await command.execute(args, context);
        } catch (error) {
            const logger = getLogger();
            logger.error(error, `Error executing command '/${commandName}'`);
            return 'error';
        }
    }

    /**
     * Parse a command input and execute it
     * @param {string} input - Full command input (e.g., "/help" or "/role coder")
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command execution result
     */
    async handleCommand(input, context) {
        if (!input.startsWith('/')) {
            return false; // Not a command
        }

        // Parse command and arguments
        const commandPart = input.substring(1); // Remove leading /
        const spaceIndex = commandPart.indexOf(' ');

        let commandName, args;
        if (spaceIndex === -1) {
            commandName = commandPart;
            args = '';
        } else {
            commandName = commandPart.substring(0, spaceIndex);
            args = commandPart.substring(spaceIndex + 1).trim();
        }

        return await this.executeCommand(commandName, args, context);
    }

    /**
     * Get all registered commands
     * @returns {BaseCommand[]} Array of all registered commands
     */
    getAllCommands() {
        return Array.from(this.commands.values());
    }

    /**
     * Get all command names (including aliases)
     * @returns {string[]} Array of all command names and aliases
     */
    getAllCommandNames() {
        const names = Array.from(this.commands.keys());
        const aliasNames = Array.from(this.aliases.keys());
        return [...names, ...aliasNames];
    }

    /**
     * Generate help text for all commands
     * @returns {string} Formatted help text
     */
    generateHelpText() {
        const commands = this.getAllCommands();

        if (commands.length === 0) {
            return '📖 No commands available';
        }

        let helpText = '\n📖 Available Commands:\n';
        helpText += `${'─'.repeat(50)}\n`;

        // Sort commands by name for consistent output
        commands.sort((a, b) => a.name.localeCompare(b.name));

        for (const command of commands) {
            helpText += `${command.getHelp()}\n`;
        }

        return helpText;
    }

    /**
     * Get commands by category (based on directory structure)
     * @returns {Object} Commands grouped by category
     */
    getCommandsByCategory() {
        const categories = {};

        for (const command of this.getAllCommands()) {
            // Try to determine category from command class name or other metadata
            let category = 'general';

            // This could be enhanced to use metadata from commands
            // For now, we'll use a simple categorization
            if (command.name.includes('role')) {
                category = 'role';
            } else if (['help', 'tools', 'review', 'cost'].includes(command.name)) {
                category = 'info';
            } else if (command.name === 'clear') {
                category = 'conversation';
            } else if (command.name === 'snapshots') {
                category = 'snapshots';
            } else if (command.name === 'index') {
                category = 'indexing';
            } else if (['exit', 'quit'].includes(command.name)) {
                category = 'system';
            }

            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(command);
        }

        return categories;
    }

    /**
     * Clear all registered commands
     */
    clear() {
        this.commands.clear();
        this.aliases.clear();
    }

    /**
     * Get registry statistics
     * @returns {Object} Registry statistics
     */
    getStats() {
        return {
            totalCommands: this.commands.size,
            totalAliases: this.aliases.size,
            commandNames: Array.from(this.commands.keys()),
            aliasNames: Array.from(this.aliases.keys()),
        };
    }
}

export default CommandRegistry;
