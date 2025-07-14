/**
 * Snapshot Metadata Management
 * Handles metadata operations and indexing for snapshots
 */

import SnapshotLogger from '../utils/SnapshotLogger.js';

/**
 * Manages snapshot metadata and provides indexing capabilities
 */
class SnapshotMetadata {
    constructor(config) {
        this.config = config;
        this.logger = new SnapshotLogger();
        this.metadata = new Map(); // snapshotId -> metadata
        this.indexes = {
            byTimestamp: new Map(), // timestamp -> Set<snapshotId>
            byInstruction: new Map(), // keyword -> Set<snapshotId>
            byMode: new Map(), // mode -> Set<snapshotId>
            byTag: new Map(), // tag -> Set<snapshotId>
            byAuthor: new Map(), // author -> Set<snapshotId>
            bySession: new Map(), // sessionId -> Set<snapshotId>
        };
        this.statistics = {
            totalSnapshots: 0,
            totalSize: 0,
            modeDistribution: { git: 0, file: 0 },
            averageFileCount: 0,
            oldestSnapshot: null,
            newestSnapshot: null,
        };
    }

    /**
     * Add snapshot metadata
     * @param {Snapshot} snapshot - Snapshot to add metadata for
     */
    addSnapshot(snapshot) {
        const snapshotId = snapshot.id;
        const metadata = this._extractMetadata(snapshot);

        // Store metadata
        this.metadata.set(snapshotId, metadata);

        // Update indexes
        this._updateIndexes(snapshotId, metadata);

        // Update statistics
        this._updateStatistics(metadata, 'add');

        this.logger.debug(`Added metadata for snapshot ${snapshotId}`, metadata);
    }

    /**
     * Remove snapshot metadata
     * @param {string} snapshotId - Snapshot ID to remove
     */
    removeSnapshot(snapshotId) {
        const metadata = this.metadata.get(snapshotId);
        if (!metadata) {
            return false;
        }

        // Remove from indexes
        this._removeFromIndexes(snapshotId, metadata);

        // Update statistics
        this._updateStatistics(metadata, 'remove');

        // Remove metadata
        this.metadata.delete(snapshotId);

        this.logger.debug(`Removed metadata for snapshot ${snapshotId}`);
        return true;
    }

    /**
     * Get snapshot metadata
     * @param {string} snapshotId - Snapshot ID
     * @returns {Object|null} Metadata or null if not found
     */
    getMetadata(snapshotId) {
        return this.metadata.get(snapshotId) || null;
    }

    /**
     * Search snapshots by criteria
     * @param {Object} criteria - Search criteria
     * @returns {string[]} Array of matching snapshot IDs
     */
    search(criteria) {
        let results = new Set();
        let firstSearch = true;

        // Search by timestamp range
        if (criteria.timeRange) {
            const timeResults = this._searchByTimeRange(criteria.timeRange);
            results = firstSearch ? timeResults : this._intersectSets(results, timeResults);
            firstSearch = false;
        }

        // Search by instruction keywords
        if (criteria.instruction) {
            const instructionResults = this._searchByInstruction(criteria.instruction);
            results = firstSearch
                ? instructionResults
                : this._intersectSets(results, instructionResults);
            firstSearch = false;
        }

        // Search by mode
        if (criteria.mode) {
            const modeResults = this.indexes.byMode.get(criteria.mode) || new Set();
            results = firstSearch ? modeResults : this._intersectSets(results, modeResults);
            firstSearch = false;
        }

        // Search by tags
        if (criteria.tags && criteria.tags.length > 0) {
            const tagResults = this._searchByTags(criteria.tags);
            results = firstSearch ? tagResults : this._intersectSets(results, tagResults);
            firstSearch = false;
        }

        // Search by author
        if (criteria.author) {
            const authorResults = this.indexes.byAuthor.get(criteria.author) || new Set();
            results = firstSearch ? authorResults : this._intersectSets(results, authorResults);
            firstSearch = false;
        }

        // Search by session
        if (criteria.sessionId) {
            const sessionResults = this.indexes.bySession.get(criteria.sessionId) || new Set();
            results = firstSearch ? sessionResults : this._intersectSets(results, sessionResults);
            firstSearch = false;
        }

        return Array.from(results);
    }

    /**
     * Get snapshots sorted by timestamp
     * @param {boolean} ascending - Sort order (default: false for newest first)
     * @returns {string[]} Sorted snapshot IDs
     */
    getSortedByTimestamp(ascending = false) {
        const timestamps = Array.from(this.indexes.byTimestamp.keys()).sort((a, b) => {
            return ascending ? a - b : b - a;
        });

        const results = [];
        for (const timestamp of timestamps) {
            const snapshotIds = this.indexes.byTimestamp.get(timestamp);
            results.push(...Array.from(snapshotIds));
        }

        return results;
    }

    /**
     * Get statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return { ...this.statistics };
    }

    /**
     * Get index information
     * @returns {Object} Index information
     */
    getIndexInfo() {
        return {
            totalMetadata: this.metadata.size,
            indexes: {
                byTimestamp: this.indexes.byTimestamp.size,
                byInstruction: this.indexes.byInstruction.size,
                byMode: this.indexes.byMode.size,
                byTag: this.indexes.byTag.size,
                byAuthor: this.indexes.byAuthor.size,
                bySession: this.indexes.bySession.size,
            },
        };
    }

    /**
     * Clear all metadata and indexes
     */
    clear() {
        this.metadata.clear();
        for (const index of Object.values(this.indexes)) {
            index.clear();
        }
        this.statistics = {
            totalSnapshots: 0,
            totalSize: 0,
            modeDistribution: { git: 0, file: 0 },
            averageFileCount: 0,
            oldestSnapshot: null,
            newestSnapshot: null,
        };
        this.logger.debug('Cleared all snapshot metadata');
    }

    /**
     * Extract metadata from snapshot
     * @private
     * @param {Snapshot} snapshot - Snapshot object
     * @returns {Object} Extracted metadata
     */
    _extractMetadata(snapshot) {
        return {
            id: snapshot.id,
            instruction: snapshot.instruction,
            timestamp:
                snapshot.timestamp instanceof Date
                    ? snapshot.timestamp.getTime()
                    : new Date(snapshot.timestamp).getTime(),
            mode: snapshot.mode,
            fileCount: snapshot.files.size,
            size: snapshot.calculateSize(),
            tags: [...snapshot.tags],
            author: snapshot.author,
            sessionId: snapshot.sessionId,
            gitHash: snapshot.gitHash,
            branchName: snapshot.branchName,
            keywords: this._extractKeywords(snapshot.instruction),
        };
    }

    /**
     * Extract keywords from instruction
     * @private
     * @param {string} instruction - Instruction text
     * @returns {string[]} Array of keywords
     */
    _extractKeywords(instruction) {
        return instruction
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 10); // Limit to first 10 keywords
    }

    /**
     * Update indexes with new metadata
     * @private
     * @param {string} snapshotId - Snapshot ID
     * @param {Object} metadata - Metadata object
     */
    _updateIndexes(snapshotId, metadata) {
        // Index by timestamp
        const timestampKey = Math.floor(metadata.timestamp / 1000) * 1000; // Round to seconds
        if (!this.indexes.byTimestamp.has(timestampKey)) {
            this.indexes.byTimestamp.set(timestampKey, new Set());
        }
        this.indexes.byTimestamp.get(timestampKey).add(snapshotId);

        // Index by instruction keywords
        for (const keyword of metadata.keywords) {
            if (!this.indexes.byInstruction.has(keyword)) {
                this.indexes.byInstruction.set(keyword, new Set());
            }
            this.indexes.byInstruction.get(keyword).add(snapshotId);
        }

        // Index by mode
        if (!this.indexes.byMode.has(metadata.mode)) {
            this.indexes.byMode.set(metadata.mode, new Set());
        }
        this.indexes.byMode.get(metadata.mode).add(snapshotId);

        // Index by tags
        for (const tag of metadata.tags) {
            if (!this.indexes.byTag.has(tag)) {
                this.indexes.byTag.set(tag, new Set());
            }
            this.indexes.byTag.get(tag).add(snapshotId);
        }

        // Index by author
        if (metadata.author) {
            if (!this.indexes.byAuthor.has(metadata.author)) {
                this.indexes.byAuthor.set(metadata.author, new Set());
            }
            this.indexes.byAuthor.get(metadata.author).add(snapshotId);
        }

        // Index by session
        if (metadata.sessionId) {
            if (!this.indexes.bySession.has(metadata.sessionId)) {
                this.indexes.bySession.set(metadata.sessionId, new Set());
            }
            this.indexes.bySession.get(metadata.sessionId).add(snapshotId);
        }
    }

    /**
     * Remove snapshot from indexes
     * @private
     * @param {string} snapshotId - Snapshot ID
     * @param {Object} metadata - Metadata object
     */
    _removeFromIndexes(snapshotId, metadata) {
        // Remove from timestamp index
        const timestampKey = Math.floor(metadata.timestamp / 1000) * 1000;
        const timestampSet = this.indexes.byTimestamp.get(timestampKey);
        if (timestampSet) {
            timestampSet.delete(snapshotId);
            if (timestampSet.size === 0) {
                this.indexes.byTimestamp.delete(timestampKey);
            }
        }

        // Remove from instruction keywords
        for (const keyword of metadata.keywords) {
            const keywordSet = this.indexes.byInstruction.get(keyword);
            if (keywordSet) {
                keywordSet.delete(snapshotId);
                if (keywordSet.size === 0) {
                    this.indexes.byInstruction.delete(keyword);
                }
            }
        }

        // Remove from other indexes
        this._removeFromIndex(this.indexes.byMode, metadata.mode, snapshotId);

        for (const tag of metadata.tags) {
            this._removeFromIndex(this.indexes.byTag, tag, snapshotId);
        }

        if (metadata.author) {
            this._removeFromIndex(this.indexes.byAuthor, metadata.author, snapshotId);
        }

        if (metadata.sessionId) {
            this._removeFromIndex(this.indexes.bySession, metadata.sessionId, snapshotId);
        }
    }

    /**
     * Remove from specific index
     * @private
     * @param {Map} index - Index map
     * @param {string} key - Index key
     * @param {string} snapshotId - Snapshot ID
     */
    _removeFromIndex(index, key, snapshotId) {
        const set = index.get(key);
        if (set) {
            set.delete(snapshotId);
            if (set.size === 0) {
                index.delete(key);
            }
        }
    }

    /**
     * Update statistics
     * @private
     * @param {Object} metadata - Metadata object
     * @param {string} operation - 'add' or 'remove'
     */
    _updateStatistics(metadata, operation) {
        if (operation === 'add') {
            this.statistics.totalSnapshots++;
            this.statistics.totalSize += metadata.size;
            this.statistics.modeDistribution[metadata.mode]++;

            if (
                !this.statistics.oldestSnapshot ||
                metadata.timestamp < this.statistics.oldestSnapshot
            ) {
                this.statistics.oldestSnapshot = metadata.timestamp;
            }
            if (
                !this.statistics.newestSnapshot ||
                metadata.timestamp > this.statistics.newestSnapshot
            ) {
                this.statistics.newestSnapshot = metadata.timestamp;
            }
        } else if (operation === 'remove') {
            this.statistics.totalSnapshots--;
            this.statistics.totalSize -= metadata.size;
            this.statistics.modeDistribution[metadata.mode]--;
        }

        // Recalculate average file count
        if (this.statistics.totalSnapshots > 0) {
            const totalFileCount = Array.from(this.metadata.values()).reduce(
                (sum, meta) => sum + meta.fileCount,
                0
            );
            this.statistics.averageFileCount = totalFileCount / this.statistics.totalSnapshots;
        } else {
            this.statistics.averageFileCount = 0;
        }
    }

    /**
     * Search by time range
     * @private
     * @param {Object} timeRange - Time range object
     * @returns {Set} Set of snapshot IDs
     */
    _searchByTimeRange(timeRange) {
        const results = new Set();
        const startTime = timeRange.start ? new Date(timeRange.start).getTime() : 0;
        const endTime = timeRange.end ? new Date(timeRange.end).getTime() : Date.now();

        for (const [timestamp, snapshotIds] of this.indexes.byTimestamp) {
            if (timestamp >= startTime && timestamp <= endTime) {
                for (const id of snapshotIds) {
                    results.add(id);
                }
            }
        }

        return results;
    }

    /**
     * Search by instruction keywords
     * @private
     * @param {string} instruction - Instruction to search for
     * @returns {Set} Set of snapshot IDs
     */
    _searchByInstruction(instruction) {
        const keywords = this._extractKeywords(instruction);
        const results = new Set();

        for (const keyword of keywords) {
            const keywordResults = this.indexes.byInstruction.get(keyword);
            if (keywordResults) {
                for (const id of keywordResults) {
                    results.add(id);
                }
            }
        }

        return results;
    }

    /**
     * Search by tags
     * @private
     * @param {string[]} tags - Tags to search for
     * @returns {Set} Set of snapshot IDs
     */
    _searchByTags(tags) {
        const results = new Set();

        for (const tag of tags) {
            const tagResults = this.indexes.byTag.get(tag);
            if (tagResults) {
                for (const id of tagResults) {
                    results.add(id);
                }
            }
        }

        return results;
    }

    /**
     * Intersect two sets
     * @private
     * @param {Set} set1 - First set
     * @param {Set} set2 - Second set
     * @returns {Set} Intersection of sets
     */
    _intersectSets(set1, set2) {
        const result = new Set();
        for (const item of set1) {
            if (set2.has(item)) {
                result.add(item);
            }
        }
        return result;
    }
}

export default SnapshotMetadata;
