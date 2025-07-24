/**
 * File Version Tracker
 *
 * Tracks file versions across snapshots to enable differential storage.
 * Maintains checksums and references to avoid duplicating unchanged files.
 */

export class FileVersionTracker {
    constructor() {
        this.fileVersions = new Map(); // filePath -> { checksum, snapshotId, version }
        this.checksumIndex = new Map(); // checksum -> { snapshotId, filePath }
    }

    /**
     * Track a file version in a snapshot
     * @param {string} filePath - Path to the file
     * @param {string} checksum - File checksum
     * @param {string} snapshotId - Snapshot ID where this version is stored
     * @param {number} size - File size
     */
    trackFileVersion(filePath, checksum, snapshotId, size = 0) {
        // Update file version tracking
        this.fileVersions.set(filePath, {
            checksum,
            snapshotId,
            version: Date.now(),
            size,
        });

        // Update checksum index
        this.checksumIndex.set(checksum, {
            snapshotId,
            filePath,
            size,
        });
    }

    /**
     * Find which snapshot contains a specific file checksum
     * @param {string} checksum - File checksum to find
     * @returns {Object|null} Snapshot info or null if not found
     */
    findSnapshotForChecksum(checksum) {
        return this.checksumIndex.get(checksum) || null;
    }

    /**
     * Get the latest version info for a file
     * @param {string} filePath - Path to the file
     * @returns {Object|null} Version info or null if not tracked
     */
    getFileVersion(filePath) {
        return this.fileVersions.get(filePath) || null;
    }

    /**
     * Check if a file has changed since last tracking
     * @param {string} filePath - Path to the file
     * @param {string} currentChecksum - Current file checksum
     * @returns {boolean} True if file has changed
     */
    hasFileChanged(filePath, currentChecksum) {
        const version = this.fileVersions.get(filePath);
        if (!version) {
            return true; // New file
        }
        return version.checksum !== currentChecksum;
    }

    /**
     * Remove tracking for files that no longer exist
     * @param {string[]} currentFilePaths - List of currently existing file paths
     */
    cleanupDeletedFiles(currentFilePaths) {
        const currentPathSet = new Set(currentFilePaths);

        for (const [filePath, version] of this.fileVersions.entries()) {
            if (!currentPathSet.has(filePath)) {
                this.fileVersions.delete(filePath);
                // Note: We don't remove from checksumIndex as other files might have same checksum
            }
        }
    }

    /**
     * Get statistics about tracked files
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            trackedFiles: this.fileVersions.size,
            uniqueChecksums: this.checksumIndex.size,
            averageFileSize: this._calculateAverageFileSize(),
        };
    }

    /**
     * Calculate average file size
     * @private
     */
    _calculateAverageFileSize() {
        if (this.fileVersions.size === 0) {
            return 0;
        }

        const totalSize = Array.from(this.fileVersions.values()).reduce(
            (sum, version) => sum + (version.size || 0),
            0
        );

        return Math.round(totalSize / this.fileVersions.size);
    }

    /**
     * Clear all tracking data
     */
    clear() {
        this.fileVersions.clear();
        this.checksumIndex.clear();
    }
}
