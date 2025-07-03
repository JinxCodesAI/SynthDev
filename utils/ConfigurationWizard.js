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
        this.currentConfig = {};
    }

    /**
     * Start the configuration wizard
     * @param {boolean} autoStart - Whether this was auto-started due to incomplete config
     * @returns {Promise<boolean>} Whether configuration was completed successfully
     */
    async startWizard(autoStart = false) {
        try {
            this._showWelcome(autoStart);

            // Load providers configuration and current settings
            this.providers = this._loadProviders();
            this.currentConfig = this.envManager.readEnvFile();

            // Create readline interface
            this.rl = createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            // Show current configuration and run selective wizard
            const config = await this._runSelectiveWizard(autoStart);

            if (config) {
                // Merge with existing configuration
                const finalConfig = { ...this.currentConfig, ...config };

                // Save configuration
                const success = this.envManager.writeEnvFile(finalConfig);
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
     * Run selective wizard based on user choices
     * @private
     * @param {boolean} autoStart - Whether this was auto-started
     * @returns {Promise<Object|null>} Configuration changes or null if cancelled
     */
    async _runSelectiveWizard(autoStart) {
        try {
            // Show current configuration
            this._showCurrentConfiguration();

            if (autoStart) {
                // For auto-start, run full setup if configuration is missing
                return await this._runFullSetup();
            } else {
                // For manual start, show menu of options
                return await this._runConfigurationMenu();
            }
        } catch (error) {
            if (error.message === 'WIZARD_CANCELLED') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Show current configuration status
     * @private
     */
    _showCurrentConfiguration() {
        console.log('\n📊 Current Configuration Status:');
        console.log('═'.repeat(50));

        // Base model configuration
        console.log('\n🎯 Base Model:');
        console.log(
            `   Provider: ${this._getProviderName(this.currentConfig.SYNTHDEV_BASE_URL) || 'Not set'}`
        );
        console.log(`   Model: ${this.currentConfig.SYNTHDEV_BASE_MODEL || 'Not set'}`);
        console.log(`   API Key: ${this.currentConfig.SYNTHDEV_API_KEY ? '[SET]' : 'Not set'}`);

        // Smart model configuration
        console.log('\n🧠 Smart Model:');
        console.log(
            `   Provider: ${this._getProviderName(this.currentConfig.SYNTHDEV_SMART_BASE_URL) || 'Same as base'}`
        );
        console.log(`   Model: ${this.currentConfig.SYNTHDEV_SMART_MODEL || 'Same as base'}`);
        console.log(
            `   API Key: ${this.currentConfig.SYNTHDEV_SMART_API_KEY ? '[SET]' : 'Same as base'}`
        );

        // Fast model configuration
        console.log('\n⚡ Fast Model:');
        console.log(
            `   Provider: ${this._getProviderName(this.currentConfig.SYNTHDEV_FAST_BASE_URL) || 'Same as base'}`
        );
        console.log(`   Model: ${this.currentConfig.SYNTHDEV_FAST_MODEL || 'Same as base'}`);
        console.log(
            `   API Key: ${this.currentConfig.SYNTHDEV_FAST_API_KEY ? '[SET]' : 'Same as base'}`
        );

        // Global settings
        console.log('\n⚙️  Global Settings:');
        console.log(
            `   Verbosity Level: ${this.currentConfig.SYNTHDEV_VERBOSITY_LEVEL || '2 (default)'}`
        );
        console.log(
            `   Max Tool Calls: ${this.currentConfig.SYNTHDEV_MAX_TOOL_CALLS || '50 (default)'}`
        );
        console.log(
            `   Prompt Enhancement: ${this.currentConfig.SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT || 'false (default)'}`
        );

        console.log('');
    }

    /**
     * Get provider name from URL
     * @private
     * @param {string} url - Provider URL
     * @returns {string|null} Provider name
     */
    _getProviderName(url) {
        if (!url) {
            return null;
        }

        const providerMap = {
            'api.openai.com': 'OpenAI',
            'generativelanguage.googleapis.com': 'Google',
            'openrouter.ai': 'OpenRouter',
            'api.anthropic.com': 'Anthropic',
        };

        for (const [domain, name] of Object.entries(providerMap)) {
            if (url.includes(domain)) {
                return name;
            }
        }

        return 'Custom';
    }

    /**
     * Run configuration menu for selective changes
     * @private
     * @returns {Promise<Object|null>} Configuration changes or null if cancelled
     */
    async _runConfigurationMenu() {
        const changes = {};

        while (true) {
            console.log('\n🔧 Configuration Menu:');
            console.log('─'.repeat(30));
            console.log('1. Change Base Model Provider/Model/API Key');
            console.log('2. Change Smart Model Provider/Model/API Key');
            console.log('3. Change Fast Model Provider/Model/API Key');
            console.log('4. Change Verbosity Level');
            console.log('5. Change Max Tool Calls');
            console.log('6. Change Prompt Enhancement Setting');
            console.log('7. Run Full Configuration Setup');
            console.log('8. Save Changes and Exit');
            console.log('0. Cancel (discard changes)');

            const choice = await this._prompt('\nSelect option (0-8): ');

            if (choice === '0') {
                throw new Error('WIZARD_CANCELLED');
            }

            if (choice === '8') {
                if (Object.keys(changes).length === 0) {
                    console.log('⚠️  No changes made.');
                    return {};
                }
                return changes;
            }

            let result = null;

            switch (choice) {
                case '1':
                    result = await this._configureBaseModel();
                    break;
                case '2':
                    result = await this._configureSmartModelSelective();
                    break;
                case '3':
                    result = await this._configureFastModelSelective();
                    break;
                case '4':
                    result = await this._configureVerbosityOnly();
                    break;
                case '5':
                    result = await this._configureMaxToolCallsOnly();
                    break;
                case '6':
                    result = await this._configurePromptEnhancementOnly();
                    break;
                case '7':
                    result = await this._runFullSetup();
                    if (result) {
                        return result; // Return immediately for full setup
                    }
                    break;
                default:
                    console.log('❌ Invalid choice. Please try again.');
                    continue;
            }

            if (result === null) {
                // User cancelled this specific configuration
                continue;
            }

            if (result) {
                Object.assign(changes, result);
                console.log('✅ Changes saved to pending configuration.');
                this._showPendingChanges(changes);
            }
        }
    }

    /**
     * Show pending changes
     * @private
     * @param {Object} changes - Pending changes
     */
    _showPendingChanges(changes) {
        if (Object.keys(changes).length === 0) {
            return;
        }

        console.log('\n📝 Pending Changes:');
        console.log('─'.repeat(20));
        for (const [key, value] of Object.entries(changes)) {
            const displayValue = key.includes('API_KEY') ? '[HIDDEN]' : value;
            console.log(`   ${key}: ${displayValue}`);
        }
        console.log('');
    }

    /**
     * Run full configuration setup
     * @private
     * @returns {Promise<Object|null>} Complete configuration or null if cancelled
     */
    async _runFullSetup() {
        console.log('\n🎯 Full Configuration Setup');
        console.log('═'.repeat(40));
        console.log('This will guide you through setting up all configuration options.\n');

        const config = {};

        // Step 1: Base model configuration (required)
        console.log('🎯 Step 1: Base Model Configuration (Required)');
        const baseConfig = await this._configureBaseModel();
        if (!baseConfig) {
            return null;
        }
        Object.assign(config, baseConfig);

        // Step 2: Smart model configuration (optional)
        console.log('\n🧠 Step 2: Smart Model Configuration (Optional)');
        const smartConfig = await this._configureSmartModelSelective();
        if (smartConfig === null) {
            return null;
        }
        if (smartConfig) {
            Object.assign(config, smartConfig);
        }

        // Step 3: Fast model configuration (optional)
        console.log('\n⚡ Step 3: Fast Model Configuration (Optional)');
        const fastConfig = await this._configureFastModelSelective();
        if (fastConfig === null) {
            return null;
        }
        if (fastConfig) {
            Object.assign(config, fastConfig);
        }

        // Step 4: Global settings
        console.log('\n⚙️  Step 4: Global Settings');
        const globalConfig = await this._configureGlobalSettingsSelective();
        if (globalConfig === null) {
            return null;
        }
        if (globalConfig) {
            Object.assign(config, globalConfig);
        }

        return config;
    }

    /**
     * Configure base model
     * @private
     * @returns {Promise<Object|null>} Base model configuration or null if cancelled
     */
    async _configureBaseModel() {
        console.log('\n📡 Choose Base Model Provider:');
        const provider = await this._chooseProvider('base');
        if (!provider) {
            return null;
        }

        console.log('\n🤖 Choose Base Model:');
        const model = await this._chooseModel(provider, 'base');
        if (!model) {
            return null;
        }

        console.log('\n🔑 Enter Base Model API Key:');
        const apiKey = await this._enterApiKey(provider, 'base');
        if (!apiKey) {
            return null;
        }

        return {
            SYNTHDEV_API_KEY: apiKey,
            SYNTHDEV_BASE_MODEL: model,
            SYNTHDEV_BASE_URL: provider.baseUrl,
        };
    }

    /**
     * Configure smart model selectively
     * @private
     * @returns {Promise<Object|null>} Smart model configuration or null if cancelled
     */
    async _configureSmartModelSelective() {
        const choice = await this._prompt('Configure smart model? (y/N): ');

        if (choice.toLowerCase() === 'cancel') {
            throw new Error('WIZARD_CANCELLED');
        }

        if (choice.toLowerCase() !== 'y' && choice.toLowerCase() !== 'yes') {
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
                p => p.baseUrl === this.currentConfig.SYNTHDEV_BASE_URL
            );
            if (baseProvider) {
                const smartModel = await this._chooseModel(baseProvider, 'smart');
                if (!smartModel) {
                    return null;
                }

                return {
                    SYNTHDEV_SMART_MODEL: smartModel,
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
     * Configure fast model selectively
     * @private
     * @returns {Promise<Object|null>} Fast model configuration or null if cancelled
     */
    async _configureFastModelSelective() {
        const choice = await this._prompt('Configure fast model? (y/N): ');

        if (choice.toLowerCase() === 'cancel') {
            throw new Error('WIZARD_CANCELLED');
        }

        if (choice.toLowerCase() !== 'y' && choice.toLowerCase() !== 'yes') {
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
                p => p.baseUrl === this.currentConfig.SYNTHDEV_BASE_URL
            );
            if (baseProvider) {
                const fastModel = await this._chooseModel(baseProvider, 'fast');
                if (!fastModel) {
                    return null;
                }

                return {
                    SYNTHDEV_FAST_MODEL: fastModel,
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
     * Configure global settings selectively
     * @private
     * @returns {Promise<Object|null>} Global settings or null if cancelled
     */
    async _configureGlobalSettingsSelective() {
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
     * Configure verbosity level only
     * @private
     * @returns {Promise<Object|null>} Verbosity setting or null if cancelled
     */
    async _configureVerbosityOnly() {
        console.log(
            `\n🔊 Current Verbosity Level: ${this.currentConfig.SYNTHDEV_VERBOSITY_LEVEL || '2 (default)'}`
        );
        const verbosity = await this._chooseVerbosity();
        if (verbosity === null) {
            return null;
        }
        if (verbosity === undefined) {
            return {};
        }

        return { SYNTHDEV_VERBOSITY_LEVEL: verbosity };
    }

    /**
     * Configure max tool calls only
     * @private
     * @returns {Promise<Object|null>} Max tool calls setting or null if cancelled
     */
    async _configureMaxToolCallsOnly() {
        console.log(
            `\n🔧 Current Max Tool Calls: ${this.currentConfig.SYNTHDEV_MAX_TOOL_CALLS || '50 (default)'}`
        );
        const maxToolCalls = await this._chooseMaxToolCalls();
        if (maxToolCalls === null) {
            return null;
        }
        if (maxToolCalls === undefined) {
            return {};
        }

        return { SYNTHDEV_MAX_TOOL_CALLS: maxToolCalls };
    }

    /**
     * Configure prompt enhancement only
     * @private
     * @returns {Promise<Object|null>} Prompt enhancement setting or null if cancelled
     */
    async _configurePromptEnhancementOnly() {
        console.log(
            `\n🔄 Current Prompt Enhancement: ${this.currentConfig.SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT || 'false (default)'}`
        );
        const promptEnhancement = await this._choosePromptEnhancement();
        if (promptEnhancement === null) {
            return null;
        }
        if (promptEnhancement === undefined) {
            return {};
        }

        return { SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT: promptEnhancement };
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
