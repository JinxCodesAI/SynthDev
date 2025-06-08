/**
 * Snapshots Command
 * Manages code checkpoints and allows reverting AI changes
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';

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

        const snapshots = snapshotManager.getSnapshotSummaries();
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
                logger.raw(
                    `   📁 Files: ${snapshot.fileCount} | Modified: ${snapshot.modifiedFiles.join(', ')}`
                );
                logger.raw();
            });

            logger.raw('Commands:');
            logger.raw('  [number] - View detailed snapshot info');
            logger.raw('  r[number] - Restore snapshot (e.g., r1)');
            logger.raw('  d[number] - Delete snapshot (e.g., d1)');
            logger.raw('  c - Clear all snapshots');
            if (gitStatus.gitMode) {
                logger.raw('  m - Merge feature branch to original branch');
                logger.raw('  s - Switch back to original branch (without merge)');
            }
            logger.raw('  q - Quit snapshots view');
            logger.raw();

            const input = await this.promptForInput('snapshots> ', context);
            const trimmed = input.trim().toLowerCase();

            if (trimmed === 'q' || trimmed === 'quit') {
                break;
            } else if (trimmed === 'c' || trimmed === 'clear') {
                const confirmed = await this.promptForConfirmation(
                    'Are you sure you want to clear all snapshots? This cannot be undone.',
                    context
                );
                if (confirmed) {
                    snapshotManager.clearAllSnapshots();
                    logger.raw('🧹 All snapshots cleared');
                    break;
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
                this.showSnapshotDetail(snapshotId, context);
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
    showSnapshotDetail(snapshotId, context) {
        const { snapshotManager } = context;
        const snapshot = snapshotManager.getSnapshot(snapshotId);
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
        logger.raw(`📁 Files backed up: ${Object.keys(snapshot.files).length}`);

        if (Object.keys(snapshot.files).length > 0) {
            logger.raw('\n📂 Backed up files:');
            for (const filePath of Object.keys(snapshot.files)) {
                logger.raw(`   - ${filePath}`);
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
        const snapshot = snapshotManager.getSnapshot(snapshotId);
        const logger = getLogger();

        if (!snapshot) {
            logger.raw(`❌ Snapshot ${snapshotId} not found`);
            return;
        }

        const fileList = Object.keys(snapshot.files).join(', ');
        const confirmed = await this.promptForConfirmation(
            `Restore snapshot ${snapshotId}? This will overwrite: ${fileList}`,
            context
        );

        if (!confirmed) {
            logger.raw('❌ Restore cancelled');
            return;
        }

        logger.raw(`🔄 Restoring snapshot ${snapshotId}...`);
        const result = await snapshotManager.restoreSnapshot(snapshotId);

        if (result.success) {
            logger.raw(`✅ Successfully restored ${result.restoredFiles.length} files:`);
            result.restoredFiles.forEach(file => logger.raw(`   ✓ ${file}`));
        } else {
            logger.raw('❌ Restore completed with errors:');
            logger.raw(`   ✓ Restored: ${result.restoredFiles.length} files`);
            logger.raw(`   ❌ Errors: ${result.errors.length}`);
            result.errors.forEach(error => logger.raw(`      - ${error}`));
        }
    }

    /**
     * Delete a snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} context - Execution context
     */
    async deleteSnapshot(snapshotId, context) {
        const { snapshotManager } = context;
        const snapshot = snapshotManager.getSnapshot(snapshotId);
        const logger = getLogger();

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

        if (snapshotManager.deleteSnapshot(snapshotId)) {
            logger.raw(`🗑️ Snapshot ${snapshotId} deleted`);
        } else {
            logger.raw(`❌ Failed to delete snapshot ${snapshotId}`);
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
