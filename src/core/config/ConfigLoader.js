/**
 * ConfigLoader - Configuration loading and validation utility
 *
 * This utility handles loading, merging, and validating configuration files
 * for the snapshot system following SynthDev configuration patterns.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from '../managers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ConfigLoader {
    /**
     * Create a new ConfigLoader
     */
    constructor() {
        this.logger = getLogger();
        this.configCache = new Map();
        this.configDir = join(__dirname, '../../../config');
    }

    /**
     * Load snapshot defaults configuration
     * @param {Object} overrides - Configuration overrides
     * @returns {Promise<Object>} Loaded configuration
     */
    async loadSnapshotDefaults(overrides = {}) {
        try {
            const cacheKey = 'snapshot-defaults';
            
            if (this.configCache.has(cacheKey)) {
                const cached = this.configCache.get(cacheKey);
                return this._mergeConfig(cached, overrides);
            }

            const configPath = join(this.configDir, 'snapshot-defaults.json');
            const configData = await this._loadJsonFile(configPath);
            
            // Validate configuration
            this._validateSnapshotDefaults(configData);
            
            // Cache the configuration
            this.configCache.set(cacheKey, configData);
            
            this.logger.debug('Snapshot defaults configuration loaded', {
                path: configPath,
                version: configData.version
            });

            return this._mergeConfig(configData, overrides);
        } catch (error) {
            this.logger.error(error, 'Failed to load snapshot defaults configuration');
            return this._getDefaultSnapshotConfig(overrides);
        }
    }

    /**
     * Load file filters configuration
     * @param {Object} overrides - Configuration overrides
     * @returns {Promise<Object>} Loaded configuration
     */
    async loadFileFilters(overrides = {}) {
        try {
            const cacheKey = 'file-filters';
            
            if (this.configCache.has(cacheKey)) {
                const cached = this.configCache.get(cacheKey);
                return this._mergeConfig(cached, overrides);
            }

            const configPath = join(this.configDir, 'file-filters.json');
            const configData = await this._loadJsonFile(configPath);
            
            // Validate configuration
            this._validateFileFilters(configData);
            
            // Cache the configuration
            this.configCache.set(cacheKey, configData);
            
            this.logger.debug('File filters configuration loaded', {
                path: configPath,
                version: configData.version,
                exclusions: configData.defaultExclusions?.length || 0,
                inclusions: configData.defaultInclusions?.length || 0
            });

            return this._mergeConfig(configData, overrides);
        } catch (error) {
            this.logger.error(error, 'Failed to load file filters configuration');
            return this._getDefaultFileFiltersConfig(overrides);
        }
    }

    /**
     * Load snapshot messages configuration
     * @param {string} locale - Locale for messages (default: 'en')
     * @returns {Promise<Object>} Loaded messages
     */
    async loadSnapshotMessages(locale = 'en') {
        try {
            const cacheKey = `snapshot-messages-${locale}`;
            
            if (this.configCache.has(cacheKey)) {
                return this.configCache.get(cacheKey);
            }

            const configPath = join(this.configDir, 'snapshot-messages.json');
            const messagesData = await this._loadJsonFile(configPath);
            
            // Cache the messages
            this.configCache.set(cacheKey, messagesData);
            
            this.logger.debug('Snapshot messages loaded', {
                path: configPath,
                version: messagesData.version,
                locale
            });

            return messagesData;
        } catch (error) {
            this.logger.error(error, 'Failed to load snapshot messages');
            return this._getDefaultMessages();
        }
    }

    /**
     * Load user-specific configuration overrides
     * @param {string} userConfigPath - Path to user configuration file
     * @returns {Promise<Object>} User configuration
     */
    async loadUserConfig(userConfigPath) {
        try {
            if (!userConfigPath) {
                return {};
            }

            const userData = await this._loadJsonFile(userConfigPath);
            
            this.logger.debug('User configuration loaded', {
                path: userConfigPath
            });

            return userData;
        } catch (error) {
            this.logger.warn('Failed to load user configuration', {
                path: userConfigPath,
                error: error.message
            });
            return {};
        }
    }

    /**
     * Clear configuration cache
     */
    clearCache() {
        this.configCache.clear();
        this.logger.debug('Configuration cache cleared');
    }

    /**
     * Load and parse JSON file
     * @param {string} filePath - Path to JSON file
     * @returns {Promise<Object>} Parsed JSON data
     * @private
     */
    async _loadJsonFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Configuration file not found: ${filePath}`);
            } else if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in configuration file: ${filePath}`);
            }
            throw error;
        }
    }

    /**
     * Merge configuration objects
     * @param {Object} base - Base configuration
     * @param {Object} overrides - Configuration overrides
     * @returns {Object} Merged configuration
     * @private
     */
    _mergeConfig(base, overrides) {
        if (!overrides || Object.keys(overrides).length === 0) {
            return { ...base };
        }

        const merged = { ...base };
        
        for (const [key, value] of Object.entries(overrides)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = this._mergeConfig(merged[key] || {}, value);
            } else {
                merged[key] = value;
            }
        }

        return merged;
    }

    /**
     * Validate snapshot defaults configuration
     * @param {Object} config - Configuration to validate
     * @private
     */
    _validateSnapshotDefaults(config) {
        if (!config.version) {
            throw new Error('Configuration version is required');
        }

        if (!config.storage || typeof config.storage !== 'object') {
            throw new Error('Storage configuration is required');
        }

        if (!config.fileHandling || typeof config.fileHandling !== 'object') {
            throw new Error('File handling configuration is required');
        }

        // Validate storage settings
        const { storage } = config;
        if (typeof storage.maxSnapshots !== 'number' || storage.maxSnapshots < 1) {
            throw new Error('maxSnapshots must be a positive number');
        }

        if (typeof storage.maxMemoryMB !== 'number' || storage.maxMemoryMB < 1) {
            throw new Error('maxMemoryMB must be a positive number');
        }

        // Validate file handling settings
        const { fileHandling } = config;
        if (typeof fileHandling.maxFileSize !== 'number' || fileHandling.maxFileSize < 1024) {
            throw new Error('maxFileSize must be at least 1024 bytes');
        }
    }

    /**
     * Validate file filters configuration
     * @param {Object} config - Configuration to validate
     * @private
     */
    _validateFileFilters(config) {
        if (!config.version) {
            throw new Error('Configuration version is required');
        }

        if (!Array.isArray(config.defaultExclusions)) {
            throw new Error('defaultExclusions must be an array');
        }

        if (!Array.isArray(config.defaultInclusions)) {
            throw new Error('defaultInclusions must be an array');
        }

        if (!Array.isArray(config.binaryExtensions)) {
            throw new Error('binaryExtensions must be an array');
        }
    }

    /**
     * Get default snapshot configuration
     * @param {Object} overrides - Configuration overrides
     * @returns {Object} Default configuration
     * @private
     */
    _getDefaultSnapshotConfig(overrides = {}) {
        const defaults = {
            version: '1.0.0',
            storage: {
                maxSnapshots: 50,
                maxMemoryMB: 100,
                cleanupStrategy: 'oldest_first',
                cleanupThreshold: 0.8
            },
            fileHandling: {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                preservePermissions: true,
                createBackups: true,
                binaryFileHandling: 'exclude',
                encoding: 'utf8'
            },
            restoration: {
                createBackupByDefault: true,
                overwriteExistingByDefault: true,
                preservePermissionsByDefault: true,
                rollbackOnFailureByDefault: true,
                previewThreshold: 10
            }
        };

        return this._mergeConfig(defaults, overrides);
    }

    /**
     * Get default file filters configuration
     * @param {Object} overrides - Configuration overrides
     * @returns {Object} Default configuration
     * @private
     */
    _getDefaultFileFiltersConfig(overrides = {}) {
        const defaults = {
            version: '1.0.0',
            defaultExclusions: [
                'node_modules/**',
                '.git/**',
                '*.tmp',
                '*.log',
                '.DS_Store',
                'Thumbs.db'
            ],
            defaultInclusions: [
                'src/**',
                '*.js',
                '*.json',
                '*.md'
            ],
            binaryExtensions: [
                '.exe', '.dll', '.jpg', '.png', '.pdf', '.zip'
            ]
        };

        return this._mergeConfig(defaults, overrides);
    }

    /**
     * Get default messages
     * @returns {Object} Default messages
     * @private
     */
    _getDefaultMessages() {
        return {
            version: '1.0.0',
            commands: {
                create: {
                    prompts: {
                        description: 'Enter snapshot description: '
                    },
                    success: {
                        created: 'Snapshot created successfully!'
                    },
                    errors: {
                        noDescription: 'Snapshot description is required'
                    }
                }
            }
        };
    }
}
