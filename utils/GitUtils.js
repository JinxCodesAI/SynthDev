/**
 * Git Utilities
 * Provides Git operations using the existing ExecuteTerminalTool
 */

import executeTerminal from '../tools/execute_terminal/implementation.js';
import { getLogger } from '../logger.js';

class GitUtils {
    constructor() {
        this.logger = getLogger();
    }

    /**
     * Check if Git is available and the current directory is a Git repository
     * @returns {Promise<{available: boolean, isRepo: boolean, error?: string}>}
     */
    async checkGitAvailability() {
        try {
            // Check if git command is available
            const gitVersionResult = await executeTerminal({ command: 'git --version' });
            if (!gitVersionResult.success) {
                return { available: false, isRepo: false, error: 'Git command not found' };
            }

            // Check if current directory is a git repository
            const gitStatusResult = await executeTerminal({ command: 'git status --porcelain' });
            if (!gitStatusResult.success) {
                // Check if it's a "not a git repository" error
                if (
                    gitStatusResult.stderr &&
                    gitStatusResult.stderr.includes('not a git repository')
                ) {
                    return { available: true, isRepo: false, error: 'Not a Git repository' };
                }
                return {
                    available: true,
                    isRepo: false,
                    error: gitStatusResult.error || 'Git status failed',
                };
            }

            return { available: true, isRepo: true };
        } catch (error) {
            return { available: false, isRepo: false, error: error.message };
        }
    }

    /**
     * Get the current Git branch name
     * @returns {Promise<{success: boolean, branch?: string, error?: string}>}
     */
    async getCurrentBranch() {
        try {
            const result = await executeTerminal({ command: 'git branch --show-current' });
            if (result.success) {
                return { success: true, branch: result.stdout.trim() };
            }
            return { success: false, error: result.error || 'Failed to get current branch' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new Git branch
     * @param {string} branchName - Name of the branch to create
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async createBranch(branchName) {
        try {
            const result = await executeTerminal({ command: `git checkout -b "${branchName}"` });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to create branch' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch to a Git branch
     * @param {string} branchName - Name of the branch to switch to
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async switchBranch(branchName) {
        try {
            const result = await executeTerminal({ command: `git checkout "${branchName}"` });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to switch branch' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Add files to Git staging area
     * @param {string[]} filePaths - Array of file paths to add
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async addFiles(filePaths) {
        try {
            const filesArg = filePaths.map(path => `"${path}"`).join(' ');
            const result = await executeTerminal({ command: `git add ${filesArg}` });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to add files' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Commit changes to Git
     * @param {string} message - Commit message (can be multi-line)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async commit(message) {
        try {
            // Handle multi-line messages by splitting and using multiple -m flags
            const lines = message.split('\n');
            const commitArgs = lines.map(line => `-m "${line.replace(/"/g, '\\"')}"`).join(' ');
            const result = await executeTerminal({ command: `git commit ${commitArgs}` });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to commit changes' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get Git status
     * @returns {Promise<{success: boolean, status?: string, hasChanges?: boolean, error?: string}>}
     */
    async getStatus() {
        try {
            const result = await executeTerminal({ command: 'git status --porcelain' });
            if (result.success) {
                const hasChanges = result.stdout.trim().length > 0;
                return { success: true, status: result.stdout, hasChanges };
            }
            return { success: false, error: result.error || 'Failed to get Git status' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Merge a branch into the current branch
     * @param {string} branchName - Name of the branch to merge
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async mergeBranch(branchName) {
        try {
            const result = await executeTerminal({ command: `git merge "${branchName}"` });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to merge branch' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate a safe branch name from user instruction
     * @param {string} instruction - User instruction
     * @returns {string} Safe branch name
     */
    generateBranchName(instruction) {
        // Create a safe branch name from the instruction
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const safeName = instruction
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .slice(0, 30); // Limit length

        return `synth-dev/${timestamp}-${safeName}`;
    }

    /**
     * Check if there are uncommitted changes
     * @returns {Promise<{success: boolean, hasUncommittedChanges?: boolean, error?: string}>}
     */
    async hasUncommittedChanges() {
        try {
            const statusResult = await this.getStatus();
            if (statusResult.success) {
                return { success: true, hasUncommittedChanges: statusResult.hasChanges };
            }
            return { success: false, error: statusResult.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get commit history for the current branch
     * @param {number} limit - Maximum number of commits to retrieve
     * @returns {Promise<{success: boolean, commits?: Array, error?: string}>}
     */
    async getCommitHistory(limit = 20) {
        try {
            const result = await executeTerminal({
                command: `git log --oneline --format="%H|%s|%ai|%an" -n ${limit}`,
            });
            if (result.success) {
                const commits = result.stdout
                    .trim()
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const [hash, subject, date, author] = line.split('|');
                        return {
                            hash: hash.trim(),
                            subject: subject.trim(),
                            date: date.trim(),
                            author: author.trim(),
                            shortHash: hash.trim().substring(0, 7),
                        };
                    });
                return { success: true, commits };
            }
            return { success: false, error: result.error || 'Failed to get commit history' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Reset to a specific commit (hard reset)
     * @param {string} commitHash - Hash of the commit to reset to
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async resetToCommit(commitHash) {
        try {
            const result = await executeTerminal({ command: `git reset --hard "${commitHash}"` });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to reset to commit' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get details of a specific commit
     * @param {string} commitHash - Hash of the commit
     * @returns {Promise<{success: boolean, commit?: Object, error?: string}>}
     */
    async getCommitDetails(commitHash) {
        try {
            const result = await executeTerminal({
                command: `git show --name-only --format="%H|%s|%ai|%an|%B" "${commitHash}"`,
            });
            if (result.success) {
                const lines = result.stdout.trim().split('\n');
                const [hash, subject, date, author, ...rest] = lines[0].split('|');

                // Find where the commit message ends and file list begins
                let messageEndIndex = 1;
                while (messageEndIndex < lines.length && lines[messageEndIndex].trim() !== '') {
                    messageEndIndex++;
                }

                const message = lines.slice(1, messageEndIndex).join('\n').trim();
                const files = lines.slice(messageEndIndex + 1).filter(line => line.trim());

                return {
                    success: true,
                    commit: {
                        hash: hash.trim(),
                        shortHash: hash.trim().substring(0, 7),
                        subject: subject.trim(),
                        date: date.trim(),
                        author: author.trim(),
                        message: message,
                        files: files,
                    },
                };
            }
            return { success: false, error: result.error || 'Failed to get commit details' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a commit exists
     * @param {string} commitHash - Hash of the commit to check
     * @returns {Promise<{success: boolean, exists?: boolean, error?: string}>}
     */
    async commitExists(commitHash) {
        try {
            const result = await executeTerminal({ command: `git cat-file -e "${commitHash}"` });
            return { success: true, exists: result.success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a Git branch
     * @param {string} branchName - Name of the branch to delete
     * @param {boolean} force - Whether to force delete the branch (default: false)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteBranch(branchName, force = false) {
        try {
            const forceFlag = force ? '-D' : '-d';
            const result = await executeTerminal({
                command: `git branch ${forceFlag} "${branchName}"`,
            });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error || 'Failed to delete branch' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

export default GitUtils;
