/**
 * Unit tests for Git Integration components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitIntegration } from '../../../src/core/snapshot/git/GitIntegration.js';
import { BranchLifecycleManager } from '../../../src/core/snapshot/git/BranchLifecycleManager.js';
import { GitSnapshotStrategy } from '../../../src/core/snapshot/strategies/GitSnapshotStrategy.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from '../../../src/core/snapshot/events/SnapshotEventEmitter.js';

// Create a shared mock data object that can be accessed from tests
const mockData = {
    available: true,
    isRepo: true,
    currentBranch: 'main',
    hasChanges: false,
    status: '',
};

// Mock GitUtils
vi.mock('../../../src/utils/GitUtils.js', () => ({
    default: class MockGitUtils {
        constructor() {
            this.mockData = mockData;
        }

        async checkGitAvailability() {
            return {
                available: this.mockData.available,
                isRepo: this.mockData.isRepo,
            };
        }

        async getCurrentBranch() {
            return {
                success: true,
                branch: this.mockData.currentBranch,
            };
        }

        async getStatus() {
            return {
                success: true,
                hasChanges: this.mockData.hasChanges,
                status: this.mockData.status,
            };
        }

        async createBranch(branchName) {
            return { success: true, branchName };
        }

        async switchBranch(branchName) {
            // Only fail if Git is not available or not a repo
            if (!this.mockData.available || !this.mockData.isRepo) {
                return {
                    success: false,
                    error: `pathspec '${branchName}' did not match any file(s) known to git`,
                };
            }
            this.mockData.currentBranch = branchName;
            return { success: true };
        }

        async addFiles(files) {
            // Only fail if Git is not available or not a repo
            if (!this.mockData.available || !this.mockData.isRepo) {
                return { success: false, error: `pathspec '${files[0]}' did not match any files` };
            }
            return { success: true, files };
        }

        async checkBranchExists(branchName) {
            return { success: true, exists: branchName === 'main' };
        }

        async commit(message) {
            return { success: true, hash: 'abc123' };
        }

        async deleteBranch(branchName, force = false) {
            return { success: true };
        }

        async getCommitHistory(limit) {
            return {
                success: true,
                commits: [
                    {
                        hash: 'abc123',
                        subject: 'Test commit',
                        author: 'Test User',
                        date: new Date().toISOString(),
                    },
                ],
            };
        }

        async resetToCommit(commitHash) {
            return { success: true };
        }

        async commitExists(commitHash) {
            return { success: true, exists: true };
        }

        async mergeBranch(branchName) {
            return { success: true };
        }

        generateBranchName(instruction) {
            return `synth-dev/${instruction.toLowerCase().replace(/\s+/g, '-')}`;
        }
    },
}));

describe('GitIntegration', () => {
    let gitIntegration;
    let config;
    let eventEmitter;

    beforeEach(() => {
        config = new SnapshotConfig();
        eventEmitter = new SnapshotEventEmitter();
        gitIntegration = new GitIntegration(config, eventEmitter);

        // Reset mock data to defaults
        mockData.available = true;
        mockData.isRepo = true;
        mockData.currentBranch = 'main';
        mockData.hasChanges = false;
        mockData.status = '';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully with valid Git repository', async () => {
            const result = await gitIntegration.initialize();

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should fail initialization when Git is not available', async () => {
            mockData.available = false;

            const result = await gitIntegration.initialize();

            expect(result.success).toBe(false);
            expect(result.error).toContain('not installed');
        });

        it('should fail initialization when not in Git repository', async () => {
            mockData.isRepo = false;

            const result = await gitIntegration.initialize();

            expect(result.success).toBe(false);
            expect(result.error).toContain('not a Git repository');
        });
    });

    describe('branch operations', () => {
        beforeEach(async () => {
            await gitIntegration.initialize();
        });

        it('should create a new branch successfully', async () => {
            const result = await gitIntegration.createBranch('test-branch');

            expect(result.success).toBe(true);
            expect(result.branchName).toBe('test-branch');
        });

        it('should sanitize invalid branch names', async () => {
            const result = await gitIntegration.createBranch('test/branch:with*invalid?chars');

            expect(result.success).toBe(true);
            // Note: '/' is actually valid in Git branch names for hierarchical organization
            expect(result.branchName).toBe('test-branch-with-invalid-chars');
            expect(result.branchName).not.toContain(':');
            expect(result.branchName).not.toContain('*');
            expect(result.branchName).not.toContain('?');
        });

        it('should switch to existing branch', async () => {
            const result = await gitIntegration.switchBranch('main');

            expect(result.success).toBe(true);
            expect(result.previousBranch).toBeDefined();
        });

        it('should validate branch names correctly', () => {
            expect(gitIntegration.isValidBranchName('valid-branch')).toBe(true);
            expect(gitIntegration.isValidBranchName('feature/test')).toBe(false); // / is now invalid
            expect(gitIntegration.isValidBranchName('.invalid')).toBe(false);
            expect(gitIntegration.isValidBranchName('invalid..')).toBe(false);
            expect(gitIntegration.isValidBranchName('invalid@@')).toBe(false);
            expect(gitIntegration.isValidBranchName('invalid~')).toBe(false);
        });
    });

    describe('file operations', () => {
        beforeEach(async () => {
            await gitIntegration.initialize();
        });

        it('should add files to staging area', async () => {
            const files = ['file1.txt', 'file2.js'];
            const result = await gitIntegration.addFiles(files);

            expect(result.success).toBe(true);
            expect(result.addedFiles).toEqual(files);
        });

        it('should validate file paths for security', () => {
            expect(gitIntegration.isValidFilePath('valid/file.txt')).toBe(true);
            expect(gitIntegration.isValidFilePath('../dangerous')).toBe(false);
            expect(gitIntegration.isValidFilePath('/absolute/path')).toBe(false);
            expect(gitIntegration.isValidFilePath('file<>:"|?*')).toBe(false);
        });

        it('should commit changes with sanitized message', async () => {
            // Mock that there are changes to commit
            mockData.hasChanges = true;

            const message = 'Test commit message\u0000with\u0001control\u0002chars';
            const result = await gitIntegration.commit(message);

            expect(result.success).toBe(true);
            expect(result.commitHash).toBeDefined();
        });

        it('should sanitize commit messages', () => {
            const dangerous = 'Message\x00with\x01control\x02chars\r\n';
            const sanitized = gitIntegration.sanitizeCommitMessage(dangerous);

            expect(sanitized).not.toContain('\x00');
            expect(sanitized).not.toContain('\x01');
            expect(sanitized).not.toContain('\x02');
            expect(sanitized).not.toContain('\r');
        });
    });

    describe('repository state management', () => {
        beforeEach(async () => {
            await gitIntegration.initialize();
        });

        it('should get repository status', async () => {
            const result = await gitIntegration.getStatus();

            expect(result.success).toBe(true);
            expect(result.status).toBeDefined();
            expect(result.status.hasChanges).toBeDefined();
        });

        it('should parse Git status output', () => {
            const statusOutput = ' M file1.txt\nA  file2.js\n?? file3.md';
            const parsed = gitIntegration.parseGitStatus(statusOutput);

            expect(parsed).toHaveLength(3);
            expect(parsed[0]).toEqual({
                path: 'file1.txt',
                status: ' M',
                staged: false,
                modified: true,
                untracked: false,
            });
            expect(parsed[1]).toEqual({
                path: 'file2.js',
                status: 'A ',
                staged: true,
                modified: false,
                untracked: false,
            });
            expect(parsed[2]).toEqual({
                path: 'file3.md',
                status: '??',
                staged: false,
                modified: true, // '?' is not a space, so modified is true
                untracked: true,
            });
        });

        it('should get commit history with snapshot detection', async () => {
            const result = await gitIntegration.getCommitHistory();

            expect(result.success).toBe(true);
            expect(result.commits).toBeDefined();
            expect(Array.isArray(result.commits)).toBe(true);
        });

        it('should detect snapshot commits', () => {
            expect(gitIntegration.isSnapshotCommit('Snapshot: Test instruction')).toBe(true);
            expect(gitIntegration.isSnapshotCommit('SynthDev Snapshot: Test')).toBe(true);
            expect(gitIntegration.isSnapshotCommit('[SNAPSHOT] Test')).toBe(true);
            expect(gitIntegration.isSnapshotCommit('automated snapshot creation')).toBe(true);
            expect(gitIntegration.isSnapshotCommit('Regular commit message')).toBe(false);
        });
    });

    describe('retry mechanism', () => {
        beforeEach(async () => {
            await gitIntegration.initialize();
        });

        it('should retry failed operations', async () => {
            let attempts = 0;
            const mockOperation = vi.fn(() => {
                attempts++;
                if (attempts < 3) {
                    return Promise.resolve({ success: false, error: 'Temporary failure' });
                }
                return Promise.resolve({ success: true, result: 'Success' });
            });

            const result = await gitIntegration.executeWithRetry('test', mockOperation);

            expect(result.success).toBe(true);
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        it('should fail after max retries', async () => {
            const mockOperation = vi.fn(() =>
                Promise.resolve({ success: false, error: 'Persistent failure' })
            );

            const result = await gitIntegration.executeWithRetry('test', mockOperation, {
                maxRetries: 2,
            });

            expect(result.success).toBe(false);
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });
    });
});

describe('BranchLifecycleManager', () => {
    let branchManager;
    let gitIntegration;
    let config;
    let eventEmitter;

    beforeEach(async () => {
        config = new SnapshotConfig();
        eventEmitter = new SnapshotEventEmitter();
        gitIntegration = new GitIntegration(config, eventEmitter);
        branchManager = new BranchLifecycleManager(gitIntegration, config, eventEmitter);

        await gitIntegration.initialize();
        await branchManager.initialize();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('branch creation', () => {
        it('should create snapshot branch successfully', async () => {
            const instruction = 'Test snapshot creation';
            const result = await branchManager.createSnapshotBranch(instruction);

            expect(result.success).toBe(true);
            expect(result.branchName).toBeDefined();
            expect(result.branchName).toContain('synth-dev');
        });

        it('should generate unique branch names', async () => {
            const instruction = 'Test instruction';

            // Mock that the first branch name already exists
            const originalBranchExists = branchManager.branchNameExists;
            let callCount = 0;
            branchManager.branchNameExists = vi.fn(async _branchName => {
                callCount++;
                // First call returns true (exists), second call returns false (doesn't exist)
                return callCount === 1;
            });

            const name1 = await branchManager.generateUniqueBranchName(instruction);

            // Reset the mock
            branchManager.branchNameExists = originalBranchExists;

            // The name should have a counter appended due to conflict
            expect(name1).toContain('test-instruction');
            expect(name1).toMatch(/-\d+$/); // Should end with -1, -2, etc.
        });

        it('should identify snapshot branches correctly', () => {
            expect(branchManager.isSnapshotBranch('synth-dev/test-branch')).toBe(true);
            expect(branchManager.isSnapshotBranch('feature/snapshot-test')).toBe(true);
            expect(branchManager.isSnapshotBranch('main')).toBe(false);
            expect(branchManager.isSnapshotBranch('feature/normal')).toBe(false);
        });
    });

    describe('branch switching', () => {
        it('should switch to existing branch', async () => {
            // Mock that the branch exists
            branchManager.branchNameExists = vi.fn(async () => true);

            const result = await branchManager.switchToBranch('main');

            expect(result.success).toBe(true);
            expect(result.previousBranch).toBeDefined();
        });

        it('should create branch if it does not exist and createIfNotExists is true', async () => {
            const result = await branchManager.switchToBranch('non-existent', {
                createIfNotExists: true,
                instruction: 'Test instruction',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('branch cleanup', () => {
        it('should identify old branches for cleanup', async () => {
            // Add some mock branch data
            branchManager.activeBranches.set('synth-dev/old-branch', {
                created: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
                lastActivity: Date.now() - 8 * 24 * 60 * 60 * 1000,
                instruction: 'Old test',
                commits: 1,
            });

            const result = await branchManager.cleanupOldBranches({
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                dryRun: true,
            });

            expect(result.success).toBe(true);
            expect(result.deletedBranches.length).toBeGreaterThan(0);
        });

        it('should get branch information', async () => {
            const result = await branchManager.getBranchInfo();

            expect(result.success).toBe(true);
            expect(Array.isArray(result.branches)).toBe(true);
        });
    });
});

describe('GitSnapshotStrategy', () => {
    let strategy;
    let config;
    let eventEmitter;

    beforeEach(async () => {
        config = new SnapshotConfig();
        eventEmitter = new SnapshotEventEmitter();
        strategy = new GitSnapshotStrategy(config, eventEmitter);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            const result = await strategy.initialize();

            expect(result.success).toBe(true);
            expect(strategy.isInitialized).toBe(true);
        });
    });

    describe('availability check', () => {
        it('should report availability correctly', async () => {
            const result = await strategy.isAvailable();

            expect(result.available).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should report unavailability when Git is not available', async () => {
            mockData.available = false;

            const result = await strategy.isAvailable();

            expect(result.available).toBe(false);
            expect(result.reason).toBeDefined();
        });
    });

    describe('commit message generation', () => {
        it('should generate standardized commit messages', () => {
            const instruction = 'Test instruction';
            const snapshotId = 'test-id-123';

            const message = strategy.generateCommitMessage(instruction, snapshotId);

            expect(message).toContain('Snapshot: Test instruction');
            expect(message).toContain('Snapshot ID: test-id-123');
            expect(message).toContain('Strategy: Git');
            expect(message).toContain('SynthDev Snapshots');
        });
    });
});
