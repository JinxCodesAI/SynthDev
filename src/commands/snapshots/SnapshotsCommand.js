/**
 * Snapshots Command Implementation
 * Provides user interface for snapshot management following ADR-002 patterns
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import { getSnapshotManager } from '../../core/snapshot/SnapshotManagerSingleton.js';
import { getSnapshotConfigManager } from '../../config/managers/snapshotConfigManager.js';
import { getLogger } from '../../core/managers/logger.js';

export class SnapshotsCommand extends InteractiveCommand {
    constructor() {
        super('snapshot', 'Create and manage file snapshots for safe project state management', [
            'snap',
            'backup',
        ]);

        this.logger = getLogger();
        this.snapshotManager = null;
        this.configManager = getSnapshotConfigManager();
        this.messages = this.configManager.getMessagesConfig();

        // Subcommands
        this.subcommands = {
            create: this.handleCreate.bind(this),
            list: this.handleList.bind(this),
            restore: this.handleRestore.bind(this),
            delete: this.handleDelete.bind(this),
            info: this.handleInfo.bind(this),
            stats: this.handleStats.bind(this),
            auto: this.handleAuto.bind(this),
            help: this.handleHelp.bind(this),
        };
    }

    /**
     * Get required dependencies for the command
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['consoleInterface', 'app', ...super.getRequiredDependencies()];
    }

    /**
     * Main command execution handler
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command result
     */
    async implementation(args, context) {
        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            // Parse arguments
            const { subcommand, subArgs } = this.parseArguments(args);

            // Handle help or no subcommand
            if (!subcommand || subcommand === 'help') {
                return await this.handleHelp(subArgs, context);
            }

            // Route to appropriate subcommand handler
            const handler = this.subcommands[subcommand];
            if (!handler) {
                const { consoleInterface } = context;
                consoleInterface.showError(
                    this.messages.errors.unknownSubcommand.replace('{subcommand}', subcommand)
                );
                consoleInterface.showMessage(this.messages.info.useHelpCommand);
                return 'error';
            }

            return await handler(subArgs, context);
        } catch (error) {
            this.logger.error(error, 'Snapshot command execution failed');
            context.consoleInterface.showError(
                this.messages.errors.commandFailed.replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle snapshot creation
     * @param {string} args - Create arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Creation result
     */
    async handleCreate(args, context) {
        const { consoleInterface } = context;

        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            // Parse description from args
            let description = args.trim();

            // If no description provided, prompt for it
            if (!description) {
                description = await this.promptForInput(
                    this.messages.prompts.snapshotDescription,
                    context
                );
                if (!description) {
                    consoleInterface.showError(this.messages.errors.invalidDescription);
                    return 'error';
                }
            }

            // Remove quotes if present
            description = description.replace(/^["']|["']$/g, '');

            consoleInterface.showMessage(
                this.messages.info.creatingSnapshot.replace('{description}', description)
            );
            consoleInterface.showMessage(this.messages.info.scanningFiles);

            // Create snapshot
            const result = await this.snapshotManager.createSnapshot(description);

            // Show success message
            consoleInterface.showMessage(this.messages.success.snapshotCreated);
            consoleInterface.showMessage(`📍 Snapshot ID: ${result.id}`);
            consoleInterface.showMessage(`📁 Files captured: ${result.stats.fileCount}`);

            // Show differential size for differential snapshots, total size for full snapshots
            const sizeToShow =
                result.metadata.type === 'differential'
                    ? result.metadata.differentialSize
                    : result.stats.totalSize;
            const sizeLabel =
                result.metadata.type === 'differential' ? 'Differential size' : 'Total size';

            consoleInterface.showMessage(`💾 ${sizeLabel}: ${this.formatBytes(sizeToShow)}`);

            // Show breakdown for differential snapshots
            if (result.metadata.type === 'differential') {
                const newFiles = result.metadata.newFiles || 0;
                const modifiedFiles = result.metadata.modifiedFiles || 0;
                const unchangedFiles = result.metadata.unchangedFiles || 0;

                consoleInterface.showMessage(
                    `📊 Changes: ${newFiles} new, ${modifiedFiles} modified, ${unchangedFiles} unchanged`
                );
            }

            consoleInterface.showMessage(`⏱️  Capture time: ${result.stats.captureTime}ms`);

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to create snapshot');
            consoleInterface.showError(
                this.messages.errors.generalFailure
                    .replace('{operation}', 'create snapshot')
                    .replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle snapshot listing
     * @param {string} args - List arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} List result
     */
    async handleList(args, context) {
        const { consoleInterface } = context;

        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            // Parse list options
            const options = this.parseListOptions(args);

            // Get snapshots
            const snapshots = await this.snapshotManager.listSnapshots(options);

            if (snapshots.length === 0) {
                consoleInterface.showMessage(this.messages.errors.noSnapshots);
                consoleInterface.showMessage(this.messages.info.noSnapshotsHelp);
                return 'empty';
            }

            // Display snapshots
            consoleInterface.showMessage(
                `\n${this.messages.info.snapshotsList.replace('{count}', snapshots.length)}`
            );
            consoleInterface.showMessage('─'.repeat(80));

            for (const snapshot of snapshots) {
                const timestamp = new Date(snapshot.timestamp).toLocaleString();
                const size = this.formatBytes(snapshot.totalSize);
                const type = snapshot.triggerType === 'manual' ? '👤' : '🤖';

                consoleInterface.showMessage(
                    `${type} ${snapshot.id.substring(0, 8)}... - ${snapshot.description}`
                );
                // For differential snapshots, show only changed files count
                const fileCountToShow =
                    snapshot.type === 'differential' && snapshot.changedFiles !== undefined
                        ? snapshot.changedFiles
                        : snapshot.fileCount;
                const fileLabel = snapshot.type === 'differential' ? 'changed' : 'files';

                consoleInterface.showMessage(
                    `   📅 ${timestamp} | 📁 ${fileCountToShow} ${fileLabel} | 💾 ${size}`
                );

                if (snapshot.triggerType !== 'manual') {
                    consoleInterface.showMessage(`   🔧 Created by: ${snapshot.triggerType}`);
                }

                consoleInterface.showMessage('');
            }

            return snapshots;
        } catch (error) {
            this.logger.error(error, 'Failed to list snapshots');
            consoleInterface.showError(
                this.messages.errors.generalFailure
                    .replace('{operation}', 'list snapshots')
                    .replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle snapshot restoration
     * @param {string} args - Restore arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Restore result
     */
    async handleRestore(args, context) {
        const { consoleInterface } = context;

        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            // Parse snapshot ID
            const snapshotId = args.trim();
            if (!snapshotId) {
                consoleInterface.showError(this.messages.errors.snapshotIdRequired);
                consoleInterface.showMessage(this.messages.info.useListCommand);
                return 'error';
            }

            // Get snapshot details
            const details = await this.snapshotManager.getSnapshotDetails(snapshotId);

            // Show snapshot info
            consoleInterface.showMessage(`\n📸 Snapshot: ${details.description}`);
            consoleInterface.showMessage(`📍 ID: ${details.id}`);
            consoleInterface.showMessage(
                `📅 Created: ${new Date(details.metadata.timestamp).toLocaleString()}`
            );
            consoleInterface.showMessage(`📁 Files: ${details.fileCount}`);

            // Generate preview
            consoleInterface.showMessage(`\n${this.messages.info.analyzingRestore}`);
            const preview = await this.snapshotManager.restoreSnapshot(snapshotId, {
                preview: true,
            });

            // Show preview
            this.showRestorePreview(preview, consoleInterface);

            // Ask for confirmation
            const confirm = await this.promptForConfirmation(
                `\n${this.messages.prompts.confirmRestore}`,
                context
            );

            if (!confirm) {
                consoleInterface.showMessage(this.messages.info.cancelled);
                return 'cancelled';
            }

            // Perform restoration
            consoleInterface.showMessage(this.messages.info.restoringFiles);
            const result = await this.snapshotManager.restoreSnapshot(snapshotId, {
                createBackups: true,
            });

            // Show results
            consoleInterface.showMessage(this.messages.success.snapshotRestored);
            consoleInterface.showMessage(`📁 Files restored: ${result.stats.restoredFiles}`);
            consoleInterface.showMessage(`💾 Backups created: ${result.backups.length}`);

            if (result.errors.length > 0) {
                consoleInterface.showMessage(`⚠️  Errors encountered: ${result.errors.length}`);
                for (const error of result.errors) {
                    consoleInterface.showMessage(`   ❌ ${error.path}: ${error.error}`);
                }
            }

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to restore snapshot');
            consoleInterface.showError(
                this.messages.errors.generalFailure
                    .replace('{operation}', 'restore snapshot')
                    .replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle snapshot deletion
     * @param {string} args - Delete arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Delete result
     */
    async handleDelete(args, context) {
        const { consoleInterface } = context;

        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            // Parse snapshot ID
            const snapshotId = args.trim();
            if (!snapshotId) {
                consoleInterface.showError(this.messages.errors.snapshotIdRequired);
                consoleInterface.showMessage(this.messages.info.useListCommand);
                return 'error';
            }

            // Get snapshot details
            const details = await this.snapshotManager.getSnapshotDetails(snapshotId);

            // Show snapshot info
            consoleInterface.showMessage(`\n📸 Snapshot: ${details.description}`);
            consoleInterface.showMessage(`📍 ID: ${details.id}`);
            consoleInterface.showMessage(
                `📅 Created: ${new Date(details.metadata.timestamp).toLocaleString()}`
            );
            consoleInterface.showMessage(`📁 Files: ${details.fileCount}`);

            // Ask for confirmation
            const confirm = await this.promptForConfirmation(
                `\n${this.messages.prompts.confirmDelete}`,
                context
            );

            if (!confirm) {
                consoleInterface.showMessage(this.messages.info.deletionCancelled);
                return 'cancelled';
            }

            // Delete snapshot
            const result = await this.snapshotManager.deleteSnapshot(snapshotId);

            consoleInterface.showMessage(this.messages.success.snapshotDeleted);
            consoleInterface.showMessage(`📸 Deleted: ${result.description}`);

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to delete snapshot');
            consoleInterface.showError(
                this.messages.errors.generalFailure
                    .replace('{operation}', 'delete snapshot')
                    .replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle snapshot info display
     * @param {string} args - Info arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Info result
     */
    async handleInfo(args, context) {
        const { consoleInterface } = context;

        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            // Parse snapshot ID
            const snapshotId = args.trim();
            if (!snapshotId) {
                consoleInterface.showError(this.messages.errors.snapshotIdRequired);
                consoleInterface.showMessage(this.messages.info.useListCommand);
                return 'error';
            }

            // Get snapshot details
            const details = await this.snapshotManager.getSnapshotDetails(snapshotId);

            // Display detailed information
            consoleInterface.showMessage('\n📸 Snapshot Details:');
            consoleInterface.showMessage('─'.repeat(50));
            consoleInterface.showMessage(`📍 ID: ${details.id}`);
            consoleInterface.showMessage(`📝 Description: ${details.description}`);
            consoleInterface.showMessage(
                `📅 Created: ${new Date(details.metadata.timestamp).toLocaleString()}`
            );
            consoleInterface.showMessage(`👤 Creator: ${details.metadata.creator}`);
            consoleInterface.showMessage(`🔧 Trigger: ${details.metadata.triggerType}`);
            consoleInterface.showMessage(`📁 Files: ${details.fileCount}`);

            // Show differential size for differential snapshots, total size for full snapshots
            const sizeToShow =
                details.metadata.type === 'differential'
                    ? details.metadata.differentialSize
                    : details.metadata.totalSize;
            const sizeLabel =
                details.metadata.type === 'differential' ? 'Differential size' : 'Total size';

            consoleInterface.showMessage(`💾 ${sizeLabel}: ${this.formatBytes(sizeToShow)}`);

            // Show breakdown for differential snapshots
            if (details.metadata.type === 'differential') {
                const newFiles = details.metadata.newFiles || 0;
                const modifiedFiles = details.metadata.modifiedFiles || 0;
                const unchangedFiles = details.metadata.unchangedFiles || 0;

                consoleInterface.showMessage(
                    `📊 Changes: ${newFiles} new, ${modifiedFiles} modified, ${unchangedFiles} unchanged`
                );
            }

            consoleInterface.showMessage(`📂 Base path: ${details.metadata.basePath}`);
            consoleInterface.showMessage(`⏱️  Capture time: ${details.metadata.captureTime}ms`);

            // Show file list (first 10 files)
            if (details.files.length > 0) {
                consoleInterface.showMessage(
                    `\n📁 Files (showing first 10 of ${details.files.length}):`
                );
                const filesToShow = details.files.slice(0, 10);

                for (const file of filesToShow) {
                    const size = this.formatBytes(file.size);
                    const modified = new Date(file.modified).toLocaleString();
                    consoleInterface.showMessage(`   📄 ${file.path} (${size}) - ${modified}`);
                }

                if (details.files.length > 10) {
                    consoleInterface.showMessage(
                        `   ... and ${details.files.length - 10} more files`
                    );
                }
            }

            return details;
        } catch (error) {
            this.logger.error(error, 'Failed to get snapshot info');
            consoleInterface.showError(
                this.messages.errors.generalFailure
                    .replace('{operation}', 'get snapshot info')
                    .replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle system statistics display
     * @param {string} args - Stats arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Stats result
     */
    async handleStats(args, context) {
        const { consoleInterface } = context;

        try {
            // Initialize snapshot manager if not already done - use singleton
            if (!this.snapshotManager) {
                this.snapshotManager = getSnapshotManager();
            }

            const stats = this.snapshotManager.getSystemStats();

            consoleInterface.showMessage('\n📊 Snapshot System Statistics:');
            consoleInterface.showMessage('─'.repeat(50));

            // Storage statistics
            consoleInterface.showMessage(`💾 Storage (${stats.configuration.storageType}):`);
            consoleInterface.showMessage(`   📸 Total snapshots: ${stats.storage.totalSnapshots}`);
            consoleInterface.showMessage(`   📊 Max snapshots: ${stats.storage.maxSnapshots}`);
            consoleInterface.showMessage(
                `   💾 Memory usage: ${stats.storage.memoryUsageMB.toFixed(2)}MB (${stats.storage.memoryUsagePercent.toFixed(1)}%)`
            );
            consoleInterface.showMessage(`   📈 Max memory: ${stats.storage.maxMemoryMB}MB`);

            // Filter statistics
            consoleInterface.showMessage('\n🔍 File Filtering:');
            consoleInterface.showMessage(`   📋 Total patterns: ${stats.filtering.totalPatterns}`);
            consoleInterface.showMessage(
                `   🔧 Default patterns: ${stats.filtering.defaultPatterns}`
            );
            consoleInterface.showMessage(
                `   ⚙️  Custom patterns: ${stats.filtering.customPatterns}`
            );
            consoleInterface.showMessage(
                `   📏 Max file size: ${this.formatBytes(stats.filtering.maxFileSize)}`
            );
            consoleInterface.showMessage(
                `   🎯 Binary handling: ${stats.filtering.binaryFileHandling}`
            );

            // System status
            consoleInterface.showMessage('\n⚡ System Status:');
            consoleInterface.showMessage(`   🔄 Active operations: ${stats.activeOperations}`);
            consoleInterface.showMessage(
                `   🧹 Auto cleanup: ${stats.configuration.autoCleanup ? 'enabled' : 'disabled'}`
            );

            if (stats.storage.lastCleanup) {
                const lastCleanup = new Date(stats.storage.lastCleanup).toLocaleString();
                consoleInterface.showMessage(`   🗑️  Last cleanup: ${lastCleanup}`);
            }

            return stats;
        } catch (error) {
            this.logger.error(error, 'Failed to get system stats');
            consoleInterface.showError(
                this.messages.errors.generalFailure
                    .replace('{operation}', 'get system stats')
                    .replace('{error}', error.message)
            );
            return 'error';
        }
    }

    /**
     * Handle automatic snapshot system information
     * @param {string} args - Auto arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Auto result
     */
    async handleAuto(args, context) {
        const { consoleInterface, app } = context;

        try {
            // Get auto snapshot status from app
            const autoStatus = app.getAutoSnapshotStatus();

            consoleInterface.showMessage('\n🤖 Automatic Snapshot System Status:');
            consoleInterface.showMessage('─'.repeat(50));

            if (!autoStatus.available) {
                consoleInterface.showMessage('❌ Auto Snapshot System not available');
                return 'unavailable';
            }

            // Show main status
            const statusIcon = autoStatus.enabled ? '✅' : '❌';
            consoleInterface.showMessage(`${statusIcon} Enabled: ${autoStatus.enabled}`);
            consoleInterface.showMessage(`🔧 Initialized: ${autoStatus.initialized}`);

            // Show component status
            consoleInterface.showMessage('\n📦 Components:');
            const components = autoStatus.components;
            Object.entries(components).forEach(([name, available]) => {
                const icon = available ? '✅' : '❌';
                const displayName = name
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase());
                consoleInterface.showMessage(
                    `   ${icon} ${displayName}: ${available ? 'Ready' : 'Not available'}`
                );
            });

            // Show integrations
            consoleInterface.showMessage('\n🔗 Integrations:');
            const integrations = autoStatus.integrations;
            Object.entries(integrations).forEach(([name, available]) => {
                const icon = available ? '✅' : '❌';
                const displayName = name
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase());
                consoleInterface.showMessage(
                    `   ${icon} ${displayName}: ${available ? 'Connected' : 'Not connected'}`
                );
            });

            // Show usage instructions
            consoleInterface.showMessage('\n💡 Usage:');
            consoleInterface.showMessage(
                '   • Automatic snapshots are created before file-modifying tools'
            );
            consoleInterface.showMessage('   • No manual intervention required');
            consoleInterface.showMessage(
                '   • Use `/snapshot list` to see all snapshots including automatic ones'
            );
            consoleInterface.showMessage(
                '   • Initial snapshots are created on first application start'
            );

            return autoStatus;
        } catch (error) {
            this.logger.error(error, 'Failed to get auto snapshot status');
            consoleInterface.showError('Failed to get automatic snapshot system status');
            return 'error';
        }
    }

    /**
     * Handle help display
     * @param {string} args - Help arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Help result
     */
    async handleHelp(args, context) {
        const { consoleInterface } = context;

        consoleInterface.showMessage(`\n${this.messages.help.title}`);
        consoleInterface.showMessage('─'.repeat(60));

        // Show commands
        const commands = this.messages.help.commandsList;
        consoleInterface.showMessage(commands.create);
        consoleInterface.showMessage(commands.list);
        consoleInterface.showMessage(commands.restore);
        consoleInterface.showMessage(commands.delete);
        consoleInterface.showMessage(commands.info);
        consoleInterface.showMessage(commands.stats);
        consoleInterface.showMessage(
            '📝 /snapshot auto             - Show automatic snapshot system status'
        );
        consoleInterface.showMessage(commands.help);

        // Show examples
        consoleInterface.showMessage(`\n${this.messages.help.examplesTitle}`);
        this.messages.help.examples.forEach(example => {
            consoleInterface.showMessage(`   ${example}`);
        });
        consoleInterface.showMessage(
            '   /snapshot auto                      - Check auto snapshot status'
        );

        // Show notes
        consoleInterface.showMessage(`\n${this.messages.help.notesTitle}`);
        this.messages.help.notes.forEach(note => {
            consoleInterface.showMessage(`   • ${note}`);
        });
        consoleInterface.showMessage(
            '   • Automatic snapshots (🤖) are created before file-modifying tools'
        );
        consoleInterface.showMessage(
            '   • Manual snapshots (👤) can still be created using /snapshot create'
        );

        return 'help';
    }

    /**
     * Parse command arguments
     * @param {string} args - Raw arguments
     * @returns {Object} Parsed arguments
     */
    parseArguments(args) {
        const trimmed = args.trim();
        const parts = trimmed.split(/\s+/);

        return {
            subcommand: parts[0] || '',
            subArgs: parts.slice(1).join(' '),
        };
    }

    /**
     * Parse list options
     * @param {string} args - List arguments
     * @returns {Object} List options
     */
    parseListOptions(args) {
        const options = {
            sortBy: 'timestamp',
            sortOrder: 'desc',
            limit: 50,
        };

        // Parse any flags or options from args
        // For now, using defaults

        return options;
    }

    /**
     * Show restore preview
     * @param {Object} preview - Preview data
     * @param {Object} consoleInterface - Console interface
     */
    showRestorePreview(preview, consoleInterface) {
        const { preview: previewData } = preview;

        consoleInterface.showMessage('\n🔍 Restoration Preview:');
        consoleInterface.showMessage('─'.repeat(40));

        if (previewData.files.toCreate.length > 0) {
            consoleInterface.showMessage(
                `📄 Files to create: ${previewData.files.toCreate.length}`
            );
            previewData.files.toCreate.slice(0, 5).forEach(file => {
                consoleInterface.showMessage(`   + ${file.path} (${this.formatBytes(file.size)})`);
            });
            if (previewData.files.toCreate.length > 5) {
                consoleInterface.showMessage(
                    `   ... and ${previewData.files.toCreate.length - 5} more`
                );
            }
        }

        if (previewData.files.toModify.length > 0) {
            consoleInterface.showMessage(
                `📝 Files to modify: ${previewData.files.toModify.length}`
            );
            previewData.files.toModify.slice(0, 5).forEach(file => {
                consoleInterface.showMessage(`   ~ ${file.path} (${this.formatBytes(file.size)})`);
            });
            if (previewData.files.toModify.length > 5) {
                consoleInterface.showMessage(
                    `   ... and ${previewData.files.toModify.length - 5} more`
                );
            }
        }

        if (previewData.files.unchanged.length > 0) {
            consoleInterface.showMessage(
                `✅ Files unchanged: ${previewData.files.unchanged.length}`
            );
        }

        consoleInterface.showMessage(
            `\n📊 Impact: ${previewData.stats.impactedFiles} files affected`
        );
        consoleInterface.showMessage(
            `💾 Total size: ${this.formatBytes(previewData.stats.totalSize)}`
        );
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) {
            return '0 B';
        }

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/snapshot <create|list|restore|delete|info|stats|auto|help> [args]';
    }
}

export default SnapshotsCommand;
