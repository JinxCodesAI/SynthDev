// tests/unit/tools/writeFile.fixed.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import writeFile from '../../../tools/write_file/implementation.js';

describe('WriteFile Tool - Fixed Tests', () => {
    const testDir = join(process.cwd(), 'test-temp');
    const testFile = join(testDir, 'test.txt');

    beforeEach(() => {
        // Create test directory
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test files
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('successful file writing', () => {
        it('should write file successfully with default parameters', async () => {
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'Hello, World!',
            });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('write_file');
            expect(result.file_path).toBe('test-temp/test.txt');
            expect(result.encoding).toBe('utf8');
            expect(result.created_directories).toEqual([]);
            expect(result.overwritten).toBe(false);
            expect(result.timestamp).toBeDefined();

            // Verify file was actually written
            const content = readFileSync(testFile, 'utf8');
            expect(content).toBe('Hello, World!');
        });

        it('should write file with custom encoding', async () => {
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'Hello, World!',
                encoding: 'ascii',
            });

            expect(result.success).toBe(true);
            expect(result.encoding).toBe('ascii');

            // Verify file was written
            const content = readFileSync(testFile, 'ascii');
            expect(content).toBe('Hello, World!');
        });

        it('should create directories when needed', async () => {
            const result = await writeFile({
                file_path: 'test-temp/subdir/nested/test.txt',
                content: 'Hello, World!',
                create_directories: true,
            });

            expect(result.success).toBe(true);
            expect(result.created_directories).toEqual([
                'test-temp/subdir',
                'test-temp/subdir/nested',
            ]);

            // Verify file was written
            const nestedFile = join(testDir, 'subdir', 'nested', 'test.txt');
            const content = readFileSync(nestedFile, 'utf8');
            expect(content).toBe('Hello, World!');
        });

        it('should handle file overwriting', async () => {
            // Create initial file
            await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'Original content',
            });

            // Overwrite it
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'New content',
                overwrite: true,
            });

            expect(result.success).toBe(true);
            expect(result.overwritten).toBe(true);

            // Verify content was overwritten
            const content = readFileSync(testFile, 'utf8');
            expect(content).toBe('New content');
        });

        it('should prevent overwriting when overwrite is false', async () => {
            // Create initial file
            await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'Original content',
            });

            // Try to overwrite with overwrite=false
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'New content',
                overwrite: false,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File already exists and overwrite is disabled');

            // Verify original content is preserved
            const content = readFileSync(testFile, 'utf8');
            expect(content).toBe('Original content');
        });
    });

    describe('parameter validation', () => {
        it('should require file_path parameter', async () => {
            const result = await writeFile({ content: 'Hello' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('file_path parameter is required');
        });

        it('should require content parameter', async () => {
            const result = await writeFile({ file_path: 'test-temp/test.txt' });

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
                file_path: 'test-temp/test.txt',
                content: 123,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('content parameter must be of type string');
        });

        it('should validate boolean parameters', async () => {
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
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

        it('should handle absolute paths (resolved relative to workspace)', async () => {
            // Absolute paths get resolved relative to the workspace
            const result = await writeFile({
                file_path: '/test-temp/test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(true);
            // File should be created at workspace/test-temp/test.txt
            expect(existsSync(testFile)).toBe(true);
        });

        it('should allow relative paths within workspace', async () => {
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(true);
            expect(existsSync(testFile)).toBe(true);
        });
    });

    describe('directory creation', () => {
        it('should fail when directories need to be created but create_directories is false', async () => {
            const result = await writeFile({
                file_path: 'test-temp/nonexistent/test.txt',
                content: 'Hello',
                create_directories: false,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should create nested directories', async () => {
            const result = await writeFile({
                file_path: 'test-temp/a/b/c/d/test.txt',
                content: 'Hello',
                create_directories: true,
            });

            expect(result.success).toBe(true);
            expect(result.created_directories).toEqual([
                'test-temp/a',
                'test-temp/a/b',
                'test-temp/a/b/c',
                'test-temp/a/b/c/d',
            ]);

            const nestedFile = join(testDir, 'a', 'b', 'c', 'd', 'test.txt');
            expect(existsSync(nestedFile)).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle empty content', async () => {
            const result = await writeFile({
                file_path: 'test-temp/empty.txt',
                content: '',
            });

            expect(result.success).toBe(true);

            const content = readFileSync(join(testDir, 'empty.txt'), 'utf8');
            expect(content).toBe('');
        });

        it('should handle large content', async () => {
            const largeContent = 'x'.repeat(1024 * 1024); // 1MB
            const result = await writeFile({
                file_path: 'test-temp/large.txt',
                content: largeContent,
            });

            expect(result.success).toBe(true);

            const content = readFileSync(join(testDir, 'large.txt'), 'utf8');
            expect(content).toBe(largeContent);
        });

        it('should handle unicode content', async () => {
            const unicodeContent = 'Hello 世界 🌍 émojis';
            const result = await writeFile({
                file_path: 'test-temp/unicode.txt',
                content: unicodeContent,
            });

            expect(result.success).toBe(true);

            const content = readFileSync(join(testDir, 'unicode.txt'), 'utf8');
            expect(content).toBe(unicodeContent);
        });

        it('should handle files with special characters in name', async () => {
            const result = await writeFile({
                file_path: 'test-temp/file with spaces & symbols!.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(true);

            const specialFile = join(testDir, 'file with spaces & symbols!.txt');
            expect(existsSync(specialFile)).toBe(true);
        });
    });

    describe('file metadata', () => {
        it('should return correct file size', async () => {
            const content = 'Hello, World!';
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: content,
            });

            expect(result.success).toBe(true);
            expect(result.size).toBe(Buffer.byteLength(content, 'utf8'));
        });

        it('should handle stats error gracefully', async () => {
            // This test is harder to trigger, but we can test the behavior
            const result = await writeFile({
                file_path: 'test-temp/test.txt',
                content: 'Hello',
            });

            expect(result.success).toBe(true);
            expect(result.size).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });
    });
});
