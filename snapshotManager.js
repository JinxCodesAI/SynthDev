import { readFileSync, existsSync } from 'fs';
import { getLogger } from './logger.js';

/**
 * Manages in-memory snapshots for file backup and restoration
 */
class SnapshotManager {
    constructor() {
        this.snapshots = []; // Array of snapshot objects
        this.currentSnapshot = null; // Current active snapshot
        this.logger = getLogger();
    }

    /**
     * Creates a new snapshot with user instruction
     * @param {string} userInstruction - The user's instruction that triggered this snapshot
     */
    createSnapshot(userInstruction) {
        // If current snapshot is empty (no files backed up), override it
        if (this.currentSnapshot && Object.keys(this.currentSnapshot.files).length === 0) {
            this.currentSnapshot.instruction = userInstruction;
            this.currentSnapshot.timestamp = new Date().toISOString();
            return;
        }

        // Create new snapshot
        const snapshot = {
            id: this.snapshots.length + 1,
            instruction: userInstruction,
            timestamp: new Date().toISOString(),
            files: {}, // Map of file_path -> original_content
            modifiedFiles: new Set() // Track which files were modified
        };

        this.snapshots.push(snapshot);
        this.currentSnapshot = snapshot;
    }

    /**
     * Backs up a file if it hasn't been backed up in the current snapshot yet
     * @param {string} filePath - Path to the file to backup
     */
    backupFileIfNeeded(filePath) {
        if (!this.currentSnapshot) {
            return; // No active snapshot
        }

        // If file already backed up in current snapshot, skip
        if (this.currentSnapshot.files.hasOwnProperty(filePath)) {
            return;
        }

        try {
            // Read original content
            if (existsSync(filePath)) {
                const originalContent = readFileSync(filePath, 'utf8');
                this.currentSnapshot.files[filePath] = originalContent;
                this.currentSnapshot.modifiedFiles.add(filePath);
            }
        } catch (error) {
            this.logger.warn(`Could not backup file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Gets all snapshots with summary information
     * @returns {Array} Array of snapshot summaries
     */
    getSnapshotSummaries() {
        return this.snapshots.map(snapshot => ({
            id: snapshot.id,
            instruction: snapshot.instruction,
            timestamp: snapshot.timestamp,
            fileCount: Object.keys(snapshot.files).length,
            modifiedFiles: Array.from(snapshot.modifiedFiles)
        }));
    }

    /**
     * Gets a specific snapshot by ID
     * @param {number} snapshotId - ID of the snapshot to retrieve
     * @returns {Object|null} Snapshot object or null if not found
     */
    getSnapshot(snapshotId) {
        return this.snapshots.find(snapshot => snapshot.id === snapshotId) || null;
    }

    /**
     * Restores all files from a specific snapshot
     * @param {number} snapshotId - ID of the snapshot to restore
     * @returns {Object} Result object with success status and details
     */
    async restoreSnapshot(snapshotId) {
        const snapshot = this.getSnapshot(snapshotId);
        if (!snapshot) {
            return {
                success: false,
                error: `Snapshot ${snapshotId} not found`
            };
        }

        const restoredFiles = [];
        const errors = [];

        for (const [filePath, originalContent] of Object.entries(snapshot.files)) {
            try {
                // Import write_file tool dynamically
                const writeFileModule = await import(`./tools/write_file/implementation.js`);
                const writeFile = writeFileModule.default;

                const result = await writeFile({
                    file_path: filePath,
                    content: originalContent,
                    encoding: 'utf8',
                    create_directories: true,
                    overwrite: true
                });

                if (result.success) {
                    restoredFiles.push(filePath);
                } else {
                    errors.push(`${filePath}: ${result.error}`);
                }
            } catch (error) {
                errors.push(`${filePath}: ${error.message}`);
            }
        }

        return {
            success: errors.length === 0,
            restoredFiles,
            errors,
            totalFiles: Object.keys(snapshot.files).length
        };
    }

    /**
     * Deletes a specific snapshot
     * @param {number} snapshotId - ID of the snapshot to delete
     * @returns {boolean} True if deleted successfully
     */
    deleteSnapshot(snapshotId) {
        const index = this.snapshots.findIndex(snapshot => snapshot.id === snapshotId);
        if (index === -1) {
            return false;
        }

        this.snapshots.splice(index, 1);
        
        // If we deleted the current snapshot, reset current snapshot
        if (this.currentSnapshot && this.currentSnapshot.id === snapshotId) {
            this.currentSnapshot = null;
        }

        return true;
    }

    /**
     * Clears all snapshots
     */
    clearAllSnapshots() {
        this.snapshots = [];
        this.currentSnapshot = null;
    }

    /**
     * Gets the current active snapshot
     * @returns {Object|null} Current snapshot or null
     */
    getCurrentSnapshot() {
        return this.currentSnapshot;
    }

    /**
     * Gets total number of snapshots
     * @returns {number} Number of snapshots
     */
    getSnapshotCount() {
        return this.snapshots.length;
    }
}

export default SnapshotManager; 