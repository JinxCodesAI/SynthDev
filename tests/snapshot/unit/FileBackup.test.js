/**
 * Unit tests for FileBackup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileBackup } from '../../../src/core/snapshot/FileBackup.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    })
}));

// Mock fs module
vi.mock('fs', () => ({
    promises: {
        readdir: vi.fn(),
        stat: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        copyFile: vi.fn(),
        chmod: vi.fn(),
        utimes: vi.fn(),
        rm: vi.fn()
    }
}));

// Mock path module
vi.mock('path', () => ({
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
    relative: vi.fn((from, to) => to.replace(from + '/', ''))
}));

describe('FileBackup', () => {
    let fileBackup;
    let mockFileFilter;
    let mockConfig;
    let mockFs;

    beforeEach(async () => {
        // Mock file filter
        mockFileFilter = {
            shouldIncludeFile: vi.fn().mockReturnValue(true),
            shouldIncludeDirectory: vi.fn().mockReturnValue(true)
        };

        // Mock configuration
        mockConfig = {
            maxFileSize: 1024 * 1024, // 1MB
            createBackups: true,
            preservePermissions: true
        };

        // Get mocked fs
        mockFs = await import('fs');

        fileBackup = new FileBackup(mockFileFilter, mockConfig);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with file filter and config', () => {
            expect(fileBackup.fileFilter).toBe(mockFileFilter);
            expect(fileBackup.config).toEqual(expect.objectContaining(mockConfig));
        });

        it('should initialize with default config when not provided', () => {
            const defaultBackup = new FileBackup(mockFileFilter);
            expect(defaultBackup.config.maxFileSize).toBe(10 * 1024 * 1024);
            expect(defaultBackup.config.createBackups).toBe(true);
        });

        it('should work without file filter', () => {
            const noFilterBackup = new FileBackup(null, mockConfig);
            expect(noFilterBackup.fileFilter).toBeNull();
        });
    });

    describe('captureFiles', () => {
        beforeEach(() => {
            // Mock directory structure
            mockFs.promises.readdir.mockImplementation((path) => {
                if (path === '/test') {
                    return Promise.resolve([
                        { name: 'file1.js', isDirectory: () => false, isFile: () => true },
                        { name: 'subdir', isDirectory: () => true, isFile: () => false }
                    ]);
                } else if (path === '/test/subdir') {
                    return Promise.resolve([
                        { name: 'file2.txt', isDirectory: () => false, isFile: () => true }
                    ]);
                }
                return Promise.resolve([]);
            });

            mockFs.promises.stat.mockResolvedValue({
                size: 1024,
                mtime: new Date('2023-01-01T10:00:00Z'),
                mode: 0o644,
                uid: 1000,
                gid: 1000,
                atime: new Date('2023-01-01T09:00:00Z'),
                ctime: new Date('2023-01-01T08:00:00Z')
            });

            mockFs.promises.readFile.mockResolvedValue('file content');
        });

        it('should capture files from directory', async () => {
            const result = await fileBackup.captureFiles('/test');

            expect(result).toHaveProperty('basePath', '/test');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('files');
            expect(result).toHaveProperty('stats');
            expect(result.stats.totalFiles).toBe(2);
        });

        it('should apply file filtering', async () => {
            mockFileFilter.shouldIncludeFile.mockReturnValue(false);

            const result = await fileBackup.captureFiles('/test');

            expect(result.stats.totalFiles).toBe(0);
            expect(result.stats.skippedFiles).toBe(2);
        });

        it('should skip files exceeding size limit', async () => {
            mockFs.promises.stat.mockResolvedValue({
                size: 2 * 1024 * 1024, // 2MB
                mtime: new Date(),
                mode: 0o644
            });

            const result = await fileBackup.captureFiles('/test');

            expect(result.stats.skippedFiles).toBe(2);
        });

        it('should handle file read errors gracefully', async () => {
            mockFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));

            const result = await fileBackup.captureFiles('/test');

            expect(result.stats.errors.length).toBeGreaterThan(0);
        });

        it('should include metadata when requested', async () => {
            const result = await fileBackup.captureFiles('/test', { includeMetadata: true });

            const fileKeys = Object.keys(result.files);
            if (fileKeys.length > 0) {
                expect(result.files[fileKeys[0]]).toHaveProperty('metadata');
            }
        });
    });

    describe('restoreFiles', () => {
        let mockFileData;

        beforeEach(() => {
            mockFileData = {
                basePath: '/test',
                timestamp: '2023-01-01T10:00:00Z',
                files: {
                    'file1.js': {
                        content: 'console.log("hello");',
                        size: 20,
                        mtime: '2023-01-01T10:00:00Z',
                        mode: 0o644
                    },
                    'subdir/file2.txt': {
                        content: 'text content',
                        size: 12,
                        mtime: '2023-01-01T10:00:00Z',
                        mode: 0o644
                    }
                }
            };

            mockFs.promises.mkdir.mockResolvedValue();
            mockFs.promises.writeFile.mockResolvedValue();
            mockFs.promises.chmod.mockResolvedValue();
            mockFs.promises.utimes.mockResolvedValue();
            mockFs.promises.copyFile.mockResolvedValue();
        });

        it('should restore files successfully', async () => {
            const result = await fileBackup.restoreFiles(mockFileData);

            expect(result.filesRestored).toBe(2);
            expect(result.filesSkipped).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(2);
        });

        it('should create directories as needed', async () => {
            await fileBackup.restoreFiles(mockFileData);

            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('subdir'),
                { recursive: true }
            );
        });

        it('should preserve file permissions when enabled', async () => {
            await fileBackup.restoreFiles(mockFileData, { preservePermissions: true });

            expect(mockFs.promises.chmod).toHaveBeenCalledWith(
                expect.any(String),
                0o644
            );
        });

        it('should skip permission restoration when disabled', async () => {
            await fileBackup.restoreFiles(mockFileData, { preservePermissions: false });

            expect(mockFs.promises.chmod).not.toHaveBeenCalled();
        });

        it('should handle file restoration errors gracefully', async () => {
            mockFs.promises.writeFile.mockRejectedValueOnce(new Error('Write failed'));

            const result = await fileBackup.restoreFiles(mockFileData);

            expect(result.filesRestored).toBe(1);
            expect(result.filesSkipped).toBe(1);
            expect(result.errors).toHaveLength(1);
        });

        it('should reject invalid file data', async () => {
            await expect(fileBackup.restoreFiles(null)).rejects.toThrow(
                'Invalid file data provided for restoration'
            );

            await expect(fileBackup.restoreFiles({})).rejects.toThrow(
                'Invalid file data provided for restoration'
            );
        });

        it('should create backup when enabled', async () => {
            mockFs.promises.stat.mockResolvedValue({ size: 100 });

            await fileBackup.restoreFiles(mockFileData, { createBackup: true });

            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringMatching(/\.synth-backup/),
                { recursive: true }
            );
        });
    });

    describe('previewRestore', () => {
        let mockFileData;

        beforeEach(() => {
            mockFileData = {
                basePath: '/test',
                timestamp: '2023-01-01T10:00:00Z',
                files: {
                    'existing.js': {
                        content: 'new content',
                        size: 11
                    },
                    'new.txt': {
                        content: 'new file',
                        size: 8
                    }
                }
            };
        });

        it('should preview restore operation', async () => {
            // Mock existing file
            mockFs.promises.stat.mockImplementation((path) => {
                if (path.includes('existing.js')) {
                    return Promise.resolve({
                        isFile: () => true,
                        size: 100,
                        mtime: new Date('2023-01-01T09:00:00Z')
                    });
                }
                throw { code: 'ENOENT' };
            });

            mockFs.promises.readFile.mockResolvedValue('old content');

            const preview = await fileBackup.previewRestore(mockFileData);

            expect(preview.changes.toCreate).toHaveLength(1);
            expect(preview.changes.toModify).toHaveLength(1);
            expect(preview.changes.toCreate[0].path).toBe('new.txt');
            expect(preview.changes.toModify[0].path).toBe('existing.js');
        });

        it('should assess risk level correctly', async () => {
            mockFs.promises.stat.mockRejectedValue({ code: 'ENOENT' });

            const preview = await fileBackup.previewRestore(mockFileData);

            expect(preview.impact.riskLevel).toBe('low');
        });

        it('should detect conflicts', async () => {
            mockFs.promises.stat.mockRejectedValue(new Error('Permission denied'));

            const preview = await fileBackup.previewRestore(mockFileData);

            expect(preview.changes.conflicts).toHaveLength(2);
            expect(preview.impact.riskLevel).toBe('high');
        });
    });

    describe('validateFileData', () => {
        it('should validate correct file data', () => {
            const validData = {
                files: {
                    'test.js': {
                        content: 'console.log("test");',
                        size: 20
                    }
                }
            };

            expect(fileBackup.validateFileData(validData)).toBe(true);
        });

        it('should reject invalid file data', () => {
            expect(fileBackup.validateFileData(null)).toBe(false);
            expect(fileBackup.validateFileData({})).toBe(false);
            expect(fileBackup.validateFileData({ files: null })).toBe(false);
        });

        it('should reject dangerous file paths', () => {
            const dangerousData = {
                files: {
                    '../../../etc/passwd': {
                        content: 'malicious',
                        size: 9
                    }
                }
            };

            expect(fileBackup.validateFileData(dangerousData)).toBe(false);
        });

        it('should reject invalid file content', () => {
            const invalidData = {
                files: {
                    'test.js': {
                        content: null,
                        size: 0
                    }
                }
            };

            expect(fileBackup.validateFileData(invalidData)).toBe(false);
        });
    });
});
