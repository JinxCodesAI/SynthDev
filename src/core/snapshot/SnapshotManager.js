/**
 * Central orchestrator for snapshot system
 * Coordinates between storage, backup, and filtering components
 */

import { getLogger } from '../../core/managers/logger.js';
import { getSnapshotConfigManager } from '../../config/managers/snapshotConfigManager.js';
import { MemorySnapshotStore } from './stores/MemorySnapshotStore.js';
import { FileBackup } from './FileBackup.js';
import { FileFilter } from './FileFilter.js';
import { v4 as uuidv4 } from 'uuid';
import { resolve } from 'path';

export class SnapshotManager {
    constructor(config = {}) {
        this.logger = getLogger();
        this.snapshotConfigManager = getSnapshotConfigManager();

        // Load configuration from snapshot config manager
        const snapshotConfig = this.snapshotConfigManager.getConfig();
        this.messages = snapshotConfig.messages;

        // Configuration with defaults (passed config takes precedence over snapshot config)
        this.config = {
            // Storage configuration
            storage: {
                ...snapshotConfig.storage,
                ...config.storage,
            },
            // File filtering configuration
            fileFiltering: {
                ...snapshotConfig.fileFiltering,
                ...config.fileFiltering,
            },
            // Backup configuration
            backup: {
                ...snapshotConfig.backup,
                ...config.backup,
            },
            // Behavior configuration
            behavior: {
                ...snapshotConfig.behavior,
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
                throw new Error(this.messages.errors.invalidDescription);
            }

            // Determine base path
            const basePath = metadata.basePath || process.cwd();
            const resolvedBasePath = resolve(basePath);

            // Get the most recent snapshot as base for differential snapshot
            let baseSnapshotId = null;
            let baseSnapshot = null;
            const recentSnapshots = await this.store.list({ limit: 1 });
            if (recentSnapshots.length > 0) {
                baseSnapshotId = recentSnapshots[0].id;
                // Retrieve the full base snapshot for differential comparison
                baseSnapshot = await this.store.retrieve(baseSnapshotId);
            }

            // Capture files
            const captureStartTime = Date.now();
            const fileData = await this.fileBackup.captureFiles(resolvedBasePath, {
                specificFiles: metadata.specificFiles,
                recursive: true,
                baseSnapshot: baseSnapshot,
            });

            // Create snapshot metadata
            const isDifferential = baseSnapshotId !== null;
            const newFiles = fileData.stats.newFiles || 0;
            const modifiedFiles = fileData.stats.modifiedFiles || 0;
            const unchangedFiles = fileData.stats.unchangedFiles || 0;

            // For differential snapshots, fileCount should be only changed files
            // For full snapshots, fileCount should be all files
            const fileCount = isDifferential
                ? newFiles + modifiedFiles
                : Object.keys(fileData.files).length;

            const snapshotMetadata = {
                description,
                basePath: resolvedBasePath,
                triggerType: metadata.triggerType || 'manual',
                captureTime: Date.now() - captureStartTime,
                fileCount: fileCount,
                totalSize: fileData.stats.totalSize,
                differentialSize: fileData.stats.differentialSize || fileData.stats.totalSize,
                newFiles: newFiles,
                modifiedFiles: modifiedFiles,
                unchangedFiles: unchangedFiles,
                linkedFiles: fileData.stats.linkedFiles || 0,
                type: isDifferential ? 'differential' : 'full',
                baseSnapshotId: baseSnapshotId,
                creator: process.env.USER || process.env.USERNAME || 'unknown',
                ...metadata,
            };

            // Store differential snapshot
            const snapshotId = await this.store.storeDifferential(
                {
                    description,
                    fileData,
                    metadata: snapshotMetadata,
                },
                baseSnapshotId
            );

            // Perform auto-cleanup if enabled
            if (this.config.behavior.autoCleanup) {
                await this._performAutoCleanup();
            }

            // Get the stored snapshot to access differential stats if available
            const storedSnapshot = await this.store.retrieve(snapshotId);
            const differentialStats = storedSnapshot?.metadata?.differentialStats;

            const result = {
                id: snapshotId,
                description,
                metadata: {
                    ...snapshotMetadata,
                    // Include differential stats in metadata for display
                    ...(differentialStats && {
                        changedFiles: differentialStats.changedFiles,
                        unchangedFiles: differentialStats.unchangedFiles,
                    }),
                },
                stats: {
                    fileCount: snapshotMetadata.fileCount,
                    totalSize: snapshotMetadata.totalSize,
                    captureTime: snapshotMetadata.captureTime,
                    type: snapshotMetadata.type,
                    ...(differentialStats && {
                        changedFiles: differentialStats.changedFiles,
                        unchangedFiles: differentialStats.unchangedFiles,
                    }),
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
                differentialSize: snapshot.differentialSize,
                triggerType: snapshot.triggerType,
                creator: snapshot.creator,
                basePath: snapshot.basePath,
                type: snapshot.type,
                // Include differential stats if available
                ...(snapshot.differentialStats && {
                    changedFiles: snapshot.differentialStats.changedFiles,
                    unchangedFiles: snapshot.differentialStats.unchangedFiles,
                }),
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
            let snapshot = await this.store.retrieve(fullId);
            if (!snapshot) {
                throw new Error(this.messages.errors.snapshotNotFound.replace('{id}', snapshotId));
            }

            // If it's a differential snapshot, reconstruct it first
            if (
                snapshot.type === 'differential' &&
                typeof this.store.reconstructSnapshot === 'function'
            ) {
                snapshot = await this.store.reconstructSnapshot(fullId);
                if (!snapshot) {
                    throw new Error(`Failed to reconstruct differential snapshot: ${snapshotId}`);
                }
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
                throw new Error(this.messages.errors.snapshotNotFound.replace('{id}', snapshotId));
            }

            // Delete from store
            const deleted = await this.store.delete(fullId);

            if (!deleted) {
                throw new Error(
                    this.messages.errors.deleteFailure.replace(
                        '{error}',
                        `Failed to delete snapshot: ${snapshotId}`
                    )
                );
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
                throw new Error(this.messages.errors.snapshotNotFound.replace('{id}', partialId));
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
                throw new Error(this.messages.errors.snapshotNotFound.replace('{id}', snapshotId));
            }

            return {
                id: fullId,
                description: snapshot.description,
                metadata: snapshot.metadata,
                fileCount: Object.keys(snapshot.fileData.files).length,
                files: await this._resolveFileDetails(snapshot.fileData.files),
            };
        } catch (error) {
            this.logger.error(error, 'Failed to get snapshot details', { snapshotId });
            throw error;
        }
    }

    /**
     * Resolve file details, handling linked files by fetching from referenced snapshots
     * @private
     * @param {Object} files - Files object from snapshot
     * @returns {Promise<Array>} Array of resolved file details
     */
    async _resolveFileDetails(files) {
        const resolvedFiles = [];

        for (const [relativePath, fileInfo] of Object.entries(files)) {
            const resolvedFileInfo = {
                path: relativePath,
                size: fileInfo.size,
                checksum: fileInfo.checksum,
                action: fileInfo.action || 'created',
            };

            // Handle linked files (unchanged files referencing other snapshots)
            if (fileInfo.snapshotId && fileInfo.action === 'unchanged') {
                try {
                    // Get the referenced snapshot to get the original file details
                    const referencedSnapshot = await this.store.retrieve(fileInfo.snapshotId);
                    if (referencedSnapshot && referencedSnapshot.fileData.files[relativePath]) {
                        const originalFile = referencedSnapshot.fileData.files[relativePath];
                        resolvedFileInfo.modified = originalFile.modified || fileInfo.modified;
                    } else {
                        // Fallback to current file info if referenced snapshot not found
                        resolvedFileInfo.modified = fileInfo.modified;
                    }
                } catch (error) {
                    // Fallback to current file info if error retrieving referenced snapshot
                    this.logger.warn('Failed to resolve referenced snapshot for file', {
                        relativePath,
                        snapshotId: fileInfo.snapshotId,
                        error: error.message,
                    });
                    resolvedFileInfo.modified = fileInfo.modified;
                }
            } else {
                // For new/modified files, use the current file info
                resolvedFileInfo.modified = fileInfo.modified;
            }

            resolvedFiles.push(resolvedFileInfo);
        }

        return resolvedFiles;
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
