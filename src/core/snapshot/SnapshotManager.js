/**
 * SnapshotManager - Central orchestrator for all snapshot operations
 *
 * This class coordinates between storage, backup, and filtering components
 * to provide a unified API for snapshot operations.
 */

import { getLogger } from '../managers/logger.js';

export class SnapshotManager {
    /**
     * Create a new SnapshotManager
     * @param {Object} store - Storage implementation (MemorySnapshotStore, etc.)
     * @param {Object} fileBackup - File backup implementation
     * @param {Object} fileFilter - File filtering implementation
     * @param {Object} config - Configuration object
     */
    constructor(store, fileBackup, fileFilter, config) {
        this.store = store;
        this.fileBackup = fileBackup;
        this.fileFilter = fileFilter;
        this.config = config;
        this.logger = getLogger();
    }

    /**
     * Create a new snapshot with description and metadata
     * @param {string} description - Snapshot description
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Created snapshot with ID
     */
    async createSnapshot(description, metadata = {}) {
        try {
            this.logger.debug('Creating snapshot', { description, metadata });

            // Validate inputs
            if (!description || typeof description !== 'string') {
                throw new Error('Snapshot description is required and must be a string');
            }

            // Get current working directory as base path
            const basePath = process.cwd();
            this.logger.debug('Using base path for snapshot', { basePath });

            // Capture files using fileBackup and fileFilter
            let fileData = {};
            if (this.fileBackup && this.fileFilter) {
                try {
                    fileData = await this.fileBackup.captureFiles(basePath, {
                        includeMetadata: true,
                        preservePermissions: this.config.preservePermissions !== false
                    });
                    this.logger.debug('Files captured successfully', {
                        fileCount: Object.keys(fileData).length
                    });
                } catch (captureError) {
                    this.logger.warn('File capture failed, creating snapshot without files', {
                        error: captureError.message
                    });
                    // Continue with empty file data - this allows basic functionality
                    // even when file operations fail
                }
            } else {
                this.logger.warn('FileBackup or FileFilter not available, creating snapshot without files');
            }

            // Create snapshot object with metadata
            const snapshot = {
                description: description.trim(),
                timestamp: new Date().toISOString(),
                metadata: {
                    basePath,
                    createdBy: 'manual',
                    version: '1.0.0',
                    ...metadata
                },
                fileData,
                stats: {
                    fileCount: Object.keys(fileData).length,
                    totalSize: this._calculateDataSize(fileData)
                }
            };

            // Store snapshot using store
            const snapshotId = await this.store.store(snapshot);

            this.logger.info('Snapshot created successfully', {
                snapshotId,
                description,
                fileCount: snapshot.stats.fileCount,
                totalSize: snapshot.stats.totalSize
            });

            return {
                id: snapshotId,
                description: snapshot.description,
                timestamp: snapshot.timestamp,
                fileCount: snapshot.stats.fileCount,
                totalSize: snapshot.stats.totalSize
            };
        } catch (error) {
            this.logger.error(error, 'Failed to create snapshot');
            throw error;
        }
    }

    /**
     * List all snapshots with optional filtering
     * @param {Object} options - Filtering and sorting options
     * @returns {Promise<Array>} List of snapshots
     */
    async listSnapshots(options = {}) {
        try {
            this.logger.debug('Listing snapshots', { options });

            // Get snapshots from store with filtering and sorting
            const snapshots = await this.store.list({
                filter: options.filter,
                sortBy: options.sortBy || 'timestamp',
                sortOrder: options.sortOrder || 'desc',
                limit: options.limit
            });

            // Add additional computed fields if needed
            const enrichedSnapshots = snapshots.map(snapshot => ({
                ...snapshot,
                age: this._calculateAge(snapshot.timestamp),
                sizeFormatted: this._formatSize(snapshot.size || 0)
            }));

            this.logger.debug('Snapshots listed successfully', {
                count: enrichedSnapshots.length,
                options
            });

            return enrichedSnapshots;
        } catch (error) {
            this.logger.error(error, 'Failed to list snapshots');
            throw error;
        }
    }

    /**
     * Restore a snapshot by ID
     * @param {string} snapshotId - Snapshot ID to restore
     * @param {Object} options - Restoration options
     * @returns {Promise<Object>} Restoration result
     */
    async restoreSnapshot(snapshotId, options = {}) {
        try {
            this.logger.debug('Restoring snapshot', { snapshotId, options });

            // Validate inputs
            if (!snapshotId || typeof snapshotId !== 'string') {
                throw new Error('Snapshot ID is required and must be a string');
            }

            // Retrieve snapshot from store
            const snapshot = await this.store.retrieve(snapshotId);
            if (!snapshot) {
                throw new Error(`Snapshot with ID ${snapshotId} not found`);
            }

            this.logger.debug('Snapshot retrieved for restoration', {
                snapshotId,
                description: snapshot.description,
                fileCount: Object.keys(snapshot.fileData || {}).length
            });

            // Validate snapshot has file data
            if (!snapshot.fileData || Object.keys(snapshot.fileData).length === 0) {
                throw new Error('Snapshot contains no file data to restore');
            }

            // Use fileBackup to restore files if available
            let restorationResult = {
                snapshotId,
                description: snapshot.description,
                timestamp: snapshot.timestamp,
                filesRestored: 0,
                errors: []
            };

            if (this.fileBackup) {
                try {
                    restorationResult = await this.fileBackup.restoreFiles(snapshot.fileData, {
                        createBackup: options.createBackup !== false,
                        overwriteExisting: options.overwriteExisting !== false,
                        preservePermissions: options.preservePermissions !== false,
                        dryRun: options.dryRun === true
                    });

                    this.logger.info('Snapshot restored successfully', {
                        snapshotId,
                        filesRestored: restorationResult.filesRestored
                    });
                } catch (restoreError) {
                    this.logger.error(restoreError, 'File restoration failed');
                    restorationResult.errors.push(restoreError.message);
                    throw new Error(`Failed to restore files: ${restoreError.message}`);
                }
            } else {
                this.logger.warn('FileBackup not available, cannot restore files');
                throw new Error('File restoration not available - FileBackup component missing');
            }

            return restorationResult;
        } catch (error) {
            this.logger.error(error, 'Failed to restore snapshot');
            throw error;
        }
    }

    /**
     * Delete a snapshot by ID
     * @param {string} snapshotId - Snapshot ID to delete
     * @returns {Promise<boolean>} Deletion success
     */
    async deleteSnapshot(snapshotId) {
        try {
            this.logger.debug('Deleting snapshot', { snapshotId });

            // Validate inputs
            if (!snapshotId || typeof snapshotId !== 'string') {
                throw new Error('Snapshot ID is required and must be a string');
            }

            // Check if snapshot exists before attempting deletion
            const exists = await this.store.exists(snapshotId);
            if (!exists) {
                this.logger.warn('Attempted to delete non-existent snapshot', { snapshotId });
                return false;
            }

            // Get snapshot info for logging before deletion
            const snapshot = await this.store.retrieve(snapshotId);
            const snapshotInfo = snapshot ? {
                description: snapshot.description,
                timestamp: snapshot.timestamp,
                fileCount: Object.keys(snapshot.fileData || {}).length
            } : { description: 'Unknown' };

            // Delete from store
            const success = await this.store.delete(snapshotId);

            if (success) {
                this.logger.info('Snapshot deleted successfully', {
                    snapshotId,
                    ...snapshotInfo
                });
            } else {
                this.logger.warn('Snapshot deletion failed', { snapshotId });
            }

            return success;
        } catch (error) {
            this.logger.error(error, 'Failed to delete snapshot');
            throw error;
        }
    }

    /**
     * Create a backup snapshot when tools modify files
     * @param {string} toolName - Name of the tool making changes
     * @param {Array} files - Files being modified
     * @returns {Promise<Object>} Backup snapshot
     */
    async createBackupSnapshot(toolName, files) {
        try {
            this.logger.debug('Creating backup snapshot', { toolName, files });

            // TODO: Implement backup snapshot creation
            // This will be used in Phase 2 for automatic snapshots

            throw new Error('createBackupSnapshot not yet implemented');
        } catch (error) {
            this.logger.error(error, 'Failed to create backup snapshot');
            throw error;
        }
    }

    /**
     * Update configuration at runtime
     * @param {Object} newConfig - New configuration object
     */
    updateConfiguration(newConfig) {
        try {
            this.logger.debug('Updating configuration', { newConfig });

            // Validate new configuration
            if (!newConfig || typeof newConfig !== 'object') {
                throw new Error('Configuration must be a valid object');
            }

            // Update internal config
            this.config = {
                ...this.config,
                ...newConfig
            };

            // Notify components of changes
            if (this.fileFilter && typeof this.fileFilter.updateConfiguration === 'function') {
                try {
                    this.fileFilter.updateConfiguration(newConfig.fileFilter || {});
                } catch (filterError) {
                    this.logger.warn('Failed to update FileFilter configuration', {
                        error: filterError.message
                    });
                }
            }

            if (this.fileBackup && newConfig.fileBackup) {
                // FileBackup config is typically updated via constructor
                // but we can update some runtime settings
                if (this.fileBackup.config) {
                    Object.assign(this.fileBackup.config, newConfig.fileBackup);
                }
            }

            this.logger.info('Configuration updated successfully', {
                updatedKeys: Object.keys(newConfig)
            });
        } catch (error) {
            this.logger.error(error, 'Failed to update configuration');
            throw error;
        }
    }

    /**
     * Calculate the size of data in bytes
     * @param {Object} data - Data to calculate size for
     * @returns {number} Size in bytes
     */
    _calculateDataSize(data) {
        try {
            return Buffer.byteLength(JSON.stringify(data), 'utf8');
        } catch (error) {
            this.logger.warn('Failed to calculate data size', { error: error.message });
            return 0;
        }
    }

    /**
     * Calculate age of snapshot in human-readable format
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Human-readable age
     */
    _calculateAge(timestamp) {
        try {
            const now = new Date();
            const snapshotTime = new Date(timestamp);
            const diffMs = now - snapshotTime;

            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMinutes < 1) return 'just now';
            if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } catch (error) {
            this.logger.warn('Failed to calculate age', { error: error.message });
            return 'unknown';
        }
    }

    /**
     * Format size in human-readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    _formatSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        const value = (bytes / Math.pow(k, i)).toFixed(1);
        return `${value} ${sizes[i]}`;
    }
}

export default SnapshotManager;
