/**
 * Unit tests for SnapshotsCommand
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    })
}));

// Mock the snapshot components
vi.mock('../../../src/core/snapshot/SnapshotManager.js', () => ({
    SnapshotManager: vi.fn()
}));

vi.mock('../../../src/core/snapshot/stores/MemorySnapshotStore.js', () => ({
    MemorySnapshotStore: vi.fn()
}));

vi.mock('../../../src/core/snapshot/FileBackup.js', () => ({
    FileBackup: vi.fn()
}));

vi.mock('../../../src/core/snapshot/FileFilter.js', () => ({
    FileFilter: vi.fn()
}));

describe('SnapshotsCommand', () => {
    let command;
    let mockContext;
    let mockSnapshotManager;

    beforeEach(() => {
        // Mock console interface
        mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                showError: vi.fn(),
                showSuccess: vi.fn(),
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn()
            }
        };

        // Mock snapshot manager
        mockSnapshotManager = {
            createSnapshot: vi.fn(),
            listSnapshots: vi.fn(),
            restoreSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
            config: {
                preservePermissions: true,
                createBackups: true
            },
            store: {
                config: {
                    maxSnapshots: 50,
                    maxMemoryMB: 100
                },
                getStorageStats: vi.fn().mockReturnValue({
                    snapshotCount: 5,
                    maxSnapshots: 50,
                    memoryUsageMB: 25.5,
                    maxMemoryMB: 100,
                    utilizationPercent: 10.0
                })
            }
        };

        command = new SnapshotsCommand(mockSnapshotManager);
    });

    describe('constructor', () => {
        it('should initialize with provided snapshot manager', () => {
            expect(command.name).toBe('snapshot');
            expect(command.description).toBe('Manage project snapshots');
            expect(command.aliases).toEqual(['snap', 'ss']);
            expect(command.snapshotManager).toBe(mockSnapshotManager);
        });

        it('should initialize without snapshot manager', () => {
            const cmd = new SnapshotsCommand();
            expect(cmd.snapshotManager).toBeNull();
        });
    });

    describe('parseArguments', () => {
        it('should parse empty arguments', () => {
            const result = command.parseArguments('');
            expect(result).toEqual({
                subcommand: '',
                args: [],
                rawArgs: ''
            });
        });

        it('should parse subcommand with arguments', () => {
            const result = command.parseArguments('create "test snapshot"');
            expect(result).toEqual({
                subcommand: 'create',
                args: ['"test', 'snapshot"'],
                rawArgs: '"test snapshot"'
            });
        });

        it('should parse list command with options', () => {
            const result = command.parseArguments('list --limit 10');
            expect(result).toEqual({
                subcommand: 'list',
                args: ['--limit', '10'],
                rawArgs: '--limit 10'
            });
        });
    });

    describe('handleCreate', () => {
        it('should create snapshot with description from args', async () => {
            const mockResult = {
                id: 'snap-123',
                description: 'Test snapshot',
                timestamp: '2023-01-01T10:00:00.000Z',
                fileCount: 5,
                totalSize: 1024
            };

            mockSnapshotManager.createSnapshot.mockResolvedValue(mockResult);

            const parsedArgs = {
                rawArgs: 'Test snapshot',
                args: ['Test', 'snapshot']
            };

            const result = await command.handleCreate(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith('Test snapshot');
            expect(mockContext.consoleInterface.showSuccess).toHaveBeenCalledWith(
                expect.stringContaining('Snapshot created successfully!')
            );
        });

        it('should prompt for description when not provided', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('Prompted description');
            
            const mockResult = {
                id: 'snap-456',
                description: 'Prompted description',
                timestamp: '2023-01-01T10:00:00.000Z',
                fileCount: 3,
                totalSize: 512
            };

            mockSnapshotManager.createSnapshot.mockResolvedValue(mockResult);

            const parsedArgs = { rawArgs: '', args: [] };

            const result = await command.handleCreate(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.promptForInput).toHaveBeenCalledWith(
                'Enter snapshot description: '
            );
            expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith('Prompted description');
        });

        it('should handle empty description', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('');

            const parsedArgs = { rawArgs: '', args: [] };

            const result = await command.handleCreate(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('cancelled');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Snapshot description is required'
            );
        });

        it('should handle creation errors', async () => {
            mockSnapshotManager.createSnapshot.mockRejectedValue(new Error('Creation failed'));

            const parsedArgs = { rawArgs: 'Test snapshot', args: [] };

            const result = await command.handleCreate(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('error');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Failed to create snapshot: Creation failed'
            );
        });
    });

    describe('handleList', () => {
        it('should list snapshots successfully', async () => {
            const mockSnapshots = [
                {
                    id: 'snap-1',
                    description: 'First snapshot',
                    age: '1 hour ago',
                    fileCount: 5,
                    sizeFormatted: '1.0 KB'
                },
                {
                    id: 'snap-2',
                    description: 'Second snapshot',
                    age: '2 hours ago',
                    fileCount: 3,
                    sizeFormatted: '512 B'
                }
            ];

            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);

            const parsedArgs = { args: [] };

            const result = await command.handleList(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                'Found 2 snapshots:\n'
            );
        });

        it('should handle empty snapshot list', async () => {
            mockSnapshotManager.listSnapshots.mockResolvedValue([]);

            const parsedArgs = { args: [] };

            const result = await command.handleList(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('empty');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                'No snapshots found. Use "/snapshot create" to create your first snapshot.'
            );
        });

        it('should handle limit option', async () => {
            mockSnapshotManager.listSnapshots.mockResolvedValue([]);

            const parsedArgs = { args: ['--limit', '5'] };

            await command.handleList(parsedArgs, mockContext, mockSnapshotManager);

            expect(mockSnapshotManager.listSnapshots).toHaveBeenCalledWith({ limit: 5 });
        });
    });

    describe('handleRestore', () => {
        beforeEach(() => {
            mockSnapshotManager.store = {
                retrieve: vi.fn()
            };
            mockSnapshotManager.fileBackup = {
                previewRestore: vi.fn()
            };
        });

        it('should restore snapshot with confirmation', async () => {
            const mockSnapshots = [
                {
                    id: 'snap-123',
                    description: 'Test snapshot',
                    age: '1 hour ago',
                    fileCount: 5,
                    sizeFormatted: '1.0 KB'
                }
            ];

            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);
            mockSnapshotManager.restoreSnapshot.mockResolvedValue({
                filesRestored: 5,
                filesSkipped: 0,
                errors: [],
                description: 'Test snapshot'
            });
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const parsedArgs = { args: ['snap-123'] };

            const result = await command.handleRestore(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalled();
            expect(mockSnapshotManager.restoreSnapshot).toHaveBeenCalledWith('snap-123', {
                createBackup: true,
                overwriteExisting: true,
                preservePermissions: true,
                rollbackOnFailure: true
            });
        });

        it('should show preview for large restores', async () => {
            const mockSnapshots = [
                {
                    id: 'snap-123',
                    description: 'Large snapshot',
                    age: '1 hour ago',
                    fileCount: 15, // > 10, should trigger preview
                    sizeFormatted: '10.0 KB'
                }
            ];

            const mockPreview = {
                impact: { riskLevel: 'medium', totalSize: 10240 },
                changes: {
                    toCreate: [{ path: 'new.js', size: 100 }],
                    toModify: [{ path: 'existing.js', currentSize: 200, newSize: 250 }],
                    conflicts: []
                }
            };

            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);
            mockSnapshotManager.store.retrieve.mockResolvedValue({
                files: { 'test.js': { content: 'test' } }
            });
            mockSnapshotManager.fileBackup.previewRestore.mockResolvedValue(mockPreview);
            mockSnapshotManager.restoreSnapshot.mockResolvedValue({
                filesRestored: 15,
                filesSkipped: 0,
                errors: []
            });
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const parsedArgs = { args: ['snap-123'] };

            const result = await command.handleRestore(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockSnapshotManager.fileBackup.previewRestore).toHaveBeenCalled();
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Restore Preview:')
            );
        });

        it('should handle restore with options', async () => {
            const mockSnapshots = [
                {
                    id: 'snap-123',
                    description: 'Test snapshot',
                    age: '1 hour ago',
                    fileCount: 5,
                    sizeFormatted: '1.0 KB'
                }
            ];

            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);
            mockSnapshotManager.restoreSnapshot.mockResolvedValue({
                filesRestored: 5,
                filesSkipped: 0,
                errors: []
            });
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const parsedArgs = { args: ['snap-123', '--no-backup', '--preview'] };

            const result = await command.handleRestore(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockSnapshotManager.restoreSnapshot).toHaveBeenCalledWith('snap-123', {
                createBackup: false,
                overwriteExisting: true,
                preservePermissions: true,
                rollbackOnFailure: true
            });
        });

        it('should handle missing snapshot ID', async () => {
            const parsedArgs = { args: [] };

            const result = await command.handleRestore(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('invalid_args');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Snapshot ID is required. Usage: /snapshot restore <id> [--preview] [--no-backup]'
            );
        });

        it('should handle non-existent snapshot', async () => {
            mockSnapshotManager.listSnapshots.mockResolvedValue([]);

            const parsedArgs = { args: ['non-existent'] };

            const result = await command.handleRestore(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('not_found');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                "Snapshot with ID 'non-existent' not found."
            );
        });

        it('should handle user cancellation', async () => {
            const mockSnapshots = [{ id: 'snap-123', description: 'Test', fileCount: 5 }];
            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const parsedArgs = { args: ['snap-123'] };

            const result = await command.handleRestore(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('cancelled');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith('Restore cancelled.');
        });
    });

    describe('handleDelete', () => {
        it('should delete snapshot with confirmation', async () => {
            const mockSnapshots = [
                {
                    id: 'snap-123',
                    description: 'Test snapshot',
                    age: '1 hour ago',
                    fileCount: 5,
                    sizeFormatted: '1.0 KB'
                }
            ];

            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);
            mockSnapshotManager.deleteSnapshot.mockResolvedValue(true);
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const parsedArgs = { args: ['snap-123'] };

            const result = await command.handleDelete(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalled();
            expect(mockSnapshotManager.deleteSnapshot).toHaveBeenCalledWith('snap-123');
            expect(mockContext.consoleInterface.showSuccess).toHaveBeenCalledWith(
                "Snapshot 'snap-123' deleted successfully."
            );
        });

        it('should handle missing snapshot ID', async () => {
            const parsedArgs = { args: [] };

            const result = await command.handleDelete(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('invalid_args');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Snapshot ID is required. Usage: /snapshot delete <id>'
            );
        });

        it('should handle non-existent snapshot', async () => {
            mockSnapshotManager.listSnapshots.mockResolvedValue([]);

            const parsedArgs = { args: ['non-existent'] };

            const result = await command.handleDelete(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('not_found');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                "Snapshot with ID 'non-existent' not found."
            );
        });

        it('should handle user cancellation', async () => {
            const mockSnapshots = [{ id: 'snap-123', description: 'Test' }];
            mockSnapshotManager.listSnapshots.mockResolvedValue(mockSnapshots);
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const parsedArgs = { args: ['snap-123'] };

            const result = await command.handleDelete(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('cancelled');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith('Delete cancelled.');
        });
    });

    describe('handleConfig', () => {
        it('should show configuration', async () => {
            const parsedArgs = { args: ['show'] };

            const result = await command.handleConfig(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Current Snapshot Configuration:')
            );
        });

        it('should show statistics', async () => {
            const parsedArgs = { args: ['stats'] };

            const result = await command.handleConfig(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Storage Statistics:')
            );
        });

        it('should show help for unknown subcommand', async () => {
            const parsedArgs = { args: ['unknown'] };

            const result = await command.handleConfig(parsedArgs, mockContext, mockSnapshotManager);

            expect(result).toBe('help_shown');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Configuration commands:')
            );
        });
    });

    describe('handleHelp', () => {
        it('should display help message', async () => {
            const result = await command.handleHelp({}, mockContext);

            expect(result).toBe('help_shown');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Snapshot Management Commands:')
            );
        });
    });

    describe('utility methods', () => {
        it('should format size correctly', () => {
            expect(command._formatSize(0)).toBe('0 B');
            expect(command._formatSize(1024)).toBe('1.0 KB');
            expect(command._formatSize(1048576)).toBe('1.0 MB');
        });

        it('should parse restore options correctly', () => {
            const options1 = command._parseRestoreOptions(['snap-123']);
            expect(options1).toEqual({
                snapshotId: 'snap-123',
                preview: false,
                noBackup: false,
                noRollback: false,
                preservePermissions: true
            });

            const options2 = command._parseRestoreOptions(['snap-456', '--preview', '--no-backup']);
            expect(options2).toEqual({
                snapshotId: 'snap-456',
                preview: true,
                noBackup: true,
                noRollback: false,
                preservePermissions: true
            });

            const options3 = command._parseRestoreOptions(['--no-permissions', 'snap-789', '--no-rollback']);
            expect(options3).toEqual({
                snapshotId: 'snap-789',
                preview: false,
                noBackup: false,
                noRollback: true,
                preservePermissions: false
            });
        });
    });
});
