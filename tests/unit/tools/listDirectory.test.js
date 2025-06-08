// tests/unit/tools/listDirectory.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { statSync, readdirSync } from 'fs';
import listDirectory from '../../../tools/list_directory/implementation.js';

// Mock fs functions and scanDirectory
vi.mock('fs', () => ({
    statSync: vi.fn(),
    readdirSync: vi.fn(),
}));

vi.mock('../../../tools/common/fs_utils.js', () => ({
    scanDirectory: vi.fn(),
}));

describe('ListDirectory Tool', () => {
    let mockScanDirectory;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Mock process.cwd() to return a consistent path
        vi.spyOn(process, 'cwd').mockReturnValue('/test/workspace');

        // Get the mocked scanDirectory function
        const fsUtils = await import('../../../tools/common/fs_utils.js');
        mockScanDirectory = fsUtils.scanDirectory;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('successful directory listing', () => {
        beforeEach(() => {
            // Mock successful directory stats
            statSync.mockReturnValue({
                isDirectory: () => true,
                isFile: () => false,
            });
        });

        it('should list directory contents with default parameters', async () => {
            // Mock non-recursive directory listing
            readdirSync.mockReturnValue(['file1.txt', 'file2.js', 'subdir']);

            // Mock individual file stats
            statSync.mockImplementation(path => {
                if (path.includes('subdir')) {
                    return {
                        isDirectory: () => true,
                        isFile: () => false,
                        size: 0,
                        mtime: new Date('2024-01-01T00:00:00.000Z'),
                    };
                }
                return {
                    isDirectory: () => false,
                    isFile: () => true,
                    size: 1024,
                    mtime: new Date('2024-01-01T00:00:00.000Z'),
                };
            });

            const result = await listDirectory({ directory_path: '.' });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('list_directory');
            expect(result.directory_path).toBe('.');
            expect(result.total_items).toBe(3);
            expect(result.directories).toHaveLength(1);
            expect(result.files).toHaveLength(2);
            expect(result.timestamp).toBeDefined();
        });

        it('should handle recursive directory scanning', async () => {
            mockScanDirectory.mockReturnValue([
                { name: 'file1.txt', path: './file1.txt', type: 'file', size: 1024, lvl: 0 },
                { name: 'subdir', path: './subdir', type: 'directory', lvl: 0 },
                { name: 'file2.js', path: './subdir/file2.js', type: 'file', size: 512, lvl: 1 },
            ]);

            const result = await listDirectory({
                directory_path: '.',
                recursive: true,
            });

            expect(result.success).toBe(true);
            expect(result.total_items).toBe(3);
            expect(result.directories).toHaveLength(1);
            expect(result.files).toHaveLength(2);

            // Check file details
            expect(result.files[0]).toEqual({
                name: 'file1.txt',
                path: './file1.txt',
                type: 'file',
                size: 1024,
                extension: '.txt',
                depth: 0,
            });

            expect(mockScanDirectory).toHaveBeenCalledWith(expect.stringContaining('workspace'), {
                depth: 5,
                includeHidden: false,
                exclusionList: expect.arrayContaining(['node_modules', '.git']),
            });
        });

        it('should handle custom parameters', async () => {
            mockScanDirectory.mockReturnValue([]);

            const result = await listDirectory({
                directory_path: 'custom/path',
                recursive: true,
                include_hidden: true,
                max_depth: 3,
                exclusion_list: ['custom_exclude'],
            });

            expect(result.success).toBe(true);
            expect(mockScanDirectory).toHaveBeenCalledWith(expect.stringContaining('custom/path'), {
                depth: 3,
                includeHidden: true,
                exclusionList: ['custom_exclude'],
            });
        });

        it('should default to current directory when path is empty', async () => {
            readdirSync.mockReturnValue([]);

            const result = await listDirectory({ directory_path: '' });

            expect(result.success).toBe(true);
            expect(result.directory_path).toBe('.');
        });

        it('should handle include_hidden parameter', async () => {
            mockScanDirectory.mockReturnValue([
                { name: '.hidden', path: './.hidden', type: 'file', size: 100, lvl: 0 },
                { name: 'visible.txt', path: './visible.txt', type: 'file', size: 200, lvl: 0 },
            ]);

            const result = await listDirectory({
                directory_path: '.',
                recursive: true,
                include_hidden: true,
            });

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(2);
            expect(result.files.some(f => f.name === '.hidden')).toBe(true);
        });
    });

    describe('parameter validation', () => {
        it('should require directory_path parameter', async () => {
            const result = await listDirectory({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('directory_path parameter is required');
        });

        it('should validate directory_path type', async () => {
            const result = await listDirectory({ directory_path: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('directory_path parameter must be of type string');
        });

        it('should validate max_depth range', async () => {
            const result = await listDirectory({
                directory_path: '.',
                max_depth: 15,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('max_depth parameter must be a number between 1 and 10');
        });

        it('should validate max_depth minimum', async () => {
            const result = await listDirectory({
                directory_path: '.',
                max_depth: 0,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('max_depth parameter must be a number between 1 and 10');
        });

        it('should validate boolean parameters', async () => {
            const result = await listDirectory({
                directory_path: '.',
                recursive: 'yes',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('recursive parameter must be of type boolean');
        });
    });

    describe('path validation and security', () => {
        it('should reject path traversal attempts', async () => {
            const result = await listDirectory({ directory_path: '../../../etc' });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should reject absolute paths outside workspace', async () => {
            const result = await listDirectory({ directory_path: '/etc' });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should allow relative paths within workspace', async () => {
            statSync.mockReturnValue({
                isDirectory: () => true,
                isFile: () => false,
            });
            readdirSync.mockReturnValue([]);

            const result = await listDirectory({ directory_path: 'subdir' });

            expect(result.success).toBe(true);
        });
    });

    describe('file system errors', () => {
        it('should handle directory not found', async () => {
            statSync.mockImplementation(() => {
                const error = new Error('ENOENT: no such file or directory');
                error.code = 'ENOENT';
                throw error;
            });

            const result = await listDirectory({ directory_path: 'nonexistent' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should handle permission denied', async () => {
            statSync.mockImplementation(() => {
                const error = new Error('EACCES: permission denied');
                error.code = 'EACCES';
                throw error;
            });

            const result = await listDirectory({ directory_path: 'restricted' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
        });

        it('should handle file instead of directory', async () => {
            statSync.mockReturnValue({
                isDirectory: () => false,
                isFile: () => true,
            });

            const result = await listDirectory({ directory_path: 'file.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Path is not a directory');
            expect(result.path_type).toBe('file');
        });

        it('should handle scanDirectory errors in recursive mode', async () => {
            statSync.mockReturnValue({
                isDirectory: () => true,
                isFile: () => false,
            });

            mockScanDirectory.mockImplementation(() => {
                throw new Error('Scan error');
            });

            const result = await listDirectory({
                directory_path: '.',
                recursive: true,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Scan error');
        });

        it('should handle readdirSync errors in non-recursive mode', async () => {
            statSync.mockReturnValue({
                isDirectory: () => true,
                isFile: () => false,
            });

            readdirSync.mockImplementation(() => {
                const error = new Error('EACCES: permission denied');
                error.code = 'EACCES';
                throw error;
            });

            const result = await listDirectory({ directory_path: '.' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
        });
    });

    describe('edge cases', () => {
        it('should handle empty directory', async () => {
            statSync.mockReturnValue({
                isDirectory: () => true,
                isFile: () => false,
            });
            readdirSync.mockReturnValue([]);

            const result = await listDirectory({ directory_path: '.' });

            expect(result.success).toBe(true);
            expect(result.total_items).toBe(0);
            expect(result.directories).toEqual([]);
            expect(result.files).toEqual([]);
        });

        it('should handle unexpected errors', async () => {
            statSync.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await listDirectory({ directory_path: '.' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unexpected error');
            expect(result.stack).toBeDefined();
        });

        it('should normalize path separators', async () => {
            mockScanDirectory.mockReturnValue([
                { name: 'file.txt', path: 'subdir\\file.txt', type: 'file', size: 100, lvl: 1 },
            ]);

            const result = await listDirectory({
                directory_path: '.',
                recursive: true,
            });

            expect(result.success).toBe(true);
            expect(result.files[0].path).toBe('subdir/file.txt'); // Normalized to forward slashes
        });
    });
});
