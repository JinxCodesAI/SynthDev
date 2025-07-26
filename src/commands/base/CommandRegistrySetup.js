/**
 * Command Registry Setup
 * Initializes and registers all available commands
 */

import CommandRegistry from './CommandRegistry.js';
import { getLogger } from '../../core/managers/logger.js';

// Import all command classes
import HelpCommand from '../info/HelpCommand.js';
import ToolsCommand from '../info/ToolsCommand.js';
import ReviewCommand from '../info/ReviewCommand.js';
import CostCommand from '../info/CostCommand.js';
import ClearCommand from '../conversation/ClearCommand.js';
import ExitCommand from '../system/ExitCommand.js';
import RoleCommand from '../role/RoleCommand.js';
import RolesCommand from '../role/RolesCommand.js';

import IndexCommand from '../indexing/IndexCommand.js';
import CmdCommand from '../terminal/CmdCommand.js';
import WorkflowsCommand from '../workflow/WorkflowsCommand.js';
import WorkflowCommand from '../workflow/WorkflowCommand.js';
import { ConfigureCommand } from '../config/ConfigureCommand.js';
import SnapshotsCommand from '../snapshots/SnapshotsCommand.js';
import TaskCommand from '../task/TaskCommand.js';

/**
 * Create and configure a command registry with all available commands
 * @returns {CommandRegistry} Configured command registry
 */
export function createCommandRegistry() {
    const registry = new CommandRegistry();
    const logger = getLogger();

    // Register all commands
    try {
        // Information commands
        registry.register(new HelpCommand());
        registry.register(new ToolsCommand());
        registry.register(new ReviewCommand());
        registry.register(new CostCommand());

        // Conversation management
        registry.register(new ClearCommand());

        // System commands
        registry.register(new ExitCommand());

        // Configuration
        registry.register(new ConfigureCommand());

        // Role management
        registry.register(new RoleCommand());
        registry.register(new RolesCommand());

        // Indexing
        registry.register(new IndexCommand());

        // Terminal commands
        registry.register(new CmdCommand());

        // Snapshot commands
        registry.register(new SnapshotsCommand());

        // Task management
        registry.register(new TaskCommand());

        // Workflow commands
        // registry.register(new WorkflowsCommand());
        // registry.register(new WorkflowCommand());

        logger.debug(`✅ Registered ${registry.getAllCommands().length} commands successfully`);
    } catch (error) {
        logger.error(error, 'Error registering commands');
        throw error;
    }

    return registry;
}

/**
 * Get command registry statistics
 * @param {CommandRegistry} registry - Command registry
 * @returns {Object} Registry statistics
 */
export function getRegistryStats(registry) {
    const stats = registry.getStats();
    const categories = registry.getCommandsByCategory();

    return {
        ...stats,
        categories: Object.keys(categories),
        commandsByCategory: categories,
    };
}

/**
 * Validate command registry setup
 * @param {CommandRegistry} registry - Command registry
 * @returns {Object} Validation results
 */
export function validateRegistry(registry) {
    const results = {
        valid: true,
        errors: [],
        warnings: [],
        stats: getRegistryStats(registry),
    };

    // Check for required commands
    const requiredCommands = ['help', 'exit', 'clear'];
    for (const cmdName of requiredCommands) {
        if (!registry.hasCommand(cmdName)) {
            results.errors.push(`Missing required command: ${cmdName}`);
            results.valid = false;
        }
    }

    // Check for duplicate aliases
    const allNames = registry.getAllCommandNames();
    const duplicates = allNames.filter((name, index) => allNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
        results.errors.push(`Duplicate command names/aliases: ${duplicates.join(', ')}`);
        results.valid = false;
    }

    // Check command implementations
    for (const command of registry.getAllCommands()) {
        try {
            // Validate command has required methods
            if (typeof command.execute !== 'function') {
                results.errors.push(`Command ${command.name} missing execute method`);
                results.valid = false;
            }

            if (typeof command.getHelp !== 'function') {
                results.warnings.push(`Command ${command.name} missing getHelp method`);
            }

            if (typeof command.getUsage !== 'function') {
                results.warnings.push(`Command ${command.name} missing getUsage method`);
            }
        } catch (error) {
            results.errors.push(`Error validating command ${command.name}: ${error.message}`);
            results.valid = false;
        }
    }

    return results;
}

export default createCommandRegistry;
