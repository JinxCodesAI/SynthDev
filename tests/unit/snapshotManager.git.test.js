/**
 * Tests for Git-powered SnapshotManager functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SnapshotManager from '../../snapshotManager.js';

// Mock dependencies
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../utils/GitUtils.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../tools/write_file/implementation.js', () => ({
    default: vi.fn(),
}));

describe('SnapshotManager - Git Mode', () => {
    let snapshotManager;
    let mockLogger;
    let mockGitUtils;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            user: vi.fn(),
            error: vi.fn(),
        };

        // Create mock GitUtils with Git mode enabled
        mockGitUtils = {
            checkGitAvailability: vi.fn(),
            getCurrentBranch: vi.fn(),
            generateBranchName: vi.fn(),
            createBranch: vi.fn(),
            commit: vi.fn(),
            switchBranch: vi.fn(),
            mergeBranch: vi.fn(),
            getCommitHistory: vi.fn(),
            resetToCommit: vi.fn(),
            getCommitDetails: vi.fn(),
            commitExists: vi.fn(),
        };

        // Setup mocks
        const loggerModule = await import('../../logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        const GitUtilsModule = await import('../../utils/GitUtils.js');
        GitUtilsModule.default.mockImplementation(() => mockGitUtils);

        // Enable Git mode
        mockGitUtils.checkGitAvailability.mockResolvedValue({
            available: true,
            isRepo: true,
        });
        mockGitUtils.getCurrentBranch.mockResolvedValue({
            success: true,
            branch: 'main',
        });

        // Create SnapshotManager instance
        snapshotManager = new SnapshotManager();
        await snapshotManager.initialize();
    });

    describe('Git Mode Snapshots', () => {
        beforeEach(async () => {
            // Setup Git mode
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/test-branch');
            mockGitUtils.createBranch.mockResolvedValue({ success: true });

            await snapshotManager.createSnapshot('Test instruction');
        });

        it('should return Git commits as snapshots', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    subject: 'Test commit 1',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test Author',
                },
                {
                    hash: 'def456ghi789',
                    shortHash: 'def456g',
                    subject: 'Test commit 2',
                    date: '2025-06-10T12:01:00Z',
                    author: 'Test Author',
                },
            ];

            mockGitUtils.getCommitHistory.mockResolvedValue({
                success: true,
                commits: mockCommits,
            });

            const summaries = await snapshotManager.getSnapshotSummaries();

            expect(summaries).toHaveLength(2);
            expect(summaries[0]).toEqual({
                id: 1,
                gitHash: 'abc123def456',
                shortHash: 'abc123d',
                instruction: 'Test commit 1',
                timestamp: '2025-06-10T12:00:00Z',
                author: 'Test Author',
                isGitCommit: true,
            });
        });

        it('should get snapshot details from Git commit', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    subject: 'Test commit',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test Author',
                },
            ];

            mockGitUtils.getCommitHistory.mockResolvedValue({
                success: true,
                commits: mockCommits,
            });

            mockGitUtils.getCommitDetails.mockResolvedValue({
                success: true,
                commit: {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    subject: 'Test commit',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test Author',
                    message: 'Full commit message',
                    files: ['file1.js', 'file2.js'],
                },
            });

            const snapshot = await snapshotManager.getSnapshot(1);

            expect(snapshot).toBeDefined();
            expect(snapshot.gitHash).toBe('abc123def456');
            expect(snapshot.files).toEqual(['file1.js', 'file2.js']);
            expect(snapshot.message).toBe('Full commit message');
        });

        it('should restore snapshot using git reset', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    subject: 'Test commit',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test Author',
                },
            ];

            mockGitUtils.getCommitHistory.mockResolvedValue({
                success: true,
                commits: mockCommits,
            });

            mockGitUtils.commitExists.mockResolvedValue({
                success: true,
                exists: true,
            });

            mockGitUtils.resetToCommit.mockResolvedValue({
                success: true,
            });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(true);
            expect(result.method).toBe('git-reset');
            expect(result.commitHash).toBe('abc123def456');
            expect(mockGitUtils.resetToCommit).toHaveBeenCalledWith('abc123def456');
        });

        it('should not allow snapshot deletion in Git mode', async () => {
            const result = await snapshotManager.deleteSnapshot(1);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not supported in Git mode');
        });

        it('should return commit count as snapshot count', async () => {
            const mockCommits = [
                {
                    hash: 'abc123',
                    shortHash: 'abc123d',
                    subject: 'Commit 1',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test',
                },
                {
                    hash: 'def456',
                    shortHash: 'def456g',
                    subject: 'Commit 2',
                    date: '2025-06-10T12:01:00Z',
                    author: 'Test',
                },
            ];

            mockGitUtils.getCommitHistory.mockResolvedValue({
                success: true,
                commits: mockCommits,
            });

            const count = await snapshotManager.getSnapshotCount();
            expect(count).toBe(2);
        });
    });

    describe('Git Mode Error Handling', () => {
        beforeEach(async () => {
            // Setup Git mode
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/test-branch');
            mockGitUtils.createBranch.mockResolvedValue({ success: true });

            await snapshotManager.createSnapshot('Test instruction');
        });

        it('should handle git reset failure', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    subject: 'Test commit',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test Author',
                },
            ];

            mockGitUtils.getCommitHistory.mockResolvedValue({
                success: true,
                commits: mockCommits,
            });

            mockGitUtils.commitExists.mockResolvedValue({
                success: true,
                exists: true,
            });

            mockGitUtils.resetToCommit.mockResolvedValue({
                success: false,
                error: 'Reset failed',
            });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Git reset failed: Reset failed');
        });

        it('should handle non-existent commit', async () => {
            const mockCommits = [
                {
                    hash: 'abc123def456',
                    shortHash: 'abc123d',
                    subject: 'Test commit',
                    date: '2025-06-10T12:00:00Z',
                    author: 'Test Author',
                },
            ];

            mockGitUtils.getCommitHistory.mockResolvedValue({
                success: true,
                commits: mockCommits,
            });

            mockGitUtils.commitExists.mockResolvedValue({
                success: true,
                exists: false,
            });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found or inaccessible');
        });
    });
});
