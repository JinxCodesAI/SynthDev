/**
 * Initial Snapshot Manager for Phase 2 - Automatic Snapshot Creation
 * Creates initial "state 0" snapshot on application startup
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { getLogger } from '../managers/logger.js';

export class InitialSnapshotManager {
    constructor(snapshotManager, config = {}) {
        this.snapshotManager = snapshotManager;
        this.config = {
            // Initial snapshot configuration
            enabled: true,
            createOnStartup: true,
            skipIfSnapshotsExist: true,
            timeout: 30000, // 30 seconds
            description: 'Initial project state',

            // State tracking file
            stateFile: '.synthdev-initial-snapshot',

            ...config,
        };

        this.logger = getLogger();
        this.initialSnapshotCreated = false;

        this.logger.debug('InitialSnapshotManager initialized', { config: this.config });
    }

    /**
     * Create initial snapshot if needed
     * @param {string} basePath - Base path for the snapshot
     * @returns {Promise<Object|null>} Snapshot result or null if not created
     */
    async createInitialSnapshot(basePath) {
        if (!this.config.enabled || !this.config.createOnStartup) {
            this.logger.debug('Initial snapshot creation disabled');
            return null;
        }

        try {
            const resolvedBasePath = resolve(basePath);

            this.logger.debug(`Checking for initial snapshot creation in ${resolvedBasePath}`);

            // Check if we should create initial snapshot
            if (!(await this.shouldCreateInitialSnapshot(resolvedBasePath))) {
                return null;
            }

            this.logger.info('Creating initial project snapshot...');

            // Create the initial snapshot
            const description = this.getInitialSnapshotDescription(resolvedBasePath);
            const metadata = this.getInitialSnapshotMetadata(resolvedBasePath);

            const result = await this._createWithTimeout(description, metadata);

            if (result) {
                // Mark initial snapshot as created
                await this.markInitialSnapshotCreated(resolvedBasePath);
                this.initialSnapshotCreated = true;

                this.logger.info(`Initial snapshot created successfully: ${result.id}`);
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to create initial snapshot', error);
            // Don't throw - initial snapshot failure shouldn't crash the app
            return null;
        }
    }

    /**
     * Create snapshot with timeout protection
     * @private
     */
    async _createWithTimeout(description, metadata) {
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.logger.warn(
                    `Initial snapshot creation timed out after ${this.config.timeout}ms`
                );
                resolve(null);
            }, this.config.timeout);

            this.snapshotManager
                .createSnapshot(description, metadata)
                .then(result => {
                    clearTimeout(timeoutHandle);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutHandle);
                    reject(error);
                });
        });
    }

    /**
     * Check if initial snapshot exists
     * @param {string} basePath - Base path to check
     * @returns {Promise<boolean>} Whether initial snapshot exists
     */
    async checkForInitialSnapshot(basePath) {
        try {
            const resolvedBasePath = resolve(basePath);

            // Check if state file exists
            const stateFilePath = resolve(resolvedBasePath, this.config.stateFile);
            if (existsSync(stateFilePath)) {
                this.logger.debug('Initial snapshot state file found');
                return true;
            }

            // Check if any snapshots exist if configured to skip
            if (this.config.skipIfSnapshotsExist) {
                const existingSnapshots = await this.snapshotManager.listSnapshots({ limit: 1 });
                if (existingSnapshots.length > 0) {
                    this.logger.debug('Existing snapshots found, skipping initial snapshot');
                    return true;
                }
            }

            return false;
        } catch (error) {
            this.logger.debug('Error checking for initial snapshot', error);
            return false;
        }
    }

    /**
     * Determine if initial snapshot should be created
     * @param {string} basePath - Base path
     * @returns {Promise<boolean>} Whether initial snapshot should be created
     */
    async shouldCreateInitialSnapshot(basePath) {
        // Check if we're in a first run scenario
        if (!(await this.isFirstRun(basePath))) {
            this.logger.debug('Not a first run, skipping initial snapshot');
            return false;
        }

        return true;
    }

    /**
     * Check if this is a first run
     * @param {string} basePath - Base path to check
     * @returns {Promise<boolean>} Whether this is a first run
     */
    async isFirstRun(basePath) {
        return !(await this.checkForInitialSnapshot(basePath));
    }

    /**
     * Get initial snapshot ID if it exists
     * @param {string} basePath - Base path
     * @returns {Promise<string|null>} Initial snapshot ID or null
     */
    async getInitialSnapshotId(basePath) {
        try {
            const { readFileSync } = await import('fs');
            const stateFilePath = resolve(basePath, this.config.stateFile);

            if (existsSync(stateFilePath)) {
                const content = readFileSync(stateFilePath, 'utf8');
                const state = JSON.parse(content);
                return state.initialSnapshotId || null;
            }
        } catch (error) {
            this.logger.debug('Error reading initial snapshot state', error);
        }

        return null;
    }

    /**
     * Mark initial snapshot as created
     * @param {string} basePath - Base path
     * @param {string} snapshotId - Snapshot ID (optional)
     * @returns {Promise<void>}
     */
    async markInitialSnapshotCreated(basePath, snapshotId = null) {
        try {
            const { writeFileSync } = await import('fs');
            const stateFilePath = resolve(basePath, this.config.stateFile);

            const state = {
                initialSnapshotCreated: true,
                timestamp: Date.now(),
                basePath: resolve(basePath),
                initialSnapshotId: snapshotId,
            };

            writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
            this.logger.debug('Initial snapshot state saved', { stateFile: stateFilePath });
        } catch (error) {
            this.logger.warn('Failed to save initial snapshot state', error);
            // Don't throw - this is not critical
        }
    }

    /**
     * Get initial snapshot description
     * @param {string} basePath - Base path
     * @returns {string} Snapshot description
     */
    getInitialSnapshotDescription(basePath) {
        const projectName = require('path').basename(basePath);
        return `${this.config.description} - ${projectName}`;
    }

    /**
     * Get initial snapshot metadata
     * @param {string} basePath - Base path
     * @returns {Object} Snapshot metadata
     */
    getInitialSnapshotMetadata(basePath) {
        return {
            triggerType: 'initial',
            basePath: resolve(basePath),
            isInitialSnapshot: true,
            applicationStartup: true,
            timestamp: Date.now(),
            creator: 'system',
            description: 'Initial project state snapshot created on application startup',
        };
    }

    /**
     * Clean up initial snapshot state
     * @param {string} basePath - Base path
     * @returns {Promise<void>}
     */
    async cleanupInitialState(basePath) {
        try {
            const { unlinkSync } = await import('fs');
            const stateFilePath = resolve(basePath, this.config.stateFile);

            if (existsSync(stateFilePath)) {
                unlinkSync(stateFilePath);
                this.logger.debug('Initial snapshot state file removed');
            }
        } catch (error) {
            this.logger.debug('Error cleaning up initial state', error);
        }
    }

    /**
     * Reset initial snapshot state
     */
    resetInitialState() {
        this.initialSnapshotCreated = false;
        this.logger.debug('Initial snapshot state reset');
    }

    /**
     * Check if initial snapshot was created in this session
     * @returns {boolean} Whether initial snapshot was created
     */
    wasInitialSnapshotCreated() {
        return this.initialSnapshotCreated;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('InitialSnapshotManager configuration updated', { config: this.config });
    }

    /**
     * Get manager statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            enabled: this.config.enabled,
            createOnStartup: this.config.createOnStartup,
            skipIfSnapshotsExist: this.config.skipIfSnapshotsExist,
            initialSnapshotCreated: this.initialSnapshotCreated,
            timeout: this.config.timeout,
            stateFile: this.config.stateFile,
        };
    }

    /**
     * Validate initial snapshot requirements
     * @param {string} basePath - Base path to validate
     * @returns {Object} Validation result
     */
    async validateRequirements(basePath) {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
        };

        try {
            const resolvedBasePath = resolve(basePath);

            // Check if base path exists
            if (!existsSync(resolvedBasePath)) {
                validation.valid = false;
                validation.errors.push(`Base path does not exist: ${resolvedBasePath}`);
                return validation;
            }

            // Check if snapshot manager is available
            if (!this.snapshotManager) {
                validation.valid = false;
                validation.errors.push('Snapshot manager not available');
                return validation;
            }

            // Check if we have write permissions (try to create state file)
            const stateFilePath = resolve(resolvedBasePath, `${this.config.stateFile}.test`);
            try {
                const { writeFileSync, unlinkSync } = await import('fs');
                writeFileSync(stateFilePath, 'test');
                unlinkSync(stateFilePath);
            } catch (error) {
                validation.warnings.push('May not have write permissions in project directory');
            }
        } catch (error) {
            validation.valid = false;
            validation.errors.push(`Validation error: ${error.message}`);
        }

        return validation;
    }
}

export default InitialSnapshotManager;
