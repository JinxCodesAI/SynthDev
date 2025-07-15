/**
 * Tests for SnapshotsCommand
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';

describe('SnapshotsCommand', () => {
    let command;
    let mockContext;
    let mockConsoleInterface;

    beforeEach(() => {
        command = new SnapshotsCommand();

        mockConsoleInterface = {
            promptForInput: vi.fn(),
            promptForConfirmation: vi.fn(),
        };

        mockContext = {
            consoleInterface: mockConsoleInterface,
        };
    });

    describe('constructor', () => {
        it('should initialize with correct name and description', () => {
            expect(command.name).toBe('snapshots');
            expect(command.description).toBe('Interactive snapshot management interface');
            expect(command.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should include consoleInterface in dependencies', () => {
            const deps = command.getRequiredDependencies();
            expect(deps).toContain('consoleInterface');
        });
    });

    describe('mock snapshot manager', () => {
        it('should create mock snapshot manager with correct structure', () => {
            const mockManager = command._createMockSnapshotManager();

            expect(mockManager).toHaveProperty('getStatus');
            expect(mockManager).toHaveProperty('getSnapshots');
            expect(typeof mockManager.getStatus).toBe('function');
            expect(typeof mockManager.getSnapshots).toBe('function');
        });

        it('should return mock status', async () => {
            const mockManager = command._createMockSnapshotManager();
            const status = await mockManager.getStatus();

            expect(status).toHaveProperty('mode');
            expect(status).toHaveProperty('gitStatus');
            expect(status).toHaveProperty('originalBranch');
            expect(status).toHaveProperty('featureBranch');
            expect(status).toHaveProperty('ready');
        });

        it('should return mock snapshots', async () => {
            const mockManager = command._createMockSnapshotManager();
            const result = await mockManager.getSnapshots();

            expect(result.success).toBe(true);
            expect(Array.isArray(result.snapshots)).toBe(true);
            expect(result.snapshots.length).toBeGreaterThan(0);

            result.snapshots.forEach(snapshot => {
                expect(snapshot).toHaveProperty('id');
                expect(snapshot).toHaveProperty('instruction');
                expect(snapshot).toHaveProperty('timestamp');
                expect(snapshot).toHaveProperty('mode');
            });
        });
    });

    describe('user input handling', () => {
        beforeEach(() => {
            command.snapshotManager = command._createMockSnapshotManager();
        });

        it('should handle quit command', async () => {
            const status = { mode: 'git' };
            const result = await command._handleUserInput('q', mockContext, status);
            expect(result).toBe(true); // Should exit
        });

        it('should handle numeric input for snapshot details', async () => {
            const status = { mode: 'git' };
            mockConsoleInterface.promptForInput.mockResolvedValue('');

            const result = await command._handleUserInput('1', mockContext, status);
            expect(result).toBe(false); // Should continue
        });

        it('should handle restore command', async () => {
            const status = { mode: 'git' };
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await command._handleUserInput('r1', mockContext, status);
            expect(result).toBe(false); // Should continue
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should handle delete command in file mode', async () => {
            const status = { mode: 'file' };
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await command._handleUserInput('d1', mockContext, status);
            expect(result).toBe(false); // Should continue
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should not handle delete command in git mode', async () => {
            const status = { mode: 'git' };

            const result = await command._handleUserInput('d1', mockContext, status);
            expect(result).toBe(false); // Should continue but show error
        });

        it('should handle clear command in file mode', async () => {
            const status = { mode: 'file' };
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await command._handleUserInput('c', mockContext, status);
            expect(result).toBe(false); // Should continue
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should handle merge command in git mode', async () => {
            const status = { mode: 'git' };
            // Mock git status with feature branch
            command.snapshotManager.getStatus = vi.fn().mockResolvedValue({
                mode: 'git',
                gitStatus: 'Active',
                originalBranch: 'main',
                featureBranch: 'synth-dev/test-branch',
                ready: true,
            });
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await command._handleUserInput('m', mockContext, status);
            expect(result).toBe(false); // Should continue
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should handle switch command in git mode', async () => {
            const status = { mode: 'git' };
            // Mock git status with feature branch
            command.snapshotManager.getStatus = vi.fn().mockResolvedValue({
                mode: 'git',
                gitStatus: 'Active',
                originalBranch: 'main',
                featureBranch: 'synth-dev/test-branch',
                ready: true,
            });
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await command._handleUserInput('s', mockContext, status);
            expect(result).toBe(false); // Should continue
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should handle invalid commands', async () => {
            const status = { mode: 'git' };

            const result = await command._handleUserInput('invalid', mockContext, status);
            expect(result).toBe(false); // Should continue
        });
    });

    describe('snapshot operations', () => {
        beforeEach(() => {
            command.snapshotManager = command._createMockSnapshotManager();
        });

        it('should show snapshot details for valid index', async () => {
            mockConsoleInterface.promptForInput.mockResolvedValue('');

            await command._showSnapshotDetails(0, mockContext);
            expect(mockConsoleInterface.promptForInput).toHaveBeenCalledWith(
                'Action (or Enter to continue): '
            );
        });

        it('should handle invalid snapshot index', async () => {
            await command._showSnapshotDetails(999, mockContext);
            // Should not prompt for input when index is invalid
            expect(mockConsoleInterface.promptForInput).not.toHaveBeenCalled();
        });

        it('should restore snapshot with confirmation', async () => {
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            await command._restoreSnapshot(0, mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should cancel restore when not confirmed', async () => {
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(false);

            await command._restoreSnapshot(0, mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should delete snapshot with confirmation', async () => {
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            await command._deleteSnapshot(0, mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should clear all snapshots with confirmation', async () => {
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            await command._clearAllSnapshots(mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });
    });

    describe('git operations', () => {
        beforeEach(() => {
            command.snapshotManager = command._createMockSnapshotManager();
        });

        it('should merge branch with confirmation', async () => {
            // Mock git status with feature branch
            command.snapshotManager.getStatus = vi.fn().mockResolvedValue({
                mode: 'git',
                gitStatus: 'Active',
                originalBranch: 'main',
                featureBranch: 'synth-dev/test-branch',
                ready: true,
            });
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            await command._mergeBranch(mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should switch branch with confirmation', async () => {
            // Mock git status with feature branch
            command.snapshotManager.getStatus = vi.fn().mockResolvedValue({
                mode: 'git',
                gitStatus: 'Active',
                originalBranch: 'main',
                featureBranch: 'synth-dev/test-branch',
                ready: true,
            });
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            await command._switchBranch(mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });
    });

    describe('snapshot listing enhancements', () => {
        beforeEach(() => {
            command.snapshotManager = command._createMockSnapshotManager();
        });

        it('should format timestamps correctly', () => {
            const now = new Date();
            const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
            const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
            const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

            expect(command._formatTimestamp(fiveMinutesAgo)).toBe('5m ago');
            expect(command._formatTimestamp(twoHoursAgo)).toBe('2h ago');
            expect(command._formatTimestamp(threeDaysAgo)).toBe('3d ago');
            expect(command._formatTimestamp(oneWeekAgo)).toContain('/');
        });

        it('should truncate text correctly', () => {
            const longText = 'This is a very long instruction that should be truncated';
            const result = command._truncateText(longText, 20);
            expect(result).toBe('This is a very lo...');
            expect(result.length).toBe(20);
        });

        it('should format file sizes correctly', () => {
            expect(command._formatFileSize(512)).toBe('512B');
            expect(command._formatFileSize(1536)).toBe('1.5KB');
            expect(command._formatFileSize(2097152)).toBe('2.0MB');
            expect(command._formatFileSize(1073741824)).toBe('1.0GB');
        });

        it('should show snapshots summary', async () => {
            const result = await command.snapshotManager.getSnapshots();
            const status = await command.snapshotManager.getStatus();

            // This should not throw and should handle the summary display
            expect(() => command._showSnapshotsSummary(result.snapshots, status)).not.toThrow();
        });

        it('should render snapshot list items correctly', () => {
            const mockSnapshot = {
                instruction: 'Test instruction',
                timestamp: new Date(),
                mode: 'file',
                files: new Map([['test.js', { size: 1024 }]]),
                modifiedFiles: new Set(['test.js']),
                fileCount: 1,
                totalSize: 1024,
            };

            expect(() => command._renderSnapshotListItem(mockSnapshot, 1, 'file')).not.toThrow();
        });

        it('should handle empty snapshots list', async () => {
            // Mock empty snapshots
            command.snapshotManager.getSnapshots = vi.fn().mockResolvedValue({
                success: true,
                snapshots: [],
            });

            await command._showSnapshotsList(mockContext);
            // Should not throw and should handle empty state gracefully
        });

        it('should handle pagination for large snapshot lists', async () => {
            // Mock large number of snapshots
            const manySnapshots = Array.from({ length: 15 }, (_, i) => ({
                id: `${i + 1}`,
                instruction: `Snapshot ${i + 1}`,
                timestamp: new Date(Date.now() - i * 60000),
                mode: 'file',
                fileCount: 1,
            }));

            command.snapshotManager.getSnapshots = vi.fn().mockResolvedValue({
                success: true,
                snapshots: manySnapshots,
            });

            await command._showSnapshotsList(mockContext);
            // Should handle pagination correctly
        });
    });

    describe('integration', () => {
        it('should have proper command structure for registration', () => {
            expect(command.name).toBeTruthy();
            expect(command.description).toBeTruthy();
            expect(typeof command.execute).toBe('function');
            expect(typeof command.implementation).toBe('function');
        });

        it('should have enhanced listing functionality', () => {
            expect(typeof command._formatTimestamp).toBe('function');
            expect(typeof command._truncateText).toBe('function');
            expect(typeof command._formatFileSize).toBe('function');
            expect(typeof command._showSnapshotsSummary).toBe('function');
            expect(typeof command._renderSnapshotListItem).toBe('function');
        });

        it('should have enhanced detail view functionality', () => {
            expect(typeof command._renderBasicSnapshotInfo).toBe('function');
            expect(typeof command._renderGitSnapshotDetails).toBe('function');
            expect(typeof command._renderFileSnapshotDetailsExpanded).toBe('function');
            expect(typeof command._renderSnapshotMetadata).toBe('function');
            expect(typeof command._getFileIcon).toBe('function');
            expect(typeof command._getFileTypeIcon).toBe('function');
            expect(typeof command._analyzeFileTypes).toBe('function');
            expect(typeof command._handleDetailViewAction).toBe('function');
        });
    });

    describe('enhanced detail view', () => {
        beforeEach(() => {
            command.snapshotManager = command._createMockSnapshotManager();
        });

        it('should get correct file icons', () => {
            expect(command._getFileIcon('test.js')).toBe('📜');
            expect(command._getFileIcon('test.ts')).toBe('📘');
            expect(command._getFileIcon('test.css')).toBe('🎨');
            expect(command._getFileIcon('test.html')).toBe('🌐');
            expect(command._getFileIcon('test.py')).toBe('🐍');
            expect(command._getFileIcon('test.unknown')).toBe('📄');
        });

        it('should analyze file types correctly', () => {
            const files = new Map([
                ['test.js', { size: 1024 }],
                ['test.ts', { size: 2048 }],
                ['test.css', { size: 512 }],
                ['test.html', { size: 256 }],
                ['test.py', { size: 128 }],
            ]);

            const analysis = command._analyzeFileTypes(files);

            expect(analysis.javascript).toEqual({ count: 1, size: 1024 });
            expect(analysis.typescript).toEqual({ count: 1, size: 2048 });
            expect(analysis.css).toEqual({ count: 1, size: 512 });
            expect(analysis.html).toEqual({ count: 1, size: 256 });
            expect(analysis.python).toEqual({ count: 1, size: 128 });
        });

        it('should handle detail view actions', async () => {
            mockConsoleInterface.promptForConfirmation.mockResolvedValue(true);

            // Test restore action
            await command._handleDetailViewAction('r1', 0, mockContext);
            expect(mockConsoleInterface.promptForConfirmation).toHaveBeenCalled();
        });

        it('should handle invalid detail view actions', async () => {
            mockConsoleInterface.promptForInput.mockResolvedValue('');

            await command._handleDetailViewAction('invalid', 0, mockContext);
            expect(mockConsoleInterface.promptForInput).toHaveBeenCalledWith('');
        });
    });
});
