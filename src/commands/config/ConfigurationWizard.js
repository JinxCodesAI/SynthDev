/**
 * Configuration Wizard
 * Core logic for the configuration wizard system
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from '../../core/managers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ConfigurationWizard {
    constructor() {
        this.logger = getLogger();
        // Get the root directory (where .env should be)
        const rootDir = join(__dirname, '../..');
        this.envFilePath = join(rootDir, '.env');
        this.providersPath = join(rootDir, 'config/defaults/providers.json');
        this.exampleEnvPath = join(rootDir, 'config.example.env');
        this.openRouterExamplePath = join(rootDir, 'config.example.openrouter.env');

        this.providers = this._loadProviders();
        this.currentConfig = this._loadCurrentConfig();
        this.envVariables = this._parseExampleEnvFiles();
    }

    /**
     * Load providers configuration
     * @private
     * @returns {Object} Providers configuration
     */
    _loadProviders() {
        try {
            const providersData = readFileSync(this.providersPath, 'utf8');
            const raw = JSON.parse(providersData);
            return {
                providers: raw.providers.map(p => ({
                    name: p.name,
                    models: p.models.map(x => x.name),
                    baseUrl: p.baseUrl,
                })),
            };
        } catch (error) {
            this.logger.error('Failed to load providers configuration:', error);
            return { providers: [] };
        }
    }

    /**
     * Load current .env configuration
     * @private
     * @returns {Object} Current environment variables
     */
    _loadCurrentConfig() {
        const config = {};

        if (existsSync(this.envFilePath)) {
            try {
                const envContent = readFileSync(this.envFilePath, 'utf8');
                const lines = envContent.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        if (key && valueParts.length > 0) {
                            config[key.trim()] = valueParts.join('=').trim();
                        }
                    }
                }
            } catch (error) {
                this.logger.error('Failed to load current .env file:', error);
            }
        }

        return config;
    }

    /**
     * Parse example .env files to get all available variables with descriptions
     * @private
     * @returns {Object} Environment variables with descriptions
     */
    _parseExampleEnvFiles() {
        const variables = {};

        // Parse both example files
        const filesToParse = [this.exampleEnvPath, this.openRouterExamplePath];

        for (const filePath of filesToParse) {
            try {
                if (!existsSync(filePath)) {
                    continue;
                }

                const exampleContent = readFileSync(filePath, 'utf8');
                const lines = exampleContent.split('\n');
                let currentComment = '';

                for (const line of lines) {
                    const trimmed = line.trim();

                    if (trimmed.startsWith('#')) {
                        // Skip commented out variable lines like #SYNTHDEV_SMART_API_KEY=
                        if (!trimmed.includes('=') || trimmed.indexOf('#') < trimmed.indexOf('=')) {
                            currentComment += `${trimmed.substring(1).trim()} `;
                        }
                    } else if (trimmed && trimmed.includes('=')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        if (key) {
                            const keyName = key.trim();
                            if (!variables[keyName]) {
                                // Don't overwrite if already exists
                                variables[keyName] = {
                                    defaultValue: valueParts.join('=').trim(),
                                    description: currentComment.trim(),
                                };
                            }
                        }
                        currentComment = '';
                    } else if (!trimmed) {
                        currentComment = '';
                    }
                }
            } catch (error) {
                this.logger.error(`Failed to parse example .env file ${filePath}:`, error);
            }
        }

        return variables;
    }

    /**
     * Check if configuration is complete
     * @returns {Object} Completeness status
     */
    checkCompleteness() {
        const required = ['SYNTHDEV_API_KEY', 'SYNTHDEV_BASE_URL', 'SYNTHDEV_BASE_MODEL'];
        const missing = required.filter(
            key => !this.currentConfig[key] || this.currentConfig[key].trim() === ''
        );

        return {
            isComplete: missing.length === 0,
            missing: missing,
            hasEnvFile: existsSync(this.envFilePath),
        };
    }

    /**
     * Get available providers
     * @returns {Array} List of providers
     */
    getProviders() {
        return this.providers.providers || [];
    }

    /**
     * Get models for a specific provider
     * @param {string} providerName - Provider name
     * @returns {Array} List of models
     */
    getModelsForProvider(providerName) {
        const provider = this.providers.providers.find(p => p.name === providerName);
        return provider ? provider.models : [];
    }

    /**
     * Get provider by name
     * @param {string} providerName - Provider name
     * @returns {Object|null} Provider object
     */
    getProvider(providerName) {
        return this.providers.providers.find(p => p.name === providerName) || null;
    }

    /**
     * Get current configuration value
     * @param {string} key - Configuration key
     * @returns {string} Current value
     */
    getCurrentValue(key) {
        return this.currentConfig[key] || '';
    }

    /**
     * Set configuration value
     * @param {string} key - Configuration key
     * @param {string} value - Configuration value
     */
    setConfigValue(key, value) {
        this.currentConfig[key] = value;
    }

    /**
     * Get configuration summary for display
     * @returns {Object} Configuration summary
     */
    getConfigSummary() {
        const summary = {
            base: {
                provider: this._getProviderFromUrl(this.currentConfig.SYNTHDEV_BASE_URL),
                model: this.currentConfig.SYNTHDEV_BASE_MODEL || 'Not set',
                apiKey: this.currentConfig.SYNTHDEV_API_KEY ? '***set***' : 'Not set',
            },
            smart: {
                provider: this._getProviderFromUrl(this.currentConfig.SYNTHDEV_SMART_BASE_URL),
                model: this.currentConfig.SYNTHDEV_SMART_MODEL || 'Not set',
                apiKey: this.currentConfig.SYNTHDEV_SMART_API_KEY ? '***set***' : 'Not set',
            },
            fast: {
                provider: this._getProviderFromUrl(this.currentConfig.SYNTHDEV_FAST_BASE_URL),
                model: this.currentConfig.SYNTHDEV_FAST_MODEL || 'Not set',
                apiKey: this.currentConfig.SYNTHDEV_FAST_API_KEY ? '***set***' : 'Not set',
            },
            other: {
                verbosity: this.currentConfig.SYNTHDEV_VERBOSITY_LEVEL || '2',
                maxToolCalls: this.currentConfig.SYNTHDEV_MAX_TOOL_CALLS || '50',
                promptEnhancement: this.currentConfig.SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT || 'false',
            },
        };

        return summary;
    }

    /**
     * Get provider name from base URL
     * @private
     * @param {string} url - Base URL
     * @returns {string} Provider name
     */
    _getProviderFromUrl(url) {
        if (!url) {
            return 'Not set';
        }

        for (const provider of this.providers.providers) {
            if (url.includes(provider.baseUrl) || provider.baseUrl.includes(url)) {
                return provider.name;
            }
        }

        return 'Custom';
    }

    /**
     * Save configuration to .env file
     * @returns {boolean} Success status
     */
    saveConfiguration() {
        try {
            const envLines = [];

            // Add header comment
            envLines.push('# SynthDev Configuration');
            envLines.push('# Generated by configuration wizard');
            envLines.push('');

            // Group variables by category
            const categories = {
                'General AI Provider Configuration': [
                    'SYNTHDEV_API_KEY',
                    'SYNTHDEV_BASE_MODEL',
                    'SYNTHDEV_BASE_URL',
                ],
                'Smart Model Configuration': [
                    'SYNTHDEV_SMART_API_KEY',
                    'SYNTHDEV_SMART_MODEL',
                    'SYNTHDEV_SMART_BASE_URL',
                ],
                'Fast Model Configuration': [
                    'SYNTHDEV_FAST_API_KEY',
                    'SYNTHDEV_FAST_MODEL',
                    'SYNTHDEV_FAST_BASE_URL',
                ],
                'Global Settings': [
                    'SYNTHDEV_MAX_TOOL_CALLS',
                    'SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT',
                    'SYNTHDEV_VERBOSITY_LEVEL',
                ],
            };

            for (const [categoryName, keys] of Object.entries(categories)) {
                envLines.push(`# ${categoryName}`);

                for (const key of keys) {
                    const value = this.currentConfig[key];
                    const envVar = this.envVariables[key];

                    if (envVar && envVar.description) {
                        envLines.push(`# ${envVar.description}`);
                    }

                    if (value) {
                        envLines.push(`${key}=${value}`);
                    } else if (envVar) {
                        envLines.push(`# ${key}=${envVar.defaultValue}`);
                    }
                }

                envLines.push('');
            }

            writeFileSync(this.envFilePath, envLines.join('\n'));
            return true;
        } catch (error) {
            this.logger.error('Failed to save .env file:', error);
            return false;
        }
    }

    /**
     * Get environment variable description
     * @param {string} key - Environment variable key
     * @returns {string} Description
     */
    getVariableDescription(key) {
        const envVar = this.envVariables[key];
        return envVar ? envVar.description : '';
    }
}
