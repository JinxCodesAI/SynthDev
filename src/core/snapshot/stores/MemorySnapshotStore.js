/**
 * MemorySnapshotStore - In-memory storage implementation for snapshots
 *
 * This class provides fast in-memory storage with configurable limits
 * and memory usage monitoring.
 */

import { getLogger } from '../../managers/logger.js';
import { randomUUID } from 'crypto';

export class MemorySnapshotStore {
    /**
     * Create a new MemorySnapshotStore
     * @param {Object} config - Configuration object
     */
    constructor(config = {}) {
        this.config = {
            maxSnapshots: config.maxSnapshots || 50,
            maxMemoryMB: config.maxMemoryMB || 100,
            persistToDisk: config.persistToDisk || false,
            ...config,
        };

        this.snapshots = new Map();
        this.logger = getLogger();
        this.memoryUsage = 0;

        this.logger.debug('MemorySnapshotStore initialized', { config: this.config });
    }

    /**
     * Store a snapshot
     * @param {Object} snapshot - Snapshot object to store
     * @returns {Promise<string>} Generated snapshot ID
     */
    async store(snapshot) {
        try {
            // Generate ID if not provided
            const snapshotId = snapshot.id || randomUUID();

            // Check if ID already exists
            if (this.snapshots.has(snapshotId)) {
                throw new Error(`Snapshot with ID ${snapshotId} already exists`);
            }

            // Create complete snapshot object with metadata
            const completeSnapshot = {
                id: snapshotId,
                description: snapshot.description || '',
                timestamp: new Date().toISOString(),
                metadata: snapshot.metadata || {},
                fileData: snapshot.fileData || {},
                ...snapshot,
            };

            // Calculate memory usage for this snapshot
            const snapshotSize = this._calculateSnapshotSize(completeSnapshot);

            // Check if adding this snapshot would exceed memory limits
            if (this.memoryUsage + snapshotSize > this.config.maxMemoryMB * 1024 * 1024) {
                // Try to cleanup old snapshots to make room
                const cleanedUp = await this.cleanup({
                    targetSize: snapshotSize,
                    strategy: 'oldest_first',
                });

                if (
                    cleanedUp === 0 ||
                    this.memoryUsage + snapshotSize > this.config.maxMemoryMB * 1024 * 1024
                ) {
                    throw new Error(
                        `Snapshot would exceed memory limit of ${this.config.maxMemoryMB}MB`
                    );
                }
            }

            // Check if we're at the snapshot count limit
            if (this.snapshots.size >= this.config.maxSnapshots) {
                // Try to cleanup old snapshots to make room
                const cleanedUp = await this.cleanup({
                    count: 1,
                    strategy: 'oldest_first',
                });

                if (cleanedUp === 0) {
                    throw new Error(
                        `Maximum number of snapshots (${this.config.maxSnapshots}) reached`
                    );
                }
            }

            // Store the snapshot
            this.snapshots.set(snapshotId, completeSnapshot);
            this.memoryUsage += snapshotSize;

            this.logger.debug('Snapshot stored successfully', {
                snapshotId,
                size: snapshotSize,
                totalSnapshots: this.snapshots.size,
                memoryUsage: this.memoryUsage,
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
     * @returns {Promise<Object|null>} Snapshot object or null if not found
     */
    async retrieve(snapshotId) {
        try {
            this.logger.debug('Retrieving snapshot', { snapshotId });

            if (!this.snapshots.has(snapshotId)) {
                this.logger.debug('Snapshot not found', { snapshotId });
                return null;
            }

            const snapshot = this.snapshots.get(snapshotId);
            this.logger.debug('Snapshot retrieved successfully', { snapshotId });

            // Return a deep copy to prevent external modifications
            return JSON.parse(JSON.stringify(snapshot));
        } catch (error) {
            this.logger.error(error, 'Failed to retrieve snapshot');
            throw error;
        }
    }

    /**
     * List all snapshots
     * @param {Object} options - Filtering and sorting options
     * @returns {Promise<Array>} List of snapshots
     */
    async list(options = {}) {
        try {
            this.logger.debug('Listing snapshots', { options });

            let snapshots = Array.from(this.snapshots.values());

            // Apply filtering if provided
            if (options.filter) {
                snapshots = snapshots.filter(snapshot => {
                    if (options.filter.description) {
                        return snapshot.description
                            .toLowerCase()
                            .includes(options.filter.description.toLowerCase());
                    }
                    if (options.filter.dateFrom) {
                        return new Date(snapshot.timestamp) >= new Date(options.filter.dateFrom);
                    }
                    if (options.filter.dateTo) {
                        return new Date(snapshot.timestamp) <= new Date(options.filter.dateTo);
                    }
                    return true;
                });
            }

            // Apply sorting (default: newest first)
            const sortBy = options.sortBy || 'timestamp';
            const sortOrder = options.sortOrder || 'desc';

            snapshots.sort((a, b) => {
                let aValue = a[sortBy];
                let bValue = b[sortBy];

                if (sortBy === 'timestamp') {
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                }

                if (sortOrder === 'desc') {
                    return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
                } else {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                }
            });

            // Apply limit if provided
            if (options.limit && options.limit > 0) {
                snapshots = snapshots.slice(0, options.limit);
            }

            // Return summary information (not full file data for performance)
            const summaries = snapshots.map(snapshot => ({
                id: snapshot.id,
                description: snapshot.description,
                timestamp: snapshot.timestamp,
                metadata: snapshot.metadata,
                fileCount: Object.keys(snapshot.fileData || {}).length,
                size: this._calculateSnapshotSize(snapshot),
            }));

            this.logger.debug('Snapshots listed successfully', {
                total: this.snapshots.size,
                filtered: summaries.length,
            });

            return summaries;
        } catch (error) {
            this.logger.error(error, 'Failed to list snapshots');
            throw error;
        }
    }

    /**
     * Delete a snapshot by ID
     * @param {string} snapshotId - Snapshot ID
     * @returns {Promise<boolean>} Deletion success
     */
    async delete(snapshotId) {
        try {
            this.logger.debug('Deleting snapshot', { snapshotId });

            if (!this.snapshots.has(snapshotId)) {
                this.logger.debug('Snapshot not found for deletion', { snapshotId });
                return false;
            }

            // Get snapshot to calculate size before deletion
            const snapshot = this.snapshots.get(snapshotId);
            const snapshotSize = this._calculateSnapshotSize(snapshot);

            // Remove from storage
            this.snapshots.delete(snapshotId);
            this.memoryUsage -= snapshotSize;

            // Ensure memory usage doesn't go negative
            if (this.memoryUsage < 0) {
                this.memoryUsage = 0;
            }

            this.logger.debug('Snapshot deleted successfully', {
                snapshotId,
                freedSize: snapshotSize,
                remainingSnapshots: this.snapshots.size,
                memoryUsage: this.memoryUsage,
            });

            return true;
        } catch (error) {
            this.logger.error(error, 'Failed to delete snapshot');
            throw error;
        }
    }

    /**
     * Check if a snapshot exists
     * @param {string} snapshotId - Snapshot ID
     * @returns {Promise<boolean>} Whether snapshot exists
     */
    async exists(snapshotId) {
        try {
            return this.snapshots.has(snapshotId);
        } catch (error) {
            this.logger.error(error, 'Failed to check snapshot existence');
            throw error;
        }
    }

    /**
     * Get storage statistics
     * @returns {Object} Storage statistics
     */
    getStorageStats() {
        return {
            snapshotCount: this.snapshots.size,
            memoryUsageMB: this.memoryUsage / (1024 * 1024),
            maxSnapshots: this.config.maxSnapshots,
            maxMemoryMB: this.config.maxMemoryMB,
            utilizationPercent: (this.snapshots.size / this.config.maxSnapshots) * 100,
        };
    }

    /**
     * Cleanup old snapshots based on criteria
     * @param {Object} criteria - Cleanup criteria
     * @returns {Promise<number>} Number of snapshots cleaned up
     */
    async cleanup(criteria = {}) {
        try {
            this.logger.debug('Cleaning up snapshots', { criteria });

            if (this.snapshots.size === 0) {
                return 0;
            }

            let snapshotsToDelete = [];
            const snapshots = Array.from(this.snapshots.values());

            // Sort by timestamp (oldest first) for cleanup
            snapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (criteria.strategy === 'oldest_first') {
                // Remove oldest snapshots first
                if (criteria.count) {
                    // Remove specific number of snapshots
                    snapshotsToDelete = snapshots.slice(0, criteria.count);
                } else if (criteria.targetSize) {
                    // Remove snapshots until we free up enough space
                    let freedSize = 0;
                    for (const snapshot of snapshots) {
                        snapshotsToDelete.push(snapshot);
                        freedSize += this._calculateSnapshotSize(snapshot);
                        if (freedSize >= criteria.targetSize) {
                            break;
                        }
                    }
                } else {
                    // Remove snapshots that exceed the limit
                    const excess = this.snapshots.size - this.config.maxSnapshots;
                    if (excess > 0) {
                        snapshotsToDelete = snapshots.slice(0, excess);
                    }
                }
            } else if (criteria.olderThan) {
                // Remove snapshots older than specified date
                const cutoffDate = new Date(criteria.olderThan);
                snapshotsToDelete = snapshots.filter(
                    snapshot => new Date(snapshot.timestamp) < cutoffDate
                );
            }

            // Perform the cleanup
            let cleanedCount = 0;
            for (const snapshot of snapshotsToDelete) {
                const success = await this.delete(snapshot.id);
                if (success) {
                    cleanedCount++;
                }
            }

            this.logger.debug('Cleanup completed', {
                cleanedCount,
                remainingSnapshots: this.snapshots.size,
                memoryUsage: this.memoryUsage,
            });

            return cleanedCount;
        } catch (error) {
            this.logger.error(error, 'Failed to cleanup snapshots');
            throw error;
        }
    }

    /**
     * Calculate the memory size of a snapshot
     * @param {Object} snapshot - Snapshot object
     * @returns {number} Size in bytes
     */
    _calculateSnapshotSize(snapshot) {
        try {
            // Convert to JSON string to get approximate size
            const jsonString = JSON.stringify(snapshot);
            return Buffer.byteLength(jsonString, 'utf8');
        } catch (error) {
            this.logger.error(error, 'Failed to calculate snapshot size');
            return 0;
        }
    }
}

export default MemorySnapshotStore;
