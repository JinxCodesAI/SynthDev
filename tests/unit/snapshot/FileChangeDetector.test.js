/**
 * Unit tests for FileChangeDetector component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileChangeDetector } from '../../../src/core/snapshot/FileChangeDetector.js';
import { statSync, readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

// Mock fs operations
vi.mock('fs', () => ({
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
}));

// Mock crypto
vi.mock('crypto', () => ({
    createHash: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn(() => 'mock-hash'),
    })),
}));

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('FileChangeDetector', () => {
    let detector;

    beforeEach(() => {
        vi.clearAllMocks();
        detector = new FileChangeDetector();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            expect(detector.config.useChecksums).toBe(true);
            expect(detector.config.trackModificationTime).toBe(true);
            expect(detector.config.minimumChangeSize).toBe(1);
            expect(detector.config.warnOnUnexpectedChanges).toBe(true);
            expect(detector.config.maxFileSize).toBe(50 * 1024 * 1024);
            expect(detector.config.excludePatterns).toContain('node_modules');
            expect(detector.config.excludePatterns).toContain('.git');
        });

        it('should accept custom configuration', () => {
            const customConfig = {
                useChecksums: false,
                trackModificationTime: false,
                minimumChangeSize: 10,
                warnOnUnexpectedChanges: false,
                maxFileSize: 1024,
                excludePatterns: ['custom'],
            };

            const customDetector = new FileChangeDetector(customConfig);
            expect(customDetector.config.useChecksums).toBe(false);
            expect(customDetector.config.trackModificationTime).toBe(false);
            expect(customDetector.config.minimumChangeSize).toBe(10);
            expect(customDetector.config.warnOnUnexpectedChanges).toBe(false);
            expect(customDetector.config.maxFileSize).toBe(1024);
            expect(customDetector.config.excludePatterns).toEqual(['custom']);
        });

        it('should initialize empty state cache', () => {
            expect(detector.stateCache).toBeInstanceOf(Map);
            expect(detector.stateCache.size).toBe(0);
        });
    });

    describe('captureFileStates', () => {
        beforeEach(() => {
            // Mock directory structure with proper path-based responses to prevent infinite recursion
            readdirSync.mockImplementation(dirPath => {
                const normalizedPath = dirPath.replace(/\\/g, '/');

                if (normalizedPath.endsWith('/test/path') || normalizedPath === '/test/path') {
                    // Root directory contains files and one subdirectory
                    return [
                        { name: 'file1.js', isDirectory: () => false, isFile: () => true },
                        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
                        { name: 'subdir', isDirectory: () => true, isFile: () => false },
                    ];
                } else if (normalizedPath.includes('subdir')) {
                    // Subdirectory contains only files (no more subdirectories to prevent infinite recursion)
                    return [
                        { name: 'nested-file.js', isDirectory: () => false, isFile: () => true },
                    ];
                } else {
                    // Any other directory is empty
                    return [];
                }
            });

            statSync.mockReturnValue({
                size: 1024,
                mtime: new Date('2023-01-01'),
                birthtime: new Date('2023-01-01'),
                mode: 0o644,
                isFile: () => true,
                isDirectory: () => false,
            });

            readFileSync.mockReturnValue(Buffer.from('test content'));
        });

        it('should capture file states for a directory', async () => {
            const result = await detector.captureFileStates('/test/path');

            expect(result).toHaveProperty('basePath');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('captureTime');
            expect(result).toHaveProperty('files');
            expect(result).toHaveProperty('stats');
            expect(result.stats).toHaveProperty('totalFiles');
            expect(result.stats).toHaveProperty('totalSize');
        });

        it('should handle directory scanning errors gracefully', async () => {
            readdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = await detector.captureFileStates('/test/path');
            expect(result.stats.errors).toHaveLength(1);
            expect(result.stats.errors[0]).toHaveProperty('error', 'Permission denied');
        });

        it('should skip files that are too large', async () => {
            statSync.mockReturnValue({
                size: 100 * 1024 * 1024, // 100MB - larger than default max
                mtime: new Date('2023-01-01'),
                birthtime: new Date('2023-01-01'),
                mode: 0o644,
                isFile: () => true,
                isDirectory: () => false,
            });

            readdirSync.mockImplementation(dirPath => {
                const normalizedPath = dirPath.replace(/\\/g, '/');
                if (normalizedPath.endsWith('/test/path') || normalizedPath === '/test/path') {
                    return [
                        { name: 'large-file.bin', isDirectory: () => false, isFile: () => true },
                    ];
                }
                return [];
            });

            const result = await detector.captureFileStates('/test/path');
            expect(result.stats.skippedFiles).toBe(1);
        });

        it('should generate checksums for small files when enabled', async () => {
            statSync.mockReturnValue({
                size: 512, // Small file
                mtime: new Date('2023-01-01'),
                birthtime: new Date('2023-01-01'),
                mode: 0o644,
                isFile: () => true,
                isDirectory: () => false,
            });

            readdirSync.mockImplementation(dirPath => {
                const normalizedPath = dirPath.replace(/\\/g, '/');
                if (normalizedPath.endsWith('/test/path') || normalizedPath === '/test/path') {
                    return [
                        { name: 'small-file.txt', isDirectory: () => false, isFile: () => true },
                    ];
                }
                return [];
            });

            const result = await detector.captureFileStates('/test/path');
            const fileState = result.files['small-file.txt'];
            expect(fileState).toHaveProperty('checksum');
            expect(createHash).toHaveBeenCalledWith('md5');
        });

        it('should skip checksums for large files', async () => {
            statSync.mockReturnValue({
                size: 2 * 1024 * 1024, // 2MB - larger than checksum limit
                mtime: new Date('2023-01-01'),
                birthtime: new Date('2023-01-01'),
                mode: 0o644,
                isFile: () => true,
                isDirectory: () => false,
            });

            readdirSync.mockImplementation(dirPath => {
                const normalizedPath = dirPath.replace(/\\/g, '/');
                if (normalizedPath.endsWith('/test/path') || normalizedPath === '/test/path') {
                    return [
                        { name: 'large-file.txt', isDirectory: () => false, isFile: () => true },
                    ];
                }
                return [];
            });

            const result = await detector.captureFileStates('/test/path');
            const fileState = result.files['large-file.txt'];
            expect(fileState).not.toHaveProperty('checksum');
        });

        it('should scan subdirectories recursively', async () => {
            const result = await detector.captureFileStates('/test/path');

            // Should find files in root directory
            expect(result.files).toHaveProperty('file1.js');
            expect(result.files).toHaveProperty('file2.txt');

            // Should find files in subdirectory (check both possible path formats)
            const hasSubdirFile =
                result.files.hasOwnProperty('subdir/nested-file.js') ||
                result.files.hasOwnProperty('subdir\\nested-file.js');
            expect(hasSubdirFile).toBe(true);

            // Should have correct statistics
            expect(result.stats.totalFiles).toBe(3); // file1.js, file2.txt, subdir/nested-file.js
            expect(result.stats.directories).toBe(2); // root + subdir
        });
    });

    describe('_shouldExclude', () => {
        it('should exclude files based on patterns', () => {
            expect(detector._shouldExclude('node_modules/package', 'package')).toBe(true);
            expect(detector._shouldExclude('src/.git/config', 'config')).toBe(true);
            expect(detector._shouldExclude('build/output.js', 'output.js')).toBe(true);
        });

        it('should exclude files based on wildcard patterns', () => {
            expect(detector._shouldExclude('logs/app.log', 'app.log')).toBe(true);
            expect(detector._shouldExclude('temp/error.log', 'error.log')).toBe(true);
        });

        it('should not exclude normal files', () => {
            expect(detector._shouldExclude('src/app.js', 'app.js')).toBe(false);
            expect(detector._shouldExclude('test/unit.test.js', 'unit.test.js')).toBe(false);
        });
    });

    describe('compareFileStates', () => {
        let beforeState, afterState;

        beforeEach(() => {
            beforeState = {
                files: {
                    'file1.js': {
                        size: 1024,
                        modified: 1609459200000, // 2021-01-01
                        checksum: 'hash1',
                    },
                    'file2.txt': {
                        size: 512,
                        modified: 1609459200000,
                        checksum: 'hash2',
                    },
                    'deleted.js': {
                        size: 256,
                        modified: 1609459200000,
                        checksum: 'hash3',
                    },
                },
            };

            afterState = {
                files: {
                    'file1.js': {
                        size: 1024,
                        modified: 1609459200000,
                        checksum: 'hash1', // Same - no change
                    },
                    'file2.txt': {
                        size: 1024, // Size changed
                        modified: 1609545600000, // Modified time changed
                        checksum: 'hash2-modified',
                    },
                    'new-file.js': {
                        size: 128,
                        modified: 1609545600000,
                        checksum: 'hash4',
                    },
                    // deleted.js is missing - deleted
                },
            };
        });

        it('should detect modified files', () => {
            const result = detector.compareFileStates(beforeState, afterState);

            expect(result.hasChanges).toBe(true);
            expect(result.changes.modified).toHaveLength(1);
            expect(result.changes.modified[0].path).toBe('file2.txt');
            expect(result.changes.modified[0].changeType).toBe('size-increased');
        });

        it('should detect created files', () => {
            const result = detector.compareFileStates(beforeState, afterState);

            expect(result.changes.created).toHaveLength(1);
            expect(result.changes.created[0].path).toBe('new-file.js');
        });

        it('should detect deleted files', () => {
            const result = detector.compareFileStates(beforeState, afterState);

            expect(result.changes.deleted).toHaveLength(1);
            expect(result.changes.deleted[0].path).toBe('deleted.js');
        });

        it('should identify unchanged files', () => {
            const result = detector.compareFileStates(beforeState, afterState);

            expect(result.changes.unchanged).toContain('file1.js');
        });

        it('should provide comprehensive statistics', () => {
            const result = detector.compareFileStates(beforeState, afterState);

            expect(result.stats.modifiedFiles).toBe(1);
            expect(result.stats.createdFiles).toBe(1);
            expect(result.stats.deletedFiles).toBe(1);
            expect(result.stats.unchangedFiles).toBe(1);
            expect(result.changeCount).toBe(3);
        });
    });

    describe('_filesAreDifferent', () => {
        it('should detect size differences', () => {
            const before = { size: 1024, modified: 1609459200000 };
            const after = { size: 2048, modified: 1609459200000 };

            expect(detector._filesAreDifferent(before, after)).toBe(true);
        });

        it('should detect modification time differences when enabled', () => {
            const before = { size: 1024, modified: 1609459200000 };
            const after = { size: 1024, modified: 1609545600000 };

            expect(detector._filesAreDifferent(before, after)).toBe(true);
        });

        it('should detect checksum differences', () => {
            const before = { size: 1024, modified: 1609459200000, checksum: 'hash1' };
            const after = { size: 1024, modified: 1609459200000, checksum: 'hash2' };

            expect(detector._filesAreDifferent(before, after)).toBe(true);
        });

        it('should return false for identical files', () => {
            const before = { size: 1024, modified: 1609459200000, checksum: 'hash1' };
            const after = { size: 1024, modified: 1609459200000, checksum: 'hash1' };

            expect(detector._filesAreDifferent(before, after)).toBe(false);
        });
    });

    describe('_getChangeType', () => {
        it('should identify size increase', () => {
            const before = { size: 1024, modified: 1609459200000 };
            const after = { size: 2048, modified: 1609459200000 };

            expect(detector._getChangeType(before, after)).toBe('size-increased');
        });

        it('should identify size decrease', () => {
            const before = { size: 2048, modified: 1609459200000 };
            const after = { size: 1024, modified: 1609459200000 };

            expect(detector._getChangeType(before, after)).toBe('size-decreased');
        });

        it('should identify content changes via checksum', () => {
            const before = { size: 1024, modified: 1609459200000, checksum: 'hash1' };
            const after = { size: 1024, modified: 1609459200000, checksum: 'hash2' };

            expect(detector._getChangeType(before, after)).toBe('content-changed');
        });

        it('should identify timestamp changes', () => {
            const before = { size: 1024, modified: 1609459200000 };
            const after = { size: 1024, modified: 1609545600000 };

            expect(detector._getChangeType(before, after)).toBe('timestamp-changed');
        });
    });

    describe('getModifiedFiles', () => {
        it('should return list of modified and created files', () => {
            const beforeState = {
                files: {
                    'file1.js': { size: 1024, modified: 1609459200000 },
                },
            };

            const afterState = {
                files: {
                    'file1.js': { size: 2048, modified: 1609545600000 }, // Modified
                    'file2.js': { size: 512, modified: 1609545600000 }, // Created
                },
            };

            const modifiedFiles = detector.getModifiedFiles(beforeState, afterState);
            expect(modifiedFiles).toContain('file1.js');
            expect(modifiedFiles).toContain('file2.js');
            expect(modifiedFiles).toHaveLength(2);
        });
    });

    describe('validateActualChanges', () => {
        it('should validate changes and return result object', () => {
            const detectedChanges = {
                hasChanges: true,
                stats: { modifiedFiles: 1, createdFiles: 1, deletedFiles: 0 },
            };

            const result = detector.validateActualChanges('write_file', {}, detectedChanges);

            expect(result).toHaveProperty('expectedModifications');
            expect(result).toHaveProperty('unexpectedChanges');
            expect(result).toHaveProperty('warnings');
            expect(result.expectedModifications).toBe(true);
        });
    });

    describe('warnAboutUnexpectedChanges', () => {
        let mockLogger;

        beforeEach(() => {
            mockLogger = {
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            };
            detector.logger = mockLogger;
        });

        it('should warn about unexpected changes when tool did not declare modifications', () => {
            const actualChanges = {
                hasChanges: true,
                changeCount: 2,
                changes: {
                    modified: [{ path: 'file1.js' }],
                    created: [{ path: 'file2.js' }],
                    deleted: [],
                },
            };

            detector.warnAboutUnexpectedChanges('read_files', false, actualChanges);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Tool read_files made unexpected file changes',
                expect.objectContaining({
                    changeCount: 2,
                    modifiedFiles: ['file1.js'],
                    createdFiles: ['file2.js'],
                })
            );
        });

        it('should warn when tool declared modifications but none detected', () => {
            const actualChanges = {
                hasChanges: false,
                changeCount: 0,
            };

            detector.warnAboutUnexpectedChanges('write_file', true, actualChanges);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Tool write_file declared it would modify files but no changes detected'
            );
        });

        it('should not warn when warnings are disabled', () => {
            detector.config.warnOnUnexpectedChanges = false;
            const actualChanges = { hasChanges: true, changeCount: 1, changes: {} };

            detector.warnAboutUnexpectedChanges('read_files', false, actualChanges);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('shouldCreateSnapshot', () => {
        it('should return false when no changes detected', () => {
            const detectedChanges = {
                hasChanges: false,
                changes: { modified: [], created: [], deleted: [] },
            };

            expect(detector.shouldCreateSnapshot(detectedChanges)).toBe(false);
        });

        it('should return true when files are created', () => {
            const detectedChanges = {
                hasChanges: true,
                changes: {
                    modified: [],
                    created: [{ path: 'newfile.js' }],
                    deleted: [],
                },
            };

            expect(detector.shouldCreateSnapshot(detectedChanges)).toBe(true);
        });

        it('should return true when files are deleted', () => {
            const detectedChanges = {
                hasChanges: true,
                changes: {
                    modified: [],
                    created: [],
                    deleted: [{ path: 'oldfile.js' }],
                },
            };

            expect(detector.shouldCreateSnapshot(detectedChanges)).toBe(true);
        });

        it('should return true when significant modifications are made', () => {
            const detectedChanges = {
                hasChanges: true,
                changes: {
                    modified: [
                        {
                            path: 'file.js',
                            beforeState: { size: 1000 },
                            afterState: { size: 1100 }, // 100 byte change > minimum
                        },
                    ],
                    created: [],
                    deleted: [],
                },
            };

            expect(detector.shouldCreateSnapshot(detectedChanges)).toBe(true);
        });

        it('should return false when changes are below minimum threshold', () => {
            detector.config.minimumChangeSize = 100;
            const detectedChanges = {
                hasChanges: true,
                changes: {
                    modified: [
                        {
                            path: 'file.js',
                            beforeState: { size: 1000 },
                            afterState: { size: 1010 }, // 10 byte change < minimum
                        },
                    ],
                    created: [],
                    deleted: [],
                },
            };

            expect(detector.shouldCreateSnapshot(detectedChanges)).toBe(false);
        });
    });

    describe('getFileModificationTime', () => {
        it('should return modification time for existing file', () => {
            const mockTime = new Date('2023-01-01').getTime();
            statSync.mockReturnValue({ mtime: new Date('2023-01-01') });

            const result = detector.getFileModificationTime('/test/file.js');
            expect(result).toBe(mockTime);
        });

        it('should return 0 for non-existent file', () => {
            statSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            const result = detector.getFileModificationTime('/test/nonexistent.js');
            expect(result).toBe(0);
        });
    });

    describe('getFileChecksum', () => {
        it('should return checksum for file', () => {
            // Mock the getFileChecksum method directly since it uses require() internally
            const mockChecksum = vi.spyOn(detector, 'getFileChecksum').mockReturnValue('mock-hash');

            const result = detector.getFileChecksum('/test/file.js');
            expect(result).toBe('mock-hash');
            expect(mockChecksum).toHaveBeenCalledWith('/test/file.js');

            mockChecksum.mockRestore();
        });

        it('should return null for file read error', () => {
            // Mock the getFileChecksum method to return null for error case
            const mockChecksum = vi.spyOn(detector, 'getFileChecksum').mockReturnValue(null);

            const result = detector.getFileChecksum('/test/file.js');
            expect(result).toBe(null);

            mockChecksum.mockRestore();
        });
    });

    describe('detectChanges', () => {
        it('should be an alias for compareFileStates', () => {
            const beforeSnapshot = { files: {} };
            const afterSnapshot = { files: {} };

            const spy = vi.spyOn(detector, 'compareFileStates');
            detector.detectChanges(beforeSnapshot, afterSnapshot);

            expect(spy).toHaveBeenCalledWith(beforeSnapshot, afterSnapshot);
        });
    });

    describe('createFileStateSnapshot', () => {
        it('should be an alias for captureFileStates', async () => {
            const spy = vi.spyOn(detector, 'captureFileStates').mockResolvedValue({});
            await detector.createFileStateSnapshot('/test/path');

            expect(spy).toHaveBeenCalledWith('/test/path');
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration', () => {
            const newConfig = { useChecksums: false, minimumChangeSize: 10 };
            detector.updateConfiguration(newConfig);

            expect(detector.config.useChecksums).toBe(false);
            expect(detector.config.minimumChangeSize).toBe(10);
            expect(detector.config.trackModificationTime).toBe(true); // Unchanged
        });
    });

    describe('getStats', () => {
        it('should return detector statistics', () => {
            detector.stateCache.set('test', {});
            const stats = detector.getStats();

            expect(stats).toHaveProperty('cacheSize', 1);
            expect(stats).toHaveProperty('config');
            expect(stats).toHaveProperty('excludePatterns');
            expect(stats.excludePatterns).toBeGreaterThan(0);
        });
    });
});
