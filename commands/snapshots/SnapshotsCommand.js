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
        const { snapshotManager, consoleInterface } = context;
        
        const snapshots = snapshotManager.getSnapshotSummaries();
        const logger = getLogger();

        if (snapshots.length === 0) {
            logger.raw('\n📸 No snapshots available');
            logger.raw('💡 Snapshots are automatically created when you give new instructions to the AI\n');
            return true;
        }

        while (true) {
            logger.raw('\n📸 Available Snapshots:');
            logger.raw('═'.repeat(80));

            snapshots.forEach((snapshot, index) => {
                const date = new Date(snapshot.timestamp).toLocaleString();
                const instructionPreview = snapshot.instruction.length > 60
                    ? snapshot.instruction.substring(0, 60) + '...'
                    : snapshot.instruction;

                logger.raw(`${snapshot.id}. [${date}] ${instructionPreview}`);
                logger.raw(`   📁 Files: ${snapshot.fileCount} | Modified: ${snapshot.modifiedFiles.join(', ')}`);
                logger.raw();
            });

            logger.raw('Commands:');
            logger.raw('  [number] - View detailed snapshot info');
            logger.raw('  r[number] - Restore snapshot (e.g., r1)');
            logger.raw('  d[number] - Delete snapshot (e.g., d1)');
            logger.raw('  c - Clear all snapshots');
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
            logger.raw(`❌ Restore completed with errors:`);
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
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/snapshots';
    }
}

export default SnapshotsCommand;
