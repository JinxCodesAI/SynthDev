/**
 * Enhanced tests for SnapshotManager to verify file creation/deletion behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SnapshotManager from '../../src/core/managers/snapshotManager.js';

// Mock dependencies
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
}));

vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../utils/GitUtils.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../tools/write_file/implementation.js', () => ({
    default: vi.fn(),
}));

describe('SnapshotManager - Enhanced File Handling', () => {
    let snapshotManager;
    let mockLogger;
    let mockGitUtils;
    let mockFs;
    let mockWriteFile;

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

        // Create mock GitUtils
        mockGitUtils = {
            checkGitAvailability: vi.fn(),
            getCurrentBranch: vi.fn(),
            generateBranchName: vi.fn(),
            createBranch: vi.fn(),
            commit: vi.fn(),
            switchBranch: vi.fn(),
            mergeBranch: vi.fn(),
        };

        // Setup mocks
        const loggerModule = await import('../../src/core/managers/logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        const GitUtilsModule = await import('../../utils/GitUtils.js');
        GitUtilsModule.default.mockImplementation(() => mockGitUtils);

        mockFs = await import('fs');
        mockWriteFile = (await import('../../tools/write_file/implementation.js')).default;

        // Default Git setup
        mockGitUtils.checkGitAvailability.mockResolvedValue({
            available: false,
            isRepo: false,
        });

        // Create SnapshotManager instance
        snapshotManager = new SnapshotManager();
    });

    describe('File Creation and Deletion Tracking', () => {
        beforeEach(async () => {
            await snapshotManager.initialize();
            await snapshotManager.createSnapshot('Test snapshot');
        });

        it('should track non-existent files with null value', async () => {
            const filePath = 'new-file.txt';

            // File doesn't exist
            mockFs.existsSync.mockReturnValue(false);

            await snapshotManager.backupFileIfNeeded(filePath);

            expect(snapshotManager.currentSnapshot.files[filePath]).toBe(null);
            expect(snapshotManager.currentSnapshot.modifiedFiles.has(filePath)).toBe(true);
        });

        it('should track existing files with their content', async () => {
            const filePath = 'existing-file.txt';
            const fileContent = 'existing content';

            // File exists
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(fileContent);

            await snapshotManager.backupFileIfNeeded(filePath);

            expect(snapshotManager.currentSnapshot.files[filePath]).toBe(fileContent);
            expect(snapshotManager.currentSnapshot.modifiedFiles.has(filePath)).toBe(true);
        });

        it('should not override snapshots that have tracked files', async () => {
            const filePath = 'test-file.txt';

            // First backup - file doesn't exist
            mockFs.existsSync.mockReturnValue(false);
            await snapshotManager.backupFileIfNeeded(filePath);

            const firstSnapshotId = snapshotManager.currentSnapshot.id;

            // Create second snapshot
            await snapshotManager.createSnapshot('Second instruction');

            // Should create a new snapshot, not override the first one
            expect(snapshotManager.currentSnapshot.id).toBe(firstSnapshotId + 1);
            expect(snapshotManager.snapshots).toHaveLength(2);
        });
    });

    describe('Snapshot Restoration with File Deletion', () => {
        beforeEach(async () => {
            await snapshotManager.initialize();
        });

        it('should delete files that did not exist in the snapshot', async () => {
            // Create snapshot and track a non-existent file
            await snapshotManager.createSnapshot('Test snapshot');
            const filePath = 'created-file.txt';

            mockFs.existsSync.mockReturnValue(false);
            await snapshotManager.backupFileIfNeeded(filePath);

            // Mock the file now exists (was created after snapshot)
            mockFs.existsSync.mockReturnValue(true);

            // Mock write_file tool
            mockWriteFile.mockResolvedValue({ success: true });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(true);
            expect(result.deletedFiles).toContain(filePath);
            expect(mockFs.unlinkSync).toHaveBeenCalledWith(filePath);
        });

        it('should restore files that existed in the snapshot', async () => {
            // Create snapshot and track an existing file
            await snapshotManager.createSnapshot('Test snapshot');
            const filePath = 'existing-file.txt';
            const originalContent = 'original content';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(originalContent);
            await snapshotManager.backupFileIfNeeded(filePath);

            // Mock write_file tool
            mockWriteFile.mockResolvedValue({ success: true });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(true);
            expect(result.restoredFiles).toContain(filePath);
            expect(mockWriteFile).toHaveBeenCalledWith({
                file_path: filePath,
                content: originalContent,
                encoding: 'utf8',
                create_directories: true,
                overwrite: true,
            });
        });

        it('should handle mixed restoration (restore some files, delete others)', async () => {
            await snapshotManager.createSnapshot('Test snapshot');

            const existingFile = 'existing.txt';
            const existingContent = 'existing content';
            const newFile = 'new.txt';

            // Backup existing file
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(existingContent);
            await snapshotManager.backupFileIfNeeded(existingFile);

            // Backup non-existent file
            mockFs.existsSync.mockReturnValue(false);
            await snapshotManager.backupFileIfNeeded(newFile);

            // During restoration, both files exist
            mockFs.existsSync.mockReturnValue(true);

            // Mock write_file tool
            mockWriteFile.mockResolvedValue({ success: true });

            const result = await snapshotManager.restoreSnapshot(1);

            expect(result.success).toBe(true);
            expect(result.restoredFiles).toContain(existingFile);
            expect(result.deletedFiles).toContain(newFile);
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    file_path: existingFile,
                    content: existingContent,
                })
            );
            expect(mockFs.unlinkSync).toHaveBeenCalledWith(newFile);
        });
    });
});
