//REVIEW: >>how commands handle filesystem  change if they do not have access to snapshot<<
//REVIEW: >>manager?<<
import {
    createCommandRegistry,
    validateRegistry,
} from '../../commands/base/CommandRegistrySetup.js';
import { getLogger } from '../managers/logger.js';

/**
 * Handles console commands like /help, /tools, /review, etc.
 * Now uses a modular command system with individual command classes
 */
class CommandHandler {
    constructor(apiClient, toolManager, consoleInterface, costsManager, app = null) {
        this.apiClient = apiClient;
        this.toolManager = toolManager;
        this.consoleInterface = consoleInterface;
        this.costsManager = costsManager;
        this.app = app;
        this.logger = getLogger();

        // Initialize the new command registry
        this.commandRegistry = createCommandRegistry();

        // Validate the registry setup
        const validation = validateRegistry(this.commandRegistry);
        if (!validation.valid) {
            this.logger.warn('Command registry validation failed:', validation.errors);
        }
        if (validation.warnings.length > 0) {
            this.logger.warn('Command registry warnings:', validation.warnings);
        }
    }

    async handleCommand(command) {
        // Check if input starts with "/" (command prefix)
        if (command.startsWith('/')) {
            // Create execution context with all dependencies
            const context = {
                apiClient: this.apiClient,
                toolManager: this.toolManager,
                consoleInterface: this.consoleInterface,
                costsManager: this.costsManager,
                commandRegistry: this.commandRegistry,
                workflowStateMachine: this.app?.workflowStateMachine,
                app: this.app,
            };

            // Use the new command registry to handle the command
            try {
                const result = await this.commandRegistry.handleCommand(command, context);
                return result;
            } catch (error) {
                this.logger.error(error, 'Error handling command');
                return 'error';
            }
        }

        // Not a command (doesn't start with "/")
        return false;
    }
}

export default CommandHandler;
