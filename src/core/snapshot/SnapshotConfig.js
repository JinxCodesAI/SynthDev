/**
 * Snapshot System Configuration
 * Handles configuration loading, validation, and default values
 */

import { getLogger } from '../managers/logger.js';

/**
 * Default configuration for the snapshot system
 */
const DEFAULT_CONFIG = {
    snapshots: {
        mode: 'auto', // auto | git | file
        contentHashing: {
            enabled: true,
            algorithm: 'md5', // md5 | sha1 | sha256
            trackChanges: true,
        },
        git: {
            branchPrefix: 'synth-dev/',
            autoCommit: true,
            commitMessageTemplate:
                'Synth-Dev [{timestamp}]: {summary}\n\nOriginal instruction: {instruction}',
            maxCommitHistory: 100,
            autoCleanupBranches: true,
            requireUncommittedChanges: true,
        },
        file: {
            maxSnapshots: 50,
            compressionEnabled: false,
            memoryLimit: '100MB',
            persistToDisk: false,
            checksumValidation: true,
        },
        cleanup: {
            autoCleanup: true,
            cleanupOnExit: true,
            retentionDays: 7,
            maxDiskUsage: '1GB',
        },
        performance: {
            lazyLoading: true,
            backgroundProcessing: true,
            cacheSize: 10,
        },
    },
};

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
    SYNTHDEV_SNAPSHOT_MODE: 'snapshots.mode',
    SYNTHDEV_SNAPSHOT_BRANCH_PREFIX: 'snapshots.git.branchPrefix',
    SYNTHDEV_SNAPSHOT_MAX_COUNT: 'snapshots.file.maxSnapshots',
    SYNTHDEV_SNAPSHOT_AUTO_CLEANUP: 'snapshots.cleanup.autoCleanup',
    SYNTHDEV_SNAPSHOT_MEMORY_LIMIT: 'snapshots.file.memoryLimit',
    SYNTHDEV_SNAPSHOT_COMPRESSION: 'snapshots.file.compressionEnabled',
};

/**
 * Configuration manager for the snapshot system
 */
class SnapshotConfig {
    constructor() {
        this.logger = getLogger();
        this.config = this._loadConfiguration();
        this._validateConfiguration();
    }

    /**
     * Load configuration from environment variables and defaults
     * @private
     * @returns {Object} Loaded configuration
     */
    _loadConfiguration() {
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

        // Apply environment variable overrides
        for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                this._setNestedValue(config, configPath, this._parseEnvValue(envValue));
            }
        }

        this.logger.debug('Snapshot configuration loaded', config);
        return config;
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
     * Parse environment variable value to appropriate type
     * @private
     * @param {string} value - Environment variable value
     * @returns {any} Parsed value
     */
    _parseEnvValue(value) {
        // Boolean values
        if (value.toLowerCase() === 'true') {
            return true;
        }
        if (value.toLowerCase() === 'false') {
            return false;
        }

        // Numeric values
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }

        // String values
        return value;
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
     * Reset configuration to defaults
     */
    resetToDefaults() {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        this._validateConfiguration();
        this.logger.debug('Configuration reset to defaults');
    }
}

export default SnapshotConfig;
