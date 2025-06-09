// tests/unit/tools/exact_search.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import exactSearch from '../../../tools/exact_search/implementation.js';

// Mock the fs_utils module
vi.mock('../../../tools/common/fs_utils.js', () => ({
    scanDirectory: vi.fn(),
    safeReadFile: vi.fn(),
}));

describe('Exact Search Tool', () => {
    let mockScanDirectory;
    let mockSafeReadFile;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Get the mocked functions
        const fsUtils = await import('../../../tools/common/fs_utils.js');
        mockScanDirectory = fsUtils.scanDirectory;
        mockSafeReadFile = fsUtils.safeReadFile;
    });

    describe('Basic Search Functionality', () => {
        it('should find exact string matches in files', async () => {
            // Mock file system
            mockScanDirectory.mockReturnValue([
                { path: 'file1.txt', type: 'file' },
                { path: 'file2.js', type: 'file' },
                { path: 'subdir', type: 'directory' },
            ]);

            mockSafeReadFile.mockImplementation(filePath => {
                if (filePath.includes('file1.txt')) {
                    return `Line 1
Line 2 with search_term here
Line 3
Line 4
Line 5`;
                }
                if (filePath.includes('file2.js')) {
                    return `function test() {
    console.log("search_term found");
    return true;
}`;
                }
                return null;
            });

            const result = await exactSearch({ search_string: 'search_term' });

            expect(result.success).toBe(true);
            expect(result.search_string).toBe('search_term');
            expect(result.results).toHaveLength(2);

            // Check first result
            expect(result.results[0].filename).toBe('file1.txt');
            expect(result.results[0].line_number).toBe(2);
            expect(result.results[0].fragment).toContain('search_term');

            // Check second result
            expect(result.results[1].filename).toBe('file2.js');
            expect(result.results[1].line_number).toBe(2);
            expect(result.results[1].fragment).toContain('search_term');
        });

        it('should include context lines around matches', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'test.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue(`Line 1
Line 2
Line 3
Line 4
Line 5 with target here
Line 6
Line 7
Line 8
Line 9`);

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(1);

            const fragment = result.results[0].fragment;
            const lines = fragment.split('\n');

            // Should include 4 lines before and after (or until file boundaries)
            expect(lines).toHaveLength(9); // Lines 1-9
            expect(fragment).toContain('Line 1');
            expect(fragment).toContain('Line 9');
            expect(fragment).toContain('target');
        });

        it('should handle matches at file boundaries', async () => {
            mockScanDirectory.mockReturnValue([
                { path: 'start.txt', type: 'file' },
                { path: 'end.txt', type: 'file' },
            ]);

            mockSafeReadFile.mockImplementation(filePath => {
                if (filePath.includes('start.txt')) {
                    return `target at start
Line 2
Line 3`;
                }
                if (filePath.includes('end.txt')) {
                    return `Line 1
Line 2
target at end`;
                }
                return null;
            });

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(2);

            // First match at start of file
            expect(result.results[0].line_number).toBe(1);
            expect(result.results[0].fragment).toContain('target at start');

            // Second match at end of file
            expect(result.results[1].line_number).toBe(3);
            expect(result.results[1].fragment).toContain('target at end');
        });

        it('should find multiple matches in same file', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'multi.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue(`Line 1
Line 2 with match
Line 3
Line 4
Line 5 with match
Line 6
Line 7 with match
Line 8`);

            const result = await exactSearch({ search_string: 'match' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(3);

            expect(result.results[0].line_number).toBe(2);
            expect(result.results[1].line_number).toBe(5);
            expect(result.results[2].line_number).toBe(7);
        });
    });

    describe('Search Statistics', () => {
        it('should provide accurate search statistics', async () => {
            mockScanDirectory.mockReturnValue([
                { path: 'file1.txt', type: 'file' },
                { path: 'file2.txt', type: 'file' },
                { path: 'file3.txt', type: 'file' },
            ]);

            mockSafeReadFile.mockImplementation(filePath => {
                if (filePath.includes('file1.txt')) {
                    return `Line with target
Another line with target`;
                }
                if (filePath.includes('file2.txt')) {
                    return `No matches here
Just regular content`;
                }
                if (filePath.includes('file3.txt')) {
                    return 'One target here';
                }
                return null;
            });

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.statistics.total_files_scanned).toBe(3);
            expect(result.statistics.files_with_matches).toBe(2);
            expect(result.statistics.total_matches).toBe(3);
        });

        it('should handle files that cannot be read', async () => {
            mockScanDirectory.mockReturnValue([
                { path: 'readable.txt', type: 'file' },
                { path: 'unreadable.txt', type: 'file' },
            ]);

            mockSafeReadFile.mockImplementation(filePath => {
                if (filePath.includes('readable.txt')) {
                    return 'Content with target';
                }
                if (filePath.includes('unreadable.txt')) {
                    return null; // Simulate unreadable file
                }
                return null;
            });

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.statistics.total_files_scanned).toBe(2); // Both files attempted
            expect(result.results).toHaveLength(2); // Both files return results
        });
    });

    describe('File Path Handling', () => {
        it('should normalize file paths with forward slashes', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'subdir\\file.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('Content with target');

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results[0].filename).toBe('subdir/file.txt');
        });

        it('should handle nested directory structures', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'level1/level2/deep.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('Deep target found');

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results[0].filename).toBe('level1/level2/deep.txt');
        });
    });

    describe('Error Handling', () => {
        it('should reject missing search_string parameter', async () => {
            const result = await exactSearch({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('search_string');
        });

        it('should reject empty search_string', async () => {
            const result = await exactSearch({ search_string: '' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('search_string cannot be empty');
        });

        it('should reject non-string search_string', async () => {
            const result = await exactSearch({ search_string: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid parameter type for search_string: expected string, got number'
            );
        });

        it('should handle directory scan errors', async () => {
            mockScanDirectory.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to scan directory');
        });

        it('should handle unexpected errors gracefully', async () => {
            mockScanDirectory.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to scan directory');
        });
    });

    describe('Edge Cases', () => {
        it('should handle no matches found', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'file1.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('No matches in this content');

            const result = await exactSearch({ search_string: 'nonexistent' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(0);
            expect(result.statistics.total_files_scanned).toBe(1);
            expect(result.statistics.files_with_matches).toBe(0);
            expect(result.statistics.total_matches).toBe(0);
        });

        it('should handle empty files', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'empty.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('');

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(0);
            expect(result.statistics.total_files_scanned).toBe(1);
        });

        it('should handle files with only newlines', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'newlines.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('\n\n\n');

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(0);
        });

        it('should handle very long lines', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'long.txt', type: 'file' }]);

            const longLine = `${'a'.repeat(10000)}target${'b'.repeat(10000)}`;
            mockSafeReadFile.mockReturnValue(longLine);

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].fragment).toContain('target');
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'test.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('Content with target');

            const result = await exactSearch({ search_string: 'target' });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('search_string');
            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('statistics');
            expect(result.tool_name).toBe('exact_search');
        });

        it('should include proper result structure', async () => {
            mockScanDirectory.mockReturnValue([{ path: 'test.txt', type: 'file' }]);

            mockSafeReadFile.mockReturnValue('Line with target');

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.results[0]).toHaveProperty('filename');
            expect(result.results[0]).toHaveProperty('fragment');
            expect(result.results[0]).toHaveProperty('line_number');
        });

        it('should include proper statistics structure', async () => {
            mockScanDirectory.mockReturnValue([]);

            const result = await exactSearch({ search_string: 'target' });

            expect(result.success).toBe(true);
            expect(result.statistics).toHaveProperty('total_files_scanned');
            expect(result.statistics).toHaveProperty('files_with_matches');
            expect(result.statistics).toHaveProperty('total_matches');
        });
    });
});
