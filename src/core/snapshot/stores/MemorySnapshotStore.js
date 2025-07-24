/**
 * Memory-based snapshot storage implementation
 * Stores snapshots in memory with configurable limits and cleanup
 */

import { getLogger } from '../../../core/managers/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { FileVersionTracker } from '../FileVersionTracker.js';

export class MemorySnapshotStore {
    constructor(config = {}) {
        this.logger = getLogger();

        // Configuration with defaults
        this.config = {
            maxSnapshots: config.maxSnapshots || 50,
            maxMemoryMB: config.maxMemoryMB || 100,
            persistToDisk: config.persistToDisk || false,
            ...config,
        };

        // In-memory storage
        this.snapshots = new Map();
        this.metadata = new Map();

        // File version tracking for differential snapshots
        this.fileVersionTracker = new FileVersionTracker();

        // Statistics tracking
        this.stats = {
            totalSnapshots: 0,
            memoryUsage: 0,
            lastCleanup: null,
        };

        this.logger.debug('MemorySnapshotStore initialized', { config: this.config });
    }

    /**
     * Store a snapshot with its data
     * @param {Object} snapshot - Snapshot data
     * @param {string} snapshot.id - Unique snapshot ID (optional, will generate if not provided)
     * @param {string} snapshot.description - Snapshot description
     * @param {Object} snapshot.fileData - File content data
     * @param {Object} snapshot.metadata - Additional metadata
     * @returns {Promise<string>} Snapshot ID
     */
    async store(snapshot) {
        try {
            // Generate ID if not provided
            const snapshotId = snapshot.id || uuidv4();

            // Validate snapshot data
            this._validateSnapshot(snapshot);

            // Check memory limits before storing
            await this._checkMemoryLimits();

            // Calculate memory usage for this snapshot
            const memorySize = this._calculateMemorySize(snapshot);

            // Create snapshot record
            const snapshotRecord = {
                id: snapshotId,
                description: snapshot.description,
                fileData: snapshot.fileData,
                metadata: {
                    timestamp: new Date().toISOString(),
                    memorySize,
                    ...snapshot.metadata,
                },
            };

            // Store snapshot and metadata
            this.snapshots.set(snapshotId, snapshotRecord);
            this.metadata.set(snapshotId, {
                ...snapshotRecord.metadata,
                description: snapshot.description,
            });

            // Update statistics
            this.stats.totalSnapshots++;
            this.stats.memoryUsage += memorySize;

            this.logger.debug('Snapshot stored successfully', {
                id: snapshotId,
                description: snapshot.description,
                memorySize,
                totalMemory: this.stats.memoryUsage,
            });

            return snapshotId;
        } catch (error) {
            this.logger.error(error, 'Failed to store snapshot');
            throw error;
        }
    }

    /**
     * Retrieve a snapshot by ID
     * @param {string} snapshotId - Snapshot ID
     * @returns {Promise<Object|null>} Snapshot data or null if not found
     */
    async retrieve(snapshotId) {
        try {
            const snapshot = this.snapshots.get(snapshotId);

            if (!snapshot) {
                this.logger.warn('Snapshot not found', { id: snapshotId });
                return null;
            }

            this.logger.debug('Snapshot retrieved successfully', { id: snapshotId });
            return snapshot;
        } catch (error) {
            this.logger.error(error, 'Failed to retrieve snapshot', { id: snapshotId });
            throw error;
        }
    }

    /**
     * List all snapshots with optional filtering
     * @param {Object} filters - Optional filters
     * @param {string} filters.sortBy - Sort by field (timestamp, description, size)
     * @param {string} filters.sortOrder - Sort order (asc, desc)
     * @param {number} filters.limit - Maximum number of results
     * @returns {Promise<Array>} Array of snapshot metadata
     */
    async list(filters = {}) {
        try {
            const { sortBy = 'timestamp', sortOrder = 'desc', limit = 100 } = filters;

            // Get all snapshots metadata
            let snapshots = Array.from(this.metadata.entries()).map(([id, metadata]) => ({
                id,
                ...metadata,
            }));

            // Apply sorting
            snapshots = this._sortSnapshots(snapshots, sortBy, sortOrder);

            // Apply limit
            if (limit > 0) {
                snapshots = snapshots.slice(0, limit);
            }

            this.logger.debug('Snapshots listed successfully', {
                count: snapshots.length,
                sortBy,
                sortOrder,
                limit,
            });

            return snapshots;
        } catch (error) {
            this.logger.error(error, 'Failed to list snapshots');
            throw error;
        }
    }

    /**
     * Delete a snapshot by ID
     * @param {string} snapshotId - Snapshot ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async delete(snapshotId) {
        try {
            const snapshot = this.snapshots.get(snapshotId);

            if (!snapshot) {
                this.logger.warn('Snapshot not found for deletion', { id: snapshotId });
                return false;
            }

            // Remove from storage
            this.snapshots.delete(snapshotId);
            this.metadata.delete(snapshotId);

            // Update statistics
            this.stats.totalSnapshots--;
            this.stats.memoryUsage -= snapshot.metadata.memorySize;

            this.logger.debug('Snapshot deleted successfully', {
                id: snapshotId,
                remainingSnapshots: this.stats.totalSnapshots,
                memoryFreed: snapshot.metadata.memorySize,
            });

            return true;
        } catch (error) {
            this.logger.error(error, 'Failed to delete snapshot', { id: snapshotId });
            throw error;
        }
    }

    /**
     * Check if a snapshot exists
     * @param {string} snapshotId - Snapshot ID
     * @returns {Promise<boolean>} True if exists, false otherwise
     */
    async exists(snapshotId) {
        return this.snapshots.has(snapshotId);
    }

    /**
     * Get storage statistics
     * @returns {Object} Storage statistics
     */
    getStorageStats() {
        return {
            ...this.stats,
            maxSnapshots: this.config.maxSnapshots,
            maxMemoryMB: this.config.maxMemoryMB,
            memoryUsageMB: this.stats.memoryUsage / (1024 * 1024),
            memoryUsagePercent:
                (this.stats.memoryUsage / (this.config.maxMemoryMB * 1024 * 1024)) * 100,
        };
    }

    /**
     * Clean up old snapshots based on criteria
     * @param {Object} criteria - Cleanup criteria
     * @param {number} criteria.maxAge - Maximum age in milliseconds
     * @param {number} criteria.maxCount - Maximum number of snapshots to keep
     * @returns {Promise<number>} Number of snapshots cleaned up
     */
    async cleanup(criteria = {}) {
        try {
            const { maxAge, maxCount } = criteria;
            let deletedCount = 0;

            // Get all snapshots sorted by timestamp (oldest first)
            const snapshots = await this.list({ sortBy: 'timestamp', sortOrder: 'asc' });

            // Clean up by age
            if (maxAge) {
                const cutoffTime = Date.now() - maxAge;

                for (const snapshot of snapshots) {
                    if (new Date(snapshot.timestamp).getTime() < cutoffTime) {
                        await this.delete(snapshot.id);
                        deletedCount++;
                    }
                }
            }

            // Clean up by count
            if (maxCount && snapshots.length > maxCount) {
                const toDelete = snapshots.length - maxCount;

                for (let i = 0; i < toDelete; i++) {
                    await this.delete(snapshots[i].id);
                    deletedCount++;
                }
            }

            this.stats.lastCleanup = new Date().toISOString();

            this.logger.debug('Cleanup completed', {
                deletedCount,
                remainingSnapshots: this.stats.totalSnapshots,
            });

            return deletedCount;
        } catch (error) {
            this.logger.error(error, 'Cleanup failed');
            throw error;
        }
    }

    /**
     * Validate snapshot data
     * @private
     * @param {Object} snapshot - Snapshot to validate
     */
    _validateSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            throw new Error('Invalid snapshot data: must be an object');
        }

        if (!snapshot.description || typeof snapshot.description !== 'string') {
            throw new Error('Invalid snapshot data: description is required and must be a string');
        }

        if (!snapshot.fileData || typeof snapshot.fileData !== 'object') {
            throw new Error('Invalid snapshot data: fileData is required and must be an object');
        }
    }

    /**
     * Check memory limits and trigger cleanup if needed
     * @private
     */
    async _checkMemoryLimits() {
        const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

        // Check memory limit
        if (this.stats.memoryUsage > maxMemoryBytes) {
            await this.cleanup({ maxCount: Math.floor(this.config.maxSnapshots * 0.8) });
        }

        // Check snapshot count limit
        if (this.stats.totalSnapshots >= this.config.maxSnapshots) {
            await this.cleanup({ maxCount: Math.floor(this.config.maxSnapshots * 0.8) });
        }
    }

    /**
     * Calculate memory size of a snapshot
     * @private
     * @param {Object} snapshot - Snapshot data
     * @returns {number} Memory size in bytes
     */
    _calculateMemorySize(snapshot) {
        try {
            const jsonString = JSON.stringify(snapshot);
            return Buffer.byteLength(jsonString, 'utf8');
        } catch (error) {
            this.logger.warn('Failed to calculate memory size, using estimate', {
                error: error.message,
            });
            return 1024; // Default estimate
        }
    }

    /**
     * Sort snapshots by specified criteria
     * @private
     * @param {Array} snapshots - Snapshots to sort
     * @param {string} sortBy - Sort field
     * @param {string} sortOrder - Sort order
     * @returns {Array} Sorted snapshots
     */
    _sortSnapshots(snapshots, sortBy, sortOrder) {
        return snapshots.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'timestamp':
                    aValue = new Date(a.timestamp).getTime();
                    bValue = new Date(b.timestamp).getTime();
                    break;
                case 'description':
                    aValue = a.description.toLowerCase();
                    bValue = b.description.toLowerCase();
                    break;
                case 'size':
                    aValue = a.memorySize || 0;
                    bValue = b.memorySize || 0;
                    break;
                default:
                    aValue = a.timestamp;
                    bValue = b.timestamp;
            }

            if (sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
    }

    /**
     * Store differential snapshot with file references
     * @param {Object} snapshot - Snapshot data to store
     * @param {string} baseSnapshotId - Base snapshot ID for differential comparison
     * @returns {Promise<string>} Generated snapshot ID
     */
    async storeDifferential(snapshot, baseSnapshotId = null) {
        const snapshotId = snapshot.id || uuidv4();

        // Process files to create differential structure
        const processedFiles = {};
        for (const [filePath, fileInfo] of Object.entries(snapshot.fileData.files)) {
            const existingVersion = this.fileVersionTracker.findSnapshotForChecksum(
                fileInfo.checksum
            );

            if (existingVersion && existingVersion.snapshotId !== snapshotId) {
                // File unchanged - reference existing version
                processedFiles[filePath] = {
                    action: 'unchanged',
                    checksum: fileInfo.checksum,
                    snapshotId: existingVersion.snapshotId,
                    size: fileInfo.size || 0,
                };
            } else {
                // File changed or new - store full content
                processedFiles[filePath] = {
                    action: baseSnapshotId ? 'modified' : 'created',
                    content: fileInfo.content,
                    checksum: fileInfo.checksum,
                    size: fileInfo.size || 0,
                };

                // Track this file version
                this.fileVersionTracker.trackFileVersion(
                    filePath,
                    fileInfo.checksum,
                    snapshotId,
                    fileInfo.size || 0
                );
            }
        }

        // Store the differential snapshot
        const snapshotRecord = {
            id: snapshotId,
            type: baseSnapshotId ? 'differential' : 'full',
            baseSnapshotId,
            description: snapshot.description,
            fileData: {
                files: processedFiles,
                basePath: snapshot.fileData.basePath,
                captureTime: snapshot.fileData.captureTime,
                stats: snapshot.fileData.stats,
            },
            metadata: {
                ...snapshot.metadata,
                timestamp: new Date().toISOString(),
                differentialStats: {
                    totalFiles: Object.keys(processedFiles).length,
                    changedFiles: Object.values(processedFiles).filter(
                        f => f.action !== 'unchanged'
                    ).length,
                    unchangedFiles: Object.values(processedFiles).filter(
                        f => f.action === 'unchanged'
                    ).length,
                },
            },
        };

        this.snapshots.set(snapshotId, snapshotRecord);
        this.metadata.set(snapshotId, {
            id: snapshotId,
            description: snapshot.description,
            timestamp: snapshotRecord.metadata.timestamp,
            type: snapshotRecord.type,
            fileCount: Object.keys(processedFiles).length,
            totalSize: this._calculateMemorySize(snapshotRecord),
        });

        // Update statistics
        this.stats.totalSnapshots++;
        this.stats.memoryUsage += this._calculateMemorySize(snapshotRecord);

        // Check memory limits
        await this._checkMemoryLimits();

        this.logger.debug('Differential snapshot stored successfully', {
            id: snapshotId,
            type: snapshotRecord.type,
            changedFiles: snapshotRecord.metadata.differentialStats.changedFiles,
            unchangedFiles: snapshotRecord.metadata.differentialStats.unchangedFiles,
        });

        return snapshotId;
    }

    /**
     * Reconstruct full file data from differential snapshots
     * @param {string} snapshotId - ID of the snapshot to reconstruct
     * @returns {Promise<Object|null>} Reconstructed snapshot or null if not found
     */
    async reconstructSnapshot(snapshotId) {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            return null;
        }

        if (snapshot.type === 'full') {
            return snapshot; // Already complete
        }

        // Reconstruct from differential chain
        const reconstructedFiles = {};
        const snapshotChain = await this._buildSnapshotChain(snapshotId);

        // Process files from oldest to newest
        for (const chainSnapshot of snapshotChain.reverse()) {
            for (const [filePath, fileInfo] of Object.entries(chainSnapshot.fileData.files)) {
                if (fileInfo.action === 'deleted') {
                    delete reconstructedFiles[filePath];
                } else if (fileInfo.action === 'unchanged') {
                    // Get content from referenced snapshot
                    const referencedSnapshot = this.snapshots.get(fileInfo.snapshotId);
                    if (referencedSnapshot) {
                        const referencedFile = referencedSnapshot.fileData.files[filePath];
                        if (referencedFile && referencedFile.content !== undefined) {
                            reconstructedFiles[filePath] = {
                                content: referencedFile.content,
                                checksum: referencedFile.checksum,
                                size: referencedFile.size,
                            };
                        }
                    }
                } else {
                    // Modified or created - use current content
                    reconstructedFiles[filePath] = {
                        content: fileInfo.content,
                        checksum: fileInfo.checksum,
                        size: fileInfo.size,
                    };
                }
            }
        }

        return {
            ...snapshot,
            fileData: {
                files: reconstructedFiles,
                basePath: snapshot.fileData.basePath,
                captureTime: snapshot.fileData.captureTime,
                stats: snapshot.fileData.stats,
            },
        };
    }

    /**
     * Build the chain of snapshots needed to reconstruct a differential snapshot
     * @private
     * @param {string} snapshotId - Starting snapshot ID
     * @returns {Promise<Array>} Array of snapshots in chain order
     */
    async _buildSnapshotChain(snapshotId) {
        const chain = [];
        let currentId = snapshotId;

        while (currentId) {
            const snapshot = this.snapshots.get(currentId);
            if (!snapshot) {
                break;
            }

            chain.push(snapshot);

            if (snapshot.type === 'full') {
                break; // Reached base snapshot
            }

            currentId = snapshot.baseSnapshotId;
        }

        return chain;
    }
}

export default MemorySnapshotStore;
