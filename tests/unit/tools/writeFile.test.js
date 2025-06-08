// tests/unit/tools/writeFile.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import writeFile from '../../../tools/write_file/implementation.js';

// Mock fs functions
vi.mock('fs', () => ({
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
}));

describe('WriteFile Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock process.cwd() to return a consistent path
        vi.spyOn(process, 'cwd').mockReturnValue('/test/workspace');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('successful file writing', () => {
        beforeEach(() => {
            // Mock successful file operations
            existsSync.mockReturnValue(false); // File doesn't exist initially
            statSync.mockReturnValue({
                size: 1024,
                mtime: new Date('2024-01-01T00:00:00.000Z'),
            });
            writeFileSync.mockImplementation(() => {}); // Successful write
        });

        it('should write file successfully with default parameters', async () => {
            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello, World!',
            });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('write_file');
            expect(result.file_path).toBe('test.txt');
            expect(result.size).toBe(1024);
            expect(result.encoding).toBe('utf8');
            expect(result.created_directories).toEqual([]);
            expect(result.overwritten).toBe(false);
            expect(result.timestamp).toBeDefined();

            expect(writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('test.txt'),
                'Hello, World!',
                'utf8'
            );
        });

        it('should write file with custom encoding', async () => {
            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello, World!',
                encoding: 'ascii',
            });

            expect(result.success).toBe(true);
            expect(result.encoding).toBe('ascii');
            expect(writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('test.txt'),
                'Hello, World!',
                'ascii'
            );
        });

        it('should create directories when needed', async () => {
            existsSync.mockImplementation(path => {
                // Directory doesn't exist, file doesn't exist
                return false;
            });

            const result = await writeFile({
                file_path: 'subdir/test.txt',
                content: 'Hello, World!',
                create_directories: true,
            });

            expect(result.success).toBe(true);
            expect(result.created_directories).toEqual(['subdir']);
            expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('subdir'), {
                recursive: true,
            });
        });

        it('should handle file overwriting', async () => {
            existsSync.mockImplementation(path => {
                // File exists
                return path.includes('test.txt');
            });

            const result = await writeFile({
                file_path: 'test.txt',
                content: 'New content',
                overwrite: true,
            });

            expect(result.success).toBe(true);
            expect(result.overwritten).toBe(true);
        });

        it('should prevent overwriting when overwrite is false', async () => {
            existsSync.mockImplementation(path => {
                // File exists
                return path.includes('test.txt');
            });

            const result = await writeFile({
                file_path: 'test.txt',
                content: 'New content',
                overwrite: false,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File already exists and overwrite is disabled');
        });
    });

    describe('parameter validation', () => {
        it('should require file_path parameter', async () => {
            const result = await writeFile({ content: 'Hello' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('file_path parameter is required');
        });

        it('should require content parameter', async () => {
            const result = await writeFile({ file_path: 'test.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('content parameter is required');
        });

        it('should validate file_path type', async () => {
            const result = await writeFile({
                file_path: 123,
                content: 'Hello',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('file_path parameter must be of type string');
        });

        it('should validate content type', async () => {
            const result = await writeFile({
                file_path: 'test.txt',
                content: 123,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('content parameter must be of type string');
        });

        it('should validate boolean parameters', async () => {
            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello',
                create_directories: 'yes',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('create_directories parameter must be of type boolean');
        });
    });

    describe('path validation and security', () => {
        it('should reject path traversal attempts', async () => {
            const result = await writeFile({
                file_path: '../../../etc/passwd',
                content: 'malicious content',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should reject absolute paths outside workspace', async () => {
            const result = await writeFile({
                file_path: '/etc/passwd',
                content: 'malicious content',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should allow relative paths within workspace', async () => {
            existsSync.mockReturnValue(false);
            statSync.mockReturnValue({ size: 1024 });
            writeFileSync.mockImplementation(() => {});

            const result = await writeFile({
                file_path: 'subdir/test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('file system errors', () => {
        it('should handle permission denied on directory creation', async () => {
            existsSync.mockReturnValue(false);
            mkdirSync.mockImplementation(() => {
                const error = new Error('EACCES: permission denied');
                error.code = 'EACCES';
                throw error;
            });

            const result = await writeFile({
                file_path: 'restricted/test.txt',
                content: 'Hello',
                create_directories: true,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot create directories');
        });

        it('should handle permission denied on file write', async () => {
            existsSync.mockReturnValue(false);
            writeFileSync.mockImplementation(() => {
                const error = new Error('EACCES: permission denied');
                error.code = 'EACCES';
                throw error;
            });

            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
        });

        it('should handle disk full error', async () => {
            existsSync.mockReturnValue(false);
            writeFileSync.mockImplementation(() => {
                const error = new Error('ENOSPC: no space left on device');
                error.code = 'ENOSPC';
                throw error;
            });

            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Disk full');
        });

        it('should handle stats error gracefully', async () => {
            existsSync.mockReturnValue(false);
            writeFileSync.mockImplementation(() => {}); // Successful write
            statSync.mockImplementation(() => {
                throw new Error('Stats error');
            });

            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(true);
            expect(result.warning).toContain('File written but metadata unavailable');
            expect(result.size).toBe(5); // Buffer.byteLength('Hello', 'utf8')
        });
    });

    describe('edge cases', () => {
        it('should handle empty content', async () => {
            existsSync.mockReturnValue(false);
            statSync.mockReturnValue({ size: 0 });
            writeFileSync.mockImplementation(() => {});

            const result = await writeFile({
                file_path: 'empty.txt',
                content: '',
            });

            expect(result.success).toBe(true);
            expect(result.size).toBe(0);
        });

        it('should handle large content', async () => {
            const largeContent = 'x'.repeat(1024 * 1024); // 1MB
            existsSync.mockReturnValue(false);
            statSync.mockReturnValue({ size: largeContent.length });
            writeFileSync.mockImplementation(() => {});

            const result = await writeFile({
                file_path: 'large.txt',
                content: largeContent,
            });

            expect(result.success).toBe(true);
            expect(result.size).toBe(largeContent.length);
        });

        it('should handle unexpected errors', async () => {
            existsSync.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await writeFile({
                file_path: 'test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unexpected error');
            expect(result.stack).toBeDefined();
        });
    });
});
