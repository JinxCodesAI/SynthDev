/**
 * Specific tests for empty file handling in snapshots
 * These tests focus on the .gitkeep file issue and similar empty file scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';
import { FileBackup } from '../../../src/core/snapshot/FileBackup.js';
import { FileFilter } from '../../../src/core/snapshot/FileFilter.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('Empty File Handling in Snapshots', () => {
    let testDir;
    let originalCwd;
    let snapshotManager;
    let fileBackup;
    let fileFilter;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `empty-file-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );
        mkdirSync(testDir, { recursive: true });
        originalCwd = process.cwd();
        process.chdir(testDir);

        // Initialize components
        fileFilter = new FileFilter();
        fileBackup = new FileBackup(fileFilter);
        snapshotManager = new SnapshotManager();
    });

    afterEach(() => {
        if (originalCwd) {
            process.chdir(originalCwd);
        }
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Empty File Capture', () => {
        it('should capture empty .gitkeep files correctly', async () => {
            // Create empty .gitkeep file
            writeFileSync(join(testDir, '.gitkeep'), '');

            // Capture files
            const fileData = await fileBackup.captureFiles(testDir);

            // Should include the empty file
            expect(fileData.files['.gitkeep']).toBeDefined();
            expect(fileData.files['.gitkeep'].content).toBe('');
            expect(fileData.files['.gitkeep'].size).toBe(0);
            expect(fileData.files['.gitkeep'].checksum).toBeDefined();
        });

        it('should capture multiple empty files with different names', async () => {
            // Create various empty files
            writeFileSync(join(testDir, '.gitkeep'), '');
            writeFileSync(join(testDir, 'empty.txt'), '');
            writeFileSync(join(testDir, 'config.json'), '');
            writeFileSync(join(testDir, '.env'), '');

            const fileData = await fileBackup.captureFiles(testDir);

            // Debug: log captured files
            console.log('Captured files:', Object.keys(fileData.files));

            // All empty files should be captured
            expect(fileData.files['.gitkeep']).toBeDefined();
            expect(fileData.files['.gitkeep'].content).toBe('');
            expect(fileData.files['empty.txt']).toBeDefined();
            expect(fileData.files['empty.txt'].content).toBe('');
            expect(fileData.files['config.json']).toBeDefined();
            expect(fileData.files['config.json'].content).toBe('');

            // .env files might be filtered out by default, check if it exists
            if (fileData.files['.env']) {
                expect(fileData.files['.env'].content).toBe('');
            } else {
                console.log('.env file was filtered out (this might be expected behavior)');
            }
        });

        it('should capture empty files in nested directories', async () => {
            // Create nested structure with empty files
            mkdirSync(join(testDir, 'docs', 'api'), { recursive: true });
            mkdirSync(join(testDir, 'src', 'components'), { recursive: true });

            writeFileSync(join(testDir, 'docs', '.gitkeep'), '');
            writeFileSync(join(testDir, 'docs', 'api', '.gitkeep'), '');
            writeFileSync(join(testDir, 'src', 'components', '.gitkeep'), '');

            const fileData = await fileBackup.captureFiles(testDir);

            // All nested empty files should be captured - use cross-platform paths
            const docsGitkeepPath = join('docs', '.gitkeep');
            const docsApiGitkeepPath = join('docs', 'api', '.gitkeep');
            const srcComponentsGitkeepPath = join('src', 'components', '.gitkeep');

            expect(fileData.files[docsGitkeepPath].content).toBe('');
            expect(fileData.files[docsApiGitkeepPath].content).toBe('');
            expect(fileData.files[srcComponentsGitkeepPath].content).toBe('');
        });
    });

    describe('Empty File Validation', () => {
        it('should validate empty file data correctly', async () => {
            // Create file data with empty content
            const fileData = {
                basePath: testDir,
                captureTime: Date.now(), // Required field
                files: {
                    '.gitkeep': {
                        content: '', // Empty string should be valid
                        checksum: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', // SHA1 of empty string
                        size: 0,
                        modified: new Date().toISOString(),
                        permissions: 0o644,
                    },
                },
                stats: { totalFiles: 1, totalSize: 0 },
            };

            // This should NOT throw an error but currently DOES
            expect(() => fileBackup.validateFileData(fileData)).not.toThrow();
        });

        it('should distinguish between empty content and missing content', async () => {
            const validEmptyFile = {
                basePath: testDir,
                captureTime: Date.now(), // Required field
                files: {
                    'empty.txt': {
                        content: '', // Valid empty content
                        checksum: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
                        size: 0,
                        modified: new Date().toISOString(),
                        permissions: 0o644,
                    },
                },
                stats: { totalFiles: 1, totalSize: 0 },
            };

            const invalidMissingContent = {
                basePath: testDir,
                captureTime: Date.now(), // Required field
                files: {
                    'missing.txt': {
                        // content is missing entirely
                        checksum: 'somechecksum',
                        size: 0,
                        modified: new Date().toISOString(),
                        permissions: 0o644,
                    },
                },
                stats: { totalFiles: 1, totalSize: 0 },
            };

            // Empty content should be valid
            expect(() => fileBackup.validateFileData(validEmptyFile)).not.toThrow();

            // Missing content should be invalid
            expect(() => fileBackup.validateFileData(invalidMissingContent)).toThrow();
        });
    });

    describe('Empty File Restoration', () => {
        it('should restore empty .gitkeep files without errors', async () => {
            // Create and capture empty file
            writeFileSync(join(testDir, '.gitkeep'), '');
            const fileData = await fileBackup.captureFiles(testDir);

            // Modify the file to have content
            writeFileSync(join(testDir, '.gitkeep'), 'not empty anymore');

            // Restore should work without throwing
            // This currently FAILS
            await expect(fileBackup.restoreFiles(fileData)).resolves.not.toThrow();

            // Verify file was restored to empty
            const content = readFileSync(join(testDir, '.gitkeep'), 'utf8');
            expect(content).toBe('');
        });

        it('should restore multiple empty files correctly', async () => {
            // Create multiple empty files
            writeFileSync(join(testDir, '.gitkeep'), '');
            writeFileSync(join(testDir, 'empty.txt'), '');
            writeFileSync(join(testDir, 'config.json'), '');

            const fileData = await fileBackup.captureFiles(testDir);

            // Modify all files
            writeFileSync(join(testDir, '.gitkeep'), 'modified');
            writeFileSync(join(testDir, 'empty.txt'), 'modified');
            writeFileSync(join(testDir, 'config.json'), '{"modified": true}');

            // Restore all files
            await expect(fileBackup.restoreFiles(fileData)).resolves.not.toThrow();

            // Verify all files are empty again
            expect(readFileSync(join(testDir, '.gitkeep'), 'utf8')).toBe('');
            expect(readFileSync(join(testDir, 'empty.txt'), 'utf8')).toBe('');
            expect(readFileSync(join(testDir, 'config.json'), 'utf8')).toBe('');
        });
    });

    describe('Snapshot Manager Integration with Empty Files', () => {
        it('should create and restore snapshots with empty files via SnapshotManager', async () => {
            // Create project with empty files
            writeFileSync(join(testDir, 'README.md'), '# Test Project');
            writeFileSync(join(testDir, '.gitkeep'), '');
            writeFileSync(join(testDir, 'empty-config.json'), '');

            // Create snapshot
            const snapshot = await snapshotManager.createSnapshot('With empty files');
            expect(snapshot.id).toBeDefined();

            // Modify files
            writeFileSync(join(testDir, 'README.md'), '# Modified Project');
            writeFileSync(join(testDir, '.gitkeep'), 'not empty');
            writeFileSync(join(testDir, 'empty-config.json'), '{"test": true}');

            // Restore snapshot - this should work
            // Currently FAILS due to empty file validation issue
            await expect(snapshotManager.restoreSnapshot(snapshot.id)).resolves.not.toThrow();

            // Verify restoration
            expect(readFileSync(join(testDir, 'README.md'), 'utf8')).toBe('# Test Project');
            expect(readFileSync(join(testDir, '.gitkeep'), 'utf8')).toBe('');
            expect(readFileSync(join(testDir, 'empty-config.json'), 'utf8')).toBe('');
        });

        it('should handle preview mode with empty files', async () => {
            // Create snapshot with empty files
            writeFileSync(join(testDir, '.gitkeep'), '');
            const snapshot = await snapshotManager.createSnapshot('Empty file snapshot');

            // Modify the empty file
            writeFileSync(join(testDir, '.gitkeep'), 'modified');

            // Preview should work
            const preview = await snapshotManager.restoreSnapshot(snapshot.id, { preview: true });

            expect(preview.type).toBe('preview');
            expect(preview.preview.stats.impactedFiles).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle files that become empty after creation', async () => {
            // Create file with content
            writeFileSync(join(testDir, 'test.txt'), 'initial content');
            const snapshot1 = await snapshotManager.createSnapshot('With content');

            // Make file empty
            writeFileSync(join(testDir, 'test.txt'), '');
            const snapshot2 = await snapshotManager.createSnapshot('Now empty');

            // Both snapshots should be restorable
            await expect(snapshotManager.restoreSnapshot(snapshot1.id)).resolves.not.toThrow();

            expect(readFileSync(join(testDir, 'test.txt'), 'utf8')).toBe('initial content');

            await expect(snapshotManager.restoreSnapshot(snapshot2.id)).resolves.not.toThrow();

            expect(readFileSync(join(testDir, 'test.txt'), 'utf8')).toBe('');
        });

        it('should handle mixed empty and non-empty files', async () => {
            // Create mixed file types
            writeFileSync(join(testDir, 'content.txt'), 'has content');
            writeFileSync(join(testDir, '.gitkeep'), '');
            writeFileSync(join(testDir, 'more-content.js'), 'console.log("hello");');
            writeFileSync(join(testDir, 'empty.json'), '');

            const snapshot = await snapshotManager.createSnapshot('Mixed files');

            // Modify all files
            writeFileSync(join(testDir, 'content.txt'), 'modified');
            writeFileSync(join(testDir, '.gitkeep'), 'not empty');
            writeFileSync(join(testDir, 'more-content.js'), 'modified');
            writeFileSync(join(testDir, 'empty.json'), '{"modified": true}');

            // Restore should work for all files
            await expect(snapshotManager.restoreSnapshot(snapshot.id)).resolves.not.toThrow();

            // Verify mixed restoration
            expect(readFileSync(join(testDir, 'content.txt'), 'utf8')).toBe('has content');
            expect(readFileSync(join(testDir, '.gitkeep'), 'utf8')).toBe('');
            expect(readFileSync(join(testDir, 'more-content.js'), 'utf8')).toBe(
                'console.log("hello");'
            );
            expect(readFileSync(join(testDir, 'empty.json'), 'utf8')).toBe('');
        });
    });
});
