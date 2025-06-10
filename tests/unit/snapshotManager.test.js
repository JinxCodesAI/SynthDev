// tests/unit/snapshotManager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('SnapshotManager', () => {
    let snapshotManager;
    let mockLogger;
    let mockGitUtils;
    let mockFs;
    let mockWriteFile;

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
        };

        // Setup mocks
        const loggerModule = await import('../../logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        const GitUtilsModule = await import('../../utils/GitUtils.js');
        GitUtilsModule.default.mockImplementation(() => mockGitUtils);

        mockFs = await import('fs');
        mockWriteFile = (await import('../../tools/write_file/implementation.js')).default;

        // Create SnapshotManager instance
        snapshotManager = new SnapshotManager();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct default values', () => {
            expect(snapshotManager.isReady).toBe(false);
            expect(snapshotManager.snapshots).toEqual([]);
            expect(snapshotManager.currentSnapshot).toBeNull();
            expect(snapshotManager.gitAvailable).toBe(false);
            expect(snapshotManager.isGitRepo).toBe(false);
            expect(snapshotManager.originalBranch).toBeNull();
            expect(snapshotManager.featureBranch).toBeNull();
            expect(snapshotManager.gitMode).toBe(false);
            expect(snapshotManager.gitInitialized).toBe(false);
        });
    });

    describe('initialize', () => {
        it('should initialize Git and set ready state', async () => {
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: true,
                isRepo: true,
            });
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'main',
            });

            await snapshotManager.initialize();

            expect(snapshotManager.isReady).toBe(true);
            expect(snapshotManager.gitAvailable).toBe(true);
            expect(snapshotManager.isGitRepo).toBe(true);
            expect(snapshotManager.originalBranch).toBe('main');
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Git integration enabled. Original branch: main'
            );
        });

        it('should handle Git not available', async () => {
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: false,
                isRepo: false,
            });

            await snapshotManager.initialize();

            expect(snapshotManager.isReady).toBe(true);
            expect(snapshotManager.gitAvailable).toBe(false);
            expect(snapshotManager.isGitRepo).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Git integration disabled. Available: false, Repo: false'
            );
        });

        it('should handle Git initialization errors', async () => {
            const error = new Error('Git error');
            mockGitUtils.checkGitAvailability.mockRejectedValue(error);

            await snapshotManager.initialize();

            expect(snapshotManager.isReady).toBe(true);
            expect(snapshotManager.gitAvailable).toBe(false);
            expect(snapshotManager.isGitRepo).toBe(false);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Git initialization failed: ${error.message}`
            );
        });
    });

    describe('createSnapshot', () => {
        beforeEach(async () => {
            // Initialize with Git available
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

        it('should create first snapshot with Git integration', async () => {
            const instruction = 'Add new feature';
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/feature-branch');
            mockGitUtils.createBranch.mockResolvedValue({ success: true });

            await snapshotManager.createSnapshot(instruction);

            expect(snapshotManager.snapshots).toHaveLength(1);
            expect(snapshotManager.currentSnapshot).toBeDefined();
            expect(snapshotManager.currentSnapshot.instruction).toBe(instruction);
            expect(snapshotManager.currentSnapshot.id).toBe(1);
            expect(snapshotManager.gitMode).toBe(true);
            expect(snapshotManager.featureBranch).toBe('synth-dev/feature-branch');
            expect(mockLogger.user).toHaveBeenCalledWith(
                '🌿 Created feature branch: synth-dev/feature-branch',
                '📸 Snapshot:'
            );
        });

        it('should create subsequent snapshots without Git branch creation', async () => {
            // Create first snapshot
            await snapshotManager.createSnapshot('First instruction');

            // Add a file to the first snapshot to prevent override
            snapshotManager.currentSnapshot.files['test.js'] = 'content';

            // Create second snapshot
            await snapshotManager.createSnapshot('Second instruction');

            expect(snapshotManager.snapshots).toHaveLength(2);
            expect(snapshotManager.currentSnapshot.id).toBe(2);
            expect(snapshotManager.currentSnapshot.instruction).toBe('Second instruction');
        });

        it('should override empty current snapshot', async () => {
            // Create first snapshot
            await snapshotManager.createSnapshot('First instruction');
            const originalId = snapshotManager.currentSnapshot.id;

            // Create another snapshot (should override since no files backed up)
            await snapshotManager.createSnapshot('Updated instruction');

            expect(snapshotManager.snapshots).toHaveLength(1);
            expect(snapshotManager.currentSnapshot.instruction).toBe('Updated instruction');
            expect(snapshotManager.currentSnapshot.id).toBe(originalId); // Same ID since it's an override
            // Verify the snapshot was updated in place rather than creating a new one
            expect(Object.keys(snapshotManager.currentSnapshot.files)).toHaveLength(0);
        });

        it('should handle Git branch creation failure', async () => {
            const instruction = 'Add new feature';
            mockGitUtils.generateBranchName.mockReturnValue('synth-dev/feature-branch');
            mockGitUtils.createBranch.mockResolvedValue({
                success: false,
                error: 'Branch creation failed',
            });

            await snapshotManager.createSnapshot(instruction);

            expect(snapshotManager.snapshots).toHaveLength(1);
            expect(snapshotManager.gitMode).toBe(false);
            expect(snapshotManager.featureBranch).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to create Git branch: Branch creation failed'
            );
        });
    });

    describe('backupFileIfNeeded', () => {
        beforeEach(async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');
        });

        it('should backup file if not already backed up', async () => {
            const filePath = 'test.js';
            const fileContent = 'console.log("test");';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(fileContent);

            await snapshotManager.backupFileIfNeeded(filePath);

            expect(snapshotManager.currentSnapshot.files[filePath]).toBe(fileContent);
            expect(snapshotManager.currentSnapshot.modifiedFiles.has(filePath)).toBe(true);
        });

        it('should skip backup if file already backed up', async () => {
            const filePath = 'test.js';
            const fileContent = 'console.log("test");';

            // First backup
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(fileContent);
            await snapshotManager.backupFileIfNeeded(filePath);

            // Second backup attempt
            mockFs.readFileSync.mockClear();
            await snapshotManager.backupFileIfNeeded(filePath);

            expect(mockFs.readFileSync).not.toHaveBeenCalled();
        });

        it('should skip backup if no current snapshot', async () => {
            snapshotManager.currentSnapshot = null;
            mockFs.existsSync.mockReturnValue(true);

            await snapshotManager.backupFileIfNeeded('test.js');

            expect(mockFs.existsSync).not.toHaveBeenCalled();
        });

        it('should handle file read errors', async () => {
            const filePath = 'test.js';
            const error = new Error('File read error');

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation(() => {
                throw error;
            });

            await snapshotManager.backupFileIfNeeded(filePath);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Could not backup file ${filePath}: ${error.message}`
            );
        });

        it('should track non-existent files with null value', async () => {
            const filePath = 'nonexistent.js';

            mockFs.existsSync.mockReturnValue(false);

            await snapshotManager.backupFileIfNeeded(filePath);

            expect(mockFs.readFileSync).not.toHaveBeenCalled();
            expect(snapshotManager.currentSnapshot.files[filePath]).toBe(null);
            expect(snapshotManager.currentSnapshot.modifiedFiles.has(filePath)).toBe(true);
        });
    });

    describe('getSnapshotSummaries', () => {
        it('should return empty array when no snapshots', () => {
            const summaries = snapshotManager.getSnapshotSummaries();
            expect(summaries).toEqual([]);
        });

        it('should return snapshot summaries', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');

            // Add some files to the snapshot
            snapshotManager.currentSnapshot.files['test1.js'] = 'content1';
            snapshotManager.currentSnapshot.files['test2.js'] = 'content2';
            snapshotManager.currentSnapshot.modifiedFiles.add('test1.js');
            snapshotManager.currentSnapshot.modifiedFiles.add('test2.js');

            const summaries = snapshotManager.getSnapshotSummaries();

            expect(summaries).toHaveLength(1);
            expect(summaries[0]).toEqual({
                id: 1,
                instruction: 'Test snapshot',
                timestamp: expect.any(String),
                fileCount: 2,
                modifiedFiles: ['test1.js', 'test2.js'],
            });
        });
    });

    describe('getSnapshot', () => {
        it('should return null for non-existent snapshot', () => {
            const snapshot = snapshotManager.getSnapshot(999);
            expect(snapshot).toBeNull();
        });

        it('should return snapshot by ID', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');

            const snapshot = snapshotManager.getSnapshot(1);

            expect(snapshot).toBeDefined();
            expect(snapshot.id).toBe(1);
            expect(snapshot.instruction).toBe('Test snapshot');
        });
    });

    describe('restoreSnapshot', () => {
        it('should return error for non-existent snapshot', async () => {
            const result = await snapshotManager.restoreSnapshot(999);

            expect(result).toEqual({
                success: false,
                error: 'Snapshot 999 not found',
            });
        });

        it('should restore files from snapshot', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');

            // Add files to snapshot
            snapshotManager.currentSnapshot.files['test1.js'] = 'content1';
            snapshotManager.currentSnapshot.files['test2.js'] = 'content2';

            // Mock write_file tool
            mockWriteFile.mockResolvedValue({ success: true });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(true);
            expect(result.restoredFiles).toEqual(['test1.js', 'test2.js']);
            expect(result.errors).toEqual([]);
            expect(result.totalFiles).toBe(2);

            expect(mockWriteFile).toHaveBeenCalledTimes(2);
            expect(mockWriteFile).toHaveBeenCalledWith({
                file_path: 'test1.js',
                content: 'content1',
                encoding: 'utf8',
                create_directories: true,
                overwrite: true,
            });
        });

        it('should handle file restoration errors', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');

            snapshotManager.currentSnapshot.files['test.js'] = 'content';

            // Mock write_file tool failure
            mockWriteFile.mockResolvedValue({
                success: false,
                error: 'Write failed',
            });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(false);
            expect(result.restoredFiles).toEqual([]);
            expect(result.errors).toEqual(['test.js: Write failed']);
            expect(result.totalFiles).toBe(1);
        });
    });

    describe('deleteSnapshot', () => {
        it('should return false for non-existent snapshot', () => {
            const result = snapshotManager.deleteSnapshot(999);
            expect(result).toBe(false);
        });

        it('should delete snapshot by ID', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot 1');

            // Add a file to prevent override
            snapshotManager.currentSnapshot.files['test1.js'] = 'content1';

            await snapshotManager.createSnapshot('Test snapshot 2');

            const result = snapshotManager.deleteSnapshot(1);

            expect(result).toBe(true);
            expect(snapshotManager.snapshots).toHaveLength(1);
            expect(snapshotManager.snapshots[0].id).toBe(2);
        });

        it('should reset current snapshot if deleted', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');

            const result = snapshotManager.deleteSnapshot(1);

            expect(result).toBe(true);
            expect(snapshotManager.currentSnapshot).toBeNull();
        });
    });

    describe('clearAllSnapshots', () => {
        it('should clear all snapshots', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot 1');
            await snapshotManager.createSnapshot('Test snapshot 2');

            snapshotManager.clearAllSnapshots();

            expect(snapshotManager.snapshots).toEqual([]);
            expect(snapshotManager.currentSnapshot).toBeNull();
        });
    });

    describe('getCurrentSnapshot', () => {
        it('should return null when no current snapshot', () => {
            const current = snapshotManager.getCurrentSnapshot();
            expect(current).toBeNull();
        });

        it('should return current snapshot', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');

            const current = snapshotManager.getCurrentSnapshot();

            expect(current).toBeDefined();
            expect(current.instruction).toBe('Test snapshot');
        });
    });

    describe('getSnapshotCount', () => {
        it('should return 0 when no snapshots', () => {
            const count = snapshotManager.getSnapshotCount();
            expect(count).toBe(0);
        });

        it('should return correct count', async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot 1');

            // Add a file to prevent override
            snapshotManager.currentSnapshot.files['test1.js'] = 'content1';

            await snapshotManager.createSnapshot('Test snapshot 2');

            const count = snapshotManager.getSnapshotCount();
            expect(count).toBe(2);
        });
    });

    describe('getGitStatus', () => {
        it('should return Git status information', async () => {
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: true,
                isRepo: true,
            });
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'main',
            });
            await snapshotManager.initialize();

            const status = snapshotManager.getGitStatus();

            expect(status).toEqual({
                gitAvailable: true,
                isGitRepo: true,
                gitMode: false,
                originalBranch: 'main',
                featureBranch: null,
            });
        });
    });

    describe('commitChangesToGit', () => {
        beforeEach(async () => {
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: true,
                isRepo: true,
            });
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'main',
            });
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');
            snapshotManager.gitMode = true; // Enable Git mode
        });

        it('should commit changes successfully', async () => {
            const modifiedFiles = ['test1.js', 'test2.js'];
            mockGitUtils.commit.mockResolvedValue({ success: true });

            const result = await snapshotManager.commitChangesToGit(modifiedFiles);

            expect(result.success).toBe(true);
            expect(mockGitUtils.commit).toHaveBeenCalledWith(expect.stringContaining('Synth-Dev'));
            expect(mockLogger.info).toHaveBeenCalledWith(
                '📝 Committed changes to Git: test1.js, test2.js'
            );
        });

        it('should return error when not in Git mode', async () => {
            snapshotManager.gitMode = false;
            const modifiedFiles = ['test.js'];

            const result = await snapshotManager.commitChangesToGit(modifiedFiles);

            expect(result).toEqual({
                success: false,
                error: 'Not in Git mode or no active snapshot',
            });
        });

        it('should handle commit failure', async () => {
            const modifiedFiles = ['test.js'];
            mockGitUtils.commit.mockResolvedValue({
                success: false,
                error: 'Commit failed',
            });

            const result = await snapshotManager.commitChangesToGit(modifiedFiles);

            expect(result).toEqual({
                success: false,
                error: 'Failed to commit: Commit failed',
            });
        });

        it('should handle many files in commit message', async () => {
            const modifiedFiles = ['file1.js', 'file2.js', 'file3.js', 'file4.js', 'file5.js'];
            mockGitUtils.commit.mockResolvedValue({ success: true });

            await snapshotManager.commitChangesToGit(modifiedFiles);

            expect(mockGitUtils.commit).toHaveBeenCalledWith(
                expect.stringContaining('file1.js, file2.js, file3.js and 2 more')
            );
        });
    });

    describe('mergeFeatureBranch', () => {
        beforeEach(async () => {
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: true,
                isRepo: true,
            });
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'main',
            });
            await snapshotManager.initialize();

            // Set up Git mode
            snapshotManager.gitMode = true;
            snapshotManager.featureBranch = 'synth-dev/feature';
        });

        it('should merge feature branch successfully', async () => {
            mockGitUtils.switchBranch.mockResolvedValue({ success: true });
            mockGitUtils.mergeBranch.mockResolvedValue({ success: true });

            const result = await snapshotManager.mergeFeatureBranch();

            expect(result.success).toBe(true);
            expect(mockGitUtils.switchBranch).toHaveBeenCalledWith('main');
            expect(mockGitUtils.mergeBranch).toHaveBeenCalledWith('synth-dev/feature');
            expect(snapshotManager.gitMode).toBe(false);
            expect(snapshotManager.featureBranch).toBeNull();
            expect(mockLogger.user).toHaveBeenCalledWith(
                '🔀 Successfully merged synth-dev/feature into main',
                '🌿 Git:'
            );
        });

        it('should return error when not in Git mode', async () => {
            snapshotManager.gitMode = false;

            const result = await snapshotManager.mergeFeatureBranch();

            expect(result).toEqual({
                success: false,
                error: 'Not in Git mode or missing branch information',
            });
        });

        it('should handle switch branch failure', async () => {
            mockGitUtils.switchBranch.mockResolvedValue({
                success: false,
                error: 'Switch failed',
            });

            const result = await snapshotManager.mergeFeatureBranch();

            expect(result).toEqual({
                success: false,
                error: 'Failed to switch to main: Switch failed',
            });
        });

        it('should handle merge failure', async () => {
            mockGitUtils.switchBranch.mockResolvedValue({ success: true });
            mockGitUtils.mergeBranch.mockResolvedValue({
                success: false,
                error: 'Merge failed',
            });

            const result = await snapshotManager.mergeFeatureBranch();

            expect(result).toEqual({
                success: false,
                error: 'Failed to merge synth-dev/feature: Merge failed',
            });
        });
    });

    describe('switchToOriginalBranch', () => {
        beforeEach(async () => {
            mockGitUtils.checkGitAvailability.mockResolvedValue({
                available: true,
                isRepo: true,
            });
            mockGitUtils.getCurrentBranch.mockResolvedValue({
                success: true,
                branch: 'main',
            });
            await snapshotManager.initialize();

            snapshotManager.gitMode = true;
        });

        it('should switch to original branch successfully', async () => {
            mockGitUtils.switchBranch.mockResolvedValue({ success: true });

            const result = await snapshotManager.switchToOriginalBranch();

            expect(result.success).toBe(true);
            expect(mockGitUtils.switchBranch).toHaveBeenCalledWith('main');
            expect(snapshotManager.gitMode).toBe(false);
        });

        it('should return error when not in Git mode', async () => {
            snapshotManager.gitMode = false;

            const result = await snapshotManager.switchToOriginalBranch();

            expect(result).toEqual({
                success: false,
                error: 'Not in Git mode or no original branch',
            });
        });

        it('should handle switch failure', async () => {
            mockGitUtils.switchBranch.mockResolvedValue({
                success: false,
                error: 'Switch failed',
            });

            const result = await snapshotManager.switchToOriginalBranch();

            expect(result).toEqual({
                success: false,
                error: 'Switch failed',
            });
        });
    });
});
