/**
 * Snapshot Configuration Manager
 * Manages snapshot-specific configuration loading and caching
 */

import { getConfigurationLoader } from '../validation/configurationLoader.js';
import { getLogger } from '../../core/managers/logger.js';
import minimatch from 'minimatch';

/**
 * Singleton SnapshotConfigManager class that loads and manages snapshot configuration
 */
class SnapshotConfigManager {
    constructor() {
        if (SnapshotConfigManager.instance) {
            return SnapshotConfigManager.instance;
        }

        this.logger = getLogger();
        this.configLoader = getConfigurationLoader();
        this.config = null;

        SnapshotConfigManager.instance = this;
    }

    /**
     * Get the singleton instance of SnapshotConfigManager
     * @returns {SnapshotConfigManager} The singleton instance
     */
    static getInstance() {
        if (!SnapshotConfigManager.instance) {
            SnapshotConfigManager.instance = new SnapshotConfigManager();
        }
        return SnapshotConfigManager.instance;
    }

    /**
     * Load snapshot configuration from files
     * @returns {Object} Loaded configuration
     */
    loadConfig() {
        if (this.config) {
            return this.config;
        }

        try {
            // Load all snapshot configuration files
            const fileFilters = this.configLoader.loadConfig(
                'snapshots/file-filters.json',
                {},
                false
            );
            const snapshotDefaults = this.configLoader.loadConfig(
                'snapshots/snapshot-defaults.json',
                {},
                false
            );
            const snapshotMessages = this.configLoader.loadConfig(
                'snapshots/snapshot-messages.json',
                {},
                false
            );

            // Load Phase 2 configuration
            const autoSnapshotDefaults = this.configLoader.loadConfig(
                'snapshots/auto-snapshot-defaults.json',
                {},
                false
            );

            // Merge and structure the configuration
            this.config = {
                // Phase 1 configuration
                fileFiltering: {
                    ...snapshotDefaults.fileFiltering,
                    // Build exclusion patterns from file-filters.json
                    defaultExclusions: this._buildExclusionPatterns(fileFilters),
                },
                storage: snapshotDefaults.storage,
                backup: snapshotDefaults.backup,
                behavior: snapshotDefaults.behavior,
                messages: snapshotMessages,
                // Keep original file-filters structure for advanced configuration
                fileFilters: fileFilters,

                // Phase 2 configuration
                phase2: {
                    ...autoSnapshotDefaults,
                },
            };

            this.logger.debug('Snapshot configuration loaded successfully', {
                exclusionPatterns: this.config.fileFiltering.defaultExclusions.length,
                storageType: this.config.storage.type,
            });

            return this.config;
        } catch (error) {
            this.logger.error(
                error,
                'Failed to load snapshot configuration, falling back to defaults'
            );

            // Return fallback configuration
            this.config = this._getFallbackConfig();
            return this.config;
        }
    }

    /**
     * Build exclusion patterns from file-filters.json structure
     * @private
     * @param {Object} fileFilters - File filters configuration
     * @returns {Array} Array of exclusion patterns
     */
    _buildExclusionPatterns(fileFilters) {
        const patterns = [];

        if (fileFilters.defaultPatterns) {
            // Add all default patterns
            Object.values(fileFilters.defaultPatterns).forEach(patternGroup => {
                if (Array.isArray(patternGroup)) {
                    patterns.push(...patternGroup);
                }
            });
        }

        // Note: Language-specific patterns are NOT automatically included
        // They would need to be activated based on project detection in the future
        // For now, only default patterns are used

        return patterns;
    }

    /**
     * Get fallback configuration if files can't be loaded
     * @private
     * @returns {Object} Fallback configuration
     */
    _getFallbackConfig() {
        return {
            fileFiltering: {
                defaultExclusions: [
                    'node_modules/**',
                    '.git/**',
                    'dist/**',
                    'build/**',
                    '*.log',
                    '*.tmp',
                ],
                customExclusions: [],
                maxFileSize: 10 * 1024 * 1024, // 10MB
                binaryFileHandling: 'exclude',
                followSymlinks: false,
                caseSensitive: false,
            },
            storage: {
                type: 'memory',
                maxSnapshots: 50,
                maxMemoryMB: 100,
                persistToDisk: false,
            },
            backup: {
                preservePermissions: true,
                validateChecksums: true,
                maxConcurrentFiles: 10,
                encoding: 'utf8',
            },
            behavior: {
                autoCleanup: true,
                cleanupThreshold: 40,
                confirmRestore: true,
                showPreview: true,
            },
            messages: {
                success: {
                    snapshotCreated: '✅ Snapshot created successfully!',
                    snapshotRestored: '✅ Snapshot restored successfully!',
                    snapshotDeleted: '✅ Snapshot deleted successfully!',
                },
                errors: {
                    snapshotNotFound: '❌ Snapshot not found: {id}',
                    invalidDescription: '❌ Snapshot description is required',
                    captureFailure: '❌ Failed to capture files: {error}',
                },
            },
        };
    }

    /**
     * Get file filtering configuration
     * @returns {Object} File filtering configuration
     */
    getFileFilteringConfig() {
        const config = this.loadConfig();
        return config.fileFiltering;
    }

    /**
     * Get storage configuration
     * @returns {Object} Storage configuration
     */
    getStorageConfig() {
        const config = this.loadConfig();
        return config.storage;
    }

    /**
     * Get backup configuration
     * @returns {Object} Backup configuration
     */
    getBackupConfig() {
        const config = this.loadConfig();
        return config.backup;
    }

    /**
     * Get behavior configuration
     * @returns {Object} Behavior configuration
     */
    getBehaviorConfig() {
        const config = this.loadConfig();
        return config.behavior;
    }

    /**
     * Get messages configuration
     * @returns {Object} Messages configuration
     */
    getMessagesConfig() {
        const config = this.loadConfig();
        return config.messages;
    }

    /**
     * Get complete configuration
     * @returns {Object} Complete configuration
     */
    getConfig() {
        return this.loadConfig();
    }

    /**
     * Reload configuration from files
     * @returns {Object} Reloaded configuration
     */
    reloadConfig() {
        this.config = null;
        // Clear cache in the underlying loader
        this.configLoader.clearCache();
        return this.loadConfig();
    }

    /**
     * Add custom exclusion pattern
     * @param {string} pattern - Pattern to add
     */
    addCustomExclusion(pattern) {
        const config = this.loadConfig();
        if (!config.fileFiltering.customExclusions.includes(pattern)) {
            config.fileFiltering.customExclusions.push(pattern);
            this.logger.debug('Added custom exclusion pattern', { pattern });
        }
    }

    /**
     * Remove custom exclusion pattern
     * @param {string} pattern - Pattern to remove
     */
    removeCustomExclusion(pattern) {
        const config = this.loadConfig();
        const index = config.fileFiltering.customExclusions.indexOf(pattern);
        if (index > -1) {
            config.fileFiltering.customExclusions.splice(index, 1);
            this.logger.debug('Removed custom exclusion pattern', { pattern });
        }
    }

    /**
     * Test if a path would be excluded by current patterns
     * @param {string} path - Path to test
     * @returns {boolean} True if path would be excluded
     */
    testExclusion(path) {
        const config = this.loadConfig();
        const allPatterns = [
            ...config.fileFiltering.defaultExclusions,
            ...config.fileFiltering.customExclusions,
        ];

        // Use minimatch for pattern matching (same as FileFilter)
        const normalizedPath = path.replace(/\\/g, '/');

        return allPatterns.some(pattern => {
            const options = {
                dot: true,
                nocase: !config.fileFiltering.caseSensitive,
                matchBase: true,
            };
            return minimatch(normalizedPath, pattern, options);
        });
    }

    /**
     * Get Phase 2 automatic snapshot configuration
     * @returns {Object} Phase 2 configuration
     */
    getPhase2Config() {
        const config = this.loadConfig();
        return config.phase2;
    }

    /**
     * Get automatic snapshot configuration
     * @returns {Object} Auto snapshot configuration
     */
    getAutoSnapshotConfig() {
        const phase2Config = this.getPhase2Config();
        return phase2Config.autoSnapshot;
    }

    /**
     * Get tool declarations configuration
     * @returns {Object} Tool declarations configuration
     */
    getToolDeclarationsConfig() {
        const phase2Config = this.getPhase2Config();
        return phase2Config.toolDeclarations;
    }

    /**
     * Get trigger rules configuration
     * @returns {Object} Trigger rules configuration
     */
    getTriggerRulesConfig() {
        const phase2Config = this.getPhase2Config();
        return phase2Config.triggerRules;
    }

    /**
     * Get file change detection configuration
     * @returns {Object} File change detection configuration
     */
    getFileChangeDetectionConfig() {
        const phase2Config = this.getPhase2Config();
        return phase2Config.fileChangeDetection;
    }

    /**
     * Get initial snapshot configuration
     * @returns {Object} Initial snapshot configuration
     */
    getInitialSnapshotConfig() {
        const phase2Config = this.getPhase2Config();
        return phase2Config.initialSnapshot;
    }

    /**
     * Get integration configuration
     * @returns {Object} Integration configuration
     */
    getIntegrationConfig() {
        const phase2Config = this.getPhase2Config();
        return phase2Config.integration;
    }
}

// Export singleton getter
export function getSnapshotConfigManager() {
    return SnapshotConfigManager.getInstance();
}

export default SnapshotConfigManager;
