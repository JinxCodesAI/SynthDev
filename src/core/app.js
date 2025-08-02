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

import PromptEnhancer from './ai/promptEnhancer.js';
import WorkflowStateMachine from '../workflow/WorkflowStateMachine.js';
import { initializeLogger, getLogger } from './managers/logger.js';
import GitUtils from '../utils/GitUtils.js';
import { AutoSnapshotManager } from './snapshot/AutoSnapshotManager.js';
import AgentManager from '../agents/AgentManager.js';

/**
 * Main application orchestrator
 */
export default class AICoderConsole {
    constructor(config) {
        this.config = config;

        // Initialize logger with configuration
        initializeLogger(config.getConfig());
        this.logger = getLogger();

        this.costsManager = costsManager;

        // Initialize basic components first
        this.consoleInterface = new ConsoleInterface();
        this.toolManager = new ToolManager();

        this.gitUtils = new GitUtils();

        // Initialize Auto Snapshot Manager (Phase 2)
        this.autoSnapshotManager = new AutoSnapshotManager(this.toolManager);

        // Defer API client initialization until after configuration check
        this.apiClient = null;
        this.promptEnhancer = null;
        this.workflowStateMachine = null;
        this.commandHandler = null;

        // State management for input blocking and exit handling
        this.isProcessing = false;
        this.isExiting = false;
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
            baseModel.baseModel,
            this.toolManager
        );

        this.promptEnhancer = new PromptEnhancer(this.costsManager, this.toolManager);
        this.workflowStateMachine = new WorkflowStateMachine(
            this.config,
            this.toolManager,
            this.consoleInterface,
            this.costsManager
        );

        // Initialize AgentManager
        this.agentManager = AgentManager.getInstance();
        this.currentAgentId = null; // Track current agent ID for agentic roles

        this.commandHandler = new CommandHandler(
            this.apiClient,
            this.toolManager,
            this.consoleInterface,
            this.costsManager,
            this
        );

        this._setupAPIClientCallbacks();
    }

    /**
     * Reinitialize API components after configuration reload
     * @public
     */
    async reinitializeAfterConfigReload() {
        // Reset components to null to allow reinitialization
        this.apiClient = null;
        this.promptEnhancer = null;
        this.workflowStateMachine = null;
        this.commandHandler = null;

        // Reinitialize with new configuration
        this._initializeAPIComponents();

        // Reload tools and set them in API client
        await this.toolManager.loadTools();
        this.apiClient.setTools(this.toolManager.getTools());

        // Set default role and system message from updated configuration
        const defaultRole = this.config.getConfig().ui.defaultRole;
        await this.apiClient.setSystemMessage(
            SystemMessages.getSystemMessage(defaultRole),
            defaultRole
        );

        // Reload workflow configs if workflow command is available
        if (this.commandHandler.commandRegistry.getCommand('workflow')) {
            await this.workflowStateMachine.loadWorkflowConfigs();
        }
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

                // Prepare context for tool execution
                const toolContext = {
                    currentRole: this.apiClient.role,
                    currentAgentId: this.currentAgentId, // Use tracked agent ID for agentic roles
                    agentManager: this.agentManager,
                    costsManager: this.costsManager,
                    toolManager: this.toolManager,
                    app: this,
                };

                return await this.toolManager.executeToolCall(
                    toolCall,
                    this.consoleInterface,
                    null, // snapshotManager removed
                    toolContext
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

            onMaxToolCallsExceeded: async maxToolCalls => {
                // Pause input processing while waiting for user confirmation
                this.consoleInterface.pauseInput();

                try {
                    const shouldContinue =
                        await this.consoleInterface.promptForMaxToolCallsContinuation(maxToolCalls);
                    return shouldContinue;
                } finally {
                    // Always resume input after confirmation
                    this.consoleInterface.resumeInput();
                }
            },
        });

        // Set the same max tool calls callback for agents
        this.agentManager.setMaxToolCallsExceededCallback(async maxToolCalls => {
            // Pause input processing while waiting for user confirmation
            this.consoleInterface.pauseInput();

            try {
                const shouldContinue =
                    await this.consoleInterface.promptForMaxToolCallsContinuation(maxToolCalls);
                return shouldContinue;
            } finally {
                // Always resume input after confirmation
                this.consoleInterface.resumeInput();
            }
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

        // Initialize Auto Snapshot Manager after tools are loaded
        try {
            await this.autoSnapshotManager.initialize();
            this.autoSnapshotManager.integrateWithApplication(this);
        } catch (error) {
            this.logger.warn('Failed to initialize Auto Snapshot Manager', error);
        }

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
        if (commandResult !== false) {
            // Command was handled (regardless of specific return value)
            this.consoleInterface.prompt();
            return;
        }

        // Check if we're in agentic mode and should spawn/communicate with agent
        const currentRole = this.apiClient.getCurrentRole();
        if (currentRole && SystemMessages.isAgentic(currentRole)) {
            if (!this.currentAgentId) {
                // First input after switching to agentic role - spawn the agent
                try {
                    const context = {
                        currentRole: currentRole,
                        currentAgentId: null, // No parent for the initial agentic role
                        agentManager: this.agentManager,
                        costsManager: this.costsManager,
                        toolManager: this.toolManager,
                        app: this,
                    };

                    const result = await this.agentManager.spawnAgent(
                        'user', // User is spawning the agentic role
                        currentRole,
                        trimmed, // User input becomes the initial task
                        context
                    );

                    this.currentAgentId = result.agentId;
                    this.consoleInterface.showMessage(
                        `🤖 Spawned ${currentRole} agent ${result.agentId} with your task`
                    );
                } catch (error) {
                    this.consoleInterface.showError(
                        `Failed to spawn ${currentRole} agent: ${error.message}`
                    );
                }
            } else {
                // Subsequent input - communicate with existing agent
                try {
                    const result = await this.agentManager.sendMessageToAgent(
                        this.currentAgentId,
                        trimmed
                    );
                    this.consoleInterface.showToolResult(result);
                } catch (error) {
                    this.consoleInterface.showError(
                        `Failed to communicate with agent: ${error.message}`
                    );
                }
            }
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
        // Track signal handling state
        this.signalReceived = false;
        this.forceExitTimer = null;

        // Handle SIGINT (Ctrl+C) - First attempt graceful, second attempt forced
        process.on('SIGINT', () => {
            if (this.signalReceived) {
                // Second Ctrl+C - force immediate exit
                console.log('\n🚨 Force termination requested. Exiting immediately...');
                process.exit(1);
            }

            this.signalReceived = true;
            console.log(
                '\n🛑 Received SIGINT (Ctrl+C). Press Ctrl+C again within 3 seconds to force exit...'
            );

            // Set up force exit timer
            this.forceExitTimer = setTimeout(() => {
                this.signalReceived = false;
                this.forceExitTimer = null;
            }, 3000);

            // Interrupt processing if active
            if (this.isProcessing) {
                this.isProcessing = false;
                this.consoleInterface.resumeInput();
                console.log('🔄 Interrupted current processing...');
            }

            // Start graceful shutdown
            this.handleExit().catch(error => {
                console.error('❌ Error during graceful shutdown:', error.message);
                process.exit(1);
            });
        });

        // Handle SIGTERM (process termination)
        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
            this.handleExit().catch(error => {
                console.error('❌ Error during graceful shutdown:', error.message);
                process.exit(1);
            });
        });

        // Windows-specific: Handle SIGBREAK (Ctrl+Break)
        if (process.platform === 'win32') {
            process.on('SIGBREAK', () => {
                console.log('\n🛑 Received SIGBREAK (Ctrl+Break), shutting down gracefully...');
                this.handleExit().catch(error => {
                    console.error('❌ Error during graceful shutdown:', error.message);
                    process.exit(1);
                });
            });
        }

        // Handle uncaught exceptions
        process.on('uncaughtException', error => {
            console.error('💥 Uncaught exception:', error);
            this.handleExit(1).catch(() => {
                process.exit(1);
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled promise rejection at:', promise, 'reason:', reason);
            this.handleExit(1).catch(() => {
                process.exit(1);
            });
        });

        // Windows-specific: Handle console control events
        if (process.platform === 'win32') {
            // Handle Windows console control events
            process.on('beforeExit', () => {
                if (!this.signalReceived) {
                    console.log('\n🔄 Process is about to exit...');
                }
            });

            // Windows-specific: Handle console close event
            process.on('exit', code => {
                if (code !== 0 && !this.isExiting) {
                    console.log(`\n🔄 Process exiting with code ${code}...`);
                }
            });

            // Try to handle Windows console control events more aggressively
            try {
                // Set up a more aggressive signal handler for Windows
                const originalEmit = process.emit;
                process.emit = function (event, ...args) {
                    if (event === 'SIGINT' || event === 'SIGTERM' || event === 'SIGBREAK') {
                        // Force the signal to be handled immediately
                        setImmediate(() => {
                            originalEmit.call(process, event, ...args);
                        });
                        return true;
                    }
                    return originalEmit.call(process, event, ...args);
                };
            } catch (error) {
                console.warn(
                    '⚠️ Could not set up enhanced Windows signal handling:',
                    error.message
                );
            }
        }
    }

    /**
     * Handle application exit with cleanup
     * @param {number} exitCode - Exit code (default: 0)
     */
    async handleExit(exitCode = 0) {
        // Prevent multiple exit attempts
        if (this.isExiting) {
            return;
        }
        this.isExiting = true;

        // Clear any force exit timer
        if (this.forceExitTimer) {
            clearTimeout(this.forceExitTimer);
            this.forceExitTimer = null;
        }

        try {
            // Set a maximum cleanup time to prevent hanging
            const cleanupTimeout = setTimeout(() => {
                console.log('\n⏰ Cleanup timeout reached. Forcing exit...');
                process.exit(exitCode);
            }, 5000); // 5 second timeout

            // Stop processing if active
            if (this.isProcessing) {
                this.isProcessing = false;
                if (this.consoleInterface) {
                    this.consoleInterface.resumeInput();
                }
            }

            // Cleanup auto snapshot manager
            if (this.autoSnapshotManager) {
                await this.autoSnapshotManager.cleanup();
            }

            // Close log file if file logging is enabled
            if (this.logger && this.logger.isFileLoggingEnabled()) {
                this.logger.closeLogFile();
                console.log('📝 Log file closed successfully');
            }

            // Show goodbye message and close console interface
            if (this.consoleInterface) {
                this.consoleInterface.showGoodbye();
                // Close the readline interface to release stdin
                this.consoleInterface.close();
            }

            // Clear the cleanup timeout since we completed successfully
            clearTimeout(cleanupTimeout);
        } catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            console.error('❌ Error during exit cleanup:', errorMsg);
        } finally {
            // Ensure we exit even if cleanup fails
            process.exit(exitCode);
        }
    }

    /**
     * Get auto snapshot manager status (for commands and debugging)
     * @returns {Object} Auto snapshot manager status
     */
    getAutoSnapshotStatus() {
        if (!this.autoSnapshotManager) {
            return { available: false };
        }

        return {
            available: true,
            ...this.autoSnapshotManager.getStatus(),
        };
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
