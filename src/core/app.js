#!/usr/bin/env node

// import { OpenAI } from 'openai';
// import { readFileSync, readdirSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
import ConfigManager from '../config/managers/configManager.js';
import SystemMessages from './ai/systemMessages.js';
import { getUIConfigManager } from '../config/managers/uiConfigManager.js';
import { getConfigurationLoader } from '../config/validation/configurationLoader.js';

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (const arg of args) {
        if (arg.startsWith('--api-key=') || arg.startsWith('--api_key=')) {
            options.apiKey = arg.split('=')[1];
        } else if (arg.startsWith('--base-model=')) {
            options.baseModel = arg.split('=')[1];
        } else if (arg.startsWith('--url=')) {
            options.baseUrl = arg.split('=')[1];
        } else if (arg.startsWith('--smart-model=') || arg.startsWith('--smart_model=')) {
            options.smartModel = arg.split('=')[1];
        } else if (arg.startsWith('--fast-model=') || arg.startsWith('--fast_model=')) {
            options.fastModel = arg.split('=')[1];
        } else if (arg.startsWith('--smart-api-key=') || arg.startsWith('--smart_api_key=')) {
            options.smartApiKey = arg.split('=')[1];
        } else if (arg.startsWith('--fast-api-key=') || arg.startsWith('--fast_api_key=')) {
            options.fastApiKey = arg.split('=')[1];
        } else if (arg.startsWith('--smart-url=') || arg.startsWith('--smart_url=')) {
            options.smartUrl = arg.split('=')[1];
        } else if (arg.startsWith('--fast-url=') || arg.startsWith('--fast_url=')) {
            options.fastUrl = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            // Use raw console.log for help since logger isn't initialized yet
            const uiConfig = getUIConfigManager();
            const cliHelp = uiConfig.getCliHelp();

            console.log(`
${cliHelp.title}
${cliHelp.usage}

Options:
${cliHelp.options.map(opt => `  ${opt}`).join('\n')}

Examples:
${cliHelp.examples.map(ex => `  ${ex}`).join('\n')}
            `);
            process.exit(0);
        }
    }

    return options;
}

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

import AIAPIClient from './ai/aiAPIClient.js';
import ToolManager from './managers/toolManager.js';
import CommandHandler from './interface/commandHandler.js';
import ConsoleInterface from './interface/consoleInterface.js';
import costsManager from './managers/costsManager.js';
import SnapshotManager from './managers/snapshotManager.js';
import PromptEnhancer from './ai/promptEnhancer.js';
import WorkflowStateMachine from '../workflow/WorkflowStateMachine.js';
import AgentManager from './managers/agentManager.js';
import { initializeLogger, getLogger } from './managers/logger.js';
import GitUtils from '../utils/GitUtils.js';

/**
 * Main application orchestrator
 */
class AICoderConsole {
    constructor(config) {
        this.config = config;

        // Initialize logger with configuration
        initializeLogger(config.getConfig());
        this.logger = getLogger();

        this.costsManager = costsManager;

        // Initialize basic components first
        this.consoleInterface = new ConsoleInterface();
        this.toolManager = new ToolManager();
        this.snapshotManager = new SnapshotManager();
        this.gitUtils = new GitUtils();

        // Defer API client initialization until after configuration check
        this.apiClient = null;
        this.promptEnhancer = null;
        this.workflowStateMachine = null;
        this.commandHandler = null;
        this.agentManager = null;

        // State management for input blocking
        this.isProcessing = false;
    }

    /**
     * Initialize API client and dependent components after configuration is ready
     * @private
     */
    _initializeAPIComponents() {
        if (this.apiClient) {
            return; // Already initialized
        }

        const baseModel = this.config.getModel('base');
        this.apiClient = new AIAPIClient(
            this.costsManager,
            baseModel.apiKey,
            baseModel.baseUrl,
            baseModel.baseModel
        );

        this.promptEnhancer = new PromptEnhancer(this.costsManager, this.toolManager);
        this.agentManager = new AgentManager(
            this.config,
            this.toolManager,
            this.snapshotManager,
            this.costsManager
        );
        this.workflowStateMachine = new WorkflowStateMachine(
            this.config,
            this.toolManager,
            this.snapshotManager,
            this.consoleInterface,
            this.costsManager
        );
        this.commandHandler = new CommandHandler(
            this.apiClient,
            this.toolManager,
            this.consoleInterface,
            this.costsManager,
            this.snapshotManager,
            this
        );

        // Set app reference in costsManager for tool access to AgentManager
        this.costsManager.setApp(this);

        this._setupAPIClientCallbacks();
    }

    _setupAPIClientCallbacks() {
        this.apiClient.setCallbacks({
            onThinking: () => {
                this.isProcessing = true;
                this.consoleInterface.showThinking();
                this.consoleInterface.pauseInput();
            },

            onChainOfThought: content => {
                this.consoleInterface.showChainOfThought(content);
            },

            onFinalChainOfThought: content => {
                this.consoleInterface.showFinalChainOfThought(content);
            },

            onContentDisplay: (content, role = null) => {
                // Display content immediately without affecting UI state
                if (content) {
                    this.consoleInterface.showMessage(
                        content,
                        role ? `🤖 ${role}:` : '🤖 Synth-Dev:'
                    );
                    this.consoleInterface.newLine();
                }
            },

            onToolExecution: async toolCall => {
                // Show that tools are being executed (only once)
                if (!this._toolsExecutionShown) {
                    this.consoleInterface.showExecutingTools();
                    this._toolsExecutionShown = true;
                }

                return await this.toolManager.executeToolCall(
                    toolCall,
                    this.consoleInterface,
                    this.snapshotManager
                );
            },

            onResponse: (response, role = null) => {
                const content =
                    response &&
                    response.choices &&
                    response.choices[0] &&
                    response.choices[0].message &&
                    response.choices[0].message.content;
                if (content) {
                    this.consoleInterface.showMessage(
                        content,
                        role ? `🤖 ${role}:` : '🤖 Synth-Dev:'
                    );
                    this.consoleInterface.newLine();
                }
                // Always reset state and unblock input when response is complete
                this._toolsExecutionShown = false; // Reset for next interaction
                this.isProcessing = false; // Unblock input
                this.consoleInterface.resumeInput();
            },

            onError: error => {
                this.consoleInterface.showError(error);
                this.consoleInterface.newLine();
                this._toolsExecutionShown = false; // Reset for next interaction
                this.isProcessing = false; // Unblock input
                this.consoleInterface.resumeInput();
            },
        });
    }

    async start() {
        // Check if configuration wizard should be started first
        if (this.config.shouldStartConfigurationWizard()) {
            this.logger.info('🔧 Configuration incomplete. Starting configuration wizard...');

            // Initialize minimal command handler for wizard only
            this.commandHandler = new CommandHandler(
                null, // No API client yet
                this.toolManager,
                this.consoleInterface,
                this.costsManager,
                this.snapshotManager,
                this
            );

            // Set up event handlers
            this.consoleInterface.setupEventHandlers(
                async input => await this.handleInput(input),
                () => this.handleExit()
            );

            // Auto-start configuration wizard
            setTimeout(async () => {
                await this.commandHandler.handleCommand('/configure');
            }, 100);

            return;
        }

        // Initialize API components now that configuration is complete
        this._initializeAPIComponents();

        await this.toolManager.loadTools();

        // Set tools in API client
        this.apiClient.setTools(this.toolManager.getTools());

        // Set default role and system message from configuration
        const defaultRole = this.config.getConfig().ui.defaultRole;
        await this.apiClient.setSystemMessage(
            SystemMessages.getSystemMessage(defaultRole),
            defaultRole
        );

        if (this.commandHandler.commandRegistry.getCommand('workflow')) {
            await this.workflowStateMachine.loadWorkflowConfigs();
        }

        await this.snapshotManager.initialize();

        // Set up signal handlers for graceful shutdown
        this.setupSignalHandlers();

        this.consoleInterface.setupEventHandlers(
            async input => await this.handleInput(input),
            () => this.handleExit()
        );

        // Log config path at verbosity level 1
        const configLoader = getConfigurationLoader();
        const configPath = configLoader.getConfigDir();
        this.logger.info(`📁 Configuration files location: ${configPath}`);

        // Gather environment and git information
        const envInfo = await this._getEnvironmentInfo();
        const gitInfo = await this._getGitInfo();

        this.consoleInterface.showStartupMessage(
            this.apiClient.getModel(),
            this.toolManager.getToolsCount(),
            this.apiClient.getCurrentRole(),
            this.apiClient.getTotalToolCount(),
            this.apiClient.getFilteredToolCount(),
            envInfo,
            gitInfo
        );

        this.consoleInterface.prompt();
    }

    async handleInput(input) {
        const trimmed = input.trim();

        if (!trimmed) {
            this.consoleInterface.prompt();
            return;
        }

        // Handle commands
        const commandResult = await this.commandHandler.handleCommand(trimmed);
        if (commandResult === 'clear' || commandResult === true || commandResult === 'invalid') {
            this.consoleInterface.prompt();
            return;
        }

        // For non-command inputs, potentially enhance the prompt
        let finalPrompt = trimmed;
        if (!trimmed.startsWith('/')) {
            finalPrompt = await this._handlePromptEnhancement(trimmed);

            // If enhancement was cancelled, return to prompt
            if (finalPrompt === null) {
                this.consoleInterface.prompt();
                return;
            }

            // Create snapshot for user instruction with the final prompt
            await this.snapshotManager.createSnapshot(finalPrompt);
        }

        // Process user message through API client
        await this.apiClient.sendUserMessage(finalPrompt);
        // Note: resumeInput() is called in the API client callbacks
    }

    /**
     * Get environment file information
     * @private
     * @returns {Promise<string>} Environment information string
     */
    async _getEnvironmentInfo() {
        try {
            const envFileInfo = this.config.getEnvFileInfo();
            if (envFileInfo.exists) {
                return `${envFileInfo.path} (loaded)`;
            } else {
                return `${envFileInfo.path} (not found)`;
            }
        } catch (error) {
            this.logger.debug('Error getting environment info:', error);
            return 'environment info unavailable';
        }
    }

    /**
     * Get git repository information
     * @private
     * @returns {Promise<string>} Git information string
     */
    async _getGitInfo() {
        try {
            const gitAvailability = await this.gitUtils.checkGitAvailability();

            if (!gitAvailability.available) {
                return 'not available';
            }

            if (!gitAvailability.isRepo) {
                return 'not a git repository';
            }

            const branchResult = await this.gitUtils.getCurrentBranch();
            if (branchResult.success) {
                return `branch: ${branchResult.branch}`;
            } else {
                return 'repository (branch unknown)';
            }
        } catch (error) {
            this.logger.debug('Error getting git info:', error);
            return 'git info unavailable';
        }
    }

    /**
     * Handle prompt enhancement if enabled
     * @private
     * @param {string} originalPrompt - The original user prompt
     * @returns {Promise<string>} The final prompt to use (original, enhanced, or user-modified)
     */
    async _handlePromptEnhancement(originalPrompt) {
        // Check if prompt enhancement is enabled
        if (!this.promptEnhancer.isEnabled()) {
            return originalPrompt;
        }

        try {
            // Show enhancement in progress
            this.consoleInterface.showEnhancingPrompt();

            // Attempt to enhance the prompt
            const enhancementResult = await this.promptEnhancer.enhancePrompt(originalPrompt);
            this.logger.debug('Enhancement result:', enhancementResult);

            if (!enhancementResult.success) {
                this.consoleInterface.showEnhancementError(enhancementResult.error);
                return originalPrompt;
            }

            // Enhancement succeeded, get user approval
            const approvalResult = await this.consoleInterface.promptForEnhancedPromptApproval(
                enhancementResult.enhancedPrompt,
                originalPrompt
            );

            if (approvalResult.useOriginal) {
                this.logger.info('\n📝 Using original prompt...\n');
                return originalPrompt;
            } else if (approvalResult.useEnhanced) {
                this.logger.info('\n✨ Using enhanced prompt...\n');
                return enhancementResult.enhancedPrompt;
            } else if (approvalResult.useModified) {
                this.logger.info('\n📝 Using your modified prompt...\n');
                return approvalResult.finalPrompt;
            }

            // Fallback to original if something went wrong
            return originalPrompt;
        } catch (error) {
            // Any unexpected error during enhancement
            this.consoleInterface.showEnhancementError(error.message);
            return originalPrompt;
        }
    }

    /**
     * Set up signal handlers for graceful shutdown
     * @private
     */
    setupSignalHandlers() {
        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            this.logger.info('\n🛑 Received SIGINT (Ctrl+C), shutting down gracefully...');
            this.handleExit();
        });

        // Handle SIGTERM (process termination)
        process.on('SIGTERM', () => {
            this.logger.info('\n🛑 Received SIGTERM, shutting down gracefully...');
            this.handleExit();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', error => {
            this.logger.error('💥 Uncaught exception:', error);
            this.handleExit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('💥 Unhandled promise rejection at:', promise, 'reason:', reason);
            this.handleExit(1);
        });
    }

    /**
     * Handle application exit with cleanup
     * @param {number} exitCode - Exit code (default: 0)
     */
    async handleExit(exitCode = 0) {
        try {
            // Show goodbye message
            this.consoleInterface.showGoodbye();

            // Perform automatic cleanup if conditions are met
            const cleanupResult = await this.snapshotManager.performCleanup();
            if (cleanupResult.success) {
                this.logger.info('✅ Automatic cleanup completed successfully');
            } else if (
                cleanupResult.error &&
                !cleanupResult.error.includes('Git integration not active')
            ) {
                this.logger.warn(`⚠️ Cleanup failed: ${cleanupResult.error}`);
            }
        } catch (error) {
            this.logger.error('❌ Error during exit cleanup:', error.message);
        } finally {
            // Ensure we exit even if cleanup fails
            process.exit(exitCode);
        }
    }
}

/**
 * Main application initialization
 */
async function main() {
    try {
        // Parse command line arguments
        const cliOptions = parseCommandLineArgs();

        // Initialize configuration with CLI options
        const config = ConfigManager.getInstance(cliOptions);

        // Initialize and validate configuration (may prompt for API key)
        await config.initialize();

        // Start the application
        const app = new AICoderConsole(config);
        await app.start();
    } catch (error) {
        // Use raw console.error for startup errors since logger may not be initialized
        try {
            const uiConfig = getUIConfigManager();
            const errorMessage = uiConfig.getMessage('errors.startup_error', {
                message: error.message,
            });
            const errorDetails = uiConfig.getMessage('errors.startup_error_details');
            console.error(`\n${errorMessage}${errorDetails}\n`);
        } catch (_configError) {
            // Fallback if configuration loading fails
            console.error(`\n❌ Error: ${error.message}\n`);
        }
        process.exit(1);
    }
}

// Start the application
main().catch(console.error);
