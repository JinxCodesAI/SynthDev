/**
 * Configuration Validator
 * Validates configuration objects against defined rules and schemas
 */

import { getConfigurationLoader } from './configurationLoader.js';

export class ConfigurationValidator {
    constructor() {
        this.configLoader = getConfigurationLoader();
        this.validationRules = null;
    }

    /**
     * Load validation rules from configuration
     * @private
     * @returns {Object} Validation rules
     */
    _loadValidationRules() {
        if (!this.validationRules) {
            this.validationRules = this.configLoader.loadConfig(
                'validation/config-validation.json',
                {},
                true
            );
        }
        return this.validationRules;
    }

    /**
     * Validate a configuration object
     * @param {Object} config - Configuration to validate
     * @param {string} configType - Type of configuration (base_config, smart_config, fast_config)
     * @returns {Object} Validation result with success flag and errors
     */
    validateConfiguration(config, configType = 'base_config') {
        const rules = this._loadValidationRules();
        const errors = [];

        try {
            // Validate required fields
            this._validateRequiredFields(config, configType, rules, errors);

            // Validate API key format
            if (config.apiKey) {
                this._validateApiKey(config.apiKey, rules, errors);
            }

            // Validate URL format
            if (config.baseUrl) {
                this._validateUrl(config.baseUrl, rules, errors);
            }

            // Validate model name
            if (config.model || config.baseModel) {
                const modelName = config.model || config.baseModel;
                this._validateModel(modelName, rules, errors);
            }

            // Validate limits and constraints
            this._validateLimits(config, rules, errors);

            return {
                success: errors.length === 0,
                errors: errors,
                warnings: [],
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Validation error: ${error.message}`],
                warnings: [],
            };
        }
    }

    /**
     * Validate required fields for a configuration type
     * @private
     */
    _validateRequiredFields(config, configType, rules, errors) {
        const requiredFields = rules.required_fields?.[configType] || [];

        for (const field of requiredFields) {
            if (!config[field] || config[field] === '') {
                const message = this._formatErrorMessage(
                    rules.error_messages?.missing_required_field ||
                        'Required field missing: {field}',
                    { field }
                );
                errors.push(message);
            }
        }
    }

    /**
     * Validate API key format
     * @private
     */
    _validateApiKey(apiKey, rules, errors) {
        const validation = rules.api_key_validation;
        if (!validation) {
            return;
        }

        if (validation.required && (!apiKey || apiKey.trim() === '')) {
            errors.push(rules.error_messages?.missing_api_key || 'API key is required');
            return;
        }

        if (validation.min_length && apiKey.length < validation.min_length) {
            errors.push(validation.error_message || 'API key too short');
            return;
        }

        if (validation.pattern) {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(apiKey)) {
                errors.push(validation.error_message || 'API key format invalid');
            }
        }
    }

    /**
     * Validate URL format
     * @private
     */
    _validateUrl(url, rules, errors) {
        const validation = rules.url_validation;
        if (!validation) {
            return;
        }

        if (validation.pattern) {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(url)) {
                const message = this._formatErrorMessage(
                    rules.error_messages?.invalid_url ||
                        validation.error_message ||
                        'Invalid URL format: {url}',
                    { url }
                );
                errors.push(message);
            }
        }
    }

    /**
     * Validate model name
     * @private
     */
    _validateModel(modelName, rules, errors) {
        const validation = rules.model_validation;
        if (!validation) {
            return;
        }

        if (validation.required && (!modelName || modelName.trim() === '')) {
            errors.push(validation.error_message || 'Model name is required');
            return;
        }

        if (validation.min_length && modelName.length < validation.min_length) {
            errors.push(validation.error_message || 'Model name too short');
        }
    }

    /**
     * Validate configuration limits and constraints
     * @private
     */
    _validateLimits(config, rules, errors) {
        const limits = rules.limits;
        if (!limits) {
            return;
        }

        // Validate max_tool_calls if present
        if (config.maxToolCalls !== undefined) {
            this._validateNumericLimit(
                config.maxToolCalls,
                limits.max_tool_calls,
                'maxToolCalls',
                errors
            );
        }

        // Validate verbosity_level if present
        if (config.verbosityLevel !== undefined) {
            this._validateNumericLimit(
                config.verbosityLevel,
                limits.verbosity_level,
                'verbosityLevel',
                errors
            );
        }
    }

    /**
     * Validate a numeric limit
     * @private
     */
    _validateNumericLimit(value, limitConfig, fieldName, errors) {
        if (!limitConfig) {
            return;
        }

        if (typeof value !== 'number') {
            const message = this._formatErrorMessage(
                'Invalid type for field {field}: expected number, got {actual}',
                { field: fieldName, actual: typeof value }
            );
            errors.push(message);
            return;
        }

        if (limitConfig.min !== undefined && value < limitConfig.min) {
            errors.push(limitConfig.error_message || `${fieldName} below minimum value`);
        }

        if (limitConfig.max !== undefined && value > limitConfig.max) {
            errors.push(limitConfig.error_message || `${fieldName} above maximum value`);
        }
    }

    /**
     * Format error message with parameter substitution
     * @private
     * @param {string} template - Message template
     * @param {Object} params - Parameters for substitution
     * @returns {string} Formatted message
     */
    _formatErrorMessage(template, params = {}) {
        let message = template;
        for (const [key, value] of Object.entries(params)) {
            message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return message;
    }

    /**
     * Validate configuration file existence
     * @param {string[]} requiredFiles - Array of required configuration file paths
     * @returns {Object} Validation result
     */
    validateConfigurationFiles(requiredFiles) {
        const errors = [];
        const missing = [];

        for (const filePath of requiredFiles) {
            if (!this.configLoader.configExists(filePath)) {
                missing.push(filePath);
                errors.push(`Required configuration file missing: ${filePath}`);
            }
        }

        return {
            success: errors.length === 0,
            errors: errors,
            missingFiles: missing,
        };
    }

    /**
     * Get validation rules for external use
     * @returns {Object} Validation rules
     */
    getValidationRules() {
        return this._loadValidationRules();
    }
}

// Export singleton instance
let configurationValidatorInstance = null;

/**
 * Get the singleton ConfigurationValidator instance
 * @returns {ConfigurationValidator} ConfigurationValidator instance
 */
export function getConfigurationValidator() {
    if (!configurationValidatorInstance) {
        configurationValidatorInstance = new ConfigurationValidator();
    }
    return configurationValidatorInstance;
}

export default ConfigurationValidator;
