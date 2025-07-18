/**
 * Central orchestrator for snapshot system
 * Coordinates between storage, backup, and filtering components
 */

import { getLogger } from '../../core/managers/logger.js';
import { MemorySnapshotStore } from './stores/MemorySnapshotStore.js';
import { FileBackup } from './FileBackup.js';
import { FileFilter } from './FileFilter.js';
import { v4 as uuidv4 } from 'uuid';
import { resolve } from 'path';

export class SnapshotManager {
    constructor(config = {}) {
        this.logger = getLogger();

        // Configuration with defaults
        this.config = {
            // Storage configuration
            storage: {
                type: 'memory',
                maxSnapshots: 50,
                maxMemoryMB: 100,
                persistToDisk: false,
                ...config.storage,
            },
            // File filtering configuration
            fileFiltering: {
                defaultExclusions: [
                    'node_modules',
                    'node_modules/**',
                    '.git',
                    '.git/**',
                    'dist',
                    'dist/**',
                    'build',
                    'build/**',
                    '*.log',
                    '*.tmp',
                ],
                customExclusions: [],
                maxFileSize: 10 * 1024 * 1024, // 10MB
                binaryFileHandling: 'exclude',
                ...config.fileFiltering,
            },
            // Backup configuration
            backup: {
                createBackups: true,
                backupSuffix: '.backup',
                preservePermissions: true,
                validateChecksums: true,
                ...config.backup,
            },
            // Behavior configuration
            behavior: {
                autoCleanup: true,
                cleanupThreshold: 40,
                confirmRestore: true,
                showPreview: true,
                ...config.behavior,
            },
            ...config,
        };

        // Initialize components
        this.fileFilter = new FileFilter(this.config.fileFiltering);
        this.fileBackup = new FileBackup(this.fileFilter, this.config.backup);
        this.store = this._createStore();

        // Track active operations
        this.activeOperations = new Set();

        this.logger.debug('SnapshotManager initialized', { config: this.config });
    }

    /**
     * Create a new snapshot
     * @param {string} description - Snapshot description
     * @param {Object} metadata - Additional metadata
     * @param {string} metadata.basePath - Base path for snapshot (defaults to current directory)
     * @param {Array} metadata.specificFiles - Specific files to include (optional)
     * @param {string} metadata.triggerType - What triggered the snapshot (manual, automatic, etc.)
     * @returns {Promise<Object>} Snapshot creation result
     */
    async createSnapshot(description, metadata = {}) {
        const operationId = uuidv4();
        this.activeOperations.add(operationId);

        try {
            this.logger.debug('Creating snapshot', { description, metadata, operationId });

            // Validate parameters
            if (!description || typeof description !== 'string') {
                throw new Error('Snapshot description is required and must be a string');
            }

            // Determine base path
            const basePath = metadata.basePath || process.cwd();
            const resolvedBasePath = resolve(basePath);

            // Capture files
            const captureStartTime = Date.now();
            const fileData = await this.fileBackup.captureFiles(resolvedBasePath, {
                specificFiles: metadata.specificFiles,
                recursive: true,
            });

            // Create snapshot metadata
            const snapshotMetadata = {
                description,
                basePath: resolvedBasePath,
                triggerType: metadata.triggerType || 'manual',
                captureTime: Date.now() - captureStartTime,
                fileCount: Object.keys(fileData.files).length,
                totalSize: fileData.stats.totalSize,
                creator: process.env.USER || process.env.USERNAME || 'unknown',
                ...metadata,
            };

            // Store snapshot
            const snapshotId = await this.store.store({
                description,
                fileData,
                metadata: snapshotMetadata,
            });

            // Perform auto-cleanup if enabled
            if (this.config.behavior.autoCleanup) {
                await this._performAutoCleanup();
            }

            const result = {
                id: snapshotId,
                description,
                metadata: snapshotMetadata,
                stats: {
                    fileCount: snapshotMetadata.fileCount,
                    totalSize: snapshotMetadata.totalSize,
                    captureTime: snapshotMetadata.captureTime,
                },
            };

            this.logger.debug('Snapshot created successfully', {
                id: snapshotId,
                description,
                stats: result.stats,
            });

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to create snapshot', { description, metadata });
            throw error;
        } finally {
            this.activeOperations.delete(operationId);
        }
    }

    /**
     * List all snapshots with optional filtering
     * @param {Object} filters - List filters
     * @param {string} filters.sortBy - Sort by field
     * @param {string} filters.sortOrder - Sort order (asc/desc)
     * @param {number} filters.limit - Maximum results
     * @param {string} filters.triggerType - Filter by trigger type
     * @returns {Promise<Array>} Array of snapshot summaries
     */
    async listSnapshots(filters = {}) {
        try {
            this.logger.debug('Listing snapshots', { filters });

            const snapshots = await this.store.list(filters);

            // Apply additional filters
            let filteredSnapshots = snapshots;

            if (filters.triggerType) {
                filteredSnapshots = snapshots.filter(
                    snapshot => snapshot.triggerType === filters.triggerType
                );
            }

            // Transform to summary format
            const summaries = filteredSnapshots.map(snapshot => ({
                id: snapshot.id,
                description: snapshot.description,
                timestamp: snapshot.timestamp,
                fileCount: snapshot.fileCount,
                totalSize: snapshot.totalSize,
                triggerType: snapshot.triggerType,
                creator: snapshot.creator,
                basePath: snapshot.basePath,
            }));

            this.logger.debug('Snapshots listed successfully', {
                totalSnapshots: summaries.length,
                filters,
            });

            return summaries;
        } catch (error) {
            this.logger.error(error, 'Failed to list snapshots');
            throw error;
        }
    }

    /**
     * Restore a snapshot
     * @param {string} snapshotId - Snapshot ID to restore (can be partial)
     * @param {Object} options - Restoration options
     * @param {boolean} options.preview - Only preview, don't actually restore
     * @param {boolean} options.force - Skip confirmation prompts
     * @param {Array} options.specificFiles - Specific files to restore
     * @param {boolean} options.createBackups - Create backups before restoration
     * @returns {Promise<Object>} Restoration result
     */
    async restoreSnapshot(snapshotId, options = {}) {
        const operationId = uuidv4();
        this.activeOperations.add(operationId);

        try {
            this.logger.debug('Restoring snapshot', { snapshotId, options, operationId });

            // Resolve partial ID to full ID
            const fullId = await this.resolveSnapshotId(snapshotId);

            // Validate snapshot exists
            const snapshot = await this.store.retrieve(fullId);
            if (!snapshot) {
                throw new Error(`Snapshot not found: ${snapshotId}`);
            }

            // If preview mode, generate preview
            if (options.preview) {
                const preview = await this.fileBackup.previewRestore(snapshot.fileData, {
                    specificFiles: options.specificFiles,
                });

                this.logger.debug('Snapshot preview generated', {
                    snapshotId: fullId,
                    impactedFiles: preview.stats.impactedFiles,
                });

                return {
                    type: 'preview',
                    snapshotId: fullId,
                    description: snapshot.description,
                    preview,
                };
            }

            // Perform restoration
            const restoreOptions = {
                createBackups: options.createBackups ?? this.config.backup.createBackups,
                validateChecksums: this.config.backup.validateChecksums,
                specificFiles: options.specificFiles,
            };

            const restoreResult = await this.fileBackup.restoreFiles(
                snapshot.fileData,
                restoreOptions
            );

            const result = {
                type: 'restore',
                snapshotId: fullId,
                description: snapshot.description,
                stats: restoreResult.stats,
                restored: restoreResult.restored,
                errors: restoreResult.errors,
                backups: restoreResult.backups,
            };

            this.logger.debug('Snapshot restored successfully', {
                snapshotId: fullId,
                stats: result.stats,
            });

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to restore snapshot', { snapshotId });
            throw error;
        } finally {
            this.activeOperations.delete(operationId);
        }
    }

    /**
     * Delete a snapshot
     * @param {string} snapshotId - Snapshot ID to delete (can be partial)
     * @returns {Promise<Object>} Deletion result
     */
    async deleteSnapshot(snapshotId) {
        try {
            this.logger.debug('Deleting snapshot', { snapshotId });

            // Resolve partial ID to full ID
            const fullId = await this.resolveSnapshotId(snapshotId);

            // Validate snapshot exists
            const snapshot = await this.store.retrieve(fullId);
            if (!snapshot) {
                throw new Error(`Snapshot not found: ${snapshotId}`);
            }

            // Delete from store
            const deleted = await this.store.delete(fullId);

            if (!deleted) {
                throw new Error(`Failed to delete snapshot: ${snapshotId}`);
            }

            const result = {
                id: fullId,
                description: snapshot.description,
                deleted: true,
            };

            this.logger.debug('Snapshot deleted successfully', { snapshotId: fullId });

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to delete snapshot', { snapshotId });
            throw error;
        }
    }

    /**
     * Create a backup snapshot before tool execution
     * @param {string} toolName - Name of the tool being executed
     * @param {Array} files - Files that will be modified
     * @returns {Promise<Object>} Backup snapshot result
     */
    async createBackupSnapshot(toolName, files = []) {
        try {
            this.logger.debug('Creating backup snapshot', { toolName, fileCount: files.length });

            const description = `Backup before ${toolName} execution`;
            const metadata = {
                triggerType: 'automatic',
                toolName,
                specificFiles: files.length > 0 ? files : undefined,
            };

            return await this.createSnapshot(description, metadata);
        } catch (error) {
            this.logger.error(error, 'Failed to create backup snapshot', { toolName });
            throw error;
        }
    }

    /**
     * Get snapshot system statistics
     * @returns {Object} System statistics
     */
    getSystemStats() {
        const storageStats = this.store.getStorageStats();
        const filterStats = this.fileFilter.getFilterStats();

        return {
            storage: storageStats,
            filtering: filterStats,
            activeOperations: this.activeOperations.size,
            configuration: {
                storageType: this.config.storage.type,
                maxSnapshots: this.config.storage.maxSnapshots,
                maxMemoryMB: this.config.storage.maxMemoryMB,
                autoCleanup: this.config.behavior.autoCleanup,
            },
        };
    }

    /**
     * Update configuration at runtime
     * @param {Object} newConfig - New configuration to apply
     */
    updateConfiguration(newConfig) {
        this.logger.debug('Updating configuration', { newConfig });

        // Update main config
        this.config = { ...this.config, ...newConfig };

        // Update component configurations
        if (newConfig.fileFiltering) {
            this.fileFilter.updateConfiguration(newConfig.fileFiltering);
        }

        // Note: Store configuration updates would require recreating the store
        // For now, we'll log this limitation
        if (newConfig.storage) {
            this.logger.warn('Storage configuration changes require system restart');
        }

        this.logger.debug('Configuration updated successfully');
    }

    /**
     * Resolve a partial snapshot ID to full ID
     * @param {string} partialId - Partial or full snapshot ID
     * @returns {Promise<string>} Full snapshot ID
     * @throws {Error} If no match found or multiple matches found
     */
    async resolveSnapshotId(partialId) {
        try {
            // First try direct lookup (full ID)
            const directMatch = await this.store.exists(partialId);
            if (directMatch) {
                return partialId;
            }

            // Get all snapshots to search for prefix matches
            const snapshots = await this.store.list();
            const matches = snapshots.filter(snapshot => snapshot.id.startsWith(partialId));

            if (matches.length === 0) {
                throw new Error(`Snapshot not found: ${partialId}`);
            }

            if (matches.length > 1) {
                const matchingIds = matches.map(s => s.id).join(', ');
                throw new Error(
                    `Ambiguous snapshot ID "${partialId}". Multiple matches found: ${matchingIds}`
                );
            }

            return matches[0].id;
        } catch (error) {
            this.logger.error(error, 'Failed to resolve snapshot ID', { partialId });
            throw error;
        }
    }

    /**
     * Get detailed snapshot information
     * @param {string} snapshotId - Snapshot ID (can be partial)
     * @returns {Promise<Object>} Detailed snapshot information
     */
    async getSnapshotDetails(snapshotId) {
        try {
            // Resolve partial ID to full ID
            const fullId = await this.resolveSnapshotId(snapshotId);

            const snapshot = await this.store.retrieve(fullId);
            if (!snapshot) {
                throw new Error(`Snapshot not found: ${snapshotId}`);
            }

            return {
                id: fullId,
                description: snapshot.description,
                metadata: snapshot.metadata,
                fileCount: Object.keys(snapshot.fileData.files).length,
                files: Object.keys(snapshot.fileData.files).map(relativePath => ({
                    path: relativePath,
                    size: snapshot.fileData.files[relativePath].size,
                    modified: snapshot.fileData.files[relativePath].modified,
                    checksum: snapshot.fileData.files[relativePath].checksum,
                })),
            };
        } catch (error) {
            this.logger.error(error, 'Failed to get snapshot details', { snapshotId });
            throw error;
        }
    }

    /**
     * Create storage implementation based on configuration
     * @private
     * @returns {Object} Storage implementation
     */
    _createStore() {
        switch (this.config.storage.type) {
            case 'memory':
                return new MemorySnapshotStore(this.config.storage);
            default:
                throw new Error(`Unsupported storage type: ${this.config.storage.type}`);
        }
    }

    /**
     * Perform automatic cleanup if needed
     * @private
     */
    async _performAutoCleanup() {
        try {
            const stats = this.store.getStorageStats();

            // Check if cleanup is needed
            if (stats.totalSnapshots >= this.config.behavior.cleanupThreshold) {
                const maxCount = Math.floor(this.config.storage.maxSnapshots * 0.8);
                const cleanedCount = await this.store.cleanup({ maxCount });

                if (cleanedCount > 0) {
                    this.logger.debug('Auto-cleanup performed', {
                        cleanedCount,
                        remainingSnapshots: stats.totalSnapshots - cleanedCount,
                    });
                }
            }
        } catch (error) {
            this.logger.warn('Auto-cleanup failed', { error: error.message });
        }
    }
}

export default SnapshotManager;
