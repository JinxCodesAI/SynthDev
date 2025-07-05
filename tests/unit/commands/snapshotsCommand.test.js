// tests/unit/commands/snapshotsCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('SnapshotsCommand', () => {
    let snapshotsCommand;
    let mockLogger;
    let mockContext;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            user: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create mock context
        mockContext = {
            snapshotManager: {
                getSnapshotSummaries: vi.fn().mockReturnValue([]),
                getSnapshot: vi.fn().mockReturnValue(null),
                getGitStatus: vi.fn().mockReturnValue({
                    gitMode: false,
                    originalBranch: null,
                    featureBranch: null,
                }),
                clearAllSnapshots: vi.fn(),
                restoreSnapshot: vi.fn().mockResolvedValue({
                    success: true,
                    restoredFiles: [],
                    errors: [],
                }),
                deleteSnapshot: vi.fn().mockReturnValue(true),
                mergeFeatureBranch: vi.fn().mockResolvedValue({
                    success: true,
                }),
                switchToOriginalBranch: vi.fn().mockResolvedValue({
                    success: true,
                }),
            },
            consoleInterface: {
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn(),
            },
        };

        // Create SnapshotsCommand instance
        snapshotsCommand = new SnapshotsCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(snapshotsCommand.name).toBe('snapshots');
            expect(snapshotsCommand.description).toBe('Manage code checkpoints, revert AI changes');
            expect(snapshotsCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = snapshotsCommand.getRequiredDependencies();
            expect(dependencies).toContain('snapshotManager');
            expect(dependencies).toContain('consoleInterface');
        });
    });

    describe('implementation', () => {
        it('should display no snapshots message when no snapshots exist', async () => {
            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('\n📸 No snapshots available');
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '💡 Snapshots are automatically created when you give new instructions to the AI\n'
            );
        });

        it('should display snapshots list and enter interactive mode', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Add new feature',
                    fileCount: 3,
                    modifiedFiles: ['src/test.js', 'src/utils.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput.mockResolvedValue('q');

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('\n📸 Available Snapshots:');
            expect(mockLogger.raw).toHaveBeenCalledWith('═'.repeat(80));
            expect(mockLogger.raw).toHaveBeenCalledWith('Commands:');
        });

        it('should handle quit command', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput.mockResolvedValue('quit');

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.consoleInterface.promptForInput).toHaveBeenCalledWith('snapshots> ');
        });

        it('should handle clear all snapshots command with confirmation', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('c')
                .mockResolvedValueOnce('q');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalledWith(
                'Are you sure you want to clear all snapshots? This cannot be undone.'
            );
            expect(mockContext.snapshotManager.clearAllSnapshots).toHaveBeenCalled();
            expect(mockLogger.raw).toHaveBeenCalledWith('🧹 All snapshots cleared');
        });

        it('should handle clear command cancellation', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('clear')
                .mockResolvedValueOnce('q');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.snapshotManager.clearAllSnapshots).not.toHaveBeenCalled();
        });

        it('should handle restore snapshot command', async () => {
            const snapshot = {
                id: 1,
                files: { 'src/test.js': 'content' },
            };
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.snapshotManager.getSnapshot.mockReturnValue(snapshot);
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('r1')
                .mockResolvedValueOnce('q');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.snapshotManager.restoreSnapshot).toHaveBeenCalledWith(1);
        });

        it('should handle delete snapshot command', async () => {
            const snapshot = { id: 1 };
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.snapshotManager.getSnapshot.mockResolvedValue(snapshot);
            mockContext.snapshotManager.deleteSnapshot.mockResolvedValue({ success: true });
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('d1')
                .mockResolvedValueOnce('q');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.snapshotManager.deleteSnapshot).toHaveBeenCalledWith(1);
            expect(mockLogger.raw).toHaveBeenCalledWith('🗑️ Snapshot 1 deleted');
        });

        it('should handle view snapshot detail command', async () => {
            const snapshot = {
                id: 1,
                timestamp: '2024-01-15T10:30:00.000Z',
                instruction: 'Add new feature',
                files: {
                    'src/feature.js': 'content1',
                    'src/utils.js': 'content2',
                },
            };
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.snapshotManager.getSnapshot.mockReturnValue(snapshot);
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('1')
                .mockResolvedValueOnce('q');

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('\n📸 Snapshot 1 Details:');
            expect(mockLogger.raw).toHaveBeenCalledWith('📝 Instruction: Add new feature');
            expect(mockLogger.raw).toHaveBeenCalledWith('📁 Files backed up: 2');
        });

        it('should handle invalid snapshot ID', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('rabc')
                .mockResolvedValueOnce('q');

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Invalid snapshot ID');
        });

        it('should handle invalid command', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('invalid')
                .mockResolvedValueOnce('q');

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '❌ Invalid command. Use q to quit, or see commands above.'
            );
        });

        it('should not show git commands when not in git mode', async () => {
            mockContext.snapshotManager.getSnapshotSummaries.mockReturnValue([
                {
                    id: 1,
                    timestamp: '2024-01-15T10:30:00.000Z',
                    instruction: 'Test',
                    fileCount: 1,
                    modifiedFiles: ['test.js'],
                },
            ]);
            mockContext.consoleInterface.promptForInput.mockResolvedValue('q');

            const result = await snapshotsCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should not display git-specific commands
            const gitCommands = mockLogger.raw.mock.calls.filter(
                call => call[0] && (call[0].includes('m - Merge') || call[0].includes('s - Switch'))
            );
            expect(gitCommands).toHaveLength(0);
        });
    });

    describe('showSnapshotDetail', () => {
        it('should display detailed snapshot information', async () => {
            const snapshot = {
                id: 1,
                timestamp: '2024-01-15T10:30:00.000Z',
                instruction: 'Add new feature',
                files: {
                    'src/feature.js': 'content1',
                    'src/utils.js': 'content2',
                },
            };
            mockContext.snapshotManager.getSnapshot.mockResolvedValue(snapshot);

            await snapshotsCommand.showSnapshotDetail(1, mockContext);

            expect(mockLogger.raw).toHaveBeenCalledWith('\n📸 Snapshot 1 Details:');
            expect(mockLogger.raw).toHaveBeenCalledWith('📝 Instruction: Add new feature');
            expect(mockLogger.raw).toHaveBeenCalledWith('📁 Files backed up: 2');
        });

        it('should handle snapshot not found', async () => {
            mockContext.snapshotManager.getSnapshot.mockResolvedValue(null);

            await snapshotsCommand.showSnapshotDetail(999, mockContext);

            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Snapshot 999 not found');
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = snapshotsCommand.getUsage();
            expect(usage).toBe('/snapshots');
        });
    });

    describe('inheritance', () => {
        it('should extend InteractiveCommand', () => {
            expect(snapshotsCommand.constructor.name).toBe('SnapshotsCommand');
            expect(typeof snapshotsCommand.promptForInput).toBe('function');
            expect(typeof snapshotsCommand.promptForConfirmation).toBe('function');
        });
    });
});
