/**
 * Configuration Wizard
 * Interactive wizard for setting up Synth-Dev configuration
 */

import { createInterface } from 'readline';
import { getConfigurationLoader } from '../configurationLoader.js';
import { EnvFileManager } from './EnvFileManager.js';
import { getLogger } from '../logger.js';

export class ConfigurationWizard {
    constructor() {
        this.logger = getLogger();
        this.configLoader = getConfigurationLoader();
        this.envManager = new EnvFileManager();
        this.rl = null;
        this.providers = null;
    }

    /**
     * Start the configuration wizard
     * @param {boolean} autoStart - Whether this was auto-started due to incomplete config
     * @returns {Promise<boolean>} Whether configuration was completed successfully
     */
    async startWizard(autoStart = false) {
        try {
            this._showWelcome(autoStart);

            // Load providers configuration
            this.providers = this._loadProviders();

            // Create readline interface
            this.rl = createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            // Run the wizard steps
            const config = await this._runWizardSteps();

            if (config) {
                // Save configuration
                const success = this.envManager.writeEnvFile(config);
                if (success) {
                    this._showSuccess();
                    return true;
                } else {
                    this._showError('Failed to save configuration file');
                    return false;
                }
            } else {
                this._showCancelled();
                return false;
            }
        } catch (error) {
            this.logger.error(error, 'Configuration wizard error');
            this._showError(error.message);
            return false;
        } finally {
            if (this.rl) {
                this.rl.close();
            }
        }
    }

    /**
     * Load providers configuration
     * @private
     * @returns {Object} Providers configuration
     */
    _loadProviders() {
        try {
            return this.configLoader.loadConfig('defaults/providers.json', {}, true);
        } catch (error) {
            this.logger.warn('Failed to load providers configuration, using defaults');
            return {
                providers: [
                    {
                        name: 'OpenAI',
                        models: ['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
                        baseUrl: 'https://api.openai.com/v1',
                    },
                ],
            };
        }
    }

    /**
     * Show welcome message
     * @private
     * @param {boolean} autoStart - Whether auto-started
     */
    _showWelcome(autoStart) {
        console.log('\n🔧 Synth-Dev Configuration Wizard');
        console.log('═'.repeat(50));

        if (autoStart) {
            console.log('⚠️  Configuration is incomplete or missing.');
            console.log("Let's set up your Synth-Dev configuration!\n");
        } else {
            console.log("Welcome! Let's configure your Synth-Dev setup.\n");
        }
    }

    /**
     * Run all wizard steps
     * @private
     * @returns {Promise<Object|null>} Configuration object or null if cancelled
     */
    async _runWizardSteps() {
        try {
            // Step 1: Choose base provider and model
            console.log('🎯 Base Model Configuration (Required)');
            console.log('This is the primary model used for most operations.\n');

            const baseProvider = await this._chooseProvider('base');
            if (!baseProvider) {
                return null;
            }

            const baseModel = await this._chooseModel(baseProvider, 'base');
            if (!baseModel) {
                return null;
            }

            const baseApiKey = await this._enterApiKey(baseProvider, 'base');
            if (!baseApiKey) {
                return null;
            }

            // Step 2: Configure smart model (optional)
            const smartConfig = await this._configureSmartModel();
            if (smartConfig === null) {
                return null;
            }

            // Step 3: Configure fast model (optional)
            const fastConfig = await this._configureFastModel();
            if (fastConfig === null) {
                return null;
            }

            // Step 4: Configure global settings
            const globalSettings = await this._configureGlobalSettings();
            if (globalSettings === null) {
                return null;
            }

            // Build final configuration
            const config = {
                SYNTHDEV_API_KEY: baseApiKey,
                SYNTHDEV_BASE_MODEL: baseModel,
                SYNTHDEV_BASE_URL: baseProvider.baseUrl,
                ...smartConfig,
                ...fastConfig,
                ...globalSettings,
            };

            return config;
        } catch (error) {
            if (error.message === 'WIZARD_CANCELLED') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Choose AI provider
     * @private
     * @param {string} modelType - Type of model (base, smart, fast)
     * @returns {Promise<Object|null>} Selected provider or null if cancelled
     */
    async _chooseProvider(modelType = 'base') {
        const stepNum = modelType === 'base' ? '1' : modelType === 'smart' ? '2a' : '3a';
        const modelLabel = modelType === 'base' ? 'Base' : modelType === 'smart' ? 'Smart' : 'Fast';

        console.log(`📡 Step ${stepNum}: Choose ${modelLabel} Model Provider`);
        console.log('─'.repeat(30));

        const providers = this.providers.providers;

        // Show provider options
        providers.forEach((provider, index) => {
            console.log(`${index + 1}. ${provider.name}`);
        });
        console.log('0. Cancel\n');

        while (true) {
            const choice = await this._prompt(`Select provider (1-${providers.length}): `);

            if (choice === '0') {
                throw new Error('WIZARD_CANCELLED');
            }

            const index = parseInt(choice) - 1;
            if (index >= 0 && index < providers.length) {
                const selected = providers[index];
                console.log(`✅ Selected: ${selected.name}\n`);
                return selected;
            }

            console.log('❌ Invalid choice. Please try again.\n');
        }
    }

    /**
     * Choose model from provider
     * @private
     * @param {Object} provider - Selected provider
     * @param {string} modelType - Type of model (base, smart, fast)
     * @returns {Promise<string|null>} Selected model or null if cancelled
     */
    async _chooseModel(provider, modelType = 'base') {
        const stepNum = modelType === 'base' ? '1b' : modelType === 'smart' ? '2b' : '3b';
        const modelLabel = modelType === 'base' ? 'Base' : modelType === 'smart' ? 'Smart' : 'Fast';

        console.log(`🤖 Step ${stepNum}: Choose ${modelLabel} Model for ${provider.name}`);
        console.log('─'.repeat(30));

        const models = provider.models;

        // Show model options in groups of 5 to avoid overwhelming
        const pageSize = 5;
        let currentPage = 0;
        const totalPages = Math.ceil(models.length / pageSize);

        while (true) {
            // Show current page of models
            const startIndex = currentPage * pageSize;
            const endIndex = Math.min(startIndex + pageSize, models.length);

            console.log(`\nPage ${currentPage + 1} of ${totalPages}:`);
            for (let i = startIndex; i < endIndex; i++) {
                console.log(`${i + 1}. ${models[i]}`);
            }

            console.log('\nNavigation:');
            if (currentPage > 0) {
                console.log('p. Previous page');
            }
            if (currentPage < totalPages - 1) {
                console.log('n. Next page');
            }
            console.log('0. Cancel');

            const choice = await this._prompt('\nSelect model number, or navigation option: ');

            if (choice === '0') {
                throw new Error('WIZARD_CANCELLED');
            }

            if (choice === 'p' && currentPage > 0) {
                currentPage--;
                continue;
            }

            if (choice === 'n' && currentPage < totalPages - 1) {
                currentPage++;
                continue;
            }

            const index = parseInt(choice) - 1;
            if (index >= 0 && index < models.length) {
                const selected = models[index];
                console.log(`✅ Selected: ${selected}\n`);
                return selected;
            }

            console.log('❌ Invalid choice. Please try again.');
        }
    }

    /**
     * Enter API key
     * @private
     * @param {Object} provider - Selected provider
     * @param {string} modelType - Type of model (base, smart, fast)
     * @returns {Promise<string|null>} API key or null if cancelled
     */
    async _enterApiKey(provider, modelType = 'base') {
        const stepNum = modelType === 'base' ? '1c' : modelType === 'smart' ? '2c' : '3c';
        const modelLabel = modelType === 'base' ? 'Base' : modelType === 'smart' ? 'Smart' : 'Fast';

        console.log(`🔑 Step ${stepNum}: Enter ${modelLabel} Model API Key for ${provider.name}`);
        console.log('─'.repeat(30));

        // Show provider-specific instructions
        this._showApiKeyInstructions(provider);

        while (true) {
            const apiKey = await this._prompt('Enter your API key (or "cancel" to exit): ');

            if (apiKey.toLowerCase() === 'cancel') {
                throw new Error('WIZARD_CANCELLED');
            }

            if (!apiKey || apiKey.trim().length === 0) {
                console.log('❌ API key cannot be empty. Please try again.\n');
                continue;
            }

            if (apiKey.trim().length < 10) {
                console.log('❌ API key seems too short. Please check and try again.\n');
                continue;
            }

            console.log('✅ API key accepted\n');
            return apiKey.trim();
        }
    }

    /**
     * Show API key instructions for provider
     * @private
     * @param {Object} provider - Provider object
     */
    _showApiKeyInstructions(provider) {
        const instructions = {
            OpenAI: 'Get your API key from: https://platform.openai.com/api-keys',
            Google: 'Get your API key from: https://aistudio.google.com/app/apikey',
            Anthropic: 'Get your API key from: https://console.anthropic.com/account/keys',
            OpenRouter: 'Get your API key from: https://openrouter.ai/keys',
        };

        const instruction =
            instructions[provider.name] || "Please obtain your API key from the provider's website";
        console.log(`💡 ${instruction}\n`);
    }

    /**
     * Configure smart model (optional)
     * @private
     * @returns {Promise<Object|null>} Smart model configuration or null if cancelled
     */
    async _configureSmartModel() {
        console.log('\n🧠 Smart Model Configuration (Optional)');
        console.log('─'.repeat(40));
        console.log('Smart models are used for complex reasoning tasks in architect role.');
        console.log('You can use the same provider/key as base model or configure separately.\n');

        const choice = await this._prompt('Configure smart model? (y/N): ');

        if (choice.toLowerCase() === 'cancel') {
            throw new Error('WIZARD_CANCELLED');
        }

        if (choice.toLowerCase() !== 'y' && choice.toLowerCase() !== 'yes') {
            console.log('⏭️  Skipping smart model configuration\n');
            return {};
        }

        const useSameAsBase = await this._prompt(
            'Use same provider and API key as base model? (Y/n): '
        );

        if (useSameAsBase.toLowerCase() === 'cancel') {
            throw new Error('WIZARD_CANCELLED');
        }

        if (useSameAsBase.toLowerCase() !== 'n' && useSameAsBase.toLowerCase() !== 'no') {
            // Use same provider, just choose different model
            const baseProvider = this.providers.providers.find(
                p => p.baseUrl === process.env.SYNTHDEV_BASE_URL
            );
            if (baseProvider) {
                const smartModel = await this._chooseModel(baseProvider, 'smart');
                if (!smartModel) {
                    return null;
                }

                return {
                    SYNTHDEV_SMART_MODEL: smartModel,
                    // API key and URL will be inherited from base
                };
            }
        }

        // Configure separate provider for smart model
        const smartProvider = await this._chooseProvider('smart');
        if (!smartProvider) {
            return null;
        }

        const smartModel = await this._chooseModel(smartProvider, 'smart');
        if (!smartModel) {
            return null;
        }

        const smartApiKey = await this._enterApiKey(smartProvider, 'smart');
        if (!smartApiKey) {
            return null;
        }

        return {
            SYNTHDEV_SMART_API_KEY: smartApiKey,
            SYNTHDEV_SMART_MODEL: smartModel,
            SYNTHDEV_SMART_BASE_URL: smartProvider.baseUrl,
        };
    }

    /**
     * Configure fast model (optional)
     * @private
     * @returns {Promise<Object|null>} Fast model configuration or null if cancelled
     */
    async _configureFastModel() {
        console.log('\n⚡ Fast Model Configuration (Optional)');
        console.log('─'.repeat(40));
        console.log('Fast models are used for quick tasks and simple operations.');
        console.log('You can use the same provider/key as base model or configure separately.\n');

        const choice = await this._prompt('Configure fast model? (y/N): ');

        if (choice.toLowerCase() === 'cancel') {
            throw new Error('WIZARD_CANCELLED');
        }

        if (choice.toLowerCase() !== 'y' && choice.toLowerCase() !== 'yes') {
            console.log('⏭️  Skipping fast model configuration\n');
            return {};
        }

        const useSameAsBase = await this._prompt(
            'Use same provider and API key as base model? (Y/n): '
        );

        if (useSameAsBase.toLowerCase() === 'cancel') {
            throw new Error('WIZARD_CANCELLED');
        }

        if (useSameAsBase.toLowerCase() !== 'n' && useSameAsBase.toLowerCase() !== 'no') {
            // Use same provider, just choose different model
            const baseProvider = this.providers.providers.find(
                p => p.baseUrl === process.env.SYNTHDEV_BASE_URL
            );
            if (baseProvider) {
                const fastModel = await this._chooseModel(baseProvider, 'fast');
                if (!fastModel) {
                    return null;
                }

                return {
                    SYNTHDEV_FAST_MODEL: fastModel,
                    // API key and URL will be inherited from base
                };
            }
        }

        // Configure separate provider for fast model
        const fastProvider = await this._chooseProvider('fast');
        if (!fastProvider) {
            return null;
        }

        const fastModel = await this._chooseModel(fastProvider, 'fast');
        if (!fastModel) {
            return null;
        }

        const fastApiKey = await this._enterApiKey(fastProvider, 'fast');
        if (!fastApiKey) {
            return null;
        }

        return {
            SYNTHDEV_FAST_API_KEY: fastApiKey,
            SYNTHDEV_FAST_MODEL: fastModel,
            SYNTHDEV_FAST_BASE_URL: fastProvider.baseUrl,
        };
    }

    /**
     * Configure global settings
     * @private
     * @returns {Promise<Object|null>} Global settings or null if cancelled
     */
    async _configureGlobalSettings() {
        console.log('\n⚙️  Global Settings (Optional)');
        console.log('─'.repeat(30));
        console.log('Configure optional global settings or press Enter to use defaults.\n');

        const settings = {};

        // Verbosity level
        const verbosity = await this._chooseVerbosity();
        if (verbosity === null) {
            throw new Error('WIZARD_CANCELLED');
        }
        if (verbosity !== undefined) {
            settings.SYNTHDEV_VERBOSITY_LEVEL = verbosity;
        }

        // Max tool calls
        const maxToolCalls = await this._chooseMaxToolCalls();
        if (maxToolCalls === null) {
            throw new Error('WIZARD_CANCELLED');
        }
        if (maxToolCalls !== undefined) {
            settings.SYNTHDEV_MAX_TOOL_CALLS = maxToolCalls;
        }

        // Prompt enhancement
        const promptEnhancement = await this._choosePromptEnhancement();
        if (promptEnhancement === null) {
            throw new Error('WIZARD_CANCELLED');
        }
        if (promptEnhancement !== undefined) {
            settings.SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT = promptEnhancement;
        }

        return settings;
    }

    /**
     * Choose verbosity level
     * @private
     * @returns {Promise<number|undefined|null>} Verbosity level, undefined for default, or null if cancelled
     */
    async _chooseVerbosity() {
        console.log('🔊 Verbosity Level:');
        console.log('0 - Minimal output');
        console.log('1 - Basic status messages');
        console.log('2 - Tool execution info (default)');
        console.log('3 - Detailed tool info');
        console.log('4 - Full tool results');
        console.log('5 - All HTTP requests');

        const choice = await this._prompt('Choose verbosity (0-5, or Enter for default): ');

        if (choice.toLowerCase() === 'cancel') {
            return null;
        }
        if (choice === '') {
            return undefined;
        }

        const level = parseInt(choice);
        if (level >= 0 && level <= 5) {
            return level;
        }

        console.log('❌ Invalid choice, using default (2)\n');
        return undefined;
    }

    /**
     * Choose max tool calls
     * @private
     * @returns {Promise<number|undefined|null>} Max tool calls, undefined for default, or null if cancelled
     */
    async _chooseMaxToolCalls() {
        console.log('\n🔧 Maximum Tool Calls:');
        console.log('Controls how many tools can be called in a single request.');
        console.log('Default: 50 (recommended for most users)');

        const choice = await this._prompt('Enter max tool calls (or Enter for default): ');

        if (choice.toLowerCase() === 'cancel') {
            return null;
        }
        if (choice === '') {
            return undefined;
        }

        const max = parseInt(choice);
        if (max > 0 && max <= 200) {
            return max;
        }

        console.log('❌ Invalid choice, using default (50)\n');
        return undefined;
    }

    /**
     * Choose prompt enhancement setting
     * @private
     * @returns {Promise<boolean|undefined|null>} Prompt enhancement setting, undefined for default, or null if cancelled
     */
    async _choosePromptEnhancement() {
        console.log('\n🔄 Prompt Enhancement:');
        console.log('⚠️  EXPERIMENTAL: Automatically enhance user prompts with AI.');
        console.log('This feature is super unstable and experimental.');
        console.log('Default: false (disabled)');

        const choice = await this._prompt(
            'Enable prompt enhancement? (y/N, or Enter for default): '
        );

        if (choice.toLowerCase() === 'cancel') {
            return null;
        }
        if (choice === '') {
            return undefined;
        }

        if (choice.toLowerCase() === 'y' || choice.toLowerCase() === 'yes') {
            console.log('⚠️  Warning: Prompt enhancement enabled. This is experimental!');
            return true;
        } else if (choice.toLowerCase() === 'n' || choice.toLowerCase() === 'no') {
            return false;
        }

        console.log('❌ Invalid choice, using default (false)\n');
        return undefined;
    }

    /**
     * Prompt user for input
     * @private
     * @param {string} question - Question to ask
     * @returns {Promise<string>} User input
     */
    _prompt(question) {
        return new Promise(resolve => {
            this.rl.question(question, answer => {
                resolve(answer.trim());
            });
        });
    }

    /**
     * Show success message
     * @private
     */
    _showSuccess() {
        console.log('\n🎉 Configuration completed successfully!');
        console.log('═'.repeat(50));
        console.log('✅ .env file has been created/updated');
        console.log('🚀 You can now use Synth-Dev');
        console.log('\nTo reconfigure later, use: /configure\n');
    }

    /**
     * Show cancellation message
     * @private
     */
    _showCancelled() {
        console.log('\n❌ Configuration cancelled');
        console.log('You can run /configure again anytime to set up your configuration.\n');
    }

    /**
     * Show error message
     * @private
     * @param {string} message - Error message
     */
    _showError(message) {
        console.log(`\n❌ Configuration failed: ${message}`);
        console.log('Please try again or check the documentation.\n');
    }
}

export default ConfigurationWizard;
