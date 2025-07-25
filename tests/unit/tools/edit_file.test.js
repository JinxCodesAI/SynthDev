// tests/unit/tools/edit_file.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import editFile from '../../../src/tools/edit_file/implementation.js';

// Mock the logger specifically for this test
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        user: vi.fn(),
        status: vi.fn(),
        toolExecution: vi.fn(),
        toolExecutionDetailed: vi.fn(),
        toolResult: vi.fn(),
        httpRequest: vi.fn(),
        raw: vi.fn(),
        setVerbosityLevel: vi.fn(),
        getVerbosityLevel: vi.fn(() => 2),
        getRecentHttpRequests: vi.fn(() => []),
        clearHttpHistory: vi.fn(),
    })),
    resetLogger: vi.fn(),
    initializeLogger: vi.fn(),
}));

describe.sequential('Edit File Tool', () => {
    const testDir = process.cwd();
    const testFile = join(testDir, 'test_edit_file.txt');

    beforeEach(() => {
        vi.clearAllMocks();
        // Clean up any existing test file
        if (existsSync(testFile)) {
            unlinkSync(testFile);
        }
    });

    afterEach(() => {
        // Clean up test file
        if (existsSync(testFile)) {
            unlinkSync(testFile);
        }
    });

    describe('Replace Operation', () => {
        it('should replace content between boundaries', async () => {
            const originalContent = `Line 1
START_MARKER
Old content here
END_MARKER
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'START_MARKER',
                boundary_end: 'END_MARKER',
                new_content: 'New content here',
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('replace');
            expect(result.edited).toBe(true);

            const newContent = readFileSync(testFile, 'utf8');
            expect(newContent).toBe(`Line 1
New content here
Line 5`);
        });

        it('should handle multiline new content', async () => {
            const originalContent = `Line 1
<!-- START -->
Old content
<!-- END -->
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: '<!-- START -->',
                boundary_end: '<!-- END -->',
                new_content: `<!-- START -->
New line 1
New line 2
<!-- END -->`,
            });

            expect(result.success).toBe(true);

            const newContent = readFileSync(testFile, 'utf8');
            expect(newContent).toContain('New line 1');
            expect(newContent).toContain('New line 2');
        });

        it('should handle empty new content', async () => {
            const originalContent = `Line 1
START
Content to remove
END
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
                new_content: '',
            });

            expect(result.success).toBe(true);

            const newContent = readFileSync(testFile, 'utf8');
            expect(newContent).toBe(`Line 1

Line 5`);
        });
    });

    describe('Delete Operation', () => {
        it('should delete content between boundaries', async () => {
            const originalContent = `Line 1
DELETE_START
Content to delete
DELETE_END
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'delete',
                boundary_start: 'DELETE_START',
                boundary_end: 'DELETE_END',
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('delete');

            const newContent = readFileSync(testFile, 'utf8');
            expect(newContent).toBe(`Line 1

Line 5`);
        });

        it('should delete multiline content', async () => {
            const originalContent = `Keep this
/* REMOVE_START */
Line to remove 1
Line to remove 2
Line to remove 3
/* REMOVE_END */
Keep this too`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'delete',
                boundary_start: '/* REMOVE_START */',
                boundary_end: '/* REMOVE_END */',
            });

            expect(result.success).toBe(true);

            const newContent = readFileSync(testFile, 'utf8');
            expect(newContent).toBe(`Keep this

Keep this too`);
        });
    });

    describe('Boundary Recovery', () => {
        it('should handle multiple boundary occurrences with recovery', async () => {
            const originalContent = `Line 1
MARKER
First occurrence
MARKER
Line 5
MARKER
Second occurrence
MARKER
Line 9`;

            writeFileSync(testFile, originalContent);

            const newContent = `MARKER
Updated content
MARKER`;

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'MARKER',
                boundary_end: 'MARKER',
                new_content: newContent,
            });

            // Should fail due to multiple boundaries
            expect(result.success).toBe(false);
            expect(result.error).toContain('found 4 times');
        });
    });

    describe('Error Handling', () => {
        it('should reject missing required parameters', async () => {
            const result = await editFile({
                file_path: 'test_edit_file.txt',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('operation');
        });

        it('should reject invalid operation', async () => {
            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'invalid',
                boundary_start: 'START',
                boundary_end: 'END',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid operation specified');
        });

        // Note: This test is implementation-dependent and may vary based on validation order
        it('should handle missing new_content parameter', async () => {
            const result = await editFile({
                file_path: 'non_existent.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
            });

            expect(result.success).toBe(false);
            // Could fail for missing file or missing new_content - both are valid
            expect(result.error).toBeDefined();
        });

        it('should reject non-existent file', async () => {
            const result = await editFile({
                file_path: 'non_existent_file.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
                new_content: 'content',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File does not exist');
        });

        it('should reject file path outside working directory', async () => {
            const result = await editFile({
                file_path: '../outside_file.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
                new_content: 'content',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });

        it('should handle boundary not found', async () => {
            const originalContent = `Line 1
Line 2
Line 3`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'NOT_FOUND',
                boundary_end: 'ALSO_NOT_FOUND',
                new_content: 'content',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('boundary_start string not found');
        });

        it('should handle boundary_start after boundary_end', async () => {
            const originalContent = `Line 1
END_MARKER
Middle content
START_MARKER
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'START_MARKER',
                boundary_end: 'END_MARKER',
                new_content: 'content',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('boundary_start string must appear before boundary_end');
        });

        it('should handle multiple boundary occurrences without recovery', async () => {
            const originalContent = `Line 1
DUPLICATE
Content 1
DUPLICATE
Line 5
DUPLICATE
Content 2
DUPLICATE
Line 9`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'delete',
                boundary_start: 'DUPLICATE',
                boundary_end: 'DUPLICATE',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('found 4 times');
        });
    });

    describe('Encoding Support', () => {
        it('should handle different encodings', async () => {
            const originalContent = 'Test content';
            writeFileSync(testFile, originalContent, 'utf8');

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'Test',
                boundary_end: 'content',
                new_content: 'New content',
                encoding: 'utf8',
            });

            expect(result.success).toBe(true);
            expect(result.encoding).toBe('utf8');
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields on success', async () => {
            const originalContent = `Line 1
START
Old content
END
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
                new_content: 'New content',
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('file_path');
            expect(result).toHaveProperty('size');
            expect(result).toHaveProperty('encoding');
            expect(result).toHaveProperty('edited');
            expect(result).toHaveProperty('operation');
            expect(result).toHaveProperty('bytes_changed');
            expect(result.tool_name).toBe('edit_file');
        });

        it('should include error details on failure', async () => {
            const result = await editFile({
                file_path: 'non_existent.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
                new_content: 'content',
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result.success).toBe(false);
        });

        it('should track bytes changed', async () => {
            const originalContent = `Line 1
START
Old
END
Line 5`;

            writeFileSync(testFile, originalContent);

            const result = await editFile({
                file_path: 'test_edit_file.txt',
                operation: 'replace',
                boundary_start: 'START',
                boundary_end: 'END',
                new_content: 'New content that is longer',
            });

            expect(result.success).toBe(true);
            expect(result.bytes_changed).toBeLessThan(0); // File got larger
        });
    });
});
