import { readFileSync, existsSync } from 'fs';
import { getLogger } from './logger.js';
import GitUtils from '../../../utils/GitUtils.js';

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
                    this.logger.info(
                        `Git integration enabled. Original branch: ${this.originalBranch}`
                    );
                }
            } else {
                this.logger.info(
                    `Git integration disabled. Available: ${this.gitAvailable}, Repo: ${this.isGitRepo}`
                );
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

        // If current snapshot is truly empty (no files tracked at all), override it
        // This handles the case where a snapshot was created but no tools were executed
        if (
            this.currentSnapshot &&
            Object.keys(this.currentSnapshot.files).length === 0 &&
            this.currentSnapshot.modifiedFiles.size === 0
        ) {
            this.currentSnapshot.instruction = userInstruction;
            this.currentSnapshot.timestamp = new Date().toISOString();
            return;
        }

        // Create new snapshot
        const snapshot = {
            id: this.snapshots.length + 1,
            instruction: userInstruction,
            timestamp: new Date().toISOString(),
            files: {}, // Map of file_path -> original_content (null for non-existent files)
            modifiedFiles: new Set(), // Track which files were modified
            gitBranch: null, // Git branch for this snapshot
            isFirstSnapshot: this.snapshots.length === 0,
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
        if (Object.prototype.hasOwnProperty.call(this.currentSnapshot.files, filePath)) {
            return;
        }

        try {
            // Always track the file, even if it doesn't exist
            if (existsSync(filePath)) {
                // File exists - backup its content
                const originalContent = readFileSync(filePath, 'utf8');
                this.currentSnapshot.files[filePath] = originalContent;
                this.currentSnapshot.modifiedFiles.add(filePath);
            } else {
                // File doesn't exist - record this fact with null value
                // This allows us to delete the file during restoration
                this.currentSnapshot.files[filePath] = null;
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
            // Create commit message with timestamp and affected files
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const fileList =
                modifiedFiles.length <= 3
                    ? modifiedFiles.join(', ')
                    : `${modifiedFiles.slice(0, 3).join(', ')} and ${modifiedFiles.length - 3} more`;

            // Sanitize the instruction to avoid shell command issues
            const sanitizedInstruction = this.currentSnapshot.instruction
                .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();

            // Create structured commit message
            const commitMessage = `Synth-Dev [${timestamp}]: Modified ${fileList}

Original instruction: ${sanitizedInstruction}`;

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
     * In Git mode, returns Git commits; in legacy mode, returns in-memory snapshots
     * @returns {Promise<Array>} Array of snapshot summaries
     */
    async getSnapshotSummaries() {
        if (this.gitMode) {
            // In Git mode, return commit history as snapshots
            const historyResult = await this.gitUtils.getCommitHistory(20);
            if (historyResult.success) {
                return historyResult.commits.map((commit, index) => ({
                    id: index + 1,
                    gitHash: commit.hash,
                    shortHash: commit.shortHash,
                    instruction: commit.subject,
                    timestamp: commit.date,
                    author: commit.author,
                    isGitCommit: true,
                }));
            }
            return [];
        } else {
            // Legacy mode - return in-memory snapshots
            return this.snapshots.map(snapshot => ({
                id: snapshot.id,
                instruction: snapshot.instruction,
                timestamp: snapshot.timestamp,
                fileCount: Object.keys(snapshot.files).length,
                modifiedFiles: Array.from(snapshot.modifiedFiles),
                isGitCommit: false,
            }));
        }
    }

    /**
     * Gets a specific snapshot by ID
     * In Git mode, retrieves commit by position; in legacy mode, retrieves in-memory snapshot
     * @param {number} snapshotId - ID of the snapshot to retrieve
     * @returns {Promise<Object|null>} Snapshot object or null if not found
     */
    async getSnapshot(snapshotId) {
        if (this.gitMode) {
            // In Git mode, get commit by position in history
            const summaries = await this.getSnapshotSummaries();
            const snapshot = summaries.find(s => s.id === snapshotId);
            if (snapshot) {
                // Get detailed commit information
                const detailsResult = await this.gitUtils.getCommitDetails(snapshot.gitHash);
                if (detailsResult.success) {
                    return {
                        ...snapshot,
                        files: detailsResult.commit.files,
                        message: detailsResult.commit.message,
                    };
                }
            }
            return null;
        } else {
            // Legacy mode - return in-memory snapshot
            return this.snapshots.find(snapshot => snapshot.id === snapshotId) || null;
        }
    }

    /**
     * Restores all files from a specific snapshot
     * In Git mode, uses git reset; in legacy mode, uses file-based restoration
     * @param {number} snapshotId - ID of the snapshot to restore
     * @returns {Promise<Object>} Result object with success status and details
     */
    async restoreSnapshot(snapshotId) {
        if (this.gitMode) {
            // Git mode - use git reset to restore to specific commit
            const summaries = await this.getSnapshotSummaries();
            const snapshot = summaries.find(s => s.id === snapshotId);

            if (!snapshot) {
                return {
                    success: false,
                    error: `Snapshot ${snapshotId} not found`,
                };
            }

            // Verify the commit exists
            const existsResult = await this.gitUtils.commitExists(snapshot.gitHash);
            if (!existsResult.success || !existsResult.exists) {
                return {
                    success: false,
                    error: `Git commit ${snapshot.shortHash} not found or inaccessible`,
                };
            }

            // Perform git reset to the commit
            const resetResult = await this.gitUtils.resetToCommit(snapshot.gitHash);
            if (resetResult.success) {
                this.logger.info(
                    `🔄 Reset to commit ${snapshot.shortHash}: ${snapshot.instruction}`
                );
                return {
                    success: true,
                    method: 'git-reset',
                    commitHash: snapshot.gitHash,
                    shortHash: snapshot.shortHash,
                    instruction: snapshot.instruction,
                    message: `Successfully reset to commit ${snapshot.shortHash}`,
                };
            } else {
                return {
                    success: false,
                    error: `Git reset failed: ${resetResult.error}`,
                };
            }
        } else {
            // Legacy mode - file-based restoration
            const snapshot = await this.getSnapshot(snapshotId);
            if (!snapshot) {
                return {
                    success: false,
                    error: `Snapshot ${snapshotId} not found`,
                };
            }

            const restoredFiles = [];
            const deletedFiles = [];
            const errors = [];

            for (const [filePath, originalContent] of Object.entries(snapshot.files)) {
                try {
                    if (originalContent === null) {
                        // File didn't exist in the snapshot - delete it if it exists now
                        if (existsSync(filePath)) {
                            const { unlinkSync } = await import('fs');
                            unlinkSync(filePath);
                            deletedFiles.push(filePath);
                        }
                    } else {
                        // File existed in the snapshot - restore its content
                        const writeFileModule = await import(
                            '../../../tools/write_file/implementation.js'
                        );
                        const writeFile = writeFileModule.default;

                        const result = await writeFile({
                            file_path: filePath,
                            content: originalContent,
                            encoding: 'utf8',
                            create_directories: true,
                            overwrite: true,
                        });

                        if (result.success) {
                            restoredFiles.push(filePath);
                        } else {
                            errors.push(`${filePath}: ${result.error}`);
                        }
                    }
                } catch (error) {
                    errors.push(`${filePath}: ${error.message}`);
                }
            }

            return {
                success: errors.length === 0,
                method: 'file-based',
                restoredFiles,
                deletedFiles,
                errors,
                totalFiles: Object.keys(snapshot.files).length,
            };
        }
    }

    /**
     * Deletes a specific snapshot
     * In Git mode, this operation is not supported (commits cannot be easily deleted)
     * In legacy mode, removes the in-memory snapshot
     * @param {number} snapshotId - ID of the snapshot to delete
     * @returns {Promise<{success: boolean, error?: string}>} Result object
     */
    async deleteSnapshot(snapshotId) {
        if (this.gitMode) {
            return {
                success: false,
                error: 'Snapshot deletion is not supported in Git mode. Use Git commands to manage commit history.',
            };
        }

        const index = this.snapshots.findIndex(snapshot => snapshot.id === snapshotId);
        if (index === -1) {
            return {
                success: false,
                error: `Snapshot ${snapshotId} not found`,
            };
        }

        this.snapshots.splice(index, 1);

        // If we deleted the current snapshot, reset current snapshot
        if (this.currentSnapshot && this.currentSnapshot.id === snapshotId) {
            this.currentSnapshot = null;
        }

        return { success: true };
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
     * In Git mode, returns number of commits; in legacy mode, returns number of in-memory snapshots
     * @returns {Promise<number>} Number of snapshots
     */
    async getSnapshotCount() {
        if (this.gitMode) {
            const summaries = await this.getSnapshotSummaries();
            return summaries.length;
        }
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
            featureBranch: this.featureBranch,
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
                return {
                    success: false,
                    error: `Failed to switch to ${this.originalBranch}: ${switchResult.error}`,
                };
            }

            // Merge feature branch
            const mergeResult = await this.gitUtils.mergeBranch(this.featureBranch);
            if (!mergeResult.success) {
                return {
                    success: false,
                    error: `Failed to merge ${this.featureBranch}: ${mergeResult.error}`,
                };
            }

            // Reset Git mode
            const mergedBranch = this.featureBranch;
            this.gitMode = false;
            this.featureBranch = null;

            this.logger.user(
                `🔀 Successfully merged ${mergedBranch} into ${this.originalBranch}`,
                '🌿 Git:'
            );
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

    /**
     * Check if automatic cleanup should be performed
     * @returns {Promise<{shouldCleanup: boolean, reason?: string}>}
     */
    async shouldPerformCleanup() {
        try {
            // Ensure Git is initialized
            await this.ensureGitInitialized();

            // Check if Git integration is active
            if (!this.gitAvailable || !this.isGitRepo || !this.gitMode) {
                return { shouldCleanup: false, reason: 'Git integration not active' };
            }

            // Check if we're on a temporary branch
            if (!this.featureBranch || !this.originalBranch) {
                return { shouldCleanup: false, reason: 'Not on a temporary branch' };
            }

            // Check if current branch has zero uncommitted changes relative to source branch
            const statusResult = await this.gitUtils.hasUncommittedChanges();
            if (!statusResult.success) {
                return {
                    shouldCleanup: false,
                    reason: `Failed to check Git status: ${statusResult.error}`,
                };
            }

            if (statusResult.hasUncommittedChanges) {
                return { shouldCleanup: false, reason: 'Branch has uncommitted changes' };
            }

            return { shouldCleanup: true };
        } catch (error) {
            return {
                shouldCleanup: false,
                reason: `Error checking cleanup conditions: ${error.message}`,
            };
        }
    }

    /**
     * Perform automatic cleanup by switching to original branch and deleting temporary branch
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async performCleanup() {
        try {
            const cleanupCheck = await this.shouldPerformCleanup();
            if (!cleanupCheck.shouldCleanup) {
                return { success: false, error: cleanupCheck.reason };
            }

            const branchToDelete = this.featureBranch;

            // Switch back to original branch
            const switchResult = await this.switchToOriginalBranch();
            if (!switchResult.success) {
                return {
                    success: false,
                    error: `Failed to switch to original branch: ${switchResult.error}`,
                };
            }

            // Delete the temporary branch
            const deleteResult = await this.gitUtils.deleteBranch(branchToDelete);
            if (!deleteResult.success) {
                this.logger.warn(
                    `Failed to delete temporary branch ${branchToDelete}: ${deleteResult.error}`
                );
                // Don't fail the cleanup if branch deletion fails - the important part is switching back
            }

            // Reset state
            this.featureBranch = null;
            this.gitMode = false;

            this.logger.info(
                `🧹 Automatic cleanup completed: switched to ${this.originalBranch} and deleted ${branchToDelete}`
            );
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

export default SnapshotManager;
