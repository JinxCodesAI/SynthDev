// tests/unit/tools/readFile.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, statSync } from 'fs';
import readFile from '../../../tools/read_file/implementation.js';

// Mock fs functions
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    statSync: vi.fn(),
}));

describe('ReadFile Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock process.cwd() to return a consistent path
        vi.spyOn(process, 'cwd').mockReturnValue('/test/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('successful file reading', () => {
        beforeEach(() => {
            // Mock successful file stats
            statSync.mockReturnValue({
                isFile: () => true,
                size: 1024,
                mtime: new Date('2024-01-01T00:00:00.000Z'),
            });

            // Mock successful file reading
            readFileSync.mockReturnValue('file content here');
        });

        it('should read file successfully with default parameters', async () => {
            const result = await readFile({ file_path: 'test.txt' });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('read_file');
            expect(result.file_path).toBe('test.txt');
            expect(result.content).toBe('file content here');
            expect(result.encoding).toBe('utf8');
            expect(result.size).toBe(17); // Buffer.byteLength('file content here', 'utf8') = 17
            expect(result.modified).toBe('2024-01-01T00:00:00.000Z');
            expect(result.timestamp).toBeDefined();
        });

        it('should read file with custom encoding', async () => {
            const result = await readFile({
                file_path: 'test.txt',
                encoding: 'ascii',
            });

            expect(result.success).toBe(true);
            expect(result.encoding).toBe('ascii');
            expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('test.txt'), 'ascii');
        });

        it('should read file with line range', async () => {
            readFileSync.mockReturnValue('line 1\nline 2\nline 3\nline 4\nline 5');

            const result = await readFile({
                file_path: 'test.txt',
                start_line: 2,
                end_line: 4,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('line 2\nline 3\nline 4');
        });

        it('should read single line when start_line equals end_line', async () => {
            readFileSync.mockReturnValue('line 1\nline 2\nline 3');

            const result = await readFile({
                file_path: 'test.txt',
                start_line: 2,
                end_line: 2,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('line 2');
        });
    });

    describe('parameter validation', () => {
        it('should require file_path parameter', async () => {
            const result = await readFile({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('file_path parameter is required');
        });

        it('should validate file_path type', async () => {
            const result = await readFile({ file_path: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('file_path parameter must be of type string');
        });

        it('should validate start_line parameter', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 1024,
                mtime: new Date(),
            });

            const result = await readFile({
                file_path: 'test.txt',
                start_line: 0,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('start_line must be a positive integer');
        });

        it('should validate end_line parameter', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 1024,
                mtime: new Date(),
            });

            const result = await readFile({
                file_path: 'test.txt',
                start_line: 5,
                end_line: 3,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'end_line must be a positive integer greater than or equal to start_line'
            );
        });
    });

    describe('path validation and security', () => {
        it('should reject path traversal attempts', async () => {
            const result = await readFile({ file_path: '../../../etc/passwd' });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should reject absolute paths outside workspace', async () => {
            const result = await readFile({ file_path: '/etc/passwd' });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should allow relative paths within workspace', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 1024,
                mtime: new Date(),
            });
            readFileSync.mockReturnValue('content');

            const result = await readFile({ file_path: 'subdir/test.txt' });

            expect(result.success).toBe(true);
        });
    });

    describe('file system errors', () => {
        it('should handle file not found', async () => {
            statSync.mockImplementation(() => {
                const error = new Error('ENOENT: no such file or directory');
                error.code = 'ENOENT';
                throw error;
            });

            const result = await readFile({ file_path: 'nonexistent.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should handle permission denied', async () => {
            statSync.mockImplementation(() => {
                const error = new Error('EACCES: permission denied');
                error.code = 'EACCES';
                throw error;
            });

            const result = await readFile({ file_path: 'restricted.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
        });

        it('should handle directory instead of file', async () => {
            statSync.mockReturnValue({
                isFile: () => false,
                size: 0,
                mtime: new Date(),
            });

            const result = await readFile({ file_path: 'directory' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Path is not a file');
            expect(result.path_type).toBe('directory');
        });

        it('should handle file too large', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 20 * 1024 * 1024, // 20MB - larger than default 10MB limit
                mtime: new Date(),
            });

            const result = await readFile({ file_path: 'large_file.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File too large');
        });

        it('should handle read errors', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 1024,
                mtime: new Date(),
            });

            readFileSync.mockImplementation(() => {
                const error = new Error('EACCES: permission denied');
                error.code = 'EACCES';
                throw error;
            });

            const result = await readFile({ file_path: 'test.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied: cannot access');
        });
    });

    describe('edge cases', () => {
        it('should handle empty file', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 0,
                mtime: new Date(),
            });
            readFileSync.mockReturnValue('');

            const result = await readFile({ file_path: 'empty.txt' });

            expect(result.success).toBe(true);
            expect(result.content).toBe('');
            expect(result.size).toBe(0);
        });

        it('should handle line range beyond file content', async () => {
            statSync.mockReturnValue({
                isFile: () => true,
                size: 1024,
                mtime: new Date(),
            });
            readFileSync.mockReturnValue('line 1\nline 2');

            const result = await readFile({
                file_path: 'test.txt',
                start_line: 5,
                end_line: 10,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe(''); // No lines in that range
        });

        it('should handle unexpected errors', async () => {
            statSync.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await readFile({ file_path: 'test.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unexpected error');
            expect(result.stack).toBeDefined();
        });
    });
});
