/**
 * Snapshot Data Model
 * Represents a snapshot with all its metadata and content
 */

import IdGenerator from '../utils/IdGenerator.js';

/**
 * Snapshot data model
 */
class Snapshot {
    constructor(data = {}) {
        // Required fields
        this.id = data.id || IdGenerator.generateSnapshotId(data.instruction);
        this.instruction = data.instruction || '';
        this.timestamp = data.timestamp || new Date();
        this.mode = data.mode || 'file'; // 'git' or 'file'

        // Optional content hash for change detection
        this.contentHash = data.contentHash || null;

        // Git mode properties
        this.gitHash = data.gitHash || null;
        this.branchName = data.branchName || null;
        this.author = data.author || null;

        // File mode properties
        this.files = data.files || new Map(); // Map<string, string | null>
        this.modifiedFiles = data.modifiedFiles || new Set();
        this.fileChecksums = data.fileChecksums || new Map(); // Map<string, string>

        // Metadata
        this.sessionId = data.sessionId || null;
        this.parentSnapshotId = data.parentSnapshotId || null;
        this.tags = data.tags || [];
        this.metadata = data.metadata || {};

        // Validation
        this._validateSnapshot();
    }

    /**
     * Validate snapshot data
     * @private
     */
    _validateSnapshot() {
        if (!this.id) {
            throw new Error('Snapshot ID is required');
        }
        if (!this.instruction) {
            throw new Error('Snapshot instruction is required');
        }
        if (!this.timestamp) {
            throw new Error('Snapshot timestamp is required');
        }
        if (!['git', 'file'].includes(this.mode)) {
            throw new Error(`Invalid snapshot mode: ${this.mode}`);
        }
    }

    /**
     * Get snapshot as plain object for serialization
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            instruction: this.instruction,
            timestamp:
                this.timestamp instanceof Date ? this.timestamp.toISOString() : this.timestamp,
            mode: this.mode,
            contentHash: this.contentHash,
            gitHash: this.gitHash,
            branchName: this.branchName,
            author: this.author,
            files: this.files instanceof Map ? Object.fromEntries(this.files) : this.files,
            modifiedFiles:
                this.modifiedFiles instanceof Set
                    ? Array.from(this.modifiedFiles)
                    : this.modifiedFiles,
            fileChecksums:
                this.fileChecksums instanceof Map
                    ? Object.fromEntries(this.fileChecksums)
                    : this.fileChecksums,
            sessionId: this.sessionId,
            parentSnapshotId: this.parentSnapshotId,
            tags: this.tags,
            metadata: this.metadata,
        };
    }

    /**
     * Create snapshot from plain object
     * @param {Object} obj - Plain object representation
     * @returns {Snapshot} Snapshot instance
     */
    static fromObject(obj) {
        const data = {
            ...obj,
            timestamp: typeof obj.timestamp === 'string' ? new Date(obj.timestamp) : obj.timestamp,
            files: obj.files ? new Map(Object.entries(obj.files)) : new Map(),
            modifiedFiles: obj.modifiedFiles ? new Set(obj.modifiedFiles) : new Set(),
            fileChecksums: obj.fileChecksums
                ? new Map(Object.entries(obj.fileChecksums))
                : new Map(),
        };
        return new Snapshot(data);
    }

    /**
     * Get snapshot summary for display
     * @returns {Object} Summary information
     */
    getSummary() {
        return {
            id: this.id,
            shortId: IdGenerator.generateShortId(this.id),
            instruction:
                this.instruction.length > 50
                    ? `${this.instruction.substring(0, 47)}...`
                    : this.instruction,
            timestamp: this.timestamp,
            mode: this.mode,
            fileCount: this.files.size,
            modifiedFileCount: this.modifiedFiles.size,
            hasGitInfo: !!(this.gitHash || this.branchName),
            tags: this.tags,
        };
    }

    /**
     * Add a file to the snapshot
     * @param {string} filePath - File path
     * @param {string|null} content - File content (null for deleted files)
     * @param {string} checksum - File checksum (optional)
     */
    addFile(filePath, content, checksum = null) {
        this.files.set(filePath, content);
        this.modifiedFiles.add(filePath);

        if (checksum && content !== null) {
            this.fileChecksums.set(filePath, checksum);
        }
    }

    /**
     * Remove a file from the snapshot
     * @param {string} filePath - File path
     */
    removeFile(filePath) {
        this.files.delete(filePath);
        this.modifiedFiles.delete(filePath);
        this.fileChecksums.delete(filePath);
    }

    /**
     * Check if snapshot contains a specific file
     * @param {string} filePath - File path
     * @returns {boolean} True if file exists in snapshot
     */
    hasFile(filePath) {
        return this.files.has(filePath);
    }

    /**
     * Get file content from snapshot
     * @param {string} filePath - File path
     * @returns {string|null} File content or null if not found/deleted
     */
    getFileContent(filePath) {
        return this.files.get(filePath) || null;
    }

    /**
     * Get all file paths in the snapshot
     * @returns {string[]} Array of file paths
     */
    getFilePaths() {
        return Array.from(this.files.keys());
    }

    /**
     * Get modified file paths
     * @returns {string[]} Array of modified file paths
     */
    getModifiedFilePaths() {
        return Array.from(this.modifiedFiles);
    }

    /**
     * Add a tag to the snapshot
     * @param {string} tag - Tag to add
     */
    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
        }
    }

    /**
     * Remove a tag from the snapshot
     * @param {string} tag - Tag to remove
     */
    removeTag(tag) {
        const index = this.tags.indexOf(tag);
        if (index > -1) {
            this.tags.splice(index, 1);
        }
    }

    /**
     * Check if snapshot has a specific tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if tag exists
     */
    hasTag(tag) {
        return this.tags.includes(tag);
    }

    /**
     * Set metadata value
     * @param {string} key - Metadata key
     * @param {any} value - Metadata value
     */
    setMetadata(key, value) {
        this.metadata[key] = value;
    }

    /**
     * Get metadata value
     * @param {string} key - Metadata key
     * @returns {any} Metadata value
     */
    getMetadata(key) {
        return this.metadata[key];
    }

    /**
     * Calculate snapshot size in bytes
     * @returns {number} Size in bytes
     */
    calculateSize() {
        let size = 0;

        // Calculate file content size
        for (const content of this.files.values()) {
            if (content !== null) {
                size += Buffer.byteLength(content, 'utf8');
            }
        }

        // Add metadata size estimate
        size += Buffer.byteLength(JSON.stringify(this.toObject()), 'utf8');

        return size;
    }

    /**
     * Clone the snapshot
     * @returns {Snapshot} Cloned snapshot
     */
    clone() {
        return Snapshot.fromObject(this.toObject());
    }

    /**
     * Compare with another snapshot
     * @param {Snapshot} other - Other snapshot to compare
     * @returns {Object} Comparison result
     */
    compare(other) {
        const differences = {
            instruction: this.instruction !== other.instruction,
            mode: this.mode !== other.mode,
            fileCount: this.files.size !== other.files.size,
            files: {
                added: [],
                removed: [],
                modified: [],
            },
        };

        // Compare files
        const thisFiles = new Set(this.files.keys());
        const otherFiles = new Set(other.files.keys());

        // Find added files
        for (const filePath of otherFiles) {
            if (!thisFiles.has(filePath)) {
                differences.files.added.push(filePath);
            }
        }

        // Find removed files
        for (const filePath of thisFiles) {
            if (!otherFiles.has(filePath)) {
                differences.files.removed.push(filePath);
            }
        }

        // Find modified files
        for (const filePath of thisFiles) {
            if (otherFiles.has(filePath)) {
                const thisContent = this.files.get(filePath);
                const otherContent = other.files.get(filePath);
                if (thisContent !== otherContent) {
                    differences.files.modified.push(filePath);
                }
            }
        }

        return differences;
    }

    /**
     * Get human-readable description
     * @returns {string} Description
     */
    toString() {
        const timestamp =
            this.timestamp instanceof Date ? this.timestamp.toLocaleString() : this.timestamp;

        return `Snapshot ${IdGenerator.generateShortId(this.id)} (${this.mode}): "${this.instruction}" - ${timestamp}`;
    }
}

export default Snapshot;
