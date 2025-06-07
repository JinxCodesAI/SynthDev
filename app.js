#!/usr/bin/env node

// import { OpenAI } from 'openai';
// import { readFileSync, readdirSync } from 'fs';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
import ConfigManager from './configManager.js';
import SystemMessages from './systemMessages.js';

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
        } else if (arg.startsWith('--base-model=') ) {
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
            console.log(`
Usage: synth-dev [options]

Options:
  --api-key=<key>        Provide base API key via command line
  --api_key=<key>        Alternative format for base API key
  --smart-model=<model>  Provide smart model name via command line
  --smart_model=<model>  Alternative format for smart model name
  --fast-model=<model>   Provide fast model name via command line
  --fast_model=<model>   Alternative format for fast model name
  --smart-api-key=<key>  Provide smart model API key via command line
  --smart_api_key=<key>  Alternative format for smart model API key
  --fast-api-key=<key>   Provide fast model API key via command line
  --fast_api_key=<key>   Alternative format for fast model API key
  --smart-url=<url>      Provide smart model base URL via command line
  --smart_url=<url>      Alternative format for smart model base URL
  --fast-url=<url>       Provide fast model base URL via command line
  --fast_url=<url>       Alternative format for fast model base URL
  --help, -h             Show this help message

Examples:
  synth-dev
  synth-dev --api-key=sk-your-api-key-here
  synth-dev --smart-model=gpt-4.1 --fast-model=gpt-4.1-mini
  synth-dev --smart-api-key=sk-smart-key --fast-api-key=sk-fast-key
  synth-dev --smart-url=https://api.openai.com/v1 --fast-url=https://api.openai.com/v1
            `);
            process.exit(0);
        }
    }

    return options;
}

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

import AIAPIClient from './aiAPIClient.js';
import ToolManager from './toolManager.js';
import CommandHandler from './commandHandler.js';
import ConsoleInterface from './consoleInterface.js';
import costsManager from './costsManager.js';
import SnapshotManager from './snapshotManager.js';
import PromptEnhancer from './promptEnhancer.js';
import { initializeLogger, getLogger } from './logger.js';

/**
 * Main application orchestrator
 */
class AICoderConsole {
    constructor(config) {
        this.config = config;

        // Initialize logger with configuration
        initializeLogger(config.getConfig());
        this.logger = getLogger();

        this.costsManager = costsManager
        const baseModel = config.getModel('base');
        this.apiClient = new AIAPIClient(
            this.costsManager,
            baseModel.apiKey,
            baseModel.baseUrl,
            baseModel.baseModel
        );

        this.consoleInterface = new ConsoleInterface();
        this.toolManager = new ToolManager();
        this.snapshotManager = new SnapshotManager();
        this.promptEnhancer = new PromptEnhancer(this.costsManager, this.toolManager);
        this.commandHandler = new CommandHandler(this.apiClient, this.toolManager, this.consoleInterface, this.costsManager, this.snapshotManager);

        // State management for input blocking
        this.isProcessing = false;

        this._setupAPIClientCallbacks();
    }

    _setupAPIClientCallbacks() {
        this.apiClient.setCallbacks({
            onThinking: () => {
                this.isProcessing = true;
                this.consoleInterface.showThinking();
                this.consoleInterface.pauseInput();
            },
            
            onChainOfThought: (content) => {
                this.consoleInterface.showChainOfThought(content);
            },
            
            onFinalChainOfThought: (content) => {
                this.consoleInterface.showFinalChainOfThought(content);
            },
            
            onToolExecution: async (toolCall) => {
                // Show that tools are being executed (only once)
                if (!this._toolsExecutionShown) {
                    this.consoleInterface.showExecutingTools();
                    this._toolsExecutionShown = true;
                }
                
                return await this.toolManager.executeToolCall(toolCall, this.consoleInterface, this.snapshotManager);
            },
            
            onResponse: (response, role = null) => {

                const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
                if (content) {
                    this.consoleInterface.showMessage(content, role ? `🤖 ${role}:` : '🤖 Synth-Dev:');
                    this.consoleInterface.newLine();
                    this._toolsExecutionShown = false; // Reset for next interaction
                    this.isProcessing = false; // Unblock input
                    this.consoleInterface.resumeInput();
                }
            },
            
            onError: (error) => {
                this.consoleInterface.showError(error);
                this.consoleInterface.newLine();
                this._toolsExecutionShown = false; // Reset for next interaction
                this.isProcessing = false; // Unblock input
                this.consoleInterface.resumeInput();
            }
        });
    }

    async start() {
        await this.toolManager.loadTools();
        
        // Set tools in API client
        this.apiClient.setTools(this.toolManager.getTools());
        
        // Set default role and system message
        await this.apiClient.setSystemMessage(SystemMessages.getSystemMessage('coder'), 'coder');
        
        this.consoleInterface.setupEventHandlers(
            async (input) => await this.handleInput(input),
            () => {
                this.consoleInterface.showGoodbye();
                process.exit(0);
            }
        );
        
        this.consoleInterface.showStartupMessage(
            this.apiClient.getModel(),
            this.toolManager.getToolsCount(),
            this.apiClient.getCurrentRole(),
            this.apiClient.getTotalToolCount(),
            this.apiClient.getFilteredToolCount()
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

            if (!enhancementResult.success) {
                // Enhancement failed, ask user what to do
                const userChoice = await this.consoleInterface.promptForEnhancementFailureAction(
                    enhancementResult.error,
                    originalPrompt
                );

                if (userChoice.useOriginal) {
                    this.logger.info('\n📝 Using original prompt...\n');
                    return originalPrompt;
                } else if (userChoice.useModified) {
                    this.logger.info('\n📝 Using your modified prompt...\n');
                    return userChoice.finalPrompt;
                } else {
                    // User chose to cancel
                    this.logger.info('\n🚫 Operation cancelled.\n');
                    return null; // Signal to cancel the operation
                }
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
        console.error(`
❌ Error: ${error.message}

Please:
1. Copy env.template to .env and add your API key, OR
2. Use --api-key=<your-key> command line argument, OR
3. Enter your API key when prompted

Get your API key from: https://platform.openai.com/api-keys
        `);
        process.exit(1);
    }
}

// Start the application
main().catch(console.error);