/**
 * Configuration Loader System
 * Loads external configuration files and provides fallback to hardcoded defaults
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from './logger.js';

// Get the directory where this module is located (synth-dev installation directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Centralized configuration loader that manages external config files
 */
class ConfigurationLoader {
    constructor() {
        this.configCache = new Map();
        // Use the synth-dev installation directory instead of current working directory
        this.configDir = join(__dirname, 'config');
        this.logger = getLogger();
    }

    /**
     * Load a configuration file
     * @param {string} configPath - Relative path from config directory
     * @param {Object} defaultConfig - Default configuration to merge with (optional)
     * @param {boolean} required - Whether the config file is required
     * @returns {Object} Loaded configuration
     */
    loadConfig(configPath, defaultConfig = {}, required = false) {
        const cacheKey = configPath;

        // Return cached config if available
        if (this.configCache.has(cacheKey)) {
            return this.configCache.get(cacheKey);
        }

        const fullPath = join(this.configDir, configPath);

        try {
            if (existsSync(fullPath)) {
                const fileContent = readFileSync(fullPath, 'utf8');
                const loadedConfig = JSON.parse(fileContent);

                // Merge with defaults if provided (loaded config takes precedence)
                const config =
                    Object.keys(defaultConfig).length > 0
                        ? this._deepMerge(defaultConfig, loadedConfig)
                        : loadedConfig;

                this.logger.debug(`Loaded configuration from: ${configPath}`);

                // Cache the configuration
                this.configCache.set(cacheKey, config);
                return config;
            } else {
                throw new Error(`Configuration file not found: ${configPath}`);
            }
        } catch (error) {
            if (required) {
                throw new Error(
                    `Failed to load required configuration ${configPath}: ${error.message} details: ${fullPath}`
                );
            }

            this.logger.warn(`Failed to load configuration ${configPath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load multiple configuration files
     * @param {Array<{path: string, default?: Object, required?: boolean}>} configs - Array of config definitions
     * @returns {Object} Object with loaded configurations keyed by path
     */
    loadConfigs(configs) {
        const result = {};

        for (const { path, default: defaultConfig = {}, required = false } of configs) {
            const key = path.replace(/[/\\]/g, '_').replace('.json', '');
            result[key] = this.loadConfig(path, defaultConfig, required);
        }

        return result;
    }

    /**
     * Reload a specific configuration file (clears cache)
     * @param {string} configPath - Path to reload
     * @param {Object} defaultConfig - Default configuration (optional)
     * @param {boolean} required - Whether the config is required
     * @returns {Object} Reloaded configuration
     */
    reloadConfig(configPath, defaultConfig = {}, required = false) {
        this.configCache.delete(configPath);
        return this.loadConfig(configPath, defaultConfig, required);
    }

    /**
     * Clear all cached configurations
     */
    clearCache() {
        this.configCache.clear();
    }

    /**
     * Deep merge two objects (second object takes precedence)
     * @private
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    _deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (this._isObject(source[key]) && this._isObject(target[key])) {
                    result[key] = this._deepMerge(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Check if value is a plain object
     * @private
     * @param {*} value - Value to check
     * @returns {boolean} True if value is a plain object
     */
    _isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Get the configuration directory path
     * @returns {string} Configuration directory path
     */
    getConfigDir() {
        return this.configDir;
    }

    /**
     * Check if a configuration file exists
     * @param {string} configPath - Relative path from config directory
     * @returns {boolean} True if file exists
     */
    configExists(configPath) {
        const fullPath = join(this.configDir, configPath);
        return existsSync(fullPath);
    }
}

// Export singleton instance
let configurationLoaderInstance = null;

/**
 * Get the singleton ConfigurationLoader instance
 * @returns {ConfigurationLoader} ConfigurationLoader instance
 */
export function getConfigurationLoader() {
    if (!configurationLoaderInstance) {
        configurationLoaderInstance = new ConfigurationLoader();
    }
    return configurationLoaderInstance;
}

export default ConfigurationLoader;
