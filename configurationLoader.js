/**
 * Configuration Loader System
 * Loads external configuration files and provides fallback to hardcoded defaults
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
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

    /**
     * Recursively scan a directory for JSON files
     * @param {string} dirPath - Directory path to scan
     * @returns {string[]} Array of JSON file paths relative to the directory
     */
    scanDirectoryForJsonFiles(dirPath) {
        const fullDirPath = join(this.configDir, dirPath);
        const jsonFiles = [];

        if (!existsSync(fullDirPath)) {
            return jsonFiles;
        }

        const scanRecursive = (currentPath, relativePath = '') => {
            try {
                const items = readdirSync(currentPath);

                for (const item of items) {
                    const itemPath = join(currentPath, item);
                    const relativeItemPath = relativePath ? join(relativePath, item) : item;

                    try {
                        const stats = statSync(itemPath);

                        if (stats.isDirectory()) {
                            // Recursively scan subdirectories
                            scanRecursive(itemPath, relativeItemPath);
                        } else if (stats.isFile() && extname(item).toLowerCase() === '.json') {
                            // Add JSON files to the list
                            jsonFiles.push(relativeItemPath);
                        }
                    } catch (error) {
                        this.logger.warn(`Failed to stat ${itemPath}: ${error.message}`);
                    }
                }
            } catch (error) {
                this.logger.warn(`Failed to read directory ${currentPath}: ${error.message}`);
            }
        };

        scanRecursive(fullDirPath);
        return jsonFiles.sort(); // Sort for consistent ordering
    }

    /**
     * Load and merge multiple role configuration files from a directory
     * @param {string} rolesDir - Directory path containing role files (relative to config)
     * @returns {Object} Merged role configurations
     */
    loadRolesFromDirectory(rolesDir = 'roles') {
        const cacheKey = `roles_directory_${rolesDir}`;

        // Return cached config if available
        if (this.configCache.has(cacheKey)) {
            return this.configCache.get(cacheKey);
        }

        const jsonFiles = this.scanDirectoryForJsonFiles(rolesDir);
        const mergedRoles = {};

        // First, try to load the legacy roles.json file for backward compatibility
        const legacyRolesPath = join(rolesDir, 'roles.json');
        if (this.configExists(legacyRolesPath)) {
            try {
                const legacyRoles = this.loadConfig(legacyRolesPath, {}, false);
                Object.assign(mergedRoles, legacyRoles);
                this.logger.debug(`Loaded legacy roles from: ${legacyRolesPath}`);
            } catch (error) {
                this.logger.warn(
                    `Failed to load legacy roles from ${legacyRolesPath}: ${error.message}`
                );
            }
        }

        // Load all other JSON files in the directory (excluding roles.json to avoid duplication)
        for (const jsonFile of jsonFiles) {
            if (jsonFile === 'roles.json') {
                continue; // Skip legacy file as it's already loaded
            }

            const filePath = join(rolesDir, jsonFile);
            try {
                const fileRoles = this.loadConfig(filePath, {}, false);

                // Merge roles from this file
                for (const [roleName, roleConfig] of Object.entries(fileRoles)) {
                    if (mergedRoles[roleName]) {
                        this.logger.warn(
                            `Role '${roleName}' from ${filePath} overwrites existing role definition`
                        );
                    }
                    mergedRoles[roleName] = roleConfig;
                }

                this.logger.debug(`Loaded roles from: ${filePath}`);
            } catch (error) {
                this.logger.warn(`Failed to load roles from ${filePath}: ${error.message}`);
            }
        }

        // Cache the merged configuration
        this.configCache.set(cacheKey, mergedRoles);

        this.logger.debug(
            `Loaded ${Object.keys(mergedRoles).length} roles from ${jsonFiles.length} files in ${rolesDir}`
        );
        return mergedRoles;
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
