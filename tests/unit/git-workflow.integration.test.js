import { describe, it, expect, vi, beforeEach } from 'vitest';
import SnapshotManager from '../../src/core/managers/snapshotManager.js';
import ToolManager from '../../src/core/managers/toolManager.js';

// Mock dependencies
vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../src/utils/GitUtils.js', () => ({
    default: vi.fn(),
}));

describe('Git Workflow Integration Test', () => {
    let snapshotManager;
    let toolManager;
    let mockLogger;
    let mockGitUtils;
    let mockConsoleInterface;

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
            addFiles: vi.fn(),
            getStatus: vi.fn(),
        };

        // Setup mocks
        const loggerModule = await import('../../src/core/managers/logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        const GitUtilsModule = await import('../../src/utils/GitUtils.js');
        GitUtilsModule.default.mockImplementation(() => mockGitUtils);

        // Create mock console interface
        mockConsoleInterface = {
            showToolExecution: vi.fn(),
            showToolResult: vi.fn(),
            promptForConfirmation: vi.fn().mockResolvedValue(true),
        };

        // Create instances
        snapshotManager = new SnapshotManager();
        toolManager = new ToolManager();
    });

    describe('Complete Git Workflow', () => {
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

        it('should handle pre-execution Git operations correctly', async () => {
            // Setup: There are existing uncommitted changes
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: true,
            });
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/test-branch');
            mockGitUtils.createBranch.mockResolvedValue({ success: true });
            mockGitUtils.addFiles.mockResolvedValue({ success: true });
            mockGitUtils.commit.mockResolvedValue({ success: true });

            // Test the pre-execution Git operations directly
            await toolManager._handlePreExecutionGitOperations(
                'write_file',
                { file_path: 'test.js', content: 'new content' },
                snapshotManager
            );

            // Verify pre-execution workflow
            // 1. Should have created snapshot and branch
            expect(snapshotManager.snapshots).toHaveLength(1);
            expect(snapshotManager.gitMode).toBe(true);
            expect(snapshotManager.featureBranch).toBe('synth-dev/test-branch');

            // 2. Should have committed existing changes
            expect(mockGitUtils.addFiles).toHaveBeenCalledWith(['.']);
            expect(mockGitUtils.commit).toHaveBeenCalledWith(expect.stringContaining('Synth-Dev'));
        });

        it('should skip pre-execution commit when no uncommitted changes', async () => {
            // Setup: No existing uncommitted changes
            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: false,
            });
            mockGitUtils.addFiles.mockResolvedValue({ success: true });
            mockGitUtils.commit.mockResolvedValue({ success: true });

            // Test the pre-execution Git operations directly
            await toolManager._handlePreExecutionGitOperations(
                'write_file',
                { file_path: 'test.js', content: 'new content' },
                snapshotManager
            );

            // Verify workflow
            // Should have created snapshot but not branch (no uncommitted changes)
            expect(snapshotManager.snapshots).toHaveLength(1);
            expect(snapshotManager.gitMode).toBe(false); // No branch created

            // Should NOT have done pre-execution commit
            expect(mockGitUtils.createBranch).not.toHaveBeenCalled();
            expect(mockGitUtils.commit).not.toHaveBeenCalled();
        });

        it('should use existing synth-dev branch without creating new one', async () => {
            // Setup: Already on synth-dev branch
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'synth-dev/existing-branch',
            });
            await snapshotManager._initializeGit(); // Re-initialize with new branch

            mockGitUtils.hasUncommittedChanges.mockResolvedValue({
                success: true,
                hasUncommittedChanges: true,
            });
            mockGitUtils.addFiles.mockResolvedValue({ success: true });
            mockGitUtils.commit.mockResolvedValue({ success: true });

            // Test the pre-execution Git operations directly
            await toolManager._handlePreExecutionGitOperations(
                'write_file',
                { file_path: 'test.js', content: 'new content' },
                snapshotManager
            );

            // Verify workflow
            // Should use existing branch, not create new one
            expect(mockGitUtils.createBranch).not.toHaveBeenCalled();
            expect(snapshotManager.gitMode).toBe(true);
            expect(snapshotManager.featureBranch).toBe('synth-dev/existing-branch');

            // Should still commit existing changes before tool execution
            expect(mockGitUtils.commit).toHaveBeenCalledTimes(1); // Pre-execution commit
        });
    });
});
