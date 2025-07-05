/**
 * Snapshots Command
 * Manages code checkpoints and allows reverting AI changes
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../core/managers/logger.js';

export class SnapshotsCommand extends InteractiveCommand {
    constructor() {
        super('snapshots', 'Manage code checkpoints, revert AI changes');
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['snapshotManager', ...super.getRequiredDependencies()];
    }

    /**
     * Execute the snapshots command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { snapshotManager } = context;

        const snapshots = await snapshotManager.getSnapshotSummaries();
        const logger = getLogger();

        if (snapshots.length === 0) {
            logger.raw('\n📸 No snapshots available');
            logger.raw(
                '💡 Snapshots are automatically created when you give new instructions to the AI\n'
            );
            return true;
        }

        while (true) {
            logger.raw('\n📸 Available Snapshots:');
            logger.raw('═'.repeat(80));

            // Show Git status if available
            const gitStatus = snapshotManager.getGitStatus();
            if (gitStatus.gitAvailable && gitStatus.isGitRepo) {
                logger.raw(`🌿 Git Status: ${gitStatus.gitMode ? 'Active' : 'Available'}`);
                if (gitStatus.originalBranch) {
                    logger.raw(`   Original branch: ${gitStatus.originalBranch}`);
                }
                if (gitStatus.featureBranch) {
                    logger.raw(`   Feature branch: ${gitStatus.featureBranch}`);
                }
                logger.raw();
            }

            snapshots.forEach((snapshot, _index) => {
                const date = new Date(snapshot.timestamp).toLocaleString();
                const instructionPreview =
                    snapshot.instruction.length > 60
                        ? `${snapshot.instruction.substring(0, 60)}...`
                        : snapshot.instruction;

                logger.raw(`${snapshot.id}. [${date}] ${instructionPreview}`);

                if (snapshot.isGitCommit) {
                    logger.raw(`   🔗 Git: ${snapshot.shortHash} | Author: ${snapshot.author}`);
                } else {
                    logger.raw(
                        `   📁 Files: ${snapshot.fileCount} | Modified: ${snapshot.modifiedFiles.join(', ')}`
                    );
                }
                logger.raw();
            });

            logger.raw('Commands:');
            logger.raw('  [number] - View detailed snapshot info');
            logger.raw('  r[number] - Restore snapshot (e.g., r1)');
            if (gitStatus.gitMode) {
                logger.raw('  🔗 Git mode: Restore uses git reset to commit');
                logger.raw('  m - Merge feature branch to original branch');
                logger.raw('  s - Switch back to original branch (without merge)');
            } else {
                logger.raw('  d[number] - Delete snapshot (e.g., d1)');
                logger.raw('  c - Clear all snapshots');
            }
            logger.raw('  q - Quit snapshots view');
            logger.raw();

            const input = await this.promptForInput('snapshots> ', context);
            const trimmed = input.trim().toLowerCase();

            if (trimmed === 'q' || trimmed === 'quit') {
                break;
            } else if (trimmed === 'c' || trimmed === 'clear') {
                const gitStatus = snapshotManager.getGitStatus();
                if (gitStatus.gitMode) {
                    logger.raw('❌ Clear snapshots is not supported in Git mode.');
                    logger.raw('💡 Use Git commands to manage commit history if needed.');
                } else {
                    const confirmed = await this.promptForConfirmation(
                        'Are you sure you want to clear all snapshots? This cannot be undone.',
                        context
                    );
                    if (confirmed) {
                        snapshotManager.clearAllSnapshots();
                        logger.raw('🧹 All snapshots cleared');
                        break;
                    }
                }
            } else if (trimmed === 'm' || trimmed === 'merge') {
                await this.mergeFeatureBranch(context);
            } else if (trimmed === 's' || trimmed === 'switch') {
                await this.switchToOriginalBranch(context);
            } else if (trimmed.startsWith('r') && trimmed.length > 1) {
                const snapshotId = parseInt(trimmed.substring(1));
                if (!isNaN(snapshotId)) {
                    await this.restoreSnapshot(snapshotId, context);
                } else {
                    logger.raw('❌ Invalid snapshot ID');
                }
            } else if (trimmed.startsWith('d') && trimmed.length > 1) {
                const snapshotId = parseInt(trimmed.substring(1));
                if (!isNaN(snapshotId)) {
                    await this.deleteSnapshot(snapshotId, context);
                } else {
                    logger.raw('❌ Invalid snapshot ID');
                }
            } else if (!isNaN(parseInt(trimmed))) {
                const snapshotId = parseInt(trimmed);
                await this.showSnapshotDetail(snapshotId, context);
            } else {
                logger.raw('❌ Invalid command. Use q to quit, or see commands above.');
            }
        }

        return true;
    }

    /**
     * Show detailed information about a specific snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} context - Execution context
     */
    async showSnapshotDetail(snapshotId, context) {
        const { snapshotManager } = context;
        const snapshot = await snapshotManager.getSnapshot(snapshotId);
        const logger = getLogger();

        if (!snapshot) {
            logger.raw(`❌ Snapshot ${snapshotId} not found`);
            return;
        }

        const date = new Date(snapshot.timestamp).toLocaleString();
        logger.raw(`\n📸 Snapshot ${snapshot.id} Details:`);
        logger.raw('─'.repeat(50));
        logger.raw(`🕒 Created: ${date}`);
        logger.raw(`📝 Instruction: ${snapshot.instruction}`);

        if (snapshot.isGitCommit) {
            logger.raw(`🔗 Git Hash: ${snapshot.gitHash}`);
            logger.raw(`👤 Author: ${snapshot.author}`);
            if (snapshot.message) {
                logger.raw(`💬 Message: ${snapshot.message}`);
            }
            if (snapshot.files && snapshot.files.length > 0) {
                logger.raw(`📁 Files changed: ${snapshot.files.length}`);
                logger.raw('\n📂 Changed files:');
                snapshot.files.forEach(file => logger.raw(`   - ${file}`));
            }
        } else {
            logger.raw(`📁 Files backed up: ${Object.keys(snapshot.files).length}`);
            if (Object.keys(snapshot.files).length > 0) {
                logger.raw('\n📂 Backed up files:');
                for (const filePath of Object.keys(snapshot.files)) {
                    logger.raw(`   - ${filePath}`);
                }
            }
        }
        logger.raw();
    }

    /**
     * Restore a snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} context - Execution context
     */
    async restoreSnapshot(snapshotId, context) {
        const { snapshotManager } = context;
        const gitStatus = snapshotManager.getGitStatus();
        const logger = getLogger();

        if (gitStatus.gitMode) {
            // Git mode - confirm git reset operation
            const summaries = await snapshotManager.getSnapshotSummaries();
            const snapshot = summaries.find(s => s.id === snapshotId);

            if (!snapshot) {
                logger.raw(`❌ Snapshot ${snapshotId} not found`);
                return;
            }

            const confirmMessage =
                `Reset to Git commit ${snapshot.shortHash}?\n` +
                `  🔗 Commit: ${snapshot.instruction}\n` +
                '  ⚠️  This will discard all changes after this commit!';

            const confirmed = await this.promptForConfirmation(confirmMessage, context);

            if (!confirmed) {
                logger.raw('❌ Reset cancelled');
                return;
            }

            logger.raw(`🔄 Resetting to commit ${snapshot.shortHash}...`);
            const result = await snapshotManager.restoreSnapshot(snapshotId);

            if (result.success) {
                logger.raw(`✅ Successfully reset to commit ${result.shortHash}`);
                logger.raw(`   🔗 ${result.instruction}`);
                logger.raw(`   📝 ${result.message}`);
            } else {
                logger.raw(`❌ Reset failed: ${result.error}`);
            }
        } else {
            // Legacy mode - file-based restoration
            const snapshot = await snapshotManager.getSnapshot(snapshotId);

            if (!snapshot) {
                logger.raw(`❌ Snapshot ${snapshotId} not found`);
                return;
            }

            // Separate files that existed vs didn't exist in the snapshot
            const existingFiles = [];
            const nonExistentFiles = [];

            for (const [filePath, content] of Object.entries(snapshot.files)) {
                if (content === null) {
                    nonExistentFiles.push(filePath);
                } else {
                    existingFiles.push(filePath);
                }
            }

            let confirmMessage = `Restore snapshot ${snapshotId}?`;
            if (existingFiles.length > 0) {
                confirmMessage += `\n  📄 Will restore: ${existingFiles.join(', ')}`;
            }
            if (nonExistentFiles.length > 0) {
                confirmMessage += `\n  🗑️ Will delete: ${nonExistentFiles.join(', ')} (didn't exist in snapshot)`;
            }

            const confirmed = await this.promptForConfirmation(confirmMessage, context);

            if (!confirmed) {
                logger.raw('❌ Restore cancelled');
                return;
            }

            logger.raw(`🔄 Restoring snapshot ${snapshotId}...`);
            const result = await snapshotManager.restoreSnapshot(snapshotId);

            if (result.success) {
                logger.raw(`✅ Successfully restored snapshot ${snapshotId}:`);
                if (result.restoredFiles && result.restoredFiles.length > 0) {
                    logger.raw(`   📄 Restored ${result.restoredFiles.length} files:`);
                    result.restoredFiles.forEach(file => logger.raw(`      ✓ ${file}`));
                }
                if (result.deletedFiles && result.deletedFiles.length > 0) {
                    logger.raw(
                        `   🗑️ Deleted ${result.deletedFiles.length} files (didn't exist in snapshot):`
                    );
                    result.deletedFiles.forEach(file => logger.raw(`      ✗ ${file}`));
                }
            } else {
                logger.raw('❌ Restore completed with errors:');
                if (result.restoredFiles) {
                    logger.raw(`   ✓ Restored: ${result.restoredFiles.length} files`);
                }
                if (result.deletedFiles && result.deletedFiles.length > 0) {
                    logger.raw(`   🗑️ Deleted: ${result.deletedFiles.length} files`);
                }
                if (result.errors) {
                    logger.raw(`   ❌ Errors: ${result.errors.length}`);
                    result.errors.forEach(error => logger.raw(`      - ${error}`));
                }
            }
        }
    }

    /**
     * Delete a snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} context - Execution context
     */
    async deleteSnapshot(snapshotId, context) {
        const { snapshotManager } = context;
        const gitStatus = snapshotManager.getGitStatus();
        const logger = getLogger();

        if (gitStatus.gitMode) {
            logger.raw('❌ Snapshot deletion is not supported in Git mode.');
            logger.raw('💡 Use Git commands to manage commit history if needed.');
            return;
        }

        const snapshot = await snapshotManager.getSnapshot(snapshotId);

        if (!snapshot) {
            logger.raw(`❌ Snapshot ${snapshotId} not found`);
            return;
        }

        const confirmed = await this.promptForConfirmation(
            `Delete snapshot ${snapshotId}? This cannot be undone.`,
            context
        );

        if (!confirmed) {
            logger.raw('❌ Delete cancelled');
            return;
        }

        const result = await snapshotManager.deleteSnapshot(snapshotId);
        if (result.success) {
            logger.raw(`🗑️ Snapshot ${snapshotId} deleted`);
        } else {
            logger.raw(`❌ Failed to delete snapshot ${snapshotId}: ${result.error}`);
        }
    }

    /**
     * Merge feature branch to original branch
     * @param {Object} context - Execution context
     */
    async mergeFeatureBranch(context) {
        const { snapshotManager } = context;
        const logger = getLogger();
        const gitStatus = snapshotManager.getGitStatus();

        if (!gitStatus.gitMode) {
            logger.raw('❌ Not in Git mode. No feature branch to merge.');
            return;
        }

        const confirmed = await this.promptForConfirmation(
            `Merge feature branch "${gitStatus.featureBranch}" into "${gitStatus.originalBranch}"?`,
            context
        );

        if (!confirmed) {
            logger.raw('❌ Merge cancelled');
            return;
        }

        logger.raw('🔄 Merging feature branch...');
        const result = await snapshotManager.mergeFeatureBranch();

        if (result.success) {
            logger.user(
                `✅ Successfully merged ${gitStatus.featureBranch} into ${gitStatus.originalBranch}`,
                '🔀 Git:'
            );
            logger.user('🌿 Switched back to original branch', '🔀 Git:');
        } else {
            logger.error(`Merge failed: ${result.error}`, 'Git merge');
        }
    }

    /**
     * Switch back to original branch without merging
     * @param {Object} context - Execution context
     */
    async switchToOriginalBranch(context) {
        const { snapshotManager } = context;
        const logger = getLogger();
        const gitStatus = snapshotManager.getGitStatus();

        if (!gitStatus.gitMode) {
            logger.raw('❌ Not in Git mode. Already on original branch.');
            return;
        }

        const confirmed = await this.promptForConfirmation(
            `Switch back to "${gitStatus.originalBranch}" without merging? Feature branch "${gitStatus.featureBranch}" will remain.`,
            context
        );

        if (!confirmed) {
            logger.raw('❌ Switch cancelled');
            return;
        }

        logger.raw('🔄 Switching to original branch...');
        const result = await snapshotManager.switchToOriginalBranch();

        if (result.success) {
            logger.user(`✅ Switched back to ${gitStatus.originalBranch}`, '🌿 Git:');
            logger.info(`Feature branch ${gitStatus.featureBranch} remains available`);
        } else {
            logger.error(`Switch failed: ${result.error}`, 'Git switch');
        }
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/snapshots';
    }
}

export default SnapshotsCommand;
