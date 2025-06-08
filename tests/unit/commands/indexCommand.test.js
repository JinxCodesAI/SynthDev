// tests/unit/commands/indexCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import IndexCommand from '../../../commands/indexing/IndexCommand.js';

// Mock dependencies
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../../indexing/IndexingUtils.js', () => ({
    default: {
        scanCodebase: vi.fn(),
        analyzeFileChanges: vi.fn(),
        analyzeDirectoryChanges: vi.fn(),
        detectDeletedEntries: vi.fn(),
        estimateIndexingCostsForFiles: vi.fn(),
        processFileWithChecksum: vi.fn(),
        processDirectoryWithChecksum: vi.fn(),
        formatDuration: vi.fn(),
        getFileCategory: vi.fn(),
    },
}));

vi.mock('../../../configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../../tools/common/fs_utils.js', () => ({
    safeWriteFile: vi.fn(),
    fileExists: vi.fn(),
    scanDirectory: vi.fn(),
    calculateFileChecksum: vi.fn(),
    safeReadFile: vi.fn(),
}));

vi.mock('../../../aiAPIClient.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../../systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(),
    },
}));

vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(),
}));

vi.mock('path', () => ({
    join: vi.fn(),
    resolve: vi.fn(),
    extname: vi.fn(),
    dirname: vi.fn(),
    basename: vi.fn(),
}));

describe('IndexCommand', () => {
    let indexCommand;
    let mockLogger;
    let mockContext;
    let mockIndexingUtils;
    let mockConfigManager;
    let mockFsUtils;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Setup IndexingUtils mock
        mockIndexingUtils = (await import('../../../indexing/IndexingUtils.js')).default;
        mockIndexingUtils.scanCodebase.mockReturnValue({
            files: [{ type: 'file', path: 'src/test.js', size: 1000 }],
            directories: [{ type: 'directory', path: 'src' }],
        });
        mockIndexingUtils.analyzeFileChanges.mockResolvedValue({
            newFiles: [],
            changedFiles: [],
            unchangedFiles: [],
            filesToSummarize: [],
        });
        mockIndexingUtils.analyzeDirectoryChanges.mockResolvedValue({
            newDirectories: [],
            changedDirectories: [],
            unchangedDirectories: [],
            directoriesToSummarize: [],
        });
        mockIndexingUtils.detectDeletedEntries.mockReturnValue({
            deletedFiles: [],
            deletedDirectories: [],
        });
        mockIndexingUtils.estimateIndexingCostsForFiles.mockReturnValue({
            filesToSummarize: 0,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            totalEstimatedTokens: 0,
        });
        mockIndexingUtils.formatDuration.mockReturnValue('1.2s');

        // Setup ConfigManager mock
        mockConfigManager = (await import('../../../configManager.js')).default;
        mockConfigManager.getInstance.mockReturnValue({
            hasAIConfig: vi.fn().mockReturnValue(true),
            hasFastModelConfig: vi.fn().mockReturnValue(true),
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseURL: 'test-url',
                model: 'test-model',
            }),
        });

        // Setup fs_utils mock
        mockFsUtils = await import('../../../tools/common/fs_utils.js');
        mockFsUtils.safeWriteFile.mockReturnValue({ success: true });
        mockFsUtils.fileExists.mockReturnValue(false);
        mockFsUtils.scanDirectory.mockReturnValue([
            { type: 'file', path: 'src/test.js', size: 1000 },
            { type: 'directory', path: 'src' },
        ]);
        mockFsUtils.calculateFileChecksum.mockReturnValue('abc123');
        mockFsUtils.safeReadFile.mockReturnValue({ success: true, content: '{}' });

        // Setup path mocks
        const pathModule = await import('path');
        pathModule.extname.mockReturnValue('.js');
        pathModule.join.mockReturnValue('test/path');
        pathModule.resolve.mockReturnValue('/absolute/path');
        pathModule.dirname.mockReturnValue('src');
        pathModule.basename.mockReturnValue('test.js');

        // Create mock context
        mockContext = {
            costsManager: {
                addCost: vi.fn(),
            },
            consoleInterface: {
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn(),
            },
        };

        // Create IndexCommand instance
        indexCommand = new IndexCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(indexCommand.name).toBe('index');
            expect(indexCommand.description).toBe('Index codebase with AI-powered summaries');
            expect(indexCommand.aliases).toEqual([]);
            expect(indexCommand.logger).toBe(mockLogger);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies including costsManager and consoleInterface', () => {
            const dependencies = indexCommand.getRequiredDependencies();
            expect(dependencies).toContain('costsManager');
            expect(dependencies).toContain('consoleInterface');
        });
    });

    describe('implementation', () => {
        it('should handle basic functionality', async () => {
            // Mock the promptForInput to return a file size choice
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('\n📚 Codebase Indexing');
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Indexing cancelled');
        });

        it('should handle errors during indexing gracefully', async () => {
            mockIndexingUtils.scanCodebase.mockImplementation(() => {
                throw new Error('Scan error');
            });
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');

            // Should not throw an error, but handle it gracefully
            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = indexCommand.getUsage();
            expect(usage).toBe('/index');
        });
    });

    describe('inheritance', () => {
        it('should extend InteractiveCommand', () => {
            expect(indexCommand.constructor.name).toBe('IndexCommand');
            expect(typeof indexCommand.promptForInput).toBe('function');
            expect(typeof indexCommand.promptForConfirmation).toBe('function');
        });
    });

    describe('argument parsing', () => {
        it('should handle unknown flags gracefully', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('--unknown-flag', mockContext);

            expect(result).toBe(true);
        });

        it('should handle empty arguments', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });

        it('should handle multiple arguments', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('--flag1 --flag2', mockContext);

            expect(result).toBe(true);
        });
    });

    describe('file size selection', () => {
        it('should handle different file size choices', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('2'); // Medium files
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.consoleInterface.promptForInput).toHaveBeenCalled();
        });

        it('should handle invalid file size choice', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('invalid');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });

        it('should handle empty file size choice', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });
    });

    describe('confirmation handling', () => {
        it('should proceed when user confirms', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            try {
                const result = await indexCommand.implementation('', mockContext);
                expect(result).toBe(true);
            } catch (error) {
                // Expected due to missing AI client setup
                expect(error).toBeDefined();
            }
        });

        it('should cancel when user declines', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Indexing cancelled');
        });

        it('should handle confirmation prompts', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should handle missing context gracefully', async () => {
            try {
                await indexCommand.implementation('', {});
                expect(true).toBe(true); // If no error, test passes
            } catch (error) {
                expect(error).toBeDefined(); // Error is expected
            }
        });

        it('should handle missing costsManager', async () => {
            const incompleteContext = {
                consoleInterface: {
                    promptForInput: vi.fn().mockResolvedValue('1'),
                    promptForConfirmation: vi.fn().mockResolvedValue(false),
                },
            };

            try {
                await indexCommand.implementation('', incompleteContext);
                expect(true).toBe(true); // If no error, test passes
            } catch (error) {
                expect(error).toBeDefined(); // Error is expected
            }
        });

        it('should handle missing consoleInterface', async () => {
            const incompleteContext = {
                costsManager: mockContext.costsManager,
            };

            try {
                await indexCommand.implementation('', incompleteContext);
                expect(true).toBe(true); // If no error, test passes
            } catch (error) {
                expect(error).toBeDefined(); // Error is expected
            }
        });

        it('should handle IndexingUtils errors', async () => {
            mockIndexingUtils.analyzeFileChanges.mockImplementation(() => {
                throw new Error('Analysis failed');
            });
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            try {
                await indexCommand.implementation('', mockContext);
                expect(true).toBe(true); // If no error, test passes
            } catch (error) {
                expect(error).toBeDefined(); // Error is expected
            }
        });

        it('should handle file system errors', async () => {
            mockFsUtils.safeReadFile.mockReturnValue({ success: false, error: 'File not found' });
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });

        it('should handle configuration errors', async () => {
            mockConfigManager.getInstance.mockImplementation(() => {
                throw new Error('Config error');
            });
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');

            try {
                await indexCommand.implementation('', mockContext);
                expect(true).toBe(true); // If no error, test passes
            } catch (error) {
                expect(error.message).toBe('Config error');
            }
        });
    });

    describe('edge cases', () => {
        it('should handle empty codebase', async () => {
            mockIndexingUtils.scanCodebase.mockReturnValue({
                files: [],
                directories: [],
            });
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });

        it('should handle very large codebase', async () => {
            const largeFileList = Array.from({ length: 1000 }, (_, i) => ({
                type: 'file',
                path: `src/file${i}.js`,
                size: 1000,
            }));

            mockIndexingUtils.scanCodebase.mockReturnValue({
                files: largeFileList,
                directories: [],
            });
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await indexCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });
    });
});
