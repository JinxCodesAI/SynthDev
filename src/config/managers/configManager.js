import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { getConfigurationValidator } from '../validation/configurationValidator.js';
import { getConfigurationLoader } from '../validation/configurationLoader.js';
import { getLogger } from '../../core/managers/logger.js';

// Get the directory where this module is located (synth-dev installation directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Singleton ConfigManager class that loads and manages all application configuration
 */
class ConfigManager {
    constructor(options = {}) {
        if (ConfigManager.instance) {
            return ConfigManager.instance;
        }

        // Load environment variables from .env file in synth-dev installation directory
        this.envFilePath = join(__dirname, '..', '..', '..', '.env');
        this.envFileExists = existsSync(this.envFilePath);

        // Initialize logger
        this.logger = getLogger();

        if (this.envFileExists) {
            config({ path: this.envFilePath });
        } else {
            this.logger.warn(`No .env file found in :${this.envFilePath}`);
        }

        // Load application defaults
        this.configLoader = getConfigurationLoader();
        this.applicationDefaults = this._loadApplicationDefaults();
        this.providersConfig = this._loadProvidersConfig();

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
     * Load application defaults from configuration file
     * @private
     * @returns {Object} Application defaults
     */
    _loadApplicationDefaults() {
        return this.configLoader.loadConfig('defaults/application.json', {}, true);
    }

    /**
     * Load providers configuration from configuration file
     * @private
     * @returns {Object} Providers configuration
     */
    _loadProvidersConfig() {
        return this.configLoader.loadConfig('defaults/providers.json', {}, true);
    }

    /**
     * Load all configuration from environment variables and CLI options
     * @private
     * @returns {Object} Configuration object
     */
    _loadConfiguration() {
        // Prioritize CLI API key over environment variable
        const apiKey = this.cliOptions.apiKey || process.env.SYNTHDEV_API_KEY;

        // Get defaults from application.json
        const defaults = this.applicationDefaults;
        const modelDefaults = defaults.models || {};
        const globalDefaults = defaults.global_settings || {};
        const uiDefaults = defaults.ui_settings || {};
        const toolDefaults = defaults.tool_settings || {};
        const safetyDefaults = defaults.safety || {};

        const config = {
            // OpenAI/General AI Provider Configuration
            base: {
                apiKey: apiKey,
                baseModel:
                    this.cliOptions.baseModel ||
                    process.env.SYNTHDEV_BASE_MODEL ||
                    modelDefaults.base?.model ||
                    'gpt-4.1-mini',
                baseUrl:
                    this.cliOptions.baseUrl ||
                    process.env.SYNTHDEV_BASE_URL ||
                    modelDefaults.base?.baseUrl ||
                    'https://api.openai.com/v1',
            },

            // Smart Model Configuration (Optional)
            smart: {
                apiKey: this.cliOptions.smartApiKey || process.env.SYNTHDEV_SMART_API_KEY || apiKey,
                model:
                    this.cliOptions.smartModel ||
                    process.env.SYNTHDEV_SMART_MODEL ||
                    modelDefaults.smart?.model ||
                    process.env.SYNTHDEV_BASE_MODEL,
                baseUrl:
                    this.cliOptions.smartUrl ||
                    process.env.SYNTHDEV_SMART_BASE_URL ||
                    modelDefaults.smart?.baseUrl ||
                    process.env.SYNTHDEV_BASE_URL,
            },

            // Fast Model Configuration (Optional)
            fast: {
                apiKey: this.cliOptions.fastApiKey || process.env.SYNTHDEV_FAST_API_KEY || apiKey,
                model:
                    this.cliOptions.fastModel ||
                    process.env.SYNTHDEV_FAST_MODEL ||
                    modelDefaults.fast?.model ||
                    process.env.SYNTHDEV_BASE_MODEL,
                baseUrl:
                    this.cliOptions.fastUrl ||
                    process.env.SYNTHDEV_FAST_BASE_URL ||
                    modelDefaults.fast?.baseUrl ||
                    process.env.SYNTHDEV_BASE_URL,
            },

            // Global Settings (prioritize env vars, then application.json, then hardcoded defaults)
            global: {
                maxToolCalls:
                    parseInt(process.env.SYNTHDEV_MAX_TOOL_CALLS) ||
                    globalDefaults.maxToolCalls ||
                    50,
                enablePromptEnhancement:
                    process.env.SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT === 'true' ||
                    globalDefaults.enablePromptEnhancement ||
                    false,
                verbosityLevel:
                    parseInt(process.env.SYNTHDEV_VERBOSITY_LEVEL) ||
                    globalDefaults.verbosityLevel ||
                    2,
            },

            // UI Settings
            ui: {
                defaultRole:
                    uiDefaults.defaultRole ||
                    (() => {
                        throw new Error(
                            'Missing required configuration: ui_settings.defaultRole in defaults/application.json'
                        );
                    })(),
                showStartupBanner:
                    uiDefaults.showStartupBanner !== undefined
                        ? uiDefaults.showStartupBanner
                        : (() => {
                              throw new Error(
                                  'Missing required configuration: ui_settings.showStartupBanner in defaults/application.json'
                              );
                          })(),
                enableColors:
                    uiDefaults.enableColors !== undefined
                        ? uiDefaults.enableColors
                        : (() => {
                              throw new Error(
                                  'Missing required configuration: ui_settings.enableColors in defaults/application.json'
                              );
                          })(),
                promptPrefix:
                    uiDefaults.promptPrefix ||
                    (() => {
                        throw new Error(
                            'Missing required configuration: ui_settings.promptPrefix in defaults/application.json'
                        );
                    })(),
            },

            // Tool Settings
            tool: {
                autoRun: toolDefaults.autoRun !== false,
                modifiesFiles: toolDefaults.modifiesFiles || false,
                defaultEncoding: toolDefaults.defaultEncoding || 'utf8', //unused
                maxFileSize: toolDefaults.maxFileSize || 10485760, //unused
                defaultTimeout: toolDefaults.defaultTimeout || 10000, //unused
            },

            // Logging Settings - removed: redundant with global.verbosityLevel
            // logging: {
            //     defaultLevel: redundant with global.verbosityLevel
            //     enableHttpLogging: covered by verbosity level 5
            //     enableToolLogging: covered by verbosity levels 2-4
            //     enableErrorLogging: errors always shown regardless of verbosity
            // },

            // Safety Settings
            safety: {
                enableAISafetyCheck: safetyDefaults.enableAISafetyCheck !== false,
                fallbackToPatternMatching: safetyDefaults.fallbackToPatternMatching !== false,
                maxScriptSize: safetyDefaults.maxScriptSize || 50000,
                scriptTimeout: safetyDefaults.scriptTimeout || {
                    min: 1000,
                    max: 30000,
                    default: 10000,
                },
            },

            // Feature Settings - removed: not used anywhere in the application
            // features: {
            //     enableSnapshots: not implemented
            //     enableIndexing: not implemented
            //     enableCommandHistory: not implemented
            //     enableContextIntegration: not implemented
            // },
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

        // Check if configuration is incomplete and needs wizard
        const isIncomplete = this._isConfigurationIncomplete();

        if (isIncomplete) {
            // Mark that configuration wizard should be started
            this.needsConfigurationWizard = true;

            // Don't validate configuration if wizard is needed
            // This allows the app to start and show the wizard
            return;
        }

        // Validate base configuration only if not incomplete
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

    /**
     * Check if configuration is incomplete and needs wizard
     * @private
     * @returns {boolean} True if configuration is incomplete
     */
    _isConfigurationIncomplete() {
        const required = ['SYNTHDEV_API_KEY', 'SYNTHDEV_BASE_URL', 'SYNTHDEV_BASE_MODEL'];

        // Check if .env file exists
        if (!this.envFileExists) {
            return true;
        }

        // Check if required variables are set
        for (const key of required) {
            const value = process.env[key];
            if (
                !value ||
                value.trim() === '' ||
                value === 'your_base_model_api_key' ||
                value === 'https://api.example.com/v1'
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if configuration wizard should be started
     * @returns {boolean} True if wizard should be started
     */
    shouldStartConfigurationWizard() {
        return this.needsConfigurationWizard === true;
    }

    /**
     * Get maximum tokens for a model from providers configuration
     * @param {string} model - Model name
     * @returns {number} Maximum tokens
     */
    getMaxTokens(model) {
        const modelConfig = this._findModelConfig(model);
        if (modelConfig && modelConfig.maxResponseSize) {
            return modelConfig.maxResponseSize;
        }

        // Fallback to hardcoded values for backward compatibility
        if (model.indexOf('qwen3-235b-a22b') !== -1) {
            return 16000;
        }
        return 32000;
    }

    /**
     * Find model configuration in providers.json
     * @param {string} modelName - Model name to search for
     * @returns {Object|null} Model configuration or null if not found
     * @private
     */
    _findModelConfig(modelName) {
        if (!this.providersConfig || !this.providersConfig.providers) {
            return null;
        }

        for (const provider of this.providersConfig.providers) {
            if (provider.models) {
                const model = provider.models.find(m => m.name === modelName);
                if (model) {
                    return model;
                }
            }
        }
        return null;
    }

    /**
     * Get model parameters with environment variable overrides
     * @param {string} modelName - Model name
     * @returns {Object} Model parameters
     */
    getModelParameters(modelName) {
        const modelConfig = this._findModelConfig(modelName);
        const defaultParams = modelConfig?.defaultParameters || {};

        // Create base parameters from model defaults
        const parameters = { ...defaultParams };

        // Override with environment variables if present
        const envTemp = process.env.SYNTHDEV_TEMPERATURE;
        if (envTemp !== undefined) {
            const temp = parseFloat(envTemp);
            if (!isNaN(temp) && temp >= 0 && temp <= 2) {
                parameters.temperature = temp;
            }
        }

        const envTopP = process.env.SYNTHDEV_TOP_P;
        if (envTopP !== undefined) {
            const topP = parseFloat(envTopP);
            if (!isNaN(topP) && topP > 0 && topP <= 1) {
                parameters.top_p = topP;
            }
        }

        const envTopK = process.env.SYNTHDEV_TOP_K;
        if (envTopK !== undefined) {
            const topK = parseInt(envTopK);
            if (!isNaN(topK) && topK >= 1) {
                parameters.top_k = topK;
            }
        }

        const envFreqPenalty = process.env.SYNTHDEV_FREQUENCY_PENALTY;
        if (envFreqPenalty !== undefined) {
            const freqPenalty = parseFloat(envFreqPenalty);
            if (!isNaN(freqPenalty) && freqPenalty >= -2 && freqPenalty <= 2) {
                parameters.frequency_penalty = freqPenalty;
            }
        }

        const envPresencePenalty = process.env.SYNTHDEV_PRESENCE_PENALTY;
        if (envPresencePenalty !== undefined) {
            const presencePenalty = parseFloat(envPresencePenalty);
            if (!isNaN(presencePenalty) && presencePenalty >= -2 && presencePenalty <= 2) {
                parameters.presence_penalty = presencePenalty;
            }
        }

        const envRepetitionPenalty = process.env.SYNTHDEV_REPETITION_PENALTY;
        if (envRepetitionPenalty !== undefined) {
            const repetitionPenalty = parseFloat(envRepetitionPenalty);
            if (!isNaN(repetitionPenalty) && repetitionPenalty > 0 && repetitionPenalty <= 2) {
                parameters.repetition_penalty = repetitionPenalty;
            }
        }

        return parameters;
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
     * Reload configuration from environment and CLI options
     * @returns {Promise<void>}
     */
    async reloadConfiguration() {
        config({ path: this.envFilePath, override: true });
        getLogger().raw(`Reloading configuration... ${this.envFilePath}`);

        // Reload application defaults to ensure they are fresh
        this.applicationDefaults = this._loadApplicationDefaults();
        this.providersConfig = this._loadProvidersConfig();

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

    /**
     * Get environment file information
     * @returns {Object} Environment file path and existence status
     */
    getEnvFileInfo() {
        return {
            path: this.envFilePath,
            exists: this.envFileExists,
            absolutePath: this.envFilePath,
        };
    }
}

export default ConfigManager;
