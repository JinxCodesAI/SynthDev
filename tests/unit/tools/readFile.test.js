// tests/unit/tools/readFile.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import readFiles from '../../../src/tools/read_files/implementation.js';
import { cleanupTestDirectory } from '../../helpers/testUtils.js';

describe.sequential('ReadFiles Tool - Fixed Tests', () => {
    const testDir = join(process.cwd(), 'test-temp');
    const testFile = join(testDir, 'test.txt');

    beforeEach(async () => {
        // Clean up and create fresh test directory
        await cleanupTestDirectory(testDir);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test files with retry logic
        await cleanupTestDirectory(testDir);
    });

    describe('successful file reading', () => {
        beforeEach(() => {
            writeFileSync(testFile, 'file content here');
        });

        it('should read file successfully with default parameters (string input)', async () => {
            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('read_files');
            expect(result.file_path).toBe('test-temp/test.txt');
            expect(result.content).toBe('file content here');
            expect(result.encoding).toBe('utf8');
            expect(result.size).toBe(17);
            expect(result.modified).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });

        it('should read file successfully with default parameters (array input)', async () => {
            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('read_files');
            expect(result.file_path).toBe('test-temp/test.txt');
            expect(result.content).toBe('file content here');
            expect(result.encoding).toBe('utf8');
            expect(result.size).toBe(17);
            expect(result.modified).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });

        it('should read file with custom encoding', async () => {
            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                encoding: 'ascii',
            });

            expect(result.success).toBe(true);
            expect(result.encoding).toBe('ascii');
            expect(result.content).toBe('file content here');
        });

        it('should read file with line range', async () => {
            writeFileSync(testFile, 'line 1\nline 2\nline 3\nline 4\nline 5');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                start_line: 2,
                end_line: 4,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('line 2\nline 3\nline 4');
        });

        it('should read single line when start_line equals end_line', async () => {
            writeFileSync(testFile, 'line 1\nline 2\nline 3');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                start_line: 2,
                end_line: 2,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('line 2');
        });
    });

    describe('parameter validation', () => {
        it('should require file_paths parameter', async () => {
            const result = await readFiles({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('Required parameter missing: file_paths');
        });

        it('should validate file_paths type', async () => {
            const result = await readFiles({ file_paths: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid parameter type');
        });

        it('should handle mixed valid and invalid file paths', async () => {
            // Create one valid file
            writeFileSync(testFile, 'valid file content');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt', '', 'test-temp/nonexistent.txt'],
            });

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(1);
            expect(result.total_requested).toBe(3);
            expect(result.total_read).toBe(1);
            expect(result.failed).toHaveLength(2);

            // Check successful file
            expect(result.files[0].file_path).toBe('test-temp/test.txt');
            expect(result.files[0].content).toBe('valid file content');

            // Check failed files
            expect(result.failed[0].file_path).toBe('');
            expect(result.failed[0].error).toContain('cannot be empty');
            expect(result.failed[1].file_path).toBe('test-temp/nonexistent.txt');
            expect(result.failed[1].error).toContain('File not found');
        });

        it('should validate start_line parameter', async () => {
            writeFileSync(testFile, 'line 1\nline 2\nline 3');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                start_line: 0,
                end_line: 1,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('start_line must be a positive integer');
        });

        it('should validate end_line parameter', async () => {
            writeFileSync(testFile, 'line 1\nline 2\nline 3');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
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
            const result = await readFiles({ file_paths: ['../../../etc/passwd'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Access denied: file path must be within the current working directory'
            );
        });

        it('should handle absolute paths (resolved relative to workspace)', async () => {
            // Absolute paths get resolved relative to the workspace, so /etc/passwd becomes workspace/etc/passwd
            const result = await readFiles({ file_paths: ['/etc/passwd'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found'); // File doesn't exist in workspace/etc/passwd
        });

        it('should allow relative paths within workspace', async () => {
            writeFileSync(testFile, 'content');

            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(true);
        });
    });

    describe('file system errors', () => {
        it('should handle file not found', async () => {
            const result = await readFiles({ file_paths: ['test-temp/nonexistent.txt'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should handle directory instead of file', async () => {
            const result = await readFiles({ file_paths: ['test-temp'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Path is not a file');
            // Note: path_type is no longer in the top-level response for single requests
        });

        it('should handle file too large', async () => {
            // Create a file larger than 10MB (the default limit)
            const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
            writeFileSync(testFile, largeContent);

            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File too large');
        });
    });

    describe('edge cases', () => {
        it('should handle empty file', async () => {
            writeFileSync(testFile, '');

            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(true);
            expect(result.content).toBe('');
            expect(result.size).toBe(0);
        });

        it('should handle line range beyond file content', async () => {
            writeFileSync(testFile, 'line 1\nline 2');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                start_line: 5,
                end_line: 10,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('end_line is beyond the end of the file');
        });

        it('should handle files with different line endings', async () => {
            writeFileSync(testFile, 'line 1\r\nline 2\r\nline 3');

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                start_line: 2,
                end_line: 2,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('line 2');
        });

        it('should handle unicode content', async () => {
            const unicodeContent = 'Hello 世界 🌍 émojis';
            writeFileSync(testFile, unicodeContent);

            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(true);
            expect(result.content).toBe(unicodeContent);
        });
    });

    describe('performance and limits', () => {
        it('should handle reasonably large files', async () => {
            const content = 'x'.repeat(1024 * 1024); // 1MB
            writeFileSync(testFile, content);

            const result = await readFiles({ file_paths: ['test-temp/test.txt'] });

            expect(result.success).toBe(true);
            expect(result.content).toBe(content);
            expect(result.size).toBe(1024 * 1024);
        });

        it('should handle files with many lines', async () => {
            const lines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`);
            writeFileSync(testFile, lines.join('\n'));

            const result = await readFiles({
                file_paths: ['test-temp/test.txt'],
                start_line: 500,
                end_line: 502,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('line 500\nline 501\nline 502');
        });
    });
});
