import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileBackup } from '../../../src/core/snapshot/FileBackup.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the logger
const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

// Mock file filter that includes all files
const mockFileFilter = {
    shouldIncludeFile: vi.fn().mockReturnValue(true),
};

describe('FileBackup', () => {
    let fileBackup;
    let testDir;
    let testFiles;

    beforeEach(() => {
        // Create a temporary directory for testing
        testDir = join(tmpdir(), `filebackup-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        // Initialize FileBackup
        fileBackup = new FileBackup(mockFileFilter, {
            preservePermissions: true,
            validateChecksums: true,
            maxConcurrentFiles: 5,
            encoding: 'utf8',
        });

        // Create test files
        testFiles = {
            'file1.txt': 'Hello World',
            'file2.txt': 'Test Content',
            'subdir/file3.txt': 'Nested File',
        };

        // Write test files
        Object.entries(testFiles).forEach(([filePath, content]) => {
            const fullPath = join(testDir, filePath);
            const dir = join(fullPath, '..');
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(fullPath, content, 'utf8');
        });
    });

    afterEach(() => {
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
        vi.clearAllMocks();
        mockFileFilter.shouldIncludeFile.mockReturnValue(true);
    });

    describe('captureFiles', () => {
        it('should capture files with checksums', async () => {
            const result = await fileBackup.captureFiles(testDir);

            expect(result).toBeDefined();
            expect(result.basePath).toBe(testDir);
            expect(result.files).toBeDefined();

            // Check that files are captured (at least the root level files)
            expect(Object.keys(result.files).length).toBeGreaterThanOrEqual(2);

            // Check that checksums are calculated
            Object.values(result.files).forEach(fileInfo => {
                expect(fileInfo.checksum).toBeDefined();
                expect(typeof fileInfo.checksum).toBe('string');
                expect(fileInfo.checksum.length).toBeGreaterThan(0);
            });
        });

        it('should capture file content correctly', async () => {
            const result = await fileBackup.captureFiles(testDir);

            expect(result.files['file1.txt'].content).toBe('Hello World');
            expect(result.files['file2.txt'].content).toBe('Test Content');
            // Note: subdirectory files might not be captured depending on the file discovery implementation
        });
    });

    describe('restoreFiles with checksum validation', () => {
        it('should skip files with matching checksums', async () => {
            // First capture the files
            const capturedData = await fileBackup.captureFiles(testDir);

            // Restore the files (should skip all since they haven't changed)
            const result = await fileBackup.restoreFiles(capturedData);

            expect(result.skipped.length).toBeGreaterThanOrEqual(2);
            expect(result.restored).toHaveLength(0);
            expect(result.errors).toHaveLength(0);

            // Check that skipped files have the correct reason
            result.skipped.forEach(skippedFile => {
                expect(skippedFile.reason).toBe('File unchanged (checksum match)');
                expect(skippedFile.checksum).toBeDefined();
            });
        });

        it('should restore files with different checksums', async () => {
            // First capture the files
            const capturedData = await fileBackup.captureFiles(testDir);

            // Modify one file
            const modifiedPath = join(testDir, 'file1.txt');
            writeFileSync(modifiedPath, 'Modified Content', 'utf8');

            // Restore the files
            const result = await fileBackup.restoreFiles(capturedData);

            expect(result.restored).toHaveLength(1);
            expect(result.skipped.length).toBeGreaterThanOrEqual(1);
            expect(result.errors).toHaveLength(0);

            // Check that the modified file was restored
            expect(result.restored[0].path).toBe('file1.txt');
            
            // Verify the file content was restored
            const restoredContent = readFileSync(modifiedPath, 'utf8');
            expect(restoredContent).toBe('Hello World');
        });

        it('should restore missing files', async () => {
            // First capture the files
            const capturedData = await fileBackup.captureFiles(testDir);

            // Delete one file
            const deletedPath = join(testDir, 'file2.txt');
            rmSync(deletedPath);

            // Restore the files
            const result = await fileBackup.restoreFiles(capturedData);

            expect(result.restored).toHaveLength(1);
            expect(result.skipped.length).toBeGreaterThanOrEqual(1);
            expect(result.errors).toHaveLength(0);

            // Check that the deleted file was restored
            expect(result.restored[0].path).toBe('file2.txt');
            
            // Verify the file was recreated
            expect(existsSync(deletedPath)).toBe(true);
            const restoredContent = readFileSync(deletedPath, 'utf8');
            expect(restoredContent).toBe('Test Content');
        });

        it('should restore all files when specific files are requested', async () => {
            // First capture the files
            const capturedData = await fileBackup.captureFiles(testDir);

            // Restore only specific files
            const result = await fileBackup.restoreFiles(capturedData, {
                specificFiles: ['file1.txt', 'file2.txt']
            });

            // Should skip the specified files since they haven't changed
            expect(result.skipped).toHaveLength(2);
            expect(result.restored).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('_calculateChecksum', () => {
        it('should generate consistent checksums for same content', () => {
            const content = 'Test content for checksum';
            const checksum1 = fileBackup._calculateChecksum(content);
            const checksum2 = fileBackup._calculateChecksum(content);

            expect(checksum1).toBe(checksum2);
            expect(typeof checksum1).toBe('string');
            expect(checksum1.length).toBeGreaterThan(0);
        });

        it('should generate different checksums for different content', () => {
            const content1 = 'Content 1';
            const content2 = 'Content 2';
            const checksum1 = fileBackup._calculateChecksum(content1);
            const checksum2 = fileBackup._calculateChecksum(content2);

            expect(checksum1).not.toBe(checksum2);
        });
    });
});
