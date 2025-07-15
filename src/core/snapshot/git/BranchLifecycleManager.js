/**
 * Branch Lifecycle Management for Snapshot System
 * Handles branch creation, switching, merging, and cleanup operations
 */

import { GitIntegration } from './GitIntegration.js';
import SnapshotLogger from '../utils/SnapshotLogger.js';
import SnapshotConfig from '../SnapshotConfig.js';
import SnapshotEventEmitter from '../events/SnapshotEventEmitter.js';
import { SnapshotEvents } from '../events/SnapshotEvents.js';
import IdGenerator from '../utils/IdGenerator.js';

/**
 * Manages the complete lifecycle of Git branches for snapshots
 */
export class BranchLifecycleManager {
    constructor(gitIntegration = null, config = null, eventEmitter = null) {
        this.gitIntegration = gitIntegration || new GitIntegration();
        this.config = config || new SnapshotConfig();
        this.eventEmitter = eventEmitter || new SnapshotEventEmitter();
        this.logger = new SnapshotLogger('BranchLifecycleManager');

        // Branch tracking
        this.activeBranches = new Map(); // branchName -> metadata
        this.branchHistory = []; // Array of branch operations
        this.maxHistorySize = 100;

        // Branch naming configuration
        this.branchPrefix = 'synth-dev';
        this.maxBranchNameLength = 100;
        this.reservedBranches = new Set(['main', 'master', 'develop', 'dev']);
    }

    /**
     * Initialize branch lifecycle manager
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        const timer = this.logger.createTimer('branch_lifecycle_init');

        try {
            this.logger.info('Initializing branch lifecycle manager...');

            // Initialize Git integration
            const gitInit = await this.gitIntegration.initialize();
            if (!gitInit.success) {
                timer(false, { error: gitInit.error });
                return { success: false, error: gitInit.error };
            }

            // Load existing branch information
            await this.loadBranchMetadata();

            // Set up event listeners
            this.setupEventListeners();

            timer(true);
            this.logger.info('Branch lifecycle manager initialized successfully');
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Branch lifecycle initialization failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Set up event listeners for branch operations
     */
    setupEventListeners() {
        this.eventEmitter.on(SnapshotEvents.BRANCH_CREATED, data => {
            this.trackBranchOperation('created', data);
        });

        this.eventEmitter.on(SnapshotEvents.BRANCH_SWITCHED, data => {
            this.trackBranchOperation('switched', data);
        });

        this.eventEmitter.on(SnapshotEvents.BRANCH_DELETED, data => {
            this.trackBranchOperation('deleted', data);
        });
    }

    /**
     * Track branch operations for history and cleanup
     * @param {string} operation - Operation type
     * @param {Object} data - Operation data
     */
    trackBranchOperation(operation, data) {
        const record = {
            operation,
            data,
            timestamp: Date.now(),
            id: IdGenerator.generateSessionId(),
        };

        this.branchHistory.unshift(record);

        // Maintain history size limit
        if (this.branchHistory.length > this.maxHistorySize) {
            this.branchHistory = this.branchHistory.slice(0, this.maxHistorySize);
        }

        // Update active branches tracking
        if (operation === 'created') {
            this.activeBranches.set(data.branchName, {
                created: Date.now(),
                instruction: data.originalName,
                commits: 0,
                lastActivity: Date.now(),
            });
        } else if (operation === 'deleted') {
            this.activeBranches.delete(data.branchName);
        }
    }

    /**
     * Load existing branch metadata from Git
     * @returns {Promise<void>}
     */
    async loadBranchMetadata() {
        try {
            // This would involve parsing Git branch information
            // For now, initialize empty tracking
            this.activeBranches.clear();
            this.logger.debug('Branch metadata loaded');
        } catch (error) {
            this.logger.warn(`Failed to load branch metadata: ${error.message}`);
        }
    }

    /**
     * Create a new snapshot branch with full lifecycle management
     * @param {string} instruction - User instruction for the snapshot
     * @param {Object} options - Branch creation options
     * @returns {Promise<{success: boolean, branchName?: string, previousBranch?: string, error?: string}>}
     */
    async createSnapshotBranch(instruction, options = {}) {
        const { autoSwitch = true, checkUncommitted = true, baseBranch = null } = options;

        const timer = this.logger.createTimer('create_snapshot_branch');

        try {
            this.logger.info(`Creating snapshot branch for: ${instruction}`);

            // Check for uncommitted changes if requested
            if (checkUncommitted) {
                const statusResult = await this.gitIntegration.getStatus();
                if (statusResult.success && statusResult.status.hasChanges) {
                    timer(false, { error: 'uncommitted_changes' });
                    return {
                        success: false,
                        error: 'Cannot create snapshot branch with uncommitted changes',
                    };
                }
            }

            // Get current branch for reference
            const repoState = await this.gitIntegration.getRepositoryState();
            const previousBranch = repoState.currentBranch;

            // Generate unique branch name
            const branchName = await this.generateUniqueBranchName(instruction);

            // Switch to base branch if specified
            if (baseBranch && baseBranch !== previousBranch) {
                const switchResult = await this.gitIntegration.switchBranch(baseBranch);
                if (!switchResult.success) {
                    timer(false, { error: switchResult.error });
                    return {
                        success: false,
                        error: `Failed to switch to base branch: ${switchResult.error}`,
                    };
                }
            }

            // Create the new branch
            const createResult = await this.gitIntegration.createBranch(branchName, {
                force: false,
                switchTo: autoSwitch,
            });

            if (createResult.success) {
                timer(true, { branchName });

                this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_BRANCH_CREATED, {
                    branchName: createResult.branchName,
                    instruction,
                    previousBranch,
                    baseBranch,
                });

                return {
                    success: true,
                    branchName: createResult.branchName,
                    previousBranch,
                };
            }

            timer(false, { error: createResult.error });
            return { success: false, error: createResult.error };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to create snapshot branch: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate a unique branch name that doesn't conflict with existing branches
     * @param {string} instruction - User instruction
     * @returns {Promise<string>}
     */
    async generateUniqueBranchName(instruction) {
        const baseName = this.gitIntegration.generateSnapshotBranchName(instruction);
        let branchName = baseName;
        let counter = 1;

        // Check for conflicts and append counter if needed
        while (await this.branchNameExists(branchName)) {
            branchName = `${baseName}-${counter}`;
            counter++;

            // Prevent infinite loops
            if (counter > 100) {
                branchName = `${this.branchPrefix}/${Date.now()}-fallback`;
                break;
            }
        }

        return branchName;
    }

    /**
     * Check if a branch name already exists
     * @param {string} branchName - Branch name to check
     * @returns {Promise<boolean>}
     */
    async branchNameExists(branchName) {
        try {
            const result = await this.gitIntegration.branchExists(branchName);
            return result.success && result.exists;
        } catch (error) {
            this.logger.warn(`Failed to check branch existence: ${error.message}`);
            return false;
        }
    }

    /**
     * Switch to a branch with safety checks and state management
     * @param {string} branchName - Name of the branch to switch to
     * @param {Object} options - Switch options
     * @returns {Promise<{success: boolean, previousBranch?: string, error?: string}>}
     */
    async switchToBranch(branchName, options = {}) {
        const { stashChanges = false, createIfNotExists = false, instruction = null } = options;

        const timer = this.logger.createTimer('switch_to_branch');

        try {
            this.logger.info(`Switching to branch: ${branchName}`);

            // Check if branch exists
            const exists = await this.branchNameExists(branchName);

            if (!exists && createIfNotExists && instruction) {
                // Create the branch first
                const createResult = await this.createSnapshotBranch(instruction, {
                    autoSwitch: false,
                });

                if (!createResult.success) {
                    timer(false, { error: createResult.error });
                    return { success: false, error: createResult.error };
                }

                branchName = createResult.branchName;
            } else if (!exists) {
                timer(false, { error: 'branch_not_found' });
                return { success: false, error: `Branch ${branchName} does not exist` };
            }

            // Perform the switch
            const switchResult = await this.gitIntegration.switchBranch(branchName, {
                stashChanges,
            });

            if (switchResult.success) {
                timer(true, { branchName });

                // Update branch activity tracking
                if (this.activeBranches.has(branchName)) {
                    const metadata = this.activeBranches.get(branchName);
                    metadata.lastActivity = Date.now();
                    this.activeBranches.set(branchName, metadata);
                }

                return {
                    success: true,
                    previousBranch: switchResult.previousBranch,
                };
            }

            timer(false, { error: switchResult.error });
            return { success: false, error: switchResult.error };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to switch to branch ${branchName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Merge a snapshot branch back to the main branch
     * @param {string} branchName - Name of the branch to merge
     * @param {Object} options - Merge options
     * @returns {Promise<{success: boolean, targetBranch?: string, conflicts?: Array, error?: string}>}
     */
    async mergeSnapshotBranch(branchName, options = {}) {
        const { targetBranch = 'main', deleteAfterMerge = true } = options;

        const timer = this.logger.createTimer('merge_snapshot_branch');

        try {
            this.logger.info(`Merging branch ${branchName} into ${targetBranch}`);

            // Validate branches exist
            const sourceBranchExists = await this.branchNameExists(branchName);
            const targetBranchExists = await this.branchNameExists(targetBranch);

            if (!sourceBranchExists) {
                timer(false, { error: 'source_branch_not_found' });
                return { success: false, error: `Source branch ${branchName} does not exist` };
            }

            if (!targetBranchExists) {
                timer(false, { error: 'target_branch_not_found' });
                return { success: false, error: `Target branch ${targetBranch} does not exist` };
            }

            // Switch to target branch
            const switchResult = await this.switchToBranch(targetBranch);
            if (!switchResult.success) {
                timer(false, { error: switchResult.error });
                return {
                    success: false,
                    error: `Failed to switch to target branch: ${switchResult.error}`,
                };
            }

            // Perform merge (using basic merge for now)
            const mergeResult = await this.gitIntegration.gitUtils.mergeBranch(branchName);

            if (mergeResult.success) {
                timer(true, { branchName, targetBranch });

                this.eventEmitter.emit(SnapshotEvents.BRANCH_MERGED, {
                    sourceBranch: branchName,
                    targetBranch,
                    deleteAfterMerge,
                });

                // Delete source branch if requested
                if (deleteAfterMerge) {
                    await this.deleteSnapshotBranch(branchName, { force: false });
                }

                return { success: true, targetBranch };
            }

            timer(false, { error: mergeResult.error });
            return { success: false, error: mergeResult.error };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to merge branch ${branchName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a snapshot branch with safety checks
     * @param {string} branchName - Name of the branch to delete
     * @param {Object} options - Delete options
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteSnapshotBranch(branchName, options = {}) {
        const { force = false, confirmDangerous = false } = options;

        const timer = this.logger.createTimer('delete_snapshot_branch');

        try {
            this.logger.info(`Deleting snapshot branch: ${branchName}`);

            // Safety check - only delete snapshot branches
            if (!this.isSnapshotBranch(branchName) && !confirmDangerous) {
                timer(false, { error: 'not_snapshot_branch' });
                return {
                    success: false,
                    error: `Branch ${branchName} is not a snapshot branch. Set confirmDangerous=true to proceed.`,
                };
            }

            // Delete the branch
            const deleteResult = await this.gitIntegration.deleteBranch(branchName, {
                force,
                confirmDangerous,
            });

            if (deleteResult.success) {
                timer(true, { branchName });

                this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_BRANCH_DELETED, {
                    branchName,
                    force,
                });

                return { success: true };
            }

            timer(false, { error: deleteResult.error });
            return { success: false, error: deleteResult.error };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to delete branch ${branchName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a branch is a snapshot branch
     * @param {string} branchName - Branch name to check
     * @returns {boolean}
     */
    isSnapshotBranch(branchName) {
        if (!branchName) {
            return false;
        }

        return (
            branchName.startsWith(`${this.branchPrefix}/`) ||
            branchName.includes('snapshot') ||
            branchName.includes('synth-dev')
        );
    }

    /**
     * Clean up old snapshot branches based on age and activity
     * @param {Object} options - Cleanup options
     * @returns {Promise<{success: boolean, deletedBranches?: Array, skippedBranches?: Array, error?: string}>}
     */
    async cleanupOldBranches(options = {}) {
        const {
            maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days
            dryRun = false,
            onlyMerged = true,
        } = options;

        const timer = this.logger.createTimer('cleanup_old_branches');

        try {
            this.logger.info('Starting snapshot branch cleanup...');

            const deletedBranches = [];
            const skippedBranches = [];
            const now = Date.now();

            // Get all tracked branches
            for (const [branchName, metadata] of this.activeBranches.entries()) {
                const age = now - metadata.created;
                const isOld = age > maxAge;
                const isInactive = now - metadata.lastActivity > maxAge;

                if (isOld || isInactive) {
                    if (!dryRun) {
                        const deleteResult = await this.deleteSnapshotBranch(branchName, {
                            force: !onlyMerged,
                        });

                        if (deleteResult.success) {
                            deletedBranches.push({
                                name: branchName,
                                age: age,
                                reason: isOld ? 'age' : 'inactivity',
                            });
                        } else {
                            skippedBranches.push({
                                name: branchName,
                                reason: deleteResult.error,
                            });
                        }
                    } else {
                        deletedBranches.push({
                            name: branchName,
                            age: age,
                            reason: isOld ? 'age' : 'inactivity',
                            dryRun: true,
                        });
                    }
                } else {
                    skippedBranches.push({
                        name: branchName,
                        reason: 'too_recent',
                    });
                }
            }

            timer(true, {
                deleted: deletedBranches.length,
                skipped: skippedBranches.length,
            });

            this.logger.info(
                `Branch cleanup completed: ${deletedBranches.length} deleted, ${skippedBranches.length} skipped`
            );

            return {
                success: true,
                deletedBranches,
                skippedBranches,
            };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Branch cleanup failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get information about all tracked snapshot branches
     * @returns {Promise<{success: boolean, branches?: Array, error?: string}>}
     */
    async getBranchInfo() {
        try {
            const branches = [];
            const now = Date.now();

            for (const [branchName, metadata] of this.activeBranches.entries()) {
                branches.push({
                    name: branchName,
                    created: new Date(metadata.created).toISOString(),
                    lastActivity: new Date(metadata.lastActivity).toISOString(),
                    age: now - metadata.created,
                    commits: metadata.commits,
                    instruction: metadata.instruction,
                    isActive: now - metadata.lastActivity < 24 * 60 * 60 * 1000, // 24 hours
                });
            }

            // Sort by last activity (most recent first)
            branches.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

            return { success: true, branches };
        } catch (error) {
            this.logger.error(`Failed to get branch info: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get branch operation history
     * @param {Object} options - History options
     * @returns {Array}
     */
    getBranchHistory(options = {}) {
        const { limit = 50, operation = null } = options;

        let history = [...this.branchHistory];

        if (operation) {
            history = history.filter(record => record.operation === operation);
        }

        return history.slice(0, limit);
    }

    /**
     * Get status information for the branch manager
     * TODO: Implement proper Git branch status when Git functionality is ready
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            gitIntegration: this.gitIntegration ? this.gitIntegration.getStatus() : null,
            activeBranches: this.activeBranches.size,
            // TODO: Add more branch-specific status information when Git functionality is implemented
        };
    }
}
