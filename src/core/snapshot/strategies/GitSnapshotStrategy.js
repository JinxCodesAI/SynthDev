/**
 * Git-based Snapshot Strategy
 * Implements snapshot operations using Git branches and commits
 */

import { SnapshotStrategy } from '../interfaces/SnapshotStrategy.js';
import { GitIntegration } from '../git/GitIntegration.js';
import { BranchLifecycleManager } from '../git/BranchLifecycleManager.js';
import Snapshot from '../models/Snapshot.js';
import SnapshotLogger from '../utils/SnapshotLogger.js';
import SnapshotConfig from '../SnapshotConfig.js';
import SnapshotEventEmitter from '../events/SnapshotEventEmitter.js';
import { SnapshotEvents } from '../events/SnapshotEvents.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Git-based implementation of snapshot strategy
 */
export class GitSnapshotStrategy extends SnapshotStrategy {
    constructor(config = null, eventEmitter = null) {
        super();
        this.config = config || new SnapshotConfig();
        this.eventEmitter = eventEmitter || new SnapshotEventEmitter();
        this.logger = new SnapshotLogger('GitSnapshotStrategy');

        // Git components
        this.gitIntegration = new GitIntegration(this.config, this.eventEmitter);
        this.branchManager = new BranchLifecycleManager(
            this.gitIntegration,
            this.config,
            this.eventEmitter
        );

        // Strategy state
        this.isInitialized = false;
        this.currentSnapshotBranch = null;
        this.baseBranch = 'main';
    }

    /**
     * Initialize the Git snapshot strategy
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        const timer = this.logger.createTimer('git_strategy_init');

        try {
            if (this.isInitialized) {
                return { success: true };
            }

            this.logger.info('Initializing Git snapshot strategy...');

            // Initialize Git integration
            const gitInit = await this.gitIntegration.initialize();
            if (!gitInit.success) {
                timer(false, { error: gitInit.error });
                return { success: false, error: gitInit.error };
            }

            // Initialize branch manager
            const branchInit = await this.branchManager.initialize();
            if (!branchInit.success) {
                timer(false, { error: branchInit.error });
                return { success: false, error: branchInit.error };
            }

            // Determine base branch
            const repoState = await this.gitIntegration.getRepositoryState();
            if (repoState.currentBranch) {
                // Use current branch as base if it's not a snapshot branch
                if (!this.branchManager.isSnapshotBranch(repoState.currentBranch)) {
                    this.baseBranch = repoState.currentBranch;
                }
            }

            this.isInitialized = true;
            timer(true);

            this.eventEmitter.emit(SnapshotEvents.STRATEGY_INITIALIZED, {
                strategy: 'git',
                baseBranch: this.baseBranch,
            });

            this.logger.info('Git snapshot strategy initialized successfully');
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Git strategy initialization failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a snapshot using Git branch and commit
     * @param {string} instruction - User instruction for the snapshot
     * @param {Object} options - Snapshot creation options
     * @returns {Promise<{success: boolean, snapshot?: Snapshot, error?: string}>}
     */
    async createSnapshot(instruction, options = {}) {
        const { files = null, includeUntracked = true, autoCommit = true } = options;

        const timer = this.logger.createTimer('create_git_snapshot');

        try {
            if (!this.isInitialized) {
                const initResult = await this.initialize();
                if (!initResult.success) {
                    timer(false, { error: initResult.error });
                    return { success: false, error: initResult.error };
                }
            }

            this.logger.info(`Creating Git snapshot: ${instruction}`);

            // Create snapshot branch
            const branchResult = await this.branchManager.createSnapshotBranch(instruction, {
                autoSwitch: true,
                checkUncommitted: true,
                baseBranch: this.baseBranch,
            });

            if (!branchResult.success) {
                timer(false, { error: branchResult.error });
                return { success: false, error: branchResult.error };
            }

            this.currentSnapshotBranch = branchResult.branchName;

            // Create snapshot object
            const snapshot = new Snapshot({
                instruction,
                mode: 'git',
                metadata: {
                    branchName: branchResult.branchName,
                    baseBranch: this.baseBranch,
                    previousBranch: branchResult.previousBranch,
                },
            });

            // Collect files to include in snapshot
            const snapshotFiles = await this.collectSnapshotFiles(files, includeUntracked);

            // Add files to snapshot object
            for (const [filePath, content] of snapshotFiles) {
                snapshot.addFile(filePath, content);
            }

            // Stage and commit files if auto-commit is enabled
            if (autoCommit && snapshotFiles.size > 0) {
                const commitResult = await this.commitSnapshotFiles(
                    Array.from(snapshotFiles.keys()),
                    instruction,
                    snapshot.id
                );

                if (!commitResult.success) {
                    timer(false, { error: commitResult.error });
                    return { success: false, error: commitResult.error };
                }

                snapshot.metadata.commitHash = commitResult.commitHash;
            }

            timer(true, {
                snapshotId: snapshot.id,
                branchName: branchResult.branchName,
                fileCount: snapshotFiles.size,
            });

            this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_CREATED, {
                snapshot,
                strategy: 'git',
                branchName: branchResult.branchName,
            });

            this.logger.info(`Git snapshot created: ${snapshot.id}`);
            return { success: true, snapshot };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to create Git snapshot: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Collect files for snapshot
     * @param {Array|null} files - Specific files to include, or null for all
     * @param {boolean} includeUntracked - Whether to include untracked files
     * @returns {Promise<Map>}
     */
    async collectSnapshotFiles(files, includeUntracked) {
        const snapshotFiles = new Map();

        try {
            if (files && Array.isArray(files)) {
                // Include specific files
                for (const filePath of files) {
                    if (existsSync(filePath)) {
                        const content = await readFile(filePath, 'utf8');
                        snapshotFiles.set(filePath, content);
                    }
                }
            } else {
                // Get all changed files from Git status
                const statusResult = await this.gitIntegration.getStatus();

                if (statusResult.success) {
                    for (const fileInfo of statusResult.status.files) {
                        if (fileInfo.untracked && !includeUntracked) {
                            continue;
                        }

                        if (existsSync(fileInfo.path)) {
                            const content = await readFile(fileInfo.path, 'utf8');
                            snapshotFiles.set(fileInfo.path, content);
                        }
                    }
                }
            }

            return snapshotFiles;
        } catch (error) {
            this.logger.error(`Failed to collect snapshot files: ${error.message}`);
            return snapshotFiles;
        }
    }

    /**
     * Commit snapshot files to Git
     * @param {Array} filePaths - Array of file paths to commit
     * @param {string} instruction - User instruction
     * @param {string} snapshotId - Snapshot ID
     * @returns {Promise<{success: boolean, commitHash?: string, error?: string}>}
     */
    async commitSnapshotFiles(filePaths, instruction, snapshotId) {
        try {
            // Stage files
            const addResult = await this.gitIntegration.addFiles(filePaths);
            if (!addResult.success) {
                return { success: false, error: addResult.error };
            }

            // Generate commit message
            const commitMessage = this.generateCommitMessage(instruction, snapshotId);

            // Commit changes
            const commitResult = await this.gitIntegration.commit(commitMessage);
            if (!commitResult.success) {
                return { success: false, error: commitResult.error };
            }

            return { success: true, commitHash: commitResult.commitHash };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate standardized commit message for snapshots
     * @param {string} instruction - User instruction
     * @param {string} snapshotId - Snapshot ID
     * @returns {string}
     */
    generateCommitMessage(instruction, snapshotId) {
        const timestamp = new Date().toISOString();

        return [
            `Snapshot: ${instruction}`,
            '',
            `Snapshot ID: ${snapshotId}`,
            `Created: ${timestamp}`,
            'Strategy: Git',
            '',
            'This commit was created automatically by SynthDev Snapshots.',
        ].join('\n');
    }

    /**
     * Restore a snapshot by switching to its branch
     * @param {string} snapshotId - ID of the snapshot to restore
     * @param {Object} options - Restoration options
     * @returns {Promise<{success: boolean, snapshot?: Snapshot, error?: string}>}
     */
    async restoreSnapshot(snapshotId, options = {}) {
        const { resetHard = false, stashChanges = true } = options;

        const timer = this.logger.createTimer('restore_git_snapshot');

        try {
            this.logger.info(`Restoring Git snapshot: ${snapshotId}`);

            // Find snapshot by ID (this would require a snapshot registry)
            // For now, assume the snapshot ID maps to a branch name
            const branchName = await this.findSnapshotBranch(snapshotId);

            if (!branchName) {
                timer(false, { error: 'snapshot_not_found' });
                return { success: false, error: `Snapshot ${snapshotId} not found` };
            }

            // Switch to snapshot branch
            const switchResult = await this.branchManager.switchToBranch(branchName, {
                stashChanges,
            });

            if (!switchResult.success) {
                timer(false, { error: switchResult.error });
                return { success: false, error: switchResult.error };
            }

            // Reset to snapshot commit if requested
            if (resetHard) {
                // This would require finding the specific commit hash
                // Implementation depends on how snapshots are stored
            }

            timer(true, { snapshotId, branchName });

            this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_RESTORED, {
                snapshotId,
                branchName,
                strategy: 'git',
            });

            this.logger.info(`Git snapshot restored: ${snapshotId}`);

            // Return a placeholder snapshot object
            const snapshot = new Snapshot({
                id: snapshotId,
                instruction: 'Restored snapshot',
                mode: 'git',
            });

            return { success: true, snapshot };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to restore Git snapshot: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Find the branch associated with a snapshot ID
     * @param {string} snapshotId - Snapshot ID to find
     * @returns {Promise<string|null>}
     */
    async findSnapshotBranch(_snapshotId) {
        // This would require searching through Git branches and commits
        // For now, return null as placeholder
        return null;
    }

    /**
     * Delete a snapshot by removing its branch
     * @param {string} snapshotId - ID of the snapshot to delete
     * @param {Object} options - Deletion options
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteSnapshot(snapshotId, options = {}) {
        const { force = false } = options;

        const timer = this.logger.createTimer('delete_git_snapshot');

        try {
            this.logger.info(`Deleting Git snapshot: ${snapshotId}`);

            const branchName = await this.findSnapshotBranch(snapshotId);

            if (!branchName) {
                timer(false, { error: 'snapshot_not_found' });
                return { success: false, error: `Snapshot ${snapshotId} not found` };
            }

            const deleteResult = await this.branchManager.deleteSnapshotBranch(branchName, {
                force,
            });

            if (deleteResult.success) {
                timer(true, { snapshotId, branchName });

                this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_DELETED, {
                    snapshotId,
                    branchName,
                    strategy: 'git',
                });

                return { success: true };
            }

            timer(false, { error: deleteResult.error });
            return { success: false, error: deleteResult.error };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to delete Git snapshot: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all Git-based snapshots
     * @param {Object} options - Listing options
     * @returns {Promise<{success: boolean, snapshots?: Array, error?: string}>}
     */
    async listSnapshots(options = {}) {
        const { limit = 50, includeMetadata = true } = options;

        try {
            // Get branch information
            const branchInfo = await this.branchManager.getBranchInfo();

            if (!branchInfo.success) {
                return { success: false, error: branchInfo.error };
            }

            // Convert branches to snapshot format
            const snapshots = branchInfo.branches.slice(0, limit).map(branch => ({
                id: branch.name, // Using branch name as ID for now
                instruction: branch.instruction,
                mode: 'git',
                created: branch.created,
                metadata: includeMetadata
                    ? {
                          branchName: branch.name,
                          commits: branch.commits,
                          lastActivity: branch.lastActivity,
                          isActive: branch.isActive,
                      }
                    : undefined,
            }));

            return { success: true, snapshots };
        } catch (error) {
            this.logger.error(`Failed to list Git snapshots: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if Git strategy is available
     * @returns {Promise<{available: boolean, reason?: string}>}
     */
    async isAvailable() {
        try {
            const availability = await this.gitIntegration.checkGitAvailability();
            return {
                available: availability.success && availability.available && availability.isRepo,
                reason: availability.error,
            };
        } catch (error) {
            return {
                available: false,
                reason: error.message,
            };
        }
    }

    /**
     * Get strategy mode
     * @returns {string} Strategy mode
     */
    getMode() {
        return 'git';
    }

    /**
     * Get all snapshots from Git branches
     * TODO: Implement proper Git snapshot retrieval when Git functionality is ready
     * For now, return empty array to allow file-based snapshots to work
     * @returns {Promise<{success: boolean, snapshots: Array}>} Result with snapshots array
     */
    async getSnapshots() {
        // TODO: Implement Git-based snapshot retrieval
        // This should:
        // 1. Get all snapshot branches from branchManager
        // 2. Convert branch information to snapshot format
        // 3. Return array of snapshot objects
        return { success: true, snapshots: [] };
    }

    /**
     * Get strategy status and statistics
     * @returns {Object} Strategy status
     */
    getStatus() {
        return {
            mode: 'git',
            available: this.isInitialized,
            initialized: this.isInitialized,
            gitIntegration: this.gitIntegration ? this.gitIntegration.getStatus() : null,
            branchManager: this.branchManager ? this.branchManager.getStatus() : null,
        };
    }
}
