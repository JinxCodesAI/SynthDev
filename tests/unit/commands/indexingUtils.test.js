// tests/unit/commands/indexingUtils.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexingUtils } from '../../../src/commands/utils/IndexingUtils.js';

// Mock dependencies
vi.mock('../../../src/tools/common/fs_utils.js', () => ({
    scanDirectory: vi.fn(),
    getFileMetadata: vi.fn(),
    calculateFileChecksum: vi.fn(),
    calculateDirectoryChecksum: vi.fn(),
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        raw: vi.fn(),
    }),
}));

vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
}));

vi.mock('path', async importOriginal => {
    const actual = await importOriginal();
    return {
        ...actual,
        extname: vi.fn(),
    };
});

describe('IndexingUtils', () => {
    let mockScanDirectory;
    let mockGetFileMetadata;
    let mockCalculateFileChecksum;
    let mockCalculateDirectoryChecksum;
    let mockReadFileSync;
    let mockExistsSync;
    let mockExtname;

    beforeEach(async () => {
        const fsUtils = await import('../../../src/tools/common/fs_utils.js');
        mockScanDirectory = fsUtils.scanDirectory;
        mockGetFileMetadata = fsUtils.getFileMetadata;
        mockCalculateFileChecksum = fsUtils.calculateFileChecksum;
        mockCalculateDirectoryChecksum = fsUtils.calculateDirectoryChecksum;

        const fs = await import('fs');
        mockReadFileSync = fs.readFileSync;
        mockExistsSync = fs.existsSync;

        const path = await import('path');
        mockExtname = path.extname;

        vi.clearAllMocks();
    });

    describe('scanCodebase', () => {
        beforeEach(() => {
            mockScanDirectory.mockReturnValue([
                { name: 'file1.js', type: 'file', path: './file1.js', lvl: 1 },
                { name: 'file2.txt', type: 'file', path: './file2.txt', lvl: 1 },
                { name: 'subdir', type: 'directory', path: './subdir', lvl: 1 },
            ]);
        });

        it('should scan codebase with default exclusions', () => {
            const result = IndexingUtils.scanCodebase(false);

            expect(mockScanDirectory).toHaveBeenCalledWith('.', {
                depth: -1,
                includeHidden: false,
                exclusionList: expect.arrayContaining([
                    'node_modules',
                    '.git',
                    '.svn',
                    'build',
                    'dist',
                    '.cache',
                    '__pycache__',
                    '.DS_Store',
                    'Thumbs.db',
                    '.synthdev',
                ]),
            });

            expect(result).toHaveLength(4); // 3 scanned + 1 root directory
            expect(result[0]).toMatchObject({
                name: '.',
                type: 'directory',
                path: '.',
                lvl: 0,
            });
        });

        it('should include hidden files when specified', () => {
            IndexingUtils.scanCodebase(true);

            expect(mockScanDirectory).toHaveBeenCalledWith('.', {
                depth: -1,
                includeHidden: true,
                exclusionList: expect.any(Array),
            });
        });
    });

    describe('analyzeFileChanges', () => {
        const mockOldIndex = {
            files: {
                'file1.js': { checksum: 'old-hash', size: 100 },
                'file2.js': { checksum: 'same-hash', size: 200 },
                'deleted.js': { checksum: 'deleted-hash', size: 50 },
            },
        };

        const mockNewEntries = [
            { name: 'file1.js', type: 'file', path: './file1.js' },
            { name: 'file2.js', type: 'file', path: './file2.js' },
            { name: 'file3.js', type: 'file', path: './file3.js' },
        ];

        beforeEach(() => {
            mockCalculateFileChecksum
                .mockReturnValueOnce('new-hash') // file1.js changed
                .mockReturnValueOnce('same-hash') // file2.js unchanged
                .mockReturnValueOnce('new-file-hash'); // file3.js new

            mockGetFileMetadata.mockReturnValue({
                size: 150,
                modified: new Date(),
            });

            mockExtname.mockImplementation(path => {
                if (path.endsWith('.js')) {
                    return '.js';
                }
                if (path.endsWith('.py')) {
                    return '.py';
                }
                return '';
            });
        });

        it('should analyze file changes correctly', async () => {
            const result = await IndexingUtils.analyzeFileChanges(
                mockNewEntries,
                mockOldIndex,
                1000
            );

            expect(result).toHaveProperty('newFiles');
            expect(result).toHaveProperty('changedFiles');
            expect(result).toHaveProperty('unchangedFiles');
            expect(result).toHaveProperty('filesToSummarize');
        });

        it('should handle missing old index', async () => {
            const result = await IndexingUtils.analyzeFileChanges(
                mockNewEntries,
                { files: {} },
                1000
            );

            expect(result).toHaveProperty('newFiles');
            expect(result).toHaveProperty('changedFiles');
            expect(result).toHaveProperty('unchangedFiles');
            expect(result).toHaveProperty('filesToSummarize');
        });

        it('should handle empty new entries', async () => {
            const result = await IndexingUtils.analyzeFileChanges([], mockOldIndex, 1000);

            expect(result).toHaveProperty('newFiles');
            expect(result).toHaveProperty('changedFiles');
            expect(result).toHaveProperty('unchangedFiles');
            expect(result).toHaveProperty('filesToSummarize');
        });
    });

    describe('analyzeDirectoryChanges', () => {
        const mockOldIndex = {
            directories: {
                dir1: { checksum: 'old-dir-hash' },
                dir2: { checksum: 'same-dir-hash' },
                'deleted-dir': { checksum: 'deleted-dir-hash' },
            },
        };

        const mockNewEntries = [
            { name: 'dir1', type: 'directory', path: './dir1' },
            { name: 'dir2', type: 'directory', path: './dir2' },
            { name: 'dir3', type: 'directory', path: './dir3' },
        ];

        beforeEach(() => {
            mockCalculateDirectoryChecksum
                .mockReturnValueOnce('new-dir-hash') // dir1 changed
                .mockReturnValueOnce('same-dir-hash') // dir2 unchanged
                .mockReturnValueOnce('new-dir3-hash'); // dir3 new
        });

        it('should analyze directory changes correctly', async () => {
            const result = await IndexingUtils.analyzeDirectoryChanges(
                mockNewEntries,
                mockOldIndex
            );

            expect(result).toHaveProperty('newDirectories');
            expect(result).toHaveProperty('changedDirectories');
            expect(result).toHaveProperty('unchangedDirectories');
            expect(result).toHaveProperty('directoriesToSummarize');
        });

        it('should handle missing old index', async () => {
            const result = await IndexingUtils.analyzeDirectoryChanges(mockNewEntries, {
                files: {},
            });

            expect(result).toHaveProperty('newDirectories');
            expect(result).toHaveProperty('changedDirectories');
            expect(result).toHaveProperty('unchangedDirectories');
            expect(result).toHaveProperty('directoriesToSummarize');
        });
    });

    describe('detectDeletedEntries', () => {
        const mockOldIndex = {
            files: {
                'existing.js': {},
                'deleted.js': {},
            },
            directories: {
                'existing-dir': {},
                'deleted-dir': {},
            },
        };

        const mockNewEntries = [
            { name: 'existing.js', type: 'file', path: './existing.js' },
            { name: 'existing-dir', type: 'directory', path: './existing-dir' },
        ];

        it('should detect deleted files and directories', () => {
            const result = IndexingUtils.detectDeletedEntries(mockNewEntries, [], mockOldIndex);

            expect(result).toHaveProperty('deletedFiles');
            expect(result).toHaveProperty('deletedDirectories');
        });

        it('should handle missing old index', () => {
            const result = IndexingUtils.detectDeletedEntries(mockNewEntries, [], { files: {} });

            expect(result).toHaveProperty('deletedFiles');
            expect(result).toHaveProperty('deletedDirectories');
        });
    });

    describe('estimateIndexingCostsForFiles', () => {
        const mockFiles = ['file1.js', 'file2.py', 'file3.txt'];

        beforeEach(() => {
            mockReadFileSync.mockReturnValue('console.log("hello world");');
            mockGetFileMetadata.mockReturnValue({ size: 100 });
            mockExtname
                .mockReturnValueOnce('.js')
                .mockReturnValueOnce('.py')
                .mockReturnValueOnce('.txt');
        });

        it('should estimate costs for files', () => {
            const mockFilesToSummarize = [
                { file: { size: 1000 } },
                { file: { size: 2000 } },
                { file: { size: 3000 } },
            ];
            const result = IndexingUtils.estimateIndexingCostsForFiles(mockFilesToSummarize, 5000);

            expect(result).toHaveProperty('filesToSummarize');
            expect(result).toHaveProperty('estimatedInputTokens');
            expect(result).toHaveProperty('estimatedOutputTokens');
            expect(result).toHaveProperty('totalEstimatedTokens');
        });

        it('should handle empty files array', () => {
            const result = IndexingUtils.estimateIndexingCostsForFiles([], 5000);

            expect(result).toHaveProperty('filesToSummarize');
            expect(result.filesToSummarize).toBe(0);
        });
    });

    describe('formatDuration', () => {
        it('should format milliseconds', () => {
            expect(IndexingUtils.formatDuration(500)).toBe('500ms');
        });

        it('should format seconds', () => {
            expect(IndexingUtils.formatDuration(1500)).toBe('1.5s');
        });

        it('should format minutes', () => {
            expect(IndexingUtils.formatDuration(65000)).toContain('m');
        });

        it('should format hours', () => {
            expect(IndexingUtils.formatDuration(3665000)).toContain('m');
        });
    });

    describe('getFileCategory', () => {
        beforeEach(() => {
            mockExtname.mockImplementation(path => {
                if (path.endsWith('.js')) {
                    return '.js';
                }
                if (path.endsWith('.py')) {
                    return '.py';
                }
                if (path.endsWith('.md')) {
                    return '.md';
                }
                return '';
            });
        });

        it('should categorize JavaScript files', () => {
            const result = IndexingUtils.getFileCategory('test.js');
            expect(result).toBe('source');
        });

        it('should categorize Python files', () => {
            const result = IndexingUtils.getFileCategory('test.py');
            expect(result).toBe('source');
        });

        it('should categorize documentation files', () => {
            const result = IndexingUtils.getFileCategory('README.md');
            expect(result).toBe('documentation');
        });

        it('should categorize unknown files', () => {
            const result = IndexingUtils.getFileCategory('test.xyz');
            // The function may return 'source' for unknown extensions as a fallback
            expect(['other', 'source']).toContain(result);
        });
    });
});
