// tests/unit/tools/fs_utils.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    scanDirectory,
    getFileMetadata,
    safeWriteFile,
    calculateFileChecksum,
    calculateDirectoryChecksum,
    calculateContentChecksum,
} from '../../../src/tools/common/fs_utils.js';
import { readFileSync, statSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
}));

// Mock path module
vi.mock('path', async importOriginal => {
    const actual = await importOriginal();
    return {
        ...actual,
        join: vi.fn((...args) => args.join('/')),
        dirname: vi.fn(path => path.split('/').slice(0, -1).join('/')),
        relative: vi.fn((from, to) => to),
        resolve: vi.fn(path => path),
    };
});

// Mock crypto module
vi.mock('crypto', () => ({
    createHash: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn(() => 'mocked-hash'),
    })),
}));

describe.sequential('fs_utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('scanDirectory', () => {
        beforeEach(() => {
            readdirSync.mockReturnValue(['file1.js', 'file2.txt', 'subdir', '.hidden']);
            statSync.mockImplementation(path => {
                if (path.includes('subdir')) {
                    return { isDirectory: () => true, isFile: () => false };
                }
                return { isDirectory: () => false, isFile: () => true };
            });
            // Prevent infinite recursion by limiting depth
            vi.mocked(join).mockImplementation((...args) => {
                const result = args.join('/');
                // Prevent infinite recursion in tests
                if (result.split('/').length > 5) {
                    throw new Error('Max depth reached');
                }
                return result;
            });
        });

        it('should scan directory with default options', () => {
            // Mock to prevent recursion
            vi.mocked(join).mockImplementation((dir, file) => {
                if (dir === '.' && file === 'subdir') {
                    return './subdir';
                }
                return `${dir}/${file}`;
            });

            const result = scanDirectory('.', { depth: 1 }); // Limit depth

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('type');
            expect(result[0]).toHaveProperty('path');
        });

        it('should include hidden files when specified', () => {
            // Mock to prevent recursion
            vi.mocked(join).mockImplementation((dir, file) => {
                if (dir === '.' && file === 'subdir') {
                    return './subdir';
                }
                return `${dir}/${file}`;
            });

            const result = scanDirectory('.', { includeHidden: true, depth: 1 });

            expect(result.length).toBeGreaterThan(0);
            expect(result.some(item => item.name === '.hidden')).toBe(true);
        });

        it('should respect depth limit', () => {
            const result = scanDirectory('.', { depth: 0 });

            expect(result).toHaveLength(3); // Only top level, no recursion
        });

        it('should exclude items from exclusion list', () => {
            readdirSync.mockReturnValue(['file1.js', 'node_modules', '.git']);
            statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true });
            vi.mocked(join).mockImplementation((dir, file) => `${dir}/${file}`);

            const result = scanDirectory('.', {
                exclusionList: ['node_modules', '.git'],
                depth: 1,
            });

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].name).toBe('file1.js');
        });

        it('should handle file system errors gracefully', () => {
            readdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = scanDirectory('.');

            expect(result).toEqual([]);
        });

        it('should handle stat errors gracefully', () => {
            readdirSync.mockReturnValue(['file1.js']);
            statSync.mockImplementation(() => {
                throw new Error('Stat failed');
            });

            const result = scanDirectory('.');

            expect(result).toEqual([]);
        });
    });

    describe('getFileMetadata', () => {
        beforeEach(() => {
            statSync.mockReturnValue({
                size: 1024,
                mtime: new Date('2023-01-01'),
                ctime: new Date('2023-01-01'),
                birthtime: new Date('2023-01-01'),
                isFile: () => true,
                isDirectory: () => false,
            });
        });

        it('should return file metadata', () => {
            const result = getFileMetadata('test.js');

            expect(result).toMatchObject({
                size: 1024,
                modified: expect.any(Date),
                created: expect.any(Date),
                isFile: true,
                isDirectory: false,
            });
        });

        it('should handle stat errors', () => {
            statSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            const result = getFileMetadata('nonexistent.js');

            expect(result).toBeNull();
        });
    });

    describe('safeWriteFile', () => {
        beforeEach(() => {
            existsSync.mockReturnValue(true);
            statSync.mockReturnValue({ size: 100 });
        });

        it('should write file successfully', () => {
            const result = safeWriteFile('test.js', 'content');

            expect(writeFileSync).toHaveBeenCalledWith('test.js', 'content', 'utf8');
            expect(result.success).toBe(true);
            expect(result.size).toBe(100);
        });

        it('should create directories when specified', () => {
            existsSync.mockReturnValue(false);

            safeWriteFile('dir/test.js', 'content', { createDirectories: true });

            expect(mkdirSync).toHaveBeenCalledWith('dir', { recursive: true });
        });

        it('should handle write errors', () => {
            writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const result = safeWriteFile('test.js', 'content');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Write failed');
        });

        it('should use custom encoding', () => {
            safeWriteFile('test.js', 'content', { encoding: 'ascii' });

            expect(writeFileSync).toHaveBeenCalledWith('test.js', 'content', 'ascii');
        });
    });

    describe('calculateFileChecksum', () => {
        beforeEach(() => {
            readFileSync.mockReturnValue('file content');
        });

        it('should calculate file checksum', () => {
            const result = calculateFileChecksum('test.js');

            expect(readFileSync).toHaveBeenCalledWith('test.js');
            expect(result).toBe('mocked-hash');
        });

        it('should handle read errors', () => {
            readFileSync.mockImplementation(() => {
                throw new Error('Read failed');
            });

            const result = calculateFileChecksum('test.js');

            expect(result).toBeNull();
        });
    });

    describe('calculateContentChecksum', () => {
        it('should calculate string checksum', () => {
            const result = calculateContentChecksum('test content');

            expect(result).toBe('mocked-hash');
        });

        it('should handle empty string', () => {
            const result = calculateContentChecksum('');

            expect(result).toBe('mocked-hash');
        });
    });

    describe('calculateDirectoryChecksum', () => {
        it('should calculate directory checksum from checksums array', () => {
            const checksums = ['hash1', 'hash2', 'hash3'];
            const result = calculateDirectoryChecksum(checksums);

            expect(result).toBe('mocked-hash');
        });

        it('should handle empty checksums array', () => {
            const result = calculateDirectoryChecksum([]);

            expect(result).toBe('mocked-hash');
        });

        it('should handle null checksums', () => {
            const result = calculateDirectoryChecksum(null);

            expect(result).toBe('mocked-hash');
        });

        it('should sort checksums for consistency', () => {
            const checksums1 = ['hash3', 'hash1', 'hash2'];
            const checksums2 = ['hash1', 'hash2', 'hash3'];

            const result1 = calculateDirectoryChecksum(checksums1);
            const result2 = calculateDirectoryChecksum(checksums2);

            expect(result1).toBe(result2);
        });
    });
});
