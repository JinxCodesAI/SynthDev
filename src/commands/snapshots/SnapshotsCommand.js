/**
 * SnapshotsCommand - User interface for snapshot management
 *
 * This command follows ADR-002 patterns and provides interactive
 * snapshot management functionality.
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../core/managers/logger.js';
import { SnapshotManager } from '../../core/snapshot/SnapshotManager.js';
import { MemorySnapshotStore } from '../../core/snapshot/stores/MemorySnapshotStore.js';
import { FileBackup } from '../../core/snapshot/FileBackup.js';
import { FileFilter } from '../../core/snapshot/FileFilter.js';

export class SnapshotsCommand extends InteractiveCommand {
    /**
     * Create a new SnapshotsCommand
     * @param {Object} snapshotManager - SnapshotManager instance (optional)
     */
    constructor(snapshotManager = null) {
        super('snapshot', 'Manage project snapshots', ['snap', 'ss']);
        this.snapshotManager = snapshotManager;
        this.logger = getLogger();
    }

    /**
     * Get required dependencies for this command
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['consoleInterface', ...super.getRequiredDependencies()];
    }

    /**
     * Initialize snapshot manager if not provided
     * @param {Object} context - Execution context
     * @returns {SnapshotManager} Initialized snapshot manager
     */
    _initializeSnapshotManager(context) {
        if (this.snapshotManager) {
            return this.snapshotManager;
        }

        try {
            // Create default configuration
            const config = {
                maxSnapshots: 50,
                maxMemoryMB: 100,
                preservePermissions: true,
                createBackups: true
            };

            // Initialize components
            const store = new MemorySnapshotStore(config);
            const fileFilter = new FileFilter(config);
            const fileBackup = new FileBackup(fileFilter, config);

            // Create and cache snapshot manager
            this.snapshotManager = new SnapshotManager(store, fileBackup, fileFilter, config);

            this.logger.debug('SnapshotManager initialized with default configuration');
            return this.snapshotManager;
        } catch (error) {
            this.logger.error(error, 'Failed to initialize SnapshotManager');
            throw new Error(`Failed to initialize snapshot system: ${error.message}`);
        }
    }

    /**
     * Command implementation
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command result
     */
    async implementation(args, context) {
        try {
            const { consoleInterface } = context;

            // Initialize snapshot manager
            const snapshotManager = this._initializeSnapshotManager(context);

            // Parse arguments to determine subcommand
            const parsedArgs = this.parseArguments(args);

            // Route to appropriate handler
            switch (parsedArgs.subcommand) {
                case 'create':
                    return await this.handleCreate(parsedArgs, context, snapshotManager);
                case 'list':
                    return await this.handleList(parsedArgs, context, snapshotManager);
                case 'restore':
                    return await this.handleRestore(parsedArgs, context, snapshotManager);
                case 'delete':
                    return await this.handleDelete(parsedArgs, context, snapshotManager);
                case 'config':
                    return await this.handleConfig(parsedArgs, context, snapshotManager);
                case 'help':
                case '':
                    return await this.handleHelp(parsedArgs, context);
                default:
                    consoleInterface.showError(`Unknown subcommand: ${parsedArgs.subcommand}`);
                    return await this.handleHelp(parsedArgs, context);
            }
        } catch (error) {
            this.logger.error(error, 'SnapshotsCommand execution failed');
            context.consoleInterface.showError(`Snapshot command failed: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Parse command arguments
     * @param {string} args - Raw arguments string
     * @returns {Object} Parsed arguments
     */
    parseArguments(args) {
        const trimmed = args.trim();
        if (!trimmed) {
            return { subcommand: '', args: [], rawArgs: '' };
        }

        const parts = trimmed.split(/\s+/);
        const subcommand = parts[0].toLowerCase();
        const remainingArgs = parts.slice(1);

        return {
            subcommand,
            args: remainingArgs,
            rawArgs: remainingArgs.join(' '),
        };
    }

    /**
     * Handle snapshot creation
     * @param {Object} parsedArgs - Parsed arguments
     * @param {Object} context - Execution context
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @returns {Promise<string>} Result
     */
    async handleCreate(parsedArgs, context, snapshotManager) {
        try {
            const { consoleInterface } = context;

            // Get description from args or prompt user
            let description = parsedArgs.rawArgs.trim();

            if (!description) {
                description = await this.promptForInput(
                    'Enter snapshot description: ',
                    context
                );

                if (!description || !description.trim()) {
                    consoleInterface.showError('Snapshot description is required');
                    return 'cancelled';
                }
            }

            // Remove quotes if present
            description = description.replace(/^["']|["']$/g, '');

            consoleInterface.showMessage('Creating snapshot...');

            // Call snapshotManager.createSnapshot()
            const result = await snapshotManager.createSnapshot(description);

            // Show success message with snapshot ID
            consoleInterface.showSuccess(
                `Snapshot created successfully!\n` +
                `ID: ${result.id}\n` +
                `Description: ${result.description}\n` +
                `Files: ${result.fileCount}\n` +
                `Size: ${this._formatSize(result.totalSize)}\n` +
                `Created: ${new Date(result.timestamp).toLocaleString()}`
            );

            return 'success';
        } catch (error) {
            this.logger.error(error, 'Failed to create snapshot');
            context.consoleInterface.showError(`Failed to create snapshot: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle snapshot listing
     * @param {Object} parsedArgs - Parsed arguments
     * @param {Object} context - Execution context
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @returns {Promise<string>} Result
     */
    async handleList(parsedArgs, context, snapshotManager) {
        try {
            const { consoleInterface } = context;

            // Parse list options
            const options = {};
            if (parsedArgs.args.includes('--limit')) {
                const limitIndex = parsedArgs.args.indexOf('--limit');
                if (limitIndex + 1 < parsedArgs.args.length) {
                    options.limit = parseInt(parsedArgs.args[limitIndex + 1], 10);
                }
            }

            // Call snapshotManager.listSnapshots()
            const snapshots = await snapshotManager.listSnapshots(options);

            // Handle empty list case
            if (snapshots.length === 0) {
                consoleInterface.showMessage('No snapshots found. Use "/snapshot create" to create your first snapshot.');
                return 'empty';
            }

            // Format and display snapshot list
            consoleInterface.showMessage(`Found ${snapshots.length} snapshot${snapshots.length > 1 ? 's' : ''}:\n`);

            for (const snapshot of snapshots) {
                const info = [
                    `ID: ${snapshot.id}`,
                    `Description: ${snapshot.description}`,
                    `Created: ${snapshot.age}`,
                    `Files: ${snapshot.fileCount}`,
                    `Size: ${snapshot.sizeFormatted}`
                ].join(' | ');

                consoleInterface.showMessage(`  ${info}`);
            }

            return 'success';
        } catch (error) {
            this.logger.error(error, 'Failed to list snapshots');
            context.consoleInterface.showError(`Failed to list snapshots: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle snapshot restoration
     * @param {Object} parsedArgs - Parsed arguments
     * @param {Object} context - Execution context
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @returns {Promise<string>} Result
     */
    async handleRestore(parsedArgs, context, snapshotManager) {
        try {
            const { consoleInterface } = context;

            // Parse restore options
            const options = this._parseRestoreOptions(parsedArgs.args);
            const snapshotId = options.snapshotId;

            if (!snapshotId) {
                consoleInterface.showError('Snapshot ID is required. Usage: /snapshot restore <id> [--preview] [--no-backup]');
                return 'invalid_args';
            }

            // Check if snapshot exists and get info
            const snapshots = await snapshotManager.listSnapshots();
            const snapshot = snapshots.find(s => s.id === snapshotId || s.id.startsWith(snapshotId));

            if (!snapshot) {
                consoleInterface.showError(`Snapshot with ID '${snapshotId}' not found.`);
                return 'not_found';
            }

            // Show preview if requested or if it's a large restore
            if (options.preview || snapshot.fileCount > 10) {
                const previewResult = await this._showRestorePreview(snapshot, snapshotManager, consoleInterface);
                if (previewResult === 'cancelled') {
                    return 'cancelled';
                }
            }

            // Show basic restore info
            consoleInterface.showMessage(
                `About to restore snapshot:\n` +
                `ID: ${snapshot.id}\n` +
                `Description: ${snapshot.description}\n` +
                `Created: ${snapshot.age}\n` +
                `Files: ${snapshot.fileCount}\n` +
                `Size: ${snapshot.sizeFormatted}\n`
            );

            // Get user confirmation with risk assessment
            const riskLevel = snapshot.fileCount > 50 ? 'HIGH' : snapshot.fileCount > 10 ? 'MEDIUM' : 'LOW';
            const confirmMessage = options.noBackup
                ? `This will overwrite current files WITHOUT creating a backup. Risk level: ${riskLevel}. Are you sure?`
                : `This will overwrite current files (backup will be created). Risk level: ${riskLevel}. Continue?`;

            const confirmed = await this.promptForConfirmation(confirmMessage, context);

            if (!confirmed) {
                consoleInterface.showMessage('Restore cancelled.');
                return 'cancelled';
            }

            // Show progress message
            consoleInterface.showMessage('Restoring snapshot...');

            // Call snapshotManager.restoreSnapshot() with options
            const result = await snapshotManager.restoreSnapshot(snapshot.id, {
                createBackup: !options.noBackup,
                overwriteExisting: true,
                preservePermissions: options.preservePermissions !== false,
                rollbackOnFailure: !options.noRollback
            });

            // Show detailed success message
            consoleInterface.showSuccess(
                `Snapshot restored successfully!\n` +
                `Files restored: ${result.filesRestored || 0}\n` +
                `Files skipped: ${result.filesSkipped || 0}\n` +
                `Errors: ${result.errors?.length || 0}\n` +
                `Snapshot: ${result.description}`
            );

            // Show errors if any
            if (result.errors && result.errors.length > 0) {
                consoleInterface.showMessage('\nErrors encountered:');
                result.errors.slice(0, 5).forEach(error => {
                    consoleInterface.showMessage(`  - ${error}`);
                });
                if (result.errors.length > 5) {
                    consoleInterface.showMessage(`  ... and ${result.errors.length - 5} more errors`);
                }
            }

            return 'success';
        } catch (error) {
            this.logger.error(error, 'Failed to restore snapshot');
            context.consoleInterface.showError(`Failed to restore snapshot: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle snapshot deletion
     * @param {Object} parsedArgs - Parsed arguments
     * @param {Object} context - Execution context
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @returns {Promise<string>} Result
     */
    async handleDelete(parsedArgs, context, snapshotManager) {
        try {
            const { consoleInterface } = context;

            // Get snapshot ID from args
            const snapshotId = parsedArgs.args[0];
            if (!snapshotId) {
                consoleInterface.showError('Snapshot ID is required. Usage: /snapshot delete <id>');
                return 'invalid_args';
            }

            // Check if snapshot exists and get info
            const snapshots = await snapshotManager.listSnapshots();
            const snapshot = snapshots.find(s => s.id === snapshotId || s.id.startsWith(snapshotId));

            if (!snapshot) {
                consoleInterface.showError(`Snapshot with ID '${snapshotId}' not found.`);
                return 'not_found';
            }

            // Show snapshot info
            consoleInterface.showMessage(
                `About to delete snapshot:\n` +
                `ID: ${snapshot.id}\n` +
                `Description: ${snapshot.description}\n` +
                `Created: ${snapshot.age}\n` +
                `Files: ${snapshot.fileCount}\n` +
                `Size: ${snapshot.sizeFormatted}\n`
            );

            // Get user confirmation
            const confirmed = await this.promptForConfirmation(
                'Are you sure you want to delete this snapshot? This action cannot be undone.',
                context
            );

            if (!confirmed) {
                consoleInterface.showMessage('Delete cancelled.');
                return 'cancelled';
            }

            // Call snapshotManager.deleteSnapshot()
            const success = await snapshotManager.deleteSnapshot(snapshot.id);

            if (success) {
                consoleInterface.showSuccess(`Snapshot '${snapshot.id}' deleted successfully.`);
                return 'success';
            } else {
                consoleInterface.showError(`Failed to delete snapshot '${snapshot.id}'.`);
                return 'error';
            }
        } catch (error) {
            this.logger.error(error, 'Failed to delete snapshot');
            context.consoleInterface.showError(`Failed to delete snapshot: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle configuration management
     * @param {Object} parsedArgs - Parsed arguments
     * @param {Object} context - Execution context
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @returns {Promise<string>} Result
     */
    async handleConfig(parsedArgs, context, snapshotManager) {
        try {
            const { consoleInterface } = context;

            const subcommand = parsedArgs.args[0] || 'show';

            switch (subcommand) {
                case 'show':
                    return await this._showConfig(snapshotManager, consoleInterface);
                case 'stats':
                    return await this._showStats(snapshotManager, consoleInterface);
                default:
                    consoleInterface.showMessage(
                        'Configuration commands:\n' +
                        '  /snapshot config show  - Show current configuration\n' +
                        '  /snapshot config stats - Show storage statistics\n'
                    );
                    return 'help_shown';
            }
        } catch (error) {
            this.logger.error(error, 'Failed to handle config');
            context.consoleInterface.showError(`Failed to handle config: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Show current configuration
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @param {Object} consoleInterface - Console interface
     * @returns {Promise<string>} Result
     */
    async _showConfig(snapshotManager, consoleInterface) {
        const config = snapshotManager.config;
        const store = snapshotManager.store;

        consoleInterface.showMessage(
            'Current Snapshot Configuration:\n' +
            `  Max Snapshots: ${store.config?.maxSnapshots || 'N/A'}\n` +
            `  Max Memory: ${store.config?.maxMemoryMB || 'N/A'} MB\n` +
            `  Preserve Permissions: ${config.preservePermissions ? 'Yes' : 'No'}\n` +
            `  Create Backups: ${config.createBackups ? 'Yes' : 'No'}\n`
        );

        return 'success';
    }

    /**
     * Show storage statistics
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @param {Object} consoleInterface - Console interface
     * @returns {Promise<string>} Result
     */
    async _showStats(snapshotManager, consoleInterface) {
        const stats = snapshotManager.store.getStorageStats();

        consoleInterface.showMessage(
            'Storage Statistics:\n' +
            `  Snapshots: ${stats.snapshotCount}/${stats.maxSnapshots}\n` +
            `  Memory Usage: ${stats.memoryUsageMB.toFixed(2)}/${stats.maxMemoryMB} MB\n` +
            `  Utilization: ${stats.utilizationPercent.toFixed(1)}%\n`
        );

        return 'success';
    }

    /**
     * Handle help display
     * @param {Object} parsedArgs - Parsed arguments
     * @param {Object} context - Execution context
     * @returns {Promise<string>} Result
     */
    async handleHelp(parsedArgs, context) {
        const { consoleInterface } = context;

        const helpText = `
Snapshot Management Commands:

  /snapshot create "description"    Create a new snapshot with description
  /snapshot list [--limit N]        List all snapshots (optionally limit results)
  /snapshot restore <id> [options]  Restore a snapshot by ID
  /snapshot delete <id>             Delete a snapshot by ID
  /snapshot config [show|stats]     Show configuration or storage statistics
  /snapshot help                    Show this help message

Restore Options:
  --preview                         Show detailed restore preview before proceeding
  --no-backup                       Skip creating backup of current files
  --no-rollback                     Disable automatic rollback on failure
  --no-permissions                  Don't restore file permissions

Aliases: /snap, /ss

Examples:
  /snapshot create "Before refactoring"
  /snapshot list
  /snapshot list --limit 5
  /snapshot restore abc123
  /snapshot restore abc123 --preview
  /snapshot restore abc123 --no-backup
  /snapshot delete abc123
  /snapshot config show
  /snapshot config stats

Note: Snapshots are stored in memory and will be lost when the application restarts.
      This is Phase 1 functionality - persistent storage will be added in later phases.
        `;

        consoleInterface.showMessage(helpText);
        return 'help_shown';
    }

    /**
     * Parse restore command options
     * @param {Array} args - Command arguments
     * @returns {Object} Parsed options
     */
    _parseRestoreOptions(args) {
        const options = {
            snapshotId: null,
            preview: false,
            noBackup: false,
            noRollback: false,
            preservePermissions: true
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('--')) {
                switch (arg) {
                    case '--preview':
                        options.preview = true;
                        break;
                    case '--no-backup':
                        options.noBackup = true;
                        break;
                    case '--no-rollback':
                        options.noRollback = true;
                        break;
                    case '--no-permissions':
                        options.preservePermissions = false;
                        break;
                }
            } else if (!options.snapshotId) {
                options.snapshotId = arg;
            }
        }

        return options;
    }

    /**
     * Show restore preview with detailed impact analysis
     * @param {Object} snapshot - Snapshot information
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     * @param {Object} consoleInterface - Console interface
     * @returns {Promise<string>} Result ('continue' or 'cancelled')
     */
    async _showRestorePreview(snapshot, snapshotManager, consoleInterface) {
        try {
            consoleInterface.showMessage('Analyzing restore impact...');

            // Get preview from FileBackup if available
            if (snapshotManager.fileBackup) {
                // Get the full snapshot data for preview
                const fullSnapshot = await snapshotManager.store.retrieve(snapshot.id);
                if (fullSnapshot && fullSnapshot.files) {
                    const preview = await snapshotManager.fileBackup.previewRestore(fullSnapshot);

                    consoleInterface.showMessage('\nRestore Preview:');
                    consoleInterface.showMessage(`Risk Level: ${preview.impact.riskLevel.toUpperCase()}`);
                    consoleInterface.showMessage(`Total Impact Size: ${this._formatSize(preview.impact.totalSize)}`);

                    if (preview.changes.toCreate.length > 0) {
                        consoleInterface.showMessage(`\nFiles to CREATE (${preview.changes.toCreate.length}):`);
                        preview.changes.toCreate.slice(0, 5).forEach(file => {
                            consoleInterface.showMessage(`  + ${file.path} (${this._formatSize(file.size)})`);
                        });
                        if (preview.changes.toCreate.length > 5) {
                            consoleInterface.showMessage(`  ... and ${preview.changes.toCreate.length - 5} more files`);
                        }
                    }

                    if (preview.changes.toModify.length > 0) {
                        consoleInterface.showMessage(`\nFiles to MODIFY (${preview.changes.toModify.length}):`);
                        preview.changes.toModify.slice(0, 5).forEach(file => {
                            consoleInterface.showMessage(`  ~ ${file.path} (${this._formatSize(file.currentSize)} → ${this._formatSize(file.newSize)})`);
                        });
                        if (preview.changes.toModify.length > 5) {
                            consoleInterface.showMessage(`  ... and ${preview.changes.toModify.length - 5} more files`);
                        }
                    }

                    if (preview.changes.conflicts.length > 0) {
                        consoleInterface.showMessage(`\nCONFLICTS (${preview.changes.conflicts.length}):`);
                        preview.changes.conflicts.forEach(conflict => {
                            consoleInterface.showMessage(`  ! ${conflict.path}: ${conflict.error}`);
                        });
                    }
                }
            }

            // Ask if user wants to continue after seeing preview
            const continueRestore = await this.promptForConfirmation(
                'Continue with restore after reviewing the preview?',
                { consoleInterface }
            );

            return continueRestore ? 'continue' : 'cancelled';
        } catch (error) {
            this.logger.warn('Failed to generate restore preview', { error: error.message });
            consoleInterface.showMessage('Could not generate detailed preview, but restore can continue.');
            return 'continue';
        }
    }

    /**
     * Format size in human-readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    _formatSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        const value = (bytes / Math.pow(k, i)).toFixed(1);
        return `${value} ${sizes[i]}`;
    }
}

export default SnapshotsCommand;
