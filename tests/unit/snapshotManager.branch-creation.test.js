import { describe, it, expect, vi, beforeEach } from 'vitest';
import SnapshotManager from '../../src/core/managers/snapshotManager.js';

// Mock dependencies
vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../src/utils/GitUtils.js', () => ({
    default: vi.fn(),
}));

describe('SnapshotManager - Branch Creation Logic', () => {
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
            debug: vi.fn(),
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
        };

        // Setup mocks
        const loggerModule = await import('../../src/core/managers/logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        const GitUtilsModule = await import('../../src/utils/GitUtils.js');
        GitUtilsModule.default.mockImplementation(() => mockGitUtils);

        // Create SnapshotManager instance
        snapshotManager = new SnapshotManager();
    });

    describe('Branch Creation Conditions', () => {
        beforeEach(async () => {
            // Setup Git as available and in repo
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: true,
                isRepo: true,
            });
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'main',
            });
            await snapshotManager.initialize();
        });

        it('should create branch when not on synth-dev branch and has uncommitted changes', async () => {
            const instruction = 'Add new feature';
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/feature-branch');
            mockGitUtils.createBranch.mockResolvedValue({ success: true });
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: true,
            });

            await snapshotManager.createSnapshot(instruction);

            expect(mockGitUtils.hasUncommittedChanges).toHaveBeenCalled();
            expect(mockGitUtils.createBranch).toHaveBeenCalledWith('synth-dev/feature-branch');
            expect(snapshotManager.gitMode).toBe(true);
            expect(snapshotManager.featureBranch).toBe('synth-dev/feature-branch');
        });

        it('should NOT create branch when no uncommitted changes', async () => {
            const instruction = 'Add new feature';
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/feature-branch');
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: false,
            });

            await snapshotManager.createSnapshot(instruction);

            expect(mockGitUtils.hasUncommittedChanges).toHaveBeenCalled();
            expect(mockGitUtils.createBranch).not.toHaveBeenCalled();
            expect(snapshotManager.gitMode).toBe(false);
            expect(snapshotManager.featureBranch).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Skipping branch creation: no uncommitted changes detected',
                '📸 Snapshot:'
            );
        });

        it('should NOT create branch when already on synth-dev branch', async () => {
            // Set current branch to a synth-dev branch
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'synth-dev/existing-branch',
            });
            await snapshotManager._initializeGit(); // Re-initialize with new branch

            const instruction = 'Add new feature';
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/feature-branch');
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: true,
            });

            await snapshotManager.createSnapshot(instruction);

            // When already on synth-dev branch, we don't check uncommitted changes
            expect(mockGitUtils.hasUncommittedChanges).not.toHaveBeenCalled();
            expect(mockGitUtils.createBranch).not.toHaveBeenCalled();
            expect(snapshotManager.gitMode).toBe(true); // Should enable Git mode
            expect(snapshotManager.featureBranch).toBe('synth-dev/existing-branch'); // Use existing branch
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Skipping branch creation: already on synth-dev branch: synth-dev/existing-branch',
                '📸 Snapshot:'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Using existing synth-dev branch: synth-dev/existing-branch',
                '📸 Snapshot:'
            );
        });

        it('should handle Git status check failure gracefully', async () => {
            const instruction = 'Add new feature';
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: false,
                error: 'Git status failed',
            });

            await snapshotManager.createSnapshot(instruction);

            expect(mockGitUtils.hasUncommittedChanges).toHaveBeenCalled();
            expect(mockGitUtils.createBranch).not.toHaveBeenCalled();
            expect(snapshotManager.gitMode).toBe(false);
            expect(snapshotManager.featureBranch).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to check Git status: Git status failed',
                '📸 Snapshot:'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Skipping branch creation: unable to check Git status: Git status failed',
                '📸 Snapshot:'
            );
        });
    });
});
