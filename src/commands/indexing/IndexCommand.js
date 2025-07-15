/**
 * Index Command
 * Indexes the codebase with AI-powered summaries
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import IndexingUtils from '../utils/IndexingUtils.js';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import ConfigManager from '../../../src/config/managers/configManager.js';
import { safeWriteFile, fileExists } from '../../tools/common/fs_utils.js';
import { getLogger } from '../../core/managers/logger.js';
import AIAPIClient from '../../core/ai/aiAPIClient.js';
import SystemMessages from '../../core/ai/systemMessages.js';

export class IndexCommand extends InteractiveCommand {
    constructor() {
        super('index', 'Index codebase with AI-powered summaries');
        this.logger = getLogger();
    }

    /**
     * Get required dependencies
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['costsManager', ...super.getRequiredDependencies()];
    }

    /**
     * Execute the index command
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const { costsManager } = context;

        this.logger.user('📚 Codebase Indexing');
        this.logger.user('═'.repeat(50));

        // Check if AI summaries are available
        const config = ConfigManager.getInstance();
        let hasAIConfig = false;
        try {
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');
            hasAIConfig = !!(modelConfig && modelConfig.apiKey);
        } catch (_error) {
            hasAIConfig = false;
        }

        if (hasAIConfig) {
            const modelType = config.hasFastModelConfig() ? 'fast' : 'base';
            const modelConfig = config.getModel(modelType);
            const modelName = modelConfig.model || modelConfig.baseModel;
            this.logger.info(`🤖 Using ${modelType} model for AI summaries: ${modelName}`);
        } else {
            this.logger.warn('Warning: No AI model configuration found');
            this.logger.info('📝 Will create index without AI summaries');
        }

        // Get user preferences
        const maxFileSize = await this.promptForFileSize(context);
        if (maxFileSize === null) {
            return true;
        } // User cancelled

        const includeHidden = await this.promptForConfirmation(
            'Include hidden files and directories?',
            context
        );

        // Create .index directory if it doesn't exist
        const indexDir = resolve('.index');
        if (!existsSync(indexDir)) {
            mkdirSync(indexDir, { recursive: true });
        }

        const indexFilePath = join(indexDir, 'codebase-index.json');

        // Load existing index if available
        let existingIndex = {};
        if (fileExists(indexFilePath)) {
            try {
                const existingContent = readFileSync(indexFilePath, 'utf8');
                existingIndex = JSON.parse(existingContent);
                this.logger.info('📂 Found existing index, will update changed files only');
            } catch (_error) {
                this.logger.warn('Could not load existing index, starting fresh');
            }
        }

        // Scan codebase
        this.logger.status('🔍 Scanning codebase...');
        const startTime = Date.now();
        const entries = IndexingUtils.scanCodebase(includeHidden);

        const files = entries.filter(entry => entry.type === 'file');
        const directories = entries.filter(entry => entry.type === 'directory');

        this.logger.info(
            `📁 Found ${files.length} files and ${directories.length} directories to process`
        );

        // Analyze files and detect changes using checksums
        this.logger.status('🔍 Analyzing file changes...');
        const fileAnalysisResult = await IndexingUtils.analyzeFileChanges(
            files,
            existingIndex,
            maxFileSize
        );

        // Analyze directories and detect changes
        this.logger.status('🔍 Analyzing directory changes...');
        const directoryAnalysisResult = await IndexingUtils.analyzeDirectoryChanges(
            directories,
            existingIndex
        );

        // Detect deleted entries
        this.logger.status('🔍 Detecting deleted entries...');
        const deletionResult = IndexingUtils.detectDeletedEntries(
            files,
            directories,
            existingIndex
        );

        // Combine results
        const analysisResult = {
            newFiles: fileAnalysisResult.newFiles,
            changedFiles: fileAnalysisResult.changedFiles,
            unchangedFiles: fileAnalysisResult.unchangedFiles,
            filesToSummarize: fileAnalysisResult.filesToSummarize,
            newDirectories: directoryAnalysisResult.newDirectories,
            changedDirectories: directoryAnalysisResult.changedDirectories,
            unchangedDirectories: directoryAnalysisResult.unchangedDirectories,
            directoriesToSummarize: directoryAnalysisResult.directoriesToSummarize,
            deletedFiles: deletionResult.deletedFiles,
            deletedDirectories: deletionResult.deletedDirectories,
        };

        this.logger.info('📊 Analysis Results:');
        this.logger.info(`   • Total files: ${files.length}`);
        this.logger.info(`   • New files: ${analysisResult.newFiles.length}`);
        this.logger.info(`   • Changed files: ${analysisResult.changedFiles.length}`);
        this.logger.info(`   • Unchanged files: ${analysisResult.unchangedFiles.length}`);
        this.logger.info(`   • Files to summarize: ${analysisResult.filesToSummarize.length}`);
        this.logger.info(`   • Total directories: ${directories.length}`);
        this.logger.info(`   • New directories: ${analysisResult.newDirectories.length}`);
        this.logger.info(
            `   • Directories to summarize: ${analysisResult.directoriesToSummarize.length}`
        );

        // Report deletions if any
        if (
            analysisResult.deletedFiles.length > 0 ||
            analysisResult.deletedDirectories.length > 0
        ) {
            this.logger.info(`   • Deleted files: ${analysisResult.deletedFiles.length}`);
            this.logger.info(
                `   • Deleted directories: ${analysisResult.deletedDirectories.length}`
            );

            // Show deleted items
            if (analysisResult.deletedFiles.length > 0) {
                this.logger.info('🗑️  Deleted files:');
                analysisResult.deletedFiles.forEach(deleted => {
                    this.logger.info(`   - ${deleted.path}`);
                });
            }
            if (analysisResult.deletedDirectories.length > 0) {
                this.logger.info('🗑️  Deleted directories:');
                analysisResult.deletedDirectories.forEach(deleted => {
                    this.logger.info(`   - ${deleted.path}`);
                });
            }
        }

        // Estimate costs before processing
        if (hasAIConfig && analysisResult.filesToSummarize.length > 0) {
            const costEstimate = IndexingUtils.estimateIndexingCostsForFiles(
                analysisResult.filesToSummarize,
                maxFileSize
            );
            this.logger.info('💰 Cost Estimation:');
            this.logger.info(`   • Files to summarize: ${costEstimate.filesToSummarize}`);
            this.logger.info(
                `   • Estimated input tokens: ${costEstimate.estimatedInputTokens.toLocaleString()}`
            );
            this.logger.info(
                `   • Estimated output tokens: ${costEstimate.estimatedOutputTokens.toLocaleString()}`
            );
            this.logger.info(
                `   • Total estimated tokens: ${costEstimate.totalEstimatedTokens.toLocaleString()}`
            );

            const proceed = await this.promptForConfirmation(
                'Proceed with indexing? This will consume API tokens.',
                context
            );

            if (!proceed) {
                this.logger.user('❌ Indexing cancelled');
                return true;
            }
        } else if (analysisResult.filesToSummarize.length === 0) {
            this.logger.info('✅ No files need to be processed - all files are up to date!');
            const proceed = await this.promptForConfirmation(
                'Update index metadata anyway?',
                context
            );
            if (!proceed) {
                this.logger.user('❌ Indexing cancelled');
                return true;
            }
        }

        // Process files and directories
        const index = await this.processCodebase(
            analysisResult,
            files,
            directories,
            maxFileSize,
            includeHidden,
            hasAIConfig,
            costsManager,
            startTime
        );

        // Add deletion statistics to the index
        index.statistics.deleted_files = analysisResult.deletedFiles.length;
        index.statistics.deleted_directories = analysisResult.deletedDirectories.length;

        // Save index to file
        this.logger.status('💾 Saving index...');
        const saveResult = safeWriteFile(indexFilePath, JSON.stringify(index, null, 2));
        if (!saveResult.success) {
            this.logger.error(`Failed to save index file: ${saveResult.error}`);
            return true;
        }

        // Show results
        this.showIndexingResults(index, indexFilePath);

        return true;
    }

    /**
     * Prompt user for file size limit
     * @param {Object} context - Execution context
     * @returns {Promise<number|null>} File size limit or null if cancelled
     */
    async promptForFileSize(context) {
        this.logger.user('📏 File Size Limit for AI Processing:');
        this.logger.user('1. Small (50KB) - Fast processing, good for most source files');
        this.logger.user('2. Medium (100KB) - Balanced processing, handles larger files');
        this.logger.user('3. Large (200KB) - Slower processing, handles very large files');
        this.logger.user('4. No limit - Process all files (may be slow/expensive)');

        const choice = await this.promptForInput(
            'Choose option (1-4) or press Enter for default (2): ',
            context
        );

        switch (choice.trim()) {
            case '1':
                return 51200; // 50KB
            case '2':
            case '':
                return 102400; // 100KB (default)
            case '3':
                return 204800; // 200KB
            case '4':
                return -1; // No limit
            default:
                this.logger.warn('Invalid choice, using default (100KB)');
                return 102400;
        }
    }

    /**
     * Process the entire codebase
     * @param {Object} analysisResult - Analysis results
     * @param {Array} files - All files
     * @param {Array} directories - All directories
     * @param {number} maxFileSize - Maximum file size
     * @param {boolean} includeHidden - Include hidden files
     * @param {boolean} hasAIConfig - Whether AI configuration is available
     * @param {Object} costsManager - Costs manager
     * @param {number} startTime - Start time
     * @returns {Promise<Object>} Complete index
     */
    async processCodebase(
        analysisResult,
        files,
        directories,
        maxFileSize,
        includeHidden,
        hasAIConfig,
        costsManager,
        startTime
    ) {
        const index = {
            metadata: {
                generated: new Date().toISOString(),
                version: '1.0.0',
                total_files: files.length,
                total_directories: directories.length,
                total_entries: files.length + directories.length,
                ai_summaries_enabled: hasAIConfig,
                parameters: {
                    max_file_size: maxFileSize,
                    include_hidden: includeHidden,
                },
            },
            files: {},
            statistics: {
                processed: 0,
                summarized: 0,
                skipped: 0,
                errors: 0,
                by_type: {},
                total_tokens_used: 0,
                total_summary_size: 0,
                directories_processed: 0,
                directories_summarized: 0,
            },
        };

        this.logger.status('📝 Processing files...');

        let fileSummarizerClient = null;
        if (hasAIConfig) {
            const config = ConfigManager.getInstance();
            const modelType = config.hasFastModelConfig() ? 'fast' : 'base';
            const modelConfig = config.getModel(modelType);
            fileSummarizerClient = new AIAPIClient(
                costsManager,
                modelConfig.apiKey,
                modelConfig.baseURL,
                modelConfig.model || modelConfig.baseModel
            );
            await fileSummarizerClient.setSystemMessage(
                SystemMessages.getSystemMessage('file_summarizer'),
                'file_summarizer'
            );
        }

        // Process each file using analysis results
        const allFilesToProcess = [
            ...analysisResult.newFiles,
            ...analysisResult.changedFiles,
            ...analysisResult.unchangedFiles,
        ];

        for (let i = 0; i < allFilesToProcess.length; i++) {
            const fileData = allFilesToProcess[i];
            const progress = Math.round((i / allFilesToProcess.length) * 100);

            if (i % 10 === 0 || i === allFilesToProcess.length - 1) {
                this.logger.info(
                    `   ${progress}% (${i + 1}/${allFilesToProcess.length}) - ${fileData.file.name}`
                );
            }

            try {
                const fileInfo = await IndexingUtils.processFileWithChecksum(
                    fileData.file,
                    fileData.checksum,
                    fileData.needsSummary,
                    maxFileSize,
                    costsManager,
                    fileData.existingInfo,
                    fileSummarizerClient
                );
                fileSummarizerClient.clearConversation();

                index.files[fileData.file.path] = fileInfo;
                index.statistics.processed++;

                if (fileInfo.ai_summary) {
                    if (fileInfo.summary_reused) {
                        index.statistics.summaries_reused =
                            (index.statistics.summaries_reused || 0) + 1;
                    } else {
                        index.statistics.summarized++;
                    }
                    // Track summary size
                    if (fileInfo.summary_size) {
                        index.statistics.total_summary_size += fileInfo.summary_size;
                    }
                }

                // Track token usage only for newly processed files (not reused summaries)
                if (fileInfo.tokens_used) {
                    index.statistics.total_tokens_used += fileInfo.tokens_used;
                }

                // Track by file type
                const category = IndexingUtils.getFileCategory(fileData.file.path);
                index.statistics.by_type[category] = (index.statistics.by_type[category] || 0) + 1;
            } catch (error) {
                this.logger.warn(`⚠️  Error processing ${fileData.file.path}:`, error.message);
                index.statistics.errors++;

                // Still add basic info even if processing failed
                index.files[fileData.file.path] = {
                    path: fileData.file.path,
                    type: fileData.file.type,
                    error: error.message,
                    processed_at: new Date().toISOString(),
                };
            }
        }

        // Process directories (after files are processed)
        this.logger.status('📁 Processing directories...');

        let directorySummarizerClient = null;
        if (hasAIConfig) {
            const config = ConfigManager.getInstance();
            const modelConfig = config.getModel('fast');
            directorySummarizerClient = new AIAPIClient(
                costsManager,
                modelConfig.apiKey,
                modelConfig.baseURL,
                modelConfig.model || modelConfig.baseModel
            );
            await directorySummarizerClient.setSystemMessage(
                SystemMessages.getSystemMessage('directory_summarizer'),
                'directory_summarizer'
            );
        }

        // Sort directories by level (deepest first) to ensure dependencies are processed correctly
        // Root directory (level 0) should be processed last to aggregate all other summaries
        const sortedDirectoriesToProcess = [
            ...analysisResult.newDirectories,
            ...analysisResult.changedDirectories,
            ...analysisResult.unchangedDirectories,
        ].sort((a, b) => {
            const aLevel = a.directory.lvl || 0;
            const bLevel = b.directory.lvl || 0;

            // Root directory (level 0) should be processed last
            if (aLevel === 0 && bLevel !== 0) {
                return 1;
            }
            if (bLevel === 0 && aLevel !== 0) {
                return -1;
            }

            // For non-root directories, process deepest first
            return bLevel - aLevel;
        });

        for (let i = 0; i < sortedDirectoriesToProcess.length; i++) {
            const directoryData = sortedDirectoriesToProcess[i];
            const progress = Math.round((i / sortedDirectoriesToProcess.length) * 100);

            if (i % 10 === 0 || i === sortedDirectoriesToProcess.length - 1) {
                this.logger.info(
                    `   ${progress}% (${i + 1}/${sortedDirectoriesToProcess.length}) - ${directoryData.directory.name}`
                );
            }

            try {
                // Get all processed entries (files and directories processed so far)
                const allProcessedEntries = Object.values(index.files);

                const directoryInfo = await IndexingUtils.processDirectoryWithChecksum(
                    directoryData.directory,
                    directoryData.needsSummary,
                    costsManager,
                    directoryData.existingInfo,
                    allProcessedEntries,
                    directorySummarizerClient
                );

                directorySummarizerClient.clearConversation();

                index.files[directoryData.directory.path] = directoryInfo;
                index.statistics.directories_processed++;

                if (directoryInfo.ai_summary) {
                    if (directoryInfo.summary_reused) {
                        index.statistics.summaries_reused =
                            (index.statistics.summaries_reused || 0) + 1;
                    } else {
                        index.statistics.directories_summarized++;
                    }
                    // Track summary size
                    if (directoryInfo.summary_size) {
                        index.statistics.total_summary_size += directoryInfo.summary_size;
                    }
                }

                // Track token usage only for newly processed directories (not reused summaries)
                if (directoryInfo.tokens_used) {
                    index.statistics.total_tokens_used += directoryInfo.tokens_used;
                }

                // Track by type
                index.statistics.by_type['directory'] =
                    (index.statistics.by_type['directory'] || 0) + 1;
            } catch (error) {
                this.logger.warn(
                    `⚠️  Error processing directory ${directoryData.directory.path}:`,
                    error.message
                );
                index.statistics.errors++;

                // Still add basic info even if processing failed
                index.files[directoryData.directory.path] = {
                    path: directoryData.directory.path,
                    type: 'directory',
                    error: error.message,
                    processed_at: new Date().toISOString(),
                };
            }
        }

        // Calculate processing time
        const processingTime = Date.now() - startTime;
        index.metadata.processing_time_ms = processingTime;
        index.metadata.processing_time_human = IndexingUtils.formatDuration(processingTime);

        return index;
    }

    /**
     * Show indexing results
     * @param {Object} index - Complete index
     * @param {string} indexFilePath - Index file path
     */
    showIndexingResults(index, indexFilePath) {
        this.logger.user('✅ Codebase indexing completed successfully!');
        this.logger.info('─'.repeat(50));
        this.logger.info(`📁 Index file: ${indexFilePath}`);
        this.logger.info('📊 Statistics:');
        this.logger.info(`   • Files processed: ${index.statistics.processed}`);
        this.logger.info(`   • Directories processed: ${index.statistics.directories_processed}`);
        this.logger.info(
            `   • Total entries: ${index.statistics.processed + index.statistics.directories_processed}`
        );
        this.logger.info(`   • New file summaries: ${index.statistics.summarized}`);
        this.logger.info(
            `   • New directory summaries: ${index.statistics.directories_summarized}`
        );
        if (index.statistics.summaries_reused) {
            this.logger.info(`   • Reused summaries: ${index.statistics.summaries_reused}`);
        }
        if (index.statistics.deleted_files > 0 || index.statistics.deleted_directories > 0) {
            this.logger.info(`   • Deleted files: ${index.statistics.deleted_files}`);
            this.logger.info(`   • Deleted directories: ${index.statistics.deleted_directories}`);
        }
        this.logger.info(`   • Errors: ${index.statistics.errors}`);
        this.logger.info(`   • Processing time: ${index.metadata.processing_time_human}`);
        this.logger.info(
            `   • Tokens used this run: ${index.statistics.total_tokens_used.toLocaleString()}`
        );
        this.logger.info(
            `   • Total summary size: ${(index.statistics.total_summary_size / 1024).toFixed(1)} KB`
        );
        this.logger.info(
            `   • By type: ${Object.entries(index.statistics.by_type)
                .map(([type, count]) => `${type}(${count})`)
                .join(', ')}`
        );
        this.logger.raw();
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/index';
    }
}

export default IndexCommand;
