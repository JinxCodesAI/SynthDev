// tests/unit/utils/gitUtils.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GitUtils from '../../../src/utils/GitUtils.js';

// Mock dependencies
vi.mock('../../../src/tools/execute_terminal/implementation.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('GitUtils', () => {
    let gitUtils;
    let mockExecuteTerminal;
    let mockLogger;

    beforeEach(async () => {
        const executeTerminal = await import(
            '../../../src/tools/execute_terminal/implementation.js'
        );
        mockExecuteTerminal = executeTerminal.default;

        const { getLogger } = await import('../../../logger.js');
        mockLogger = getLogger();

        gitUtils = new GitUtils();
        vi.clearAllMocks();
    });

    describe('checkGitAvailability', () => {
        it('should return available and isRepo when git is available and in repo', async () => {
            mockExecuteTerminal
                .mockResolvedValueOnce({ success: true, stdout: 'git version 2.34.1' })
                .mockResolvedValueOnce({ success: true, stdout: '.git' });

            const result = await gitUtils.checkGitAvailability();

            expect(result).toEqual({
                available: true,
                isRepo: true,
            });
        });

        it('should return not available when git command fails', async () => {
            mockExecuteTerminal.mockResolvedValueOnce({
                success: false,
                error: 'git: command not found',
            });

            const result = await gitUtils.checkGitAvailability();

            expect(result).toEqual({
                available: false,
                isRepo: false,
                error: 'Git command not found',
            });
        });

        it('should return available but not repo when not in git repo', async () => {
            mockExecuteTerminal
                .mockResolvedValueOnce({ success: true, stdout: 'git version 2.34.1' })
                .mockResolvedValueOnce({ success: false, error: 'not a git repository' });

            const result = await gitUtils.checkGitAvailability();

            expect(result.available).toBe(true);
            expect(result.isRepo).toBe(false);
        });

        it('should handle exceptions gracefully', async () => {
            mockExecuteTerminal.mockRejectedValue(new Error('Network error'));

            const result = await gitUtils.checkGitAvailability();

            expect(result).toEqual({
                available: false,
                isRepo: false,
                error: 'Network error',
            });
        });
    });

    describe('getCurrentBranch', () => {
        it('should return current branch name', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: true,
                stdout: 'main\n',
            });

            const result = await gitUtils.getCurrentBranch();

            expect(result).toEqual({
                success: true,
                branch: 'main',
            });
            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command: 'git branch --show-current',
            });
        });

        it('should handle git command failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                error: 'not a git repository',
            });

            const result = await gitUtils.getCurrentBranch();

            expect(result).toEqual({
                success: false,
                error: 'not a git repository',
            });
        });

        it('should handle exceptions', async () => {
            mockExecuteTerminal.mockRejectedValue(new Error('Command failed'));

            const result = await gitUtils.getCurrentBranch();

            expect(result).toEqual({
                success: false,
                error: 'Command failed',
            });
        });
    });

    describe('createBranch', () => {
        it('should create and checkout new branch', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: true });

            const result = await gitUtils.createBranch('feature-branch');

            expect(result).toEqual({ success: true });
            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command: 'git checkout -b "feature-branch"',
            });
        });

        it('should handle branch creation failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                error: 'branch already exists',
            });

            const result = await gitUtils.createBranch('existing-branch');

            expect(result).toEqual({
                success: false,
                error: 'branch already exists',
            });
        });

        it('should handle exceptions', async () => {
            mockExecuteTerminal.mockRejectedValue(new Error('Git error'));

            const result = await gitUtils.createBranch('feature-branch');

            expect(result).toEqual({
                success: false,
                error: 'Git error',
            });
        });
    });

    describe('switchBranch', () => {
        it('should switch to existing branch', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: true });

            const result = await gitUtils.switchBranch('main');

            expect(result).toEqual({ success: true });
            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command: 'git checkout "main"',
            });
        });

        it('should handle branch switch failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                error: 'branch not found',
            });

            const result = await gitUtils.switchBranch('nonexistent');

            expect(result).toEqual({
                success: false,
                error: 'branch not found',
            });
        });
    });

    describe('addFiles', () => {
        it('should add all files when no specific files provided', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: false, error: 'No files provided' });

            const result = await gitUtils.addFiles([]);

            expect(result.success).toBe(false);
        });

        it('should add specific files', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: true });

            const result = await gitUtils.addFiles(['file1.js', 'file2.js']);

            expect(result).toEqual({ success: true });
            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command: 'git add "file1.js" "file2.js"',
            });
        });

        it('should handle add failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                error: 'file not found',
            });

            const result = await gitUtils.addFiles(['nonexistent.js']);

            expect(result).toEqual({
                success: false,
                error: 'file not found',
            });
        });
    });

    describe('commit', () => {
        it('should commit with single line message', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: true });

            const result = await gitUtils.commit('Add new feature');

            expect(result).toEqual({ success: true });
            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command: 'git commit -m "Add new feature"',
            });
        });

        it('should commit with multi-line message', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: true });

            const result = await gitUtils.commit(
                'Add new feature\n\nThis feature includes:\n- Feature A\n- Feature B'
            );

            expect(result).toEqual({ success: true });
            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command:
                    'git commit -m "Add new feature" -m "" -m "This feature includes:" -m "- Feature A" -m "- Feature B"',
            });
        });

        it('should handle commit failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                error: 'nothing to commit',
            });

            const result = await gitUtils.commit('Empty commit');

            expect(result).toEqual({
                success: false,
                error: 'nothing to commit',
            });
        });

        it('should escape quotes in commit message', async () => {
            mockExecuteTerminal.mockResolvedValue({ success: true });

            await gitUtils.commit('Fix "quoted" text');

            expect(mockExecuteTerminal).toHaveBeenCalledWith({
                command: 'git commit -m "Fix \\"quoted\\" text"',
            });
        });
    });

    describe('getStatus', () => {
        it('should return status with changes', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: true,
                stdout: ' M file1.js\n?? file2.js\n',
            });

            const result = await gitUtils.getStatus();

            expect(result).toEqual({
                success: true,
                status: ' M file1.js\n?? file2.js\n',
                hasChanges: true,
            });
        });

        it('should return status with no changes', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: true,
                stdout: '',
            });

            const result = await gitUtils.getStatus();

            expect(result).toEqual({
                success: true,
                status: '',
                hasChanges: false,
            });
        });

        it('should handle status command failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                error: 'not a git repository',
            });

            const result = await gitUtils.getStatus();

            expect(result).toEqual({
                success: false,
                error: 'not a git repository',
            });
        });
    });
});
