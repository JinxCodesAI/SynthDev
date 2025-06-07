import { readFileSync, existsSync } from 'fs';
import { getLogger } from './logger.js';
import GitUtils from './utils/GitUtils.js';

/**
 * Manages in-memory snapshots for file backup and restoration with Git integration
 */
class SnapshotManager {
    constructor() {
        this.isReady = false;
        this.snapshots = []; // Array of snapshot objects
        this.currentSnapshot = null; // Current active snapshot
        this.logger = getLogger();
        this.gitUtils = new GitUtils();
        this.gitAvailable = false;
        this.isGitRepo = false;
        this.originalBranch = null; // Store original branch name
        this.featureBranch = null; // Store feature branch name
        this.gitMode = false; // Whether we're using Git mode
        this.gitInitialized = false; // Track if Git initialization is complete
    }

    /**
     * Initialize Git availability and settings
     * @private
     */
    async _initializeGit() {
        try {
            const gitCheck = await this.gitUtils.checkGitAvailability();
            this.gitAvailable = gitCheck.available;
            this.isGitRepo = gitCheck.isRepo;

            if (this.gitAvailable && this.isGitRepo) {
                // Get current branch name
                const branchResult = await this.gitUtils.getCurrentBranch();
                if (branchResult.success) {
                    this.originalBranch = branchResult.branch;
                    this.logger.info(`Git integration enabled. Original branch: ${this.originalBranch}`);
                }
            } else {
                this.logger.info(`Git integration disabled. Available: ${this.gitAvailable}, Repo: ${this.isGitRepo}`);
            }
        } catch (error) {
            this.logger.warn(`Git initialization failed: ${error.message}`);
            this.gitAvailable = false;
            this.isGitRepo = false;
        } finally {
            this.gitInitialized = true;
            this.isReady = true;
        }
    }

    /**
     * Ensure Git initialization is complete
     */
    async ensureGitInitialized() {
        if (!this.gitInitialized && !this.isReady) {
            await this._initializeGit();
        }
    }

    async initialize() {
        await this.ensureGitInitialized();
        this.isReady = true;
    }

    /**
     * Creates a new snapshot with user instruction
     * @param {string} userInstruction - The user's instruction that triggered this snapshot
     */
    async createSnapshot(userInstruction) {
        // Ensure Git is initialized before proceeding
        await this.ensureGitInitialized();

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
            modifiedFiles: new Set(), // Track which files were modified
            gitBranch: null, // Git branch for this snapshot
            isFirstSnapshot: this.snapshots.length === 0
        };

        // Handle Git integration for first snapshot
        if (this.gitAvailable && this.isGitRepo && snapshot.isFirstSnapshot) {
            await this._handleFirstSnapshotGit(snapshot, userInstruction);
        }

        this.snapshots.push(snapshot);
        this.currentSnapshot = snapshot;
    }

    /**
     * Handle Git operations for the first snapshot
     * @param {Object} snapshot - The snapshot object
     * @param {string} userInstruction - User instruction
     * @private
     */
    async _handleFirstSnapshotGit(snapshot, userInstruction) {
        try {
            // Generate feature branch name
            const branchName = this.gitUtils.generateBranchName(userInstruction);

            // Create and switch to feature branch
            const createResult = await this.gitUtils.createBranch(branchName);
            if (createResult.success) {
                this.featureBranch = branchName;
                this.gitMode = true;
                snapshot.gitBranch = branchName;
                this.logger.user(`🌿 Created feature branch: ${branchName}`, '📸 Snapshot:');
            } else {
                this.logger.warn(`Failed to create Git branch: ${createResult.error}`);
            }
        } catch (error) {
            this.logger.warn(`Git branch creation failed: ${error.message}`);
        }
    }

    /**
     * Backs up a file if it hasn't been backed up in the current snapshot yet
     * @param {string} filePath - Path to the file to backup
     */
    async backupFileIfNeeded(filePath) {
        if (!this.currentSnapshot) {
            return; // No active snapshot
        }

        // If file already backed up in current snapshot, skip
        if (this.currentSnapshot.files.hasOwnProperty(filePath)) {
            return;
        }

        try {
            // Read original content (for fallback restore)
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
     * Commit changes to Git if in Git mode
     * @param {string[]} modifiedFiles - Array of modified file paths
     */
    async commitChangesToGit(modifiedFiles) {
        if (!this.gitMode || !this.currentSnapshot) {
            return { success: false, error: 'Not in Git mode or no active snapshot' };
        }

        try {
            // Add modified files to Git
            const addResult = await this.gitUtils.addFiles(modifiedFiles);
            if (!addResult.success) {
                return { success: false, error: `Failed to add files: ${addResult.error}` };
            }

            // Create commit message with timestamp and affected files
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const fileList = modifiedFiles.length <= 3
                ? modifiedFiles.join(', ')
                : `${modifiedFiles.slice(0, 3).join(', ')} and ${modifiedFiles.length - 3} more`;

            // Create structured commit message
            const commitMessage = `Synth-Dev [${timestamp}]: Modified ${fileList}

Original instruction: ${this.currentSnapshot.instruction}`;

            // Commit changes
            const commitResult = await this.gitUtils.commit(commitMessage);
            if (commitResult.success) {
                this.logger.info(`📝 Committed changes to Git: ${modifiedFiles.join(', ')}`);
                return { success: true };
            } else {
                return { success: false, error: `Failed to commit: ${commitResult.error}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
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

    /**
     * Get Git status information
     * @returns {Object} Git status information
     */
    getGitStatus() {
        return {
            gitAvailable: this.gitAvailable,
            isGitRepo: this.isGitRepo,
            gitMode: this.gitMode,
            originalBranch: this.originalBranch,
            featureBranch: this.featureBranch
        };
    }

    /**
     * Merge feature branch back to original branch
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async mergeFeatureBranch() {
        if (!this.gitMode || !this.featureBranch || !this.originalBranch) {
            return { success: false, error: 'Not in Git mode or missing branch information' };
        }

        try {
            // Switch back to original branch
            const switchResult = await this.gitUtils.switchBranch(this.originalBranch);
            if (!switchResult.success) {
                return { success: false, error: `Failed to switch to ${this.originalBranch}: ${switchResult.error}` };
            }

            // Merge feature branch
            const mergeResult = await this.gitUtils.mergeBranch(this.featureBranch);
            if (!mergeResult.success) {
                return { success: false, error: `Failed to merge ${this.featureBranch}: ${mergeResult.error}` };
            }

            // Reset Git mode
            const mergedBranch = this.featureBranch;
            this.gitMode = false;
            this.featureBranch = null;

            this.logger.user(`🔀 Successfully merged ${mergedBranch} into ${this.originalBranch}`, '🌿 Git:');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch back to original branch without merging
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async switchToOriginalBranch() {
        if (!this.gitMode || !this.originalBranch) {
            return { success: false, error: 'Not in Git mode or no original branch' };
        }

        try {
            const switchResult = await this.gitUtils.switchBranch(this.originalBranch);
            if (switchResult.success) {
                this.gitMode = false;
                return { success: true };
            } else {
                return { success: false, error: switchResult.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

export default SnapshotManager; 