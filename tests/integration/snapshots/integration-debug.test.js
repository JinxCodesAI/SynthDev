/**
 * Debug tests to understand current integration issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AutoSnapshotManager } from '../../../src/core/snapshot/AutoSnapshotManager.js';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';
import {
    getSnapshotManager,
    resetSnapshotManager,
} from '../../../src/core/snapshot/SnapshotManagerSingleton.js';
// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    initializeLogger: vi.fn(),
}));

// Mock configuration with enabled auto-snapshot functionality
const mockConfig = {
    fileFiltering: {
        defaultExclusions: ['node_modules', '.git'],
        customExclusions: [],
        maxFileSize: 10 * 1024 * 1024,
        binaryFileHandling: 'exclude',
    },
    storage: {
        type: 'memory',
        maxSnapshots: 50,
        maxMemoryMB: 100,
    },
    backup: {
        encoding: 'utf8',
    },
    behavior: {
        autoCleanup: true,
    },
    messages: {
        success: {
            snapshotCreated: '✅ Snapshot created successfully!',
            snapshotRestored: '✅ Snapshot restored successfully!',
            snapshotDeleted: '✅ Snapshot deleted successfully!',
            filesBackedUp: '💾 Files backed up before restoration',
            validationPassed: '✅ All files validated successfully',
        },
        info: {
            scanningFiles: '📂 Scanning and capturing files...',
            analyzingRestore: '🔍 Analyzing restoration impact...',
            restoringFiles: '🔄 Restoring files...',
            creatingBackups: '💾 Creating backups...',
            validatingFiles: '✅ Validating restored files...',
            cleaningUp: '🧹 Performing cleanup...',
            creatingSnapshot: 'Creating snapshot: "{description}"',
            snapshotsList: '📸 Snapshots ({count} total):',
            cancelled: 'Restoration cancelled.',
            deletionCancelled: 'Deletion cancelled.',
            noSnapshotsHelp: 'Use "/snapshot create <description>" to create your first snapshot.',
            useListCommand: 'Use "/snapshot list" to see available snapshots.',
            useHelpCommand: 'Use "/snapshot help" to see available commands.',
        },
        warnings: {
            largeFile: '⚠️  Large file detected: {filename} ({size})',
            binaryFile: '⚠️  Binary file excluded: {filename}',
            permissionDenied: '⚠️  Permission denied: {filename}',
            checksumMismatch: '⚠️  Checksum validation failed: {filename}',
            potentialDataLoss: '⚠️  Potential data loss detected in restoration',
        },
        errors: {
            snapshotNotFound: '❌ Snapshot not found: {id}',
            invalidDescription: '❌ Snapshot description is required',
            captureFailure: '❌ Failed to capture files: {error}',
            restoreFailure: '❌ Failed to restore files: {error}',
            deleteFailure: '❌ Failed to delete snapshot: {error}',
            configurationError: '❌ Configuration error: {error}',
            storageError: '❌ Storage error: {error}',
            fileSystemError: '❌ File system error: {error}',
            memoryLimitExceeded: '❌ Memory limit exceeded',
            diskSpaceLow: '❌ Insufficient disk space',
            unknownSubcommand: 'Unknown subcommand: {subcommand}',
            commandFailed: 'Command failed: {error}',
            snapshotIdRequired: 'Snapshot ID is required.',
            noSnapshots: 'No snapshots found.',
            generalFailure: 'Failed to {operation}: {error}',
        },
        prompts: {
            snapshotDescription: 'Enter snapshot description: ',
            confirmRestore: 'Do you want to proceed with the restoration?',
            confirmDelete:
                'Are you sure you want to delete this snapshot? This action cannot be undone.',
            selectSnapshot: 'Select a snapshot to restore:',
            overwriteConfirmation: 'File {filename} will be overwritten. Continue?',
        },
        help: {
            commandDescription:
                'Create and manage file snapshots for safe project state management',
            createCommand: 'Create a new snapshot with the given description',
            listCommand: 'List all existing snapshots with their details',
            restoreCommand: 'Restore files from a specific snapshot',
            deleteCommand: 'Delete a specific snapshot',
            infoCommand: 'Show detailed information about a snapshot',
            statsCommand: 'Show snapshot system statistics',
            title: '📸 Snapshot Management Commands:',
            commandsList: {
                create: '📝 /snapshot create <description>     - Create a new snapshot',
                list: '📋 /snapshot list                     - List all snapshots',
                restore: '🔄 /snapshot restore <id>             - Restore a snapshot',
                delete: '🗑️  /snapshot delete <id>              - Delete a snapshot',
                info: 'ℹ️  /snapshot info <id>               - Show snapshot details',
                stats: '📊 /snapshot stats                    - Show system statistics',
                help: '❓ /snapshot help                     - Show this help',
            },
            examplesTitle: '💡 Examples:',
            examples: [
                '/snapshot create "Before refactoring"',
                '/snapshot list',
                '/snapshot restore 12345678',
                '/snapshot info 12345678',
            ],
            notesTitle: '📝 Notes:',
            notes: [
                'Snapshots exclude node_modules, .git, and build artifacts',
                'Restoration creates backups of current files',
                'Snapshot IDs can be abbreviated (first 8 characters)',
                'Use quotes for descriptions with spaces',
            ],
        },
        stats: {
            totalSnapshots: '📸 Total snapshots: {count}',
            memoryUsage: '💾 Memory usage: {used}MB / {total}MB ({percent}%)',
            storageType: '💾 Storage type: {type}',
            lastCleanup: '🧹 Last cleanup: {timestamp}',
            activeOperations: '⚡ Active operations: {count}',
            filterPatterns: '🔍 Filter patterns: {count}',
            autoCleanup: '🧹 Auto cleanup: {status}',
        },
    },
};

const mockPhase2Config = {
    autoSnapshot: {
        enabled: true,
        createOnToolExecution: true,
        createInitialSnapshot: true,
        verifyFileChanges: true,
    },
    toolDeclarations: {
        defaultModifiesFiles: false,
        warnOnMissingDeclaration: false,
        cacheDeclarations: true,
    },
    triggerRules: {
        maxSnapshotsPerSession: 20,
        cooldownPeriod: 1000,
        requireActualChanges: false,
    },
    descriptionGeneration: {
        maxLength: 100,
        includeToolName: true,
        includeTargetFiles: true,
    },
    fileChangeDetection: {
        enabled: true,
        useChecksums: false,
        trackModificationTime: true,
        excludePatterns: ['node_modules', '.git'],
    },
    initialSnapshot: {
        enabled: true,
        createOnStartup: true,
        skipIfSnapshotsExist: false,
    },
    integration: {
        enabled: true,
        trackFileChanges: true,
        cleanupEmptySnapshots: true,
    },
};

// Mock config managers with enabled configuration
vi.mock('../../../src/config/managers/snapshotConfigManager.js', () => ({
    getSnapshotConfigManager: () => ({
        getConfig: () => mockConfig,
        getPhase2Config: () => mockPhase2Config,
        getFileFilteringConfig: () => mockConfig.fileFiltering,
        getStorageConfig: () => mockConfig.storage,
        getBackupConfig: () => mockConfig.backup,
        getBehaviorConfig: () => mockConfig.behavior,
        getMessagesConfig: () => mockConfig.messages,
    }),
}));

describe.sequential('Integration Debug Tests', () => {
    let testDir;
    let originalCwd;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `debug-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );
        mkdirSync(testDir, { recursive: true });
        originalCwd = process.cwd();
        process.chdir(testDir);

        // Reset singleton
        resetSnapshotManager();

        // Configuration is now mocked directly above

        // Create test files
        writeFileSync(join(testDir, 'test.txt'), 'test content');
        writeFileSync(join(testDir, '.gitkeep'), '');
    });

    afterEach(() => {
        try {
            if (originalCwd && existsSync(originalCwd)) {
                process.chdir(originalCwd);
            }
        } catch (error) {
            // Ignore chdir errors during cleanup
        }

        try {
            if (testDir && existsSync(testDir)) {
                rmSync(testDir, { recursive: true, force: true });
            }
        } catch (error) {
            // Ignore cleanup errors
        }

        resetSnapshotManager();
    });

    it('should verify singleton pattern works', async () => {
        const manager1 = getSnapshotManager();
        const manager2 = getSnapshotManager();

        expect(manager1).toBe(manager2);

        // Create snapshot with first instance
        const snapshot1 = await manager1.createSnapshot('Test snapshot 1');

        // List snapshots with second instance
        const snapshots = await manager2.listSnapshots();

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0].id).toBe(snapshot1.id);
    });

    it('should verify AutoSnapshotManager and SnapshotsCommand use same store', async () => {
        const autoManager = new AutoSnapshotManager();
        await autoManager.initialize();

        const snapshotsCommand = new SnapshotsCommand();

        // Create manual snapshot via AutoSnapshotManager's internal manager
        const manualSnapshot =
            await autoManager.snapshotManager.createSnapshot('Manual test snapshot');
        console.log('Manual snapshot created:', manualSnapshot);

        // Check what's in the store directly
        const directSnapshots = await autoManager.snapshotManager.listSnapshots();
        console.log('Direct snapshots from manager:', directSnapshots);

        // List snapshots via SnapshotsCommand
        const mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                promptForInput: vi.fn(),
                showError: vi.fn(),
            },
        };

        try {
            const result = await snapshotsCommand.handleList([], mockContext);
            console.log('Snapshots found via command:', result);

            expect(result).not.toBe('empty');
            expect(result).not.toBe('error');
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            // Should find the manual snapshot
            const foundManual = result.find(s => s.id === manualSnapshot.id);
            expect(foundManual).toBeDefined();
        } catch (error) {
            console.error('Error in handleList:', error);
            console.log('showError calls:', mockContext.consoleInterface.showError.mock.calls);
            throw error;
        }
    });

    it('should debug initial snapshot creation', async () => {
        const autoManager = new AutoSnapshotManager();
        await autoManager.initialize();

        console.log('AutoSnapshotManager config:', autoManager.config);
        console.log('Initial snapshot enabled:', autoManager.config.initialSnapshot.enabled);
        console.log('AutoSnapshotManager enabled:', autoManager.isEnabled());

        if (autoManager.isEnabled() && autoManager.initialSnapshotManager) {
            // Force create initial snapshot when enabled
            const result = await autoManager.initialSnapshotManager.createInitialSnapshot(testDir);
            console.log('Initial snapshot result:', result);
        } else {
            console.log('Auto-snapshot is disabled, skipping initial snapshot creation');
        }

        // Check if it's in the store
        const snapshots = await autoManager.snapshotManager.listSnapshots();
        console.log('Snapshots in store after initial creation:', snapshots.length);

        if (snapshots.length > 0) {
            console.log(
                'Snapshot details:',
                snapshots.map(s => ({
                    id: s.id,
                    description: s.description,
                    triggerType: s.triggerType,
                }))
            );
        }

        expect(snapshots.length).toBeGreaterThan(0);
    });
});
