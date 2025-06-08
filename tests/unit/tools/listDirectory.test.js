// tests/unit/tools/listDirectory.fixed.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import listDirectory from '../../../tools/list_directory/implementation.js';

describe('ListDirectory Tool - Fixed Tests', () => {
    const testDir = join(process.cwd(), 'test-temp');

    beforeEach(() => {
        // Clean up and create fresh test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up test files
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('successful directory listing', () => {
        beforeEach(() => {
            // Create test files and directories
            writeFileSync(join(testDir, 'file1.txt'), 'content1');
            writeFileSync(join(testDir, 'file2.js'), 'content2');
            mkdirSync(join(testDir, 'subdir1'));
            mkdirSync(join(testDir, 'subdir2'));
            writeFileSync(join(testDir, 'subdir1', 'nested.txt'), 'nested content');
        });

        it('should list directory contents with default parameters', async () => {
            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('list_directory');
            expect(result.directory_path).toBe('test-temp');
            expect(result.files).toBeDefined();
            expect(result.directories).toBeDefined();
            expect(result.total_items).toBeGreaterThan(0);
            expect(result.timestamp).toBeDefined();

            // Check that we have the expected files
            const fileNames = result.files.map(f => f.name);
            const dirNames = result.directories.map(d => d.name);
            expect(fileNames).toContain('file1.txt');
            expect(fileNames).toContain('file2.js');
            expect(dirNames).toContain('subdir1');
            expect(dirNames).toContain('subdir2');
        });

        it('should include file metadata', async () => {
            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            const file = result.files.find(f => f.name === 'file1.txt');
            expect(file).toBeDefined();
            expect(file.type).toBe('file');
            expect(file.size).toBeDefined();
            expect(file.extension).toBe('.txt');
            expect(file.path).toContain('file1.txt');
        });

        it('should distinguish between files and directories', async () => {
            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);

            const file = result.files.find(f => f.name === 'file1.txt');
            const dir = result.directories.find(d => d.name === 'subdir1');

            expect(file.type).toBe('file');
            expect(dir.type).toBe('directory');
        });

        it('should handle empty directories', async () => {
            const emptyDir = join(testDir, 'empty');
            mkdirSync(emptyDir);

            const result = await listDirectory({ directory_path: 'test-temp/empty' });

            expect(result.success).toBe(true);
            expect(result.files).toEqual([]);
            expect(result.directories).toEqual([]);
            expect(result.total_items).toBe(0);
        });

        it('should handle current directory', async () => {
            const result = await listDirectory({ directory_path: '.' });

            expect(result.success).toBe(true);
            expect(result.directory_path).toBe('.');
            expect(result.files).toBeDefined();
            expect(result.directories).toBeDefined();
            expect(result.total_items).toBeGreaterThan(0);
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

        it('should validate boolean parameters', async () => {
            const result = await listDirectory({
                directory_path: 'test-temp',
                include_hidden: 'yes',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('include_hidden parameter must be of type boolean');
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

        it('should handle absolute paths (resolved relative to workspace)', async () => {
            // Absolute paths get resolved relative to the workspace
            const result = await listDirectory({ directory_path: '/test-temp' });

            expect(result.success).toBe(true);
            expect(result.files).toBeDefined();
        });

        it('should allow relative paths within workspace', async () => {
            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            expect(result.files).toBeDefined();
        });
    });

    describe('file system errors', () => {
        it('should handle directory not found', async () => {
            const result = await listDirectory({ directory_path: 'test-temp/nonexistent' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should handle file instead of directory', async () => {
            writeFileSync(join(testDir, 'notadir.txt'), 'content');

            const result = await listDirectory({ directory_path: 'test-temp/notadir.txt' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Path is not a directory');
        });
    });

    describe('filtering and options', () => {
        beforeEach(() => {
            // Create test files including hidden ones
            writeFileSync(join(testDir, 'visible.txt'), 'content');
            writeFileSync(join(testDir, '.hidden.txt'), 'hidden content');
            writeFileSync(join(testDir, '.env'), 'env content');
            mkdirSync(join(testDir, '.hidden-dir'));
        });

        it('should hide hidden files by default', async () => {
            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            const fileNames = result.files.map(f => f.name);
            const dirNames = result.directories.map(d => d.name);
            expect(fileNames).toContain('visible.txt');
            expect(fileNames).not.toContain('.hidden.txt');
            expect(fileNames).not.toContain('.env');
            expect(dirNames).not.toContain('.hidden-dir');
        });

        it('should show hidden files when requested', async () => {
            const result = await listDirectory({
                directory_path: 'test-temp',
                include_hidden: true,
            });

            expect(result.success).toBe(true);
            const fileNames = result.files.map(f => f.name);
            const dirNames = result.directories.map(d => d.name);
            expect(fileNames).toContain('visible.txt');
            expect(fileNames).toContain('.hidden.txt');
            expect(fileNames).toContain('.env');
            expect(dirNames).toContain('.hidden-dir');
        });
    });

    describe('edge cases', () => {
        it('should handle directories with special characters', async () => {
            const specialDir = join(testDir, 'dir with spaces & symbols!');
            mkdirSync(specialDir);
            writeFileSync(join(specialDir, 'file.txt'), 'content');

            const result = await listDirectory({
                directory_path: 'test-temp/dir with spaces & symbols!',
            });

            expect(result.success).toBe(true);
            expect(result.files.length).toBe(1);
            expect(result.files[0].name).toBe('file.txt');
        });

        it('should handle unicode file names', async () => {
            const unicodeFile = join(testDir, '世界.txt');
            writeFileSync(unicodeFile, 'unicode content');

            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            const fileNames = result.files.map(f => f.name);
            expect(fileNames).toContain('世界.txt');
        });

        it('should handle large directories', async () => {
            // Create many files
            for (let i = 0; i < 100; i++) {
                writeFileSync(join(testDir, `file${i}.txt`), `content ${i}`);
            }

            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            expect(result.files.length).toBe(100);
        });

        it('should normalize path separators', async () => {
            mkdirSync(join(testDir, 'subdir'));
            writeFileSync(join(testDir, 'subdir', 'file.txt'), 'content');

            // Use different path separators
            const result = await listDirectory({ directory_path: 'test-temp/subdir' });

            expect(result.success).toBe(true);
            expect(result.files.length).toBe(1);
            expect(result.files[0].name).toBe('file.txt');
        });
    });

    describe('performance and limits', () => {
        it('should handle directories with many subdirectories', async () => {
            // Create nested directory structure
            for (let i = 0; i < 50; i++) {
                mkdirSync(join(testDir, `subdir${i}`));
                writeFileSync(join(testDir, `subdir${i}`, 'file.txt'), `content ${i}`);
            }

            const result = await listDirectory({ directory_path: 'test-temp' });

            expect(result.success).toBe(true);
            expect(result.directories.length).toBe(50);
        });

        it('should return consistent results', async () => {
            writeFileSync(join(testDir, 'file1.txt'), 'content1');
            writeFileSync(join(testDir, 'file2.txt'), 'content2');

            const result1 = await listDirectory({ directory_path: 'test-temp' });
            const result2 = await listDirectory({ directory_path: 'test-temp' });

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result1.files.length).toBe(result2.files.length);

            const names1 = result1.files.map(f => f.name).sort();
            const names2 = result2.files.map(f => f.name).sort();
            expect(names1).toEqual(names2);
        });
    });
});
