/**
 * Snapshot System Configuration
 * Integrates with the centralized configuration system
 */

import { getLogger } from '../managers/logger.js';
import ConfigManager from '../../config/managers/configManager.js';

//REVIEW: >>how this is used ? configuration should be in src\config folder in json format.<<
//REVIEW: >>is src\config folder utilized here in any way ?<<
/**
 * Configuration manager for the snapshot system
 * Now integrates with the centralized ConfigManager
 */
class SnapshotConfig {
    constructor(customConfig = {}) {
        this.logger = getLogger();
        this.configManager = ConfigManager.getInstance();
        this.config = this._loadConfiguration(customConfig);
        this._validateConfiguration();
    }

    /**
     * Load configuration from centralized ConfigManager with custom overrides
     * @private
     * @param {Object} customConfig - Custom configuration to merge
     * @returns {Object} Loaded configuration
     */
    _loadConfiguration(customConfig = {}) {
        // Get configuration from centralized ConfigManager
        const centralConfig = this.configManager.getConfig();

        // Create a copy of the snapshot configuration
        const config = {
            snapshots: JSON.parse(JSON.stringify(centralConfig.snapshots)),
        };

        // Apply custom configuration overrides if provided
        if (customConfig && Object.keys(customConfig).length > 0) {
            this._mergeConfig(config, customConfig);
        }

        this.logger.debug('Snapshot configuration loaded from ConfigManager', config);
        return config;
    }

    /**
     * Merge custom configuration into the base configuration
     * @private
     * @param {Object} target - Target configuration object
     * @param {Object} source - Source configuration to merge
     */
    _mergeConfig(target, source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (
                    typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key])
                ) {
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    this._mergeConfig(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
    }

    /**
     * Validate the loaded configuration
     * @private
     */
    _validateConfiguration() {
        const errors = [];

        // Validate mode
        const validModes = ['auto', 'git', 'file'];
        if (!validModes.includes(this.config.snapshots.mode)) {
            errors.push(
                `Invalid snapshot mode: ${this.config.snapshots.mode}. Must be one of: ${validModes.join(', ')}`
            );
        }

        // Validate hash algorithm
        const validAlgorithms = ['md5', 'sha1', 'sha256'];
        if (!validAlgorithms.includes(this.config.snapshots.contentHashing.algorithm)) {
            errors.push(
                `Invalid hash algorithm: ${this.config.snapshots.contentHashing.algorithm}. Must be one of: ${validAlgorithms.join(', ')}`
            );
        }

        // Validate numeric values
        if (this.config.snapshots.file.maxSnapshots < 1) {
            errors.push('maxSnapshots must be at least 1');
        }

        if (this.config.snapshots.git.maxCommitHistory < 1) {
            errors.push('maxCommitHistory must be at least 1');
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }

        this.logger.debug('Snapshot configuration validated successfully');
    }

    /**
     * Get the complete configuration
     * @returns {Object} Configuration object
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get snapshot-specific configuration
     * @returns {Object} Snapshot configuration
     */
    getSnapshotConfig() {
        return this.config.snapshots;
    }

    /**
     * Get Git-specific configuration
     * @returns {Object} Git configuration
     */
    getGitConfig() {
        return this.config.snapshots.git;
    }

    /**
     * Get file-based configuration
     * @returns {Object} File configuration
     */
    getFileConfig() {
        return this.config.snapshots.file;
    }

    /**
     * Get cleanup configuration
     * @returns {Object} Cleanup configuration
     */
    getCleanupConfig() {
        return this.config.snapshots.cleanup;
    }

    /**
     * Get performance configuration
     * @returns {Object} Performance configuration
     */
    getPerformanceConfig() {
        return this.config.snapshots.performance;
    }

    /**
     * Parse memory limit string to bytes
     * @param {string} memoryLimit - Memory limit string (e.g., "100MB", "1GB")
     * @returns {number} Memory limit in bytes
     */
    parseMemoryLimit(memoryLimit) {
        const units = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
        };

        const match = memoryLimit.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
        if (!match) {
            throw new Error(`Invalid memory limit format: ${memoryLimit}`);
        }

        const [, value, unit] = match;
        const multiplier = units[unit.toUpperCase()];
        return Math.floor(parseFloat(value) * multiplier);
    }

    /**
     * Get memory limit in bytes
     * @returns {number} Memory limit in bytes
     */
    getMemoryLimitBytes() {
        return this.parseMemoryLimit(this.config.snapshots.file.memoryLimit);
    }

    /**
     * Set a nested value in an object using dot notation
     * @private
     * @param {Object} obj - Target object
     * @param {string} path - Dot-separated path
     * @param {any} value - Value to set
     */
    _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    /**
     * Update configuration at runtime
     * @param {string} path - Dot-separated configuration path
     * @param {any} value - New value
     */
    updateConfig(path, value) {
        this._setNestedValue(this.config, path, value);
        this._validateConfiguration();
        this.logger.debug(`Configuration updated: ${path} = ${value}`);
    }

    /**
     * Reset configuration to defaults from ConfigManager
     */
    resetToDefaults() {
        const centralConfig = this.configManager.getConfig();
        this.config = {
            snapshots: JSON.parse(JSON.stringify(centralConfig.snapshots)),
        };
        this._validateConfiguration();
        this.logger.debug('Configuration reset to defaults from ConfigManager');
    }
}

export default SnapshotConfig;
