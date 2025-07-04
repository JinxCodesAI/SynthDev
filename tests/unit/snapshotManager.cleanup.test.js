// tests/unit/snapshotManager.cleanup.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SnapshotManager from '../../src/core/managers/snapshotManager.js';

describe('SnapshotManager Cleanup', () => {
    let snapshotManager;
    let mockLogger;
    let mockGitUtils;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            user: vi.fn(),
        };

        // Create mock GitUtils
        mockGitUtils = {
            checkGitAvailability: vi.fn(),
            getCurrentBranch: vi.fn(),
            generateBranchName: vi.fn(),
            createBranch: vi.fn(),
            switchBranch: vi.fn(),
            commit: vi.fn(),
            mergeBranch: vi.fn(),
            hasUncommittedChanges: vi.fn(),
            deleteBranch: vi.fn(),
        };

        // Mock the logger module
        vi.doMock('../../logger.js', () => ({
            getLogger: () => mockLogger,
        }));

        // Mock the GitUtils module
        vi.doMock('../../utils/GitUtils.js', () => ({
            default: function () {
                return mockGitUtils;
            },
        }));

        // Create SnapshotManager instance
        snapshotManager = new SnapshotManager();
        snapshotManager.logger = mockLogger;
        snapshotManager.gitUtils = mockGitUtils;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('shouldPerformCleanup', () => {
        it('should return false when Git integration is not active', async () => {
            snapshotManager.gitAvailable = false;
            snapshotManager.isGitRepo = false;
            snapshotManager.gitMode = false;
            snapshotManager.gitInitialized = true; // Skip Git initialization

            const result = await snapshotManager.shouldPerformCleanup();

            expect(result.shouldCleanup).toBe(false);
            expect(result.reason).toBe('Git integration not active');
        });

        it('should return false when not on a temporary branch', async () => {
            snapshotManager.gitAvailable = true;
            snapshotManager.isGitRepo = true;
            snapshotManager.gitMode = true;
            snapshotManager.featureBranch = null;
            snapshotManager.originalBranch = 'main';
            snapshotManager.gitInitialized = true; // Skip Git initialization

            const result = await snapshotManager.shouldPerformCleanup();

            expect(result.shouldCleanup).toBe(false);
            expect(result.reason).toBe('Not on a temporary branch');
        });

        it('should return false when there are uncommitted changes', async () => {
            snapshotManager.gitAvailable = true;
            snapshotManager.isGitRepo = true;
            snapshotManager.gitMode = true;
            snapshotManager.featureBranch = 'synth-dev/test-branch';
            snapshotManager.originalBranch = 'main';
            snapshotManager.gitInitialized = true; // Skip Git initialization

            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: true,
            });

            const result = await snapshotManager.shouldPerformCleanup();

            expect(result.shouldCleanup).toBe(false);
            expect(result.reason).toBe('Branch has uncommitted changes');
        });

        it('should return true when all conditions are met', async () => {
            snapshotManager.gitAvailable = true;
            snapshotManager.isGitRepo = true;
            snapshotManager.gitMode = true;
            snapshotManager.featureBranch = 'synth-dev/test-branch';
            snapshotManager.originalBranch = 'main';
            snapshotManager.gitInitialized = true; // Skip Git initialization

            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: false,
            });

            const result = await snapshotManager.shouldPerformCleanup();

            expect(result.shouldCleanup).toBe(true);
        });

        it('should handle Git status check errors', async () => {
            snapshotManager.gitAvailable = true;
            snapshotManager.isGitRepo = true;
            snapshotManager.gitMode = true;
            snapshotManager.featureBranch = 'synth-dev/test-branch';
            snapshotManager.originalBranch = 'main';
            snapshotManager.gitInitialized = true; // Skip Git initialization

            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: false,
                error: 'Git error',
            });

            const result = await snapshotManager.shouldPerformCleanup();

            expect(result.shouldCleanup).toBe(false);
            expect(result.reason).toBe('Failed to check Git status: Git error');
        });
    });

    describe('performCleanup', () => {
        beforeEach(() => {
            snapshotManager.gitAvailable = true;
            snapshotManager.isGitRepo = true;
            snapshotManager.gitMode = true;
            snapshotManager.featureBranch = 'synth-dev/test-branch';
            snapshotManager.originalBranch = 'main';
            snapshotManager.gitInitialized = true; // Skip Git initialization
        });

        it('should successfully perform cleanup', async () => {
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: false,
            });
            mockGitUtils.switchBranch.mockResolvedValue({ success: true });
            mockGitUtils.deleteBranch.mockResolvedValue({ success: true });

            const result = await snapshotManager.performCleanup();

            expect(result.success).toBe(true);
            expect(mockGitUtils.switchBranch).toHaveBeenCalledWith('main');
            expect(mockGitUtils.deleteBranch).toHaveBeenCalledWith('synth-dev/test-branch');
            expect(snapshotManager.featureBranch).toBeNull();
            expect(snapshotManager.gitMode).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(
                '🧹 Automatic cleanup completed: switched to main and deleted synth-dev/test-branch'
            );
        });

        it('should fail when cleanup conditions are not met', async () => {
            snapshotManager.gitMode = false;

            const result = await snapshotManager.performCleanup();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Git integration not active');
        });

        it('should fail when switching branches fails', async () => {
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: false,
            });
            mockGitUtils.switchBranch.mockResolvedValue({
                success: false,
                error: 'Switch failed',
            });

            const result = await snapshotManager.performCleanup();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to switch to original branch: Switch failed');
        });

        it('should continue cleanup even if branch deletion fails', async () => {
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: false,
            });
            mockGitUtils.switchBranch.mockResolvedValue({ success: true });
            mockGitUtils.deleteBranch.mockResolvedValue({
                success: false,
                error: 'Delete failed',
            });

            const result = await snapshotManager.performCleanup();

            expect(result.success).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to delete temporary branch synth-dev/test-branch: Delete failed'
            );
            expect(snapshotManager.featureBranch).toBeNull();
            expect(snapshotManager.gitMode).toBe(false);
        });

        it('should handle exceptions during cleanup', async () => {
            mockGitUtils.hasUncommittedChanges.mockRejectedValue(new Error('Unexpected error'));

            const result = await snapshotManager.performCleanup();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Error checking cleanup conditions: Unexpected error');
        });
    });
});
