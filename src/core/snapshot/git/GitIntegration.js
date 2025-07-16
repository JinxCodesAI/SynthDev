/**
 * Git Integration Layer for Snapshot System
 * Provides secure Git operations with validation, error handling, and retry mechanisms
 */

import GitUtils from '../../../utils/GitUtils.js';
import SnapshotLogger from '../utils/SnapshotLogger.js';
import SnapshotConfig from '../SnapshotConfig.js';
import SnapshotEventEmitter from '../events/SnapshotEventEmitter.js';
import { SnapshotEvents } from '../events/SnapshotEvents.js';

/**
 * Enhanced Git integration with security and validation
 */
export class GitIntegration {
    constructor(config = null, eventEmitter = null) {
        this.config = config || new SnapshotConfig();
        this.eventEmitter = eventEmitter || new SnapshotEventEmitter();
        this.logger = new SnapshotLogger('GitIntegration');
        this.gitUtils = new GitUtils();

        // Security and validation settings
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.commandTimeout = 30000; // 30 seconds
        this.allowedCommands = new Set([
            'status',
            'branch',
            'checkout',
            'add',
            'commit',
            'merge',
            'reset',
            'log',
            'show',
            'cat-file',
            'rev-parse',
        ]);

        // Repository state cache
        this.repoState = {
            isAvailable: null,
            isRepo: null,
            currentBranch: null,
            lastChecked: null,
            cacheTimeout: 5000, // 5 seconds
        };
    }

    /**
     * Initialize Git integration and validate repository state
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        const timer = this.logger.createTimer('git_initialization');

        try {
            this.logger.info('Initializing Git integration...');

            // Check Git availability and repository state
            const availability = await this.checkGitAvailability();
            if (!availability.success) {
                timer(false, { error: availability.error });
                return { success: false, error: availability.error };
            }

            // Validate repository configuration
            const validation = await this.validateRepositoryState();
            if (!validation.success) {
                timer(false, { error: validation.error });
                return { success: false, error: validation.error };
            }

            // Initialize branch tracking
            await this.updateRepositoryState();

            this.eventEmitter.emit(SnapshotEvents.GIT_INITIALIZED, {
                available: availability.available,
                isRepo: availability.isRepo,
                currentBranch: this.repoState.currentBranch,
            });

            timer(true);
            this.logger.info('Git integration initialized successfully');
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Git initialization failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check Git availability with enhanced validation
     * @returns {Promise<{success: boolean, available?: boolean, isRepo?: boolean, error?: string}>}
     */
    async checkGitAvailability() {
        try {
            const result = await this.gitUtils.checkGitAvailability();

            if (!result.available) {
                this.logger.warn('Git is not available on this system');
                return {
                    success: false,
                    available: false,
                    isRepo: false,
                    error: 'Git is not installed or not available in PATH',
                };
            }

            if (!result.isRepo) {
                this.logger.warn('Current directory is not a Git repository');
                return {
                    success: false,
                    available: true,
                    isRepo: false,
                    error: 'Current directory is not a Git repository',
                };
            }

            return {
                success: true,
                available: true,
                isRepo: true,
            };
        } catch (error) {
            this.logger.error(`Git availability check failed: ${error.message}`);
            return {
                success: false,
                available: false,
                isRepo: false,
                error: error.message,
            };
        }
    }

    /**
     * Validate repository state and configuration
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async validateRepositoryState() {
        try {
            // Check for uncommitted changes
            const statusResult = await this.gitUtils.getStatus();
            if (!statusResult.success) {
                return {
                    success: false,
                    error: `Failed to get repository status: ${statusResult.error}`,
                };
            }

            // Get current branch
            const branchResult = await this.gitUtils.getCurrentBranch();
            if (!branchResult.success) {
                return {
                    success: false,
                    error: `Failed to get current branch: ${branchResult.error}`,
                };
            }

            // Validate branch name format
            if (!this.isValidBranchName(branchResult.branch)) {
                this.logger.warn(`Current branch name may cause issues: ${branchResult.branch}`);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Update cached repository state
     * @returns {Promise<void>}
     */
    async updateRepositoryState() {
        try {
            const availability = await this.gitUtils.checkGitAvailability();
            const branchResult = await this.gitUtils.getCurrentBranch();

            this.repoState = {
                isAvailable: availability.available,
                isRepo: availability.isRepo,
                currentBranch: branchResult.success ? branchResult.branch : null,
                lastChecked: Date.now(),
                cacheTimeout: this.repoState.cacheTimeout,
            };
        } catch (error) {
            this.logger.error(`Failed to update repository state: ${error.message}`);
        }
    }

    /**
     * Get cached repository state with automatic refresh
     * @returns {Promise<Object>}
     */
    async getRepositoryState() {
        const now = Date.now();

        if (
            !this.repoState.lastChecked ||
            now - this.repoState.lastChecked > this.repoState.cacheTimeout
        ) {
            await this.updateRepositoryState();
        }

        return { ...this.repoState };
    }

    /**
     * Validate branch name format
     * @param {string} branchName - Branch name to validate
     * @returns {boolean}
     */
    isValidBranchName(branchName) {
        if (!branchName || typeof branchName !== 'string') {
            return false;
        }

        // Git branch name rules
        const invalidPatterns = [
            /^\./, // Cannot start with dot
            /\.\.|@@|\s/, // Cannot contain .. or @@ or spaces
            //eslint-disable-next-line no-useless-escape
            /[~^:?*[\]\\\/]/, // Cannot contain special characters including /
            /\/$/, // Cannot end with slash
            /\.lock$/, // Cannot end with .lock
        ];

        return !invalidPatterns.some(pattern => pattern.test(branchName));
    }

    /**
     * Sanitize branch name for Git compatibility
     * @param {string} branchName - Branch name to sanitize
     * @returns {string}
     */
    sanitizeBranchName(branchName) {
        if (!branchName) {
            return 'snapshot-branch';
        }

        return (
            branchName
                //eslint-disable-next-line no-useless-escape
                .replace(/[~^:?*[\]\\\/]/g, '-') // Replace invalid characters including /
                .replace(/\.\./g, '-') // Replace double dots
                .replace(/@@/g, '-') // Replace double at signs
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/^\.+/, '') // Remove leading dots
                .replace(/\.lock$/, '') // Remove .lock suffix
                .replace(/\/$/, '') // Remove trailing slash
                .replace(/-+/g, '-') // Collapse multiple hyphens
                .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
                .substring(0, 100) || // Limit length
            'snapshot-branch'
        ); // Fallback if empty
    }

    /**
     * Execute Git command with retry mechanism and validation
     * @param {string} operation - Operation name for logging
     * @param {Function} gitOperation - Git operation function
     * @param {Object} options - Execution options
     * @returns {Promise<{success: boolean, result?: any, error?: string}>}
     */
    async executeWithRetry(operation, gitOperation, options = {}) {
        const { maxRetries = this.maxRetries, retryDelay = this.retryDelay } = options;
        const timer = this.logger.createTimer(`git_${operation}`);

        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.debug(
                    `Executing Git operation: ${operation} (attempt ${attempt}/${maxRetries})`
                );

                const result = await gitOperation();

                if (result.success) {
                    timer(true, { attempt });
                    this.eventEmitter.emit(SnapshotEvents.GIT_OPERATION_SUCCESS, {
                        operation,
                        attempt,
                        result,
                    });
                    return { success: true, result };
                }

                lastError = result.error || 'Unknown error';
                this.logger.warn(
                    `Git operation ${operation} failed (attempt ${attempt}): ${lastError}`
                );
            } catch (error) {
                lastError = error.message;
                this.logger.error(
                    `Git operation ${operation} threw error (attempt ${attempt}): ${lastError}`
                );
            }

            // Wait before retry (except on last attempt)
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        timer(false, { error: lastError, attempts: maxRetries });
        this.eventEmitter.emit(SnapshotEvents.GIT_OPERATION_FAILED, {
            operation,
            error: lastError,
            attempts: maxRetries,
        });

        return { success: false, error: lastError };
    }

    /**
     * Create a new branch with validation and safety checks
     * @param {string} branchName - Name of the branch to create
     * @param {Object} options - Creation options
     * @returns {Promise<{success: boolean, branchName?: string, error?: string}>}
     */
    async createBranch(branchName, options = {}) {
        const { force = false } = options;

        try {
            // Sanitize branch name
            const sanitizedName = this.sanitizeBranchName(branchName);

            // Validate branch name
            if (!this.isValidBranchName(sanitizedName)) {
                return { success: false, error: `Invalid branch name: ${sanitizedName}` };
            }

            // Check if branch already exists
            const branchExists = await this.branchExists(sanitizedName);
            if (branchExists.success && branchExists.exists && !force) {
                return { success: false, error: `Branch ${sanitizedName} already exists` };
            }

            // Create branch with retry mechanism
            const result = await this.executeWithRetry('create_branch', async () => {
                return await this.gitUtils.createBranch(sanitizedName);
            });

            if (result.success) {
                this.logger.info(`Created branch: ${sanitizedName}`);
                await this.updateRepositoryState();

                this.eventEmitter.emit(SnapshotEvents.BRANCH_CREATED, {
                    branchName: sanitizedName,
                    originalName: branchName,
                });

                return { success: true, branchName: sanitizedName };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to create branch ${branchName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch to a branch with safety checks
     * @param {string} branchName - Name of the branch to switch to
     * @param {Object} options - Switch options
     * @returns {Promise<{success: boolean, previousBranch?: string, error?: string}>}
     */
    async switchBranch(branchName, options = {}) {
        const { stashChanges = true } = options;

        try {
            // Get current branch for rollback
            const currentState = await this.getRepositoryState();
            const previousBranch = currentState.currentBranch;

            // Check for uncommitted changes
            const statusResult = await this.gitUtils.getStatus();
            if (statusResult.success && statusResult.hasChanges && stashChanges) {
                this.logger.warn(
                    'Uncommitted changes detected, consider stashing before branch switch'
                );
            }

            // Switch branch with retry mechanism
            const result = await this.executeWithRetry('switch_branch', async () => {
                return await this.gitUtils.switchBranch(branchName);
            });

            if (result.success) {
                this.logger.info(`Switched to branch: ${branchName}`);
                await this.updateRepositoryState();

                this.eventEmitter.emit(SnapshotEvents.BRANCH_SWITCHED, {
                    branchName,
                    previousBranch,
                });

                return { success: true, previousBranch };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to switch to branch ${branchName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a branch exists
     * @param {string} branchName - Name of the branch to check
     * @returns {Promise<{success: boolean, exists?: boolean, error?: string}>}
     */
    async branchExists(branchName) {
        try {
            const result = await this.executeWithRetry('check_branch_exists', async () => {
                // Use git show-ref to check if branch exists
                const showRefResult = await this.gitUtils.gitUtils?.executeTerminal?.({
                    command: `git show-ref --verify --quiet refs/heads/${branchName}`,
                });

                // If command succeeds, branch exists
                return { success: showRefResult?.success || false };
            });

            return {
                success: true,
                exists: result.success && result.result?.success,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Add files to staging area with validation
     * @param {string[]} filePaths - Array of file paths to add
     * @param {Object} options - Add options
     * @returns {Promise<{success: boolean, addedFiles?: string[], error?: string}>}
     */
    async addFiles(filePaths, options = {}) {
        const { validatePaths = true } = options;

        try {
            if (!Array.isArray(filePaths) || filePaths.length === 0) {
                return { success: false, error: 'No files specified to add' };
            }

            // Validate file paths if requested
            if (validatePaths) {
                const invalidPaths = filePaths.filter(path => !this.isValidFilePath(path));
                if (invalidPaths.length > 0) {
                    return {
                        success: false,
                        error: `Invalid file paths: ${invalidPaths.join(', ')}`,
                    };
                }
            }

            // Add files with retry mechanism
            const result = await this.executeWithRetry('add_files', async () => {
                return await this.gitUtils.addFiles(filePaths);
            });

            if (result.success) {
                this.logger.info(`Added ${filePaths.length} files to staging area`);

                this.eventEmitter.emit(SnapshotEvents.FILES_STAGED, {
                    files: filePaths,
                    count: filePaths.length,
                });

                return { success: true, addedFiles: filePaths };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to add files: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate file path for security
     * @param {string} filePath - File path to validate
     * @returns {boolean}
     */
    isValidFilePath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        // Security checks
        const dangerousPatterns = [
            /\.\./, // Directory traversal
            /^\//, // Absolute paths
            /[<>:"|?*]/, // Invalid filename characters
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
        ];

        return !dangerousPatterns.some(pattern => pattern.test(filePath));
    }

    /**
     * Commit changes with enhanced message formatting
     * @param {string} message - Commit message
     * @param {Object} options - Commit options
     * @returns {Promise<{success: boolean, commitHash?: string, error?: string}>}
     */
    async commit(message, options = {}) {
        const { allowEmpty = false } = options;

        try {
            if (!message || typeof message !== 'string') {
                return { success: false, error: 'Commit message is required' };
            }

            // Sanitize commit message
            const sanitizedMessage = this.sanitizeCommitMessage(message);

            // Check if there are changes to commit
            if (!allowEmpty) {
                const statusResult = await this.gitUtils.getStatus();
                if (statusResult.success && !statusResult.hasChanges) {
                    return { success: false, error: 'No changes to commit' };
                }
            }

            // Commit with retry mechanism
            const result = await this.executeWithRetry('commit', async () => {
                return await this.gitUtils.commit(sanitizedMessage);
            });

            if (result.success) {
                // Get the commit hash
                const branchResult = await this.gitUtils.getCurrentBranch();
                const commitResult = await this.gitUtils.getCommitHistory(1);

                const commitHash =
                    commitResult.success && commitResult.commits.length > 0
                        ? commitResult.commits[0].hash
                        : null;

                this.logger.info(`Created commit: ${commitHash?.substring(0, 7) || 'unknown'}`);

                this.eventEmitter.emit(SnapshotEvents.COMMIT_CREATED, {
                    message: sanitizedMessage,
                    hash: commitHash,
                    branch: branchResult.success ? branchResult.branch : null,
                });

                return { success: true, commitHash };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to commit: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sanitize commit message for security and formatting
     * @param {string} message - Raw commit message
     * @returns {string}
     */
    sanitizeCommitMessage(message) {
        if (!message) {
            return 'Empty commit message';
        }

        //TODO: Add lint ignore for rule no-control-regex
        // Remove control characters
        return (
            message
                // eslint-disable-next-line no-control-regex
                .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove control characters
                .replace(/\r\n/g, '\n') // Normalize line endings
                .replace(/\r/g, '\n') // Convert CR to LF
                .trim()
                .substring(0, 2000) || // Limit message length
            'Empty commit message'
        );
    }

    /**
     * Get repository status with enhanced information
     * @returns {Promise<{success: boolean, status?: Object, error?: string}>}
     */
    async getStatus() {
        try {
            const result = await this.executeWithRetry('get_status', async () => {
                return await this.gitUtils.getStatus();
            });

            if (result.success) {
                const statusInfo = {
                    hasChanges: result.result.hasChanges,
                    rawStatus: result.result.status,
                    files: this.parseGitStatus(result.result.status),
                    timestamp: new Date().toISOString(),
                };

                return { success: true, status: statusInfo };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to get status: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse Git status output into structured format
     * @param {string} statusOutput - Raw git status --porcelain output
     * @returns {Array}
     */
    parseGitStatus(statusOutput) {
        if (!statusOutput) {
            return [];
        }

        return statusOutput
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const status = line.substring(0, 2);
                const filePath = line.substring(3);

                return {
                    path: filePath,
                    status: status,
                    staged: status[0] !== ' ' && status[0] !== '?',
                    modified: status[1] !== ' ',
                    untracked: status === '??',
                };
            });
    }

    /**
     * Reset repository to a specific commit with safety checks
     * @param {string} commitHash - Hash of the commit to reset to
     * @param {Object} options - Reset options
     * @returns {Promise<{success: boolean, previousHead?: string, error?: string}>}
     */
    async resetToCommit(commitHash, options = {}) {
        const { hard = true, confirmDangerous = false } = options;

        try {
            if (!commitHash) {
                return { success: false, error: 'Commit hash is required' };
            }

            // Validate commit hash format
            if (!/^[a-f0-9]{7,40}$/i.test(commitHash)) {
                return { success: false, error: 'Invalid commit hash format' };
            }

            // Check if commit exists
            const commitExists = await this.gitUtils.commitExists(commitHash);
            if (!commitExists.success || !commitExists.exists) {
                return { success: false, error: `Commit ${commitHash} does not exist` };
            }

            // Safety check for hard reset
            if (hard && !confirmDangerous) {
                const statusResult = await this.gitUtils.getStatus();
                if (statusResult.success && statusResult.hasChanges) {
                    return {
                        success: false,
                        error: 'Hard reset would lose uncommitted changes. Set confirmDangerous=true to proceed.',
                    };
                }
            }

            // Get current HEAD for rollback information
            const currentBranch = await this.gitUtils.getCurrentBranch();
            const currentCommits = await this.gitUtils.getCommitHistory(1);
            const previousHead =
                currentCommits.success && currentCommits.commits.length > 0
                    ? currentCommits.commits[0].hash
                    : null;

            // Perform reset with retry mechanism
            const result = await this.executeWithRetry('reset_to_commit', async () => {
                return await this.gitUtils.resetToCommit(commitHash);
            });

            if (result.success) {
                this.logger.info(`Reset to commit: ${commitHash}`);
                await this.updateRepositoryState();

                this.eventEmitter.emit(SnapshotEvents.REPOSITORY_RESET, {
                    commitHash,
                    previousHead,
                    branch: currentBranch.success ? currentBranch.branch : null,
                });

                return { success: true, previousHead };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to reset to commit ${commitHash}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get commit history with enhanced information
     * @param {Object} options - History options
     * @returns {Promise<{success: boolean, commits?: Array, error?: string}>}
     */
    async getCommitHistory(options = {}) {
        const { limit = 20 } = options;

        try {
            const result = await this.executeWithRetry('get_commit_history', async () => {
                return await this.gitUtils.getCommitHistory(limit);
            });

            if (result.success) {
                const commits = result.result.commits.map(commit => ({
                    ...commit,
                    isSnapshot: this.isSnapshotCommit(commit.subject),
                    timestamp: new Date(commit.date).getTime(),
                }));

                return { success: true, commits };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to get commit history: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a commit is a snapshot commit
     * @param {string} commitMessage - Commit message to check
     * @returns {boolean}
     */
    isSnapshotCommit(commitMessage) {
        if (!commitMessage) {
            return false;
        }

        const snapshotPatterns = [
            /^Snapshot:/i,
            /^SynthDev Snapshot:/i,
            /\[SNAPSHOT\]/i,
            /automated snapshot/i,
        ];

        return snapshotPatterns.some(pattern => pattern.test(commitMessage));
    }

    /**
     * Delete a branch with safety checks
     * @param {string} branchName - Name of the branch to delete
     * @param {Object} options - Delete options
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteBranch(branchName, options = {}) {
        const { force = false, confirmDangerous = false } = options;

        try {
            if (!branchName) {
                return { success: false, error: 'Branch name is required' };
            }

            // Safety check - don't delete current branch
            const currentState = await this.getRepositoryState();
            if (currentState.currentBranch === branchName) {
                return { success: false, error: 'Cannot delete current branch' };
            }

            // Safety check - don't delete main branches without confirmation
            const protectedBranches = ['main', 'master', 'develop', 'dev'];
            if (protectedBranches.includes(branchName) && !confirmDangerous) {
                return {
                    success: false,
                    error: `Branch ${branchName} is protected. Set confirmDangerous=true to proceed.`,
                };
            }

            // Delete branch with retry mechanism
            const result = await this.executeWithRetry('delete_branch', async () => {
                return await this.gitUtils.deleteBranch(branchName, force);
            });

            if (result.success) {
                this.logger.info(`Deleted branch: ${branchName}`);

                this.eventEmitter.emit(SnapshotEvents.BRANCH_DELETED, {
                    branchName,
                    force,
                });

                return { success: true };
            }

            return { success: false, error: result.error };
        } catch (error) {
            this.logger.error(`Failed to delete branch ${branchName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate a snapshot-specific branch name
     * @param {string} instruction - User instruction
     * @param {Object} options - Generation options
     * @returns {string}
     */
    generateSnapshotBranchName(instruction, options = {}) {
        const { prefix = 'synth-dev', includeTimestamp = true } = options;

        let branchName = this.gitUtils.generateBranchName(instruction);

        // Ensure it starts with our prefix
        if (!branchName.startsWith(`${prefix}/`)) {
            const timestamp = includeTimestamp
                ? new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
                : '';

            const safeName = instruction
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .slice(0, 30);

            branchName = `${prefix}/${timestamp}-${safeName}`;
        }

        return this.sanitizeBranchName(branchName);
    }

    /**
     * Clean up old snapshot branches
     * @param {Object} options - Cleanup options
     * @returns {Promise<{success: boolean, deletedBranches?: Array, error?: string}>}
     */
    async cleanupSnapshotBranches(_options = {}) {
        // 7 days default

        try {
            // This would require additional Git commands to list branches with dates
            // For now, return a placeholder implementation
            this.logger.info('Snapshot branch cleanup requested');

            return {
                success: true,
                deletedBranches: [],
                message: 'Branch cleanup not yet implemented',
            };
        } catch (error) {
            this.logger.error(`Failed to cleanup snapshot branches: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
