import { config } from 'dotenv';
import { createInterface } from 'readline';
import { getConfigurationValidator } from './configurationValidator.js';

/**
 * Singleton ConfigManager class that loads and manages all application configuration
 */
class ConfigManager {
    constructor(options = {}) {
        if (ConfigManager.instance) {
            return ConfigManager.instance;
        }

        // Load environment variables from .env file
        config();

        // Store command line provided options
        this.cliOptions = {
            apiKey: options.apiKey,
            smartModel: options.smartModel,
            fastModel: options.fastModel,
            smartApiKey: options.smartApiKey,
            fastApiKey: options.fastApiKey,
            smartUrl: options.smartUrl,
            fastUrl: options.fastUrl,
            baseModel: options.baseModel,
            baseUrl: options.baseUrl,
        };

        // Initialize configuration
        this.config = this._loadConfiguration();

        // Mark as not yet validated
        this.isValidated = false;

        ConfigManager.instance = this;
    }

    /**
     * Get the singleton instance of ConfigManager
     * @param {Object} options - Configuration options
     * @param {string} options.apiKey - Base API key from command line
     * @param {string} options.smartModel - Smart model name from command line
     * @param {string} options.fastModel - Fast model name from command line
     * @param {string} options.smartApiKey - Smart model API key from command line
     * @param {string} options.fastApiKey - Fast model API key from command line
     * @param {string} options.smartUrl - Smart model base URL from command line
     * @param {string} options.fastUrl - Fast model base URL from command line
     * @returns {ConfigManager} The singleton instance
     */
    static getInstance(options = {}) {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager(options);
        }
        return ConfigManager.instance;
    }

    /**
     * Initialize and validate configuration (must be called after getInstance)
     * @returns {Promise<void>}
     */
    async initialize() {
        if (!this.isValidated) {
            await this._validateConfiguration();
            this.isValidated = true;
        }
    }

    /**
     * Load all configuration from environment variables and CLI options
     * @private
     * @returns {Object} Configuration object
     */
    _loadConfiguration() {
        // Prioritize CLI API key over environment variable
        const apiKey = this.cliOptions.apiKey || process.env.API_KEY;

        const config = {
            // OpenAI/General AI Provider Configuration
            base: {
                apiKey: apiKey,
                baseModel: this.cliOptions.baseModel || process.env.BASE_MODEL || 'gpt-4.1-mini',
                baseUrl:
                    this.cliOptions.baseUrl || process.env.BASE_URL || 'https://api.openai.com/v1',
            },

            // Smart Model Configuration (Optional)
            smart: {
                apiKey: this.cliOptions.smartApiKey || process.env.SMART_API_KEY || apiKey,
                model:
                    this.cliOptions.smartModel || process.env.SMART_MODEL || process.env.BASE_MODEL,
                baseUrl:
                    this.cliOptions.smartUrl || process.env.SMART_BASE_URL || process.env.BASE_URL,
            },

            // Fast Model Configuration (Optional)
            fast: {
                apiKey: this.cliOptions.fastApiKey || process.env.FAST_API_KEY || apiKey,
                model:
                    this.cliOptions.fastModel || process.env.FAST_MODEL || process.env.BASE_MODEL,
                baseUrl:
                    this.cliOptions.fastUrl || process.env.FAST_BASE_URL || process.env.BASE_URL,
            },

            // Global Settings
            global: {
                maxToolCalls: parseInt(process.env.MAX_TOOL_CALLS) || 50,
                enablePromptEnhancement: process.env.ENABLE_PROMPT_ENHANCEMENT === 'true' || false,
                verbosityLevel: parseInt(process.env.VERBOSITY_LEVEL) || 2,
            },
        };
        return config;
    }

    /**
     * Validate required configuration values
     * @private
     */
    async _validateConfiguration() {
        const validator = getConfigurationValidator();
        const errors = [];

        // Check for required base configuration - prompt if missing
        if (!this.config.base.apiKey) {
            try {
                const apiKey = await this._promptForApiKey();
                this._updateApiKey(apiKey);
            } catch (_error) {
                errors.push('API_KEY is required');
            }
        }

        // Validate base configuration
        const baseValidation = validator.validateConfiguration(this.config.base, 'base_config');
        if (!baseValidation.success) {
            errors.push(...baseValidation.errors);
        }

        // Validate smart configuration if it has required fields
        if (this.config.smart.apiKey && this.config.smart.model) {
            const smartValidation = validator.validateConfiguration(
                this.config.smart,
                'smart_config'
            );
            if (!smartValidation.success) {
                errors.push(...smartValidation.errors.map(err => `Smart config: ${err}`));
            }
        }

        // Validate fast configuration if it has required fields
        if (this.config.fast.apiKey && this.config.fast.model) {
            const fastValidation = validator.validateConfiguration(this.config.fast, 'fast_config');
            if (!fastValidation.success) {
                errors.push(...fastValidation.errors.map(err => `Fast config: ${err}`));
            }
        }

        // Validate global configuration
        const globalValidation = validator.validateConfiguration(
            this.config.global,
            'global_config'
        );
        if (!globalValidation.success) {
            errors.push(...globalValidation.errors.map(err => `Global config: ${err}`));
        }

        if (errors.length > 0) {
            const rules = validator.getValidationRules();
            const errorMessage =
                rules.error_messages?.configuration_validation_failed ||
                'Configuration validation failed:\n{errors}';
            throw new Error(errorMessage.replace('{errors}', errors.join('\n')));
        }
    }

    getMaxTokens(model) {
        if (model.indexOf('qwen3-235b-a22b') !== -1) {
            return 16000;
        }
        return 32000;
    }
    getModel(model) {
        if (model === 'base') {
            return this.config.base;
        } else if (model === 'smart') {
            return this.config.smart;
        } else if (model === 'fast') {
            return this.config.fast;
        }
    }

    getConfig() {
        return { ...this.config };
    }

    /**
     * Check if smart model is configured
     * @returns {boolean} Whether smart model configuration is available
     */
    hasSmartModelConfig() {
        return !!(this.config.smart.apiKey && this.config.smart.model);
    }

    /**
     * Check if fast model is configured
     * @returns {boolean} Whether fast model configuration is available
     */
    hasFastModelConfig() {
        return !!(this.config.fast.apiKey && this.config.fast.model);
    }

    /**
     * Prompt user for API key interactively
     * @private
     * @returns {Promise<string>} The API key entered by user
     */
    async _promptForApiKey() {
        // Use raw console.log for API key prompts since this is critical user interaction
        // and logger may not be initialized yet during config setup
        console.log('\n🔑 API Key Required');
        console.log('No API key found in environment variables or command line arguments.');
        console.log('Please provide your OpenAI API key to continue.');
        console.log('You can get your API key from: https://platform.openai.com/api-keys\n');

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve, reject) => {
            rl.question('Enter your API key: ', apiKey => {
                rl.close();

                if (!apiKey || apiKey.trim().length === 0) {
                    reject(new Error('API key cannot be empty'));
                    return;
                }

                resolve(apiKey.trim());
            });
        });
    }

    /**
     * Update the API key in configuration
     * @private
     * @param {string} apiKey - The new API key
     */
    _updateApiKey(apiKey) {
        this.config.base.apiKey = apiKey;
        this.config.smart.apiKey = this.config.smart.apiKey || apiKey;
        this.config.fast.apiKey = this.config.fast.apiKey || apiKey;
    }

    /**
     * Reload configuration from environment and CLI options
     * @returns {Promise<void>}
     */
    async reloadConfiguration() {
        this.config = this._loadConfiguration();
        this.isValidated = false;
        await this.initialize();
    }

    /**
     * Validate configuration files existence
     * @param {string[]} requiredFiles - Array of required configuration file paths
     * @returns {Object} Validation result
     */
    validateConfigurationFiles(requiredFiles = []) {
        const validator = getConfigurationValidator();
        return validator.validateConfigurationFiles(requiredFiles);
    }

    /**
     * Get configuration validation rules
     * @returns {Object} Validation rules
     */
    getValidationRules() {
        const validator = getConfigurationValidator();
        return validator.getValidationRules();
    }
}

export default ConfigManager;
