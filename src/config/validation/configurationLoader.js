/**
 * Configuration Loader System
 * Loads external configuration files and provides fallback to hardcoded defaults
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from '../../core/managers/logger.js';

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
        this.configDir = join(__dirname, '..');
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
                    `Failed to load required configuration ${configPath}: ${error.message} \n details: ${fullPath}`
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
     * Parse filename to extract group information
     * @param {string} filename - The filename to parse
     * @returns {Object} Object with {basename, group} where group is 'global' if not specified
     */
    _parseRoleFilename(filename) {
        // Remove .json extension
        const nameWithoutExt = filename.replace(/\.json$/i, '');

        // Check if filename contains a group (format: name.group.json)
        const parts = nameWithoutExt.split('.');

        if (parts.length >= 2) {
            // Last part is the group, everything before is the basename
            const group = parts[parts.length - 1];
            const basename = parts.slice(0, -1).join('.');
            return { basename, group };
        } else {
            // No group specified, use 'global'
            return { basename: nameWithoutExt, group: 'global' };
        }
    }

    /**
     * Load and merge multiple role configuration files from a directory
     * @param {string} rolesDir - Directory path containing role files (relative to config)
     * @returns {Object} Object with roles and roleGroups properties
     */
    loadRolesFromDirectory(rolesDir = 'roles') {
        const cacheKey = `roles_directory_${rolesDir}`;

        // Return cached config if available
        if (this.configCache.has(cacheKey)) {
            return this.configCache.get(cacheKey);
        }

        const jsonFiles = this.scanDirectoryForJsonFiles(rolesDir);
        const mergedRoles = {};
        const roleGroups = {}; // Track which roles belong to which groups

        // First, try to load the legacy roles.json file for backward compatibility
        const legacyRolesPath = join(rolesDir, 'roles.json');
        if (this.configExists(legacyRolesPath)) {
            try {
                const legacyRoles = this.loadConfig(legacyRolesPath, {}, false);

                // Add legacy roles to global group
                for (const [roleName, roleConfig] of Object.entries(legacyRoles)) {
                    mergedRoles[roleName] = {
                        ...roleConfig,
                        _group: 'global',
                        _source: 'roles.json',
                    };
                    if (!roleGroups['global']) {
                        roleGroups['global'] = [];
                    }
                    roleGroups['global'].push(roleName);
                }

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

                // Parse filename to get group information
                const filename = jsonFile.split('/').pop(); // Get just the filename, not the path
                const { basename, group } = this._parseRoleFilename(filename);

                // Merge roles from this file
                for (const [roleName, roleConfig] of Object.entries(fileRoles)) {
                    if (mergedRoles[roleName]) {
                        this.logger.warn(
                            `Role '${roleName}' from ${filePath} overwrites existing role definition`
                        );

                        // Preserve important fields from the original role if they're missing in the new one
                        const existingRole = mergedRoles[roleName];
                        const preservedFields = {};

                        // Preserve agent_description if it exists in the original but not in the new role
                        if (existingRole.agent_description && !roleConfig.agent_description) {
                            preservedFields.agent_description = existingRole.agent_description;
                        }

                        // Preserve enabled_agents if it exists in the original but not in the new role
                        if (existingRole.enabled_agents && !roleConfig.enabled_agents) {
                            preservedFields.enabled_agents = existingRole.enabled_agents;
                        }

                        // Preserve can_create_tasks_for if it exists in the original but not in the new role
                        if (existingRole.can_create_tasks_for && !roleConfig.can_create_tasks_for) {
                            preservedFields.can_create_tasks_for =
                                existingRole.can_create_tasks_for;
                        }

                        // Add group metadata to role config with preserved fields
                        mergedRoles[roleName] = {
                            ...preservedFields,
                            ...roleConfig,
                            _group: group,
                            _source: jsonFile,
                        };
                    } else {
                        // Add group metadata to role config
                        mergedRoles[roleName] = {
                            ...roleConfig,
                            _group: group,
                            _source: jsonFile,
                        };
                    }

                    // Track role in group
                    if (!roleGroups[group]) {
                        roleGroups[group] = [];
                    }
                    roleGroups[group].push(roleName);
                }

                this.logger.debug(`Loaded roles from: ${filePath} (group: ${group})`);
            } catch (error) {
                this.logger.warn(`Failed to load roles from ${filePath}: ${error.message}`);
            }
        }

        const result = {
            roles: mergedRoles,
            roleGroups: roleGroups,
        };

        // Cache the merged configuration
        this.configCache.set(cacheKey, result);

        this.logger.debug(
            `Loaded ${Object.keys(mergedRoles).length} roles from ${jsonFiles.length} files in ${rolesDir}. Groups: ${Object.keys(roleGroups).join(', ')}`
        );
        return result;
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
