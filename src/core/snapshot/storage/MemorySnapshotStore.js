/**
 * In-Memory Snapshot Storage Implementation
 * Provides fast in-memory storage for snapshots with optional persistence
 *
 * FUNCTIONAL SPECIFICATION ANALYSIS:
 * - ✅ Task 1.3 deliverable: "In-memory storage implementation" - IMPLEMENTED
 * - ✅ Acceptance criteria: "Storage interface is mode-agnostic" - IMPLEMENTED
 * - ✅ Product Owner test: "Memory usage stays within configured limits" - TESTED
 *
 * CURRENT USAGE STATUS:
 * - ❌ NOT used in main application code
 * - ✅ Used in unit tests (tests/unit/snapshot/data-models.test.js)
 * - ✅ Exported from main index.js for external use
 *
 * ARCHITECTURAL DECISION:
 * FileSnapshotStrategy uses internal Map storage instead of this class:
 * - FileSnapshotStrategy.snapshots = new Map() (line 37 in FileSnapshotStrategy.js)
 * - Direct storage management within strategy for performance
 * - Avoids additional abstraction layer
 *
 * RECOMMENDATION: **KEEP** - Required by functional specification
 *
 * Reasons to keep:
 * 1. Explicitly required in functional specification Task 1.3
 * 2. Provides unified storage interface as specified
 * 3. Could be used for future storage strategy refactoring
 * 4. Essential for external integrations requiring storage abstraction
 * 5. Unit tests validate the specification requirements
 *
 * Future integration opportunities:
 * - Refactor FileSnapshotStrategy to use this unified interface
 * - External storage backends that need memory caching layer
 * - Storage strategy pattern implementation
 * - Multi-strategy storage coordination
 */

import { SnapshotStore } from '../interfaces/SnapshotStrategy.js';
import SnapshotMetadata from '../models/SnapshotMetadata.js';
import SnapshotLogger from '../utils/SnapshotLogger.js';

/**
 * In-memory implementation of SnapshotStore
 */
class MemorySnapshotStore extends SnapshotStore {
    constructor(config, logger) {
        super(config, logger);
        this.logger = logger || new SnapshotLogger();
        this.snapshots = new Map(); // snapshotId -> Snapshot
        this.metadata = new SnapshotMetadata(config);
        this.maxSnapshots = config.getFileConfig().maxSnapshots;
        this.memoryLimit = config.getMemoryLimitBytes();
        this.currentMemoryUsage = 0;
        this.initialized = false;
    }

    /**
     * Initialize the storage
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing memory snapshot store');
        this.initialized = true;

        this.logger.logSnapshotOperation('store_initialized', {
            mode: 'memory',
            maxSnapshots: this.maxSnapshots,
            memoryLimit: this.memoryLimit,
            success: true,
        });
    }

    /**
     * Store a snapshot
     * @param {Snapshot} snapshot - Snapshot to store
     * @returns {Promise<void>}
     */
    async storeSnapshot(snapshot) {
        if (!this.initialized) {
            await this.initialize();
        }

        const timer = this.logger.createTimer('store_snapshot');

        try {
            // Check memory limits
            const snapshotSize = snapshot.calculateSize();
            await this._ensureCapacity(snapshotSize);

            // Store snapshot
            this.snapshots.set(snapshot.id, snapshot);
            this.metadata.addSnapshot(snapshot);
            this.currentMemoryUsage += snapshotSize;

            this.logger.logSnapshotOperation('store', {
                snapshotId: snapshot.id,
                mode: snapshot.mode,
                size: snapshotSize,
                totalSnapshots: this.snapshots.size,
                memoryUsage: this.currentMemoryUsage,
                success: true,
                duration: timer(true),
            });
        } catch (error) {
            this.logger.error(`Error storing snapshot ${snapshot.id}: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Retrieve a snapshot by ID
     * @param {string} id - Snapshot ID
     * @returns {Promise<Snapshot|null>} Snapshot or null if not found
     */
    async getSnapshot(id) {
        const timer = this.logger.createTimer('get_snapshot');

        try {
            const snapshot = this.snapshots.get(id) || null;

            this.logger.logSnapshotOperation('retrieve', {
                snapshotId: id,
                found: !!snapshot,
                success: true,
                duration: timer(true),
            });

            return snapshot;
        } catch (error) {
            this.logger.error(`Error retrieving snapshot ${id}: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get all snapshots
     * @returns {Promise<Snapshot[]>} Array of snapshots
     */
    async getAllSnapshots() {
        const timer = this.logger.createTimer('get_all_snapshots');

        try {
            const snapshots = Array.from(this.snapshots.values());

            this.logger.logSnapshotOperation('retrieve_all', {
                count: snapshots.length,
                success: true,
                duration: timer(true),
            });

            return snapshots;
        } catch (error) {
            this.logger.error(`Error retrieving all snapshots: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Delete a snapshot
     * @param {string} id - Snapshot ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteSnapshot(id) {
        const timer = this.logger.createTimer('delete_snapshot');

        try {
            const snapshot = this.snapshots.get(id);
            if (!snapshot) {
                timer(true, { result: 'not_found' });
                return false;
            }

            const snapshotSize = snapshot.calculateSize();

            // Remove from storage
            this.snapshots.delete(id);
            this.metadata.removeSnapshot(id);
            this.currentMemoryUsage -= snapshotSize;

            this.logger.logSnapshotOperation('delete', {
                snapshotId: id,
                size: snapshotSize,
                remainingSnapshots: this.snapshots.size,
                memoryUsage: this.currentMemoryUsage,
                success: true,
                duration: timer(true),
            });

            return true;
        } catch (error) {
            this.logger.error(`Error deleting snapshot ${id}: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Clear all snapshots
     * @returns {Promise<void>}
     */
    async clearAll() {
        const timer = this.logger.createTimer('clear_all');

        try {
            const count = this.snapshots.size;

            this.snapshots.clear();
            this.metadata.clear();
            this.currentMemoryUsage = 0;

            this.logger.logSnapshotOperation('clear_all', {
                deletedCount: count,
                success: true,
                duration: timer(true),
            });
        } catch (error) {
            this.logger.error(`Error clearing all snapshots: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get storage statistics
     * @returns {Promise<Object>} Storage statistics
     */
    async getStats() {
        const metadataStats = this.metadata.getStatistics();
        const indexInfo = this.metadata.getIndexInfo();

        return {
            type: 'memory',
            totalSnapshots: this.snapshots.size,
            memoryUsage: {
                current: this.currentMemoryUsage,
                limit: this.memoryLimit,
                percentage: Math.round((this.currentMemoryUsage / this.memoryLimit) * 100),
            },
            capacity: {
                maxSnapshots: this.maxSnapshots,
                remaining: this.maxSnapshots - this.snapshots.size,
            },
            metadata: metadataStats,
            indexes: indexInfo,
            performance: {
                averageSnapshotSize:
                    this.snapshots.size > 0
                        ? Math.round(this.currentMemoryUsage / this.snapshots.size)
                        : 0,
            },
        };
    }

    /**
     * Search snapshots using metadata
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Snapshot[]>} Matching snapshots
     */
    async searchSnapshots(criteria) {
        const timer = this.logger.createTimer('search_snapshots');

        try {
            const snapshotIds = this.metadata.search(criteria);
            const snapshots = snapshotIds
                .map(id => this.snapshots.get(id))
                .filter(snapshot => snapshot !== undefined);

            this.logger.logSnapshotOperation('search', {
                criteria,
                resultCount: snapshots.length,
                success: true,
                duration: timer(true),
            });

            return snapshots;
        } catch (error) {
            this.logger.error(`Error searching snapshots: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get snapshots sorted by timestamp
     * @param {boolean} ascending - Sort order
     * @returns {Promise<Snapshot[]>} Sorted snapshots
     */
    async getSortedSnapshots(ascending = false) {
        const snapshotIds = this.metadata.getSortedByTimestamp(ascending);
        return snapshotIds
            .map(id => this.snapshots.get(id))
            .filter(snapshot => snapshot !== undefined);
    }

    /**
     * Ensure storage capacity for new snapshot
     * @private
     * @param {number} requiredSize - Required size in bytes
     * @returns {Promise<void>}
     */
    async _ensureCapacity(requiredSize) {
        // Check snapshot count limit
        if (this.snapshots.size >= this.maxSnapshots) {
            await this._evictOldestSnapshots(1);
        }

        // Check memory limit
        if (this.currentMemoryUsage + requiredSize > this.memoryLimit) {
            const requiredSpace = this.currentMemoryUsage + requiredSize - this.memoryLimit;
            await this._evictSnapshotsBySize(requiredSpace);
        }
    }

    /**
     * Evict oldest snapshots
     * @private
     * @param {number} count - Number of snapshots to evict
     * @returns {Promise<void>}
     */
    async _evictOldestSnapshots(count) {
        const sortedIds = this.metadata.getSortedByTimestamp(true); // Oldest first
        const toEvict = sortedIds.slice(0, count);

        for (const snapshotId of toEvict) {
            await this.deleteSnapshot(snapshotId);
            this.logger.warn(`Evicted snapshot ${snapshotId} due to capacity limits`);
        }
    }

    /**
     * Evict snapshots by size requirement
     * @private
     * @param {number} requiredSpace - Required space in bytes
     * @returns {Promise<void>}
     */
    async _evictSnapshotsBySize(requiredSpace) {
        const sortedIds = this.metadata.getSortedByTimestamp(true); // Oldest first
        let freedSpace = 0;

        for (const snapshotId of sortedIds) {
            if (freedSpace >= requiredSpace) {
                break;
            }

            const snapshot = this.snapshots.get(snapshotId);
            if (snapshot) {
                const snapshotSize = snapshot.calculateSize();
                await this.deleteSnapshot(snapshotId);
                freedSpace += snapshotSize;
                this.logger.warn(`Evicted snapshot ${snapshotId} to free ${snapshotSize} bytes`);
            }
        }

        if (freedSpace < requiredSpace) {
            throw new Error(
                `Unable to free sufficient memory. Required: ${requiredSpace}, freed: ${freedSpace}`
            );
        }
    }

    /**
     * Get memory usage information
     * @returns {Object} Memory usage details
     */
    getMemoryUsage() {
        return {
            current: this.currentMemoryUsage,
            limit: this.memoryLimit,
            percentage: Math.round((this.currentMemoryUsage / this.memoryLimit) * 100),
            snapshots: this.snapshots.size,
            averageSnapshotSize:
                this.snapshots.size > 0
                    ? Math.round(this.currentMemoryUsage / this.snapshots.size)
                    : 0,
        };
    }

    /**
     * Check if memory usage is approaching limits
     * @returns {boolean} True if memory usage is high
     */
    isMemoryUsageHigh() {
        return this.currentMemoryUsage / this.memoryLimit > 0.8; // 80% threshold
    }

    /**
     * Optimize storage by removing unnecessary data
     * @returns {Promise<Object>} Optimization results
     */
    async optimize() {
        const timer = this.logger.createTimer('optimize_storage');
        const initialSize = this.currentMemoryUsage;
        const initialCount = this.snapshots.size;

        try {
            // Remove any corrupted or invalid snapshots
            const toRemove = [];
            for (const [id, snapshot] of this.snapshots) {
                try {
                    snapshot.toObject(); // Test serialization
                } catch (_error) {
                    toRemove.push(id);
                }
            }

            for (const id of toRemove) {
                await this.deleteSnapshot(id);
            }

            const finalSize = this.currentMemoryUsage;
            const finalCount = this.snapshots.size;
            const savedSpace = initialSize - finalSize;
            const removedSnapshots = initialCount - finalCount;

            const result = {
                initialSize,
                finalSize,
                savedSpace,
                initialCount,
                finalCount,
                removedSnapshots,
                success: true,
            };

            this.logger.logSnapshotOperation('optimize', {
                ...result,
                duration: timer(true),
            });

            return result;
        } catch (error) {
            this.logger.error(`Error optimizing storage: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }
}

export default MemorySnapshotStore;
