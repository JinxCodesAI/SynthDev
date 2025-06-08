/**
 * Index Command
 * Indexes the codebase with AI-powered summaries
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import IndexingUtils from '../utils/IndexingUtils.js';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import ConfigManager from '../../configManager.js';
import { safeWriteFile, fileExists } from '../../tools/common/fs_utils.js';
import { getLogger } from '../../logger.js';
import AIAPIClient from '../../aiAPIClient.js';
import SystemMessages from '../../systemMessages.js';

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

        this.logger.raw('\n📚 Codebase Indexing');
        this.logger.raw('═'.repeat(50));

        // Check if AI summaries are available
        const config = ConfigManager.getInstance();
        let hasAIConfig = false;
        try {
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');
            hasAIConfig = !!(modelConfig && modelConfig.apiKey);
        } catch (error) {
            hasAIConfig = false;
        }

        if (hasAIConfig) {
            const modelType = config.hasFastModelConfig() ? 'fast' : 'base';
            const modelConfig = config.getModel(modelType);
            const modelName = modelConfig.model || modelConfig.baseModel;
            this.logger.raw(`🤖 Using ${modelType} model for AI summaries: ${modelName}`);
        } else {
            this.logger.warn('Warning: No AI model configuration found');
            this.logger.raw('📝 Will create index without AI summaries');
        }

        // Get user preferences
        const maxFileSize = await this.promptForFileSize(context);
        if (maxFileSize === null) return true; // User cancelled

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
                this.logger.raw('📂 Found existing index, will update changed files only');
            } catch (error) {
                this.logger.warn('Could not load existing index, starting fresh');
            }
        }

        // Scan codebase
        this.logger.raw('\n🔍 Scanning codebase...');
        const startTime = Date.now();
        const entries = IndexingUtils.scanCodebase(includeHidden);

        const files = entries.filter(entry => entry.type === 'file');
        const directories = entries.filter(entry => entry.type === 'directory');

        this.logger.raw(`📁 Found ${files.length} files and ${directories.length} directories to process`);

        // Analyze files and detect changes using checksums
        this.logger.raw('\n🔍 Analyzing file changes...');
        const fileAnalysisResult = await IndexingUtils.analyzeFileChanges(files, existingIndex, maxFileSize);

        // Analyze directories and detect changes
        this.logger.raw('\n🔍 Analyzing directory changes...');
        const directoryAnalysisResult = await IndexingUtils.analyzeDirectoryChanges(directories, existingIndex);

        // Detect deleted entries
        this.logger.raw('\n🔍 Detecting deleted entries...');
        const deletionResult = IndexingUtils.detectDeletedEntries(files, directories, existingIndex);

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
            deletedDirectories: deletionResult.deletedDirectories
        };

        this.logger.raw('\n📊 Analysis Results:');
        this.logger.raw(`   • Total files: ${files.length}`);
        this.logger.raw(`   • New files: ${analysisResult.newFiles.length}`);
        this.logger.raw(`   • Changed files: ${analysisResult.changedFiles.length}`);
        this.logger.raw(`   • Unchanged files: ${analysisResult.unchangedFiles.length}`);
        this.logger.raw(`   • Files to summarize: ${analysisResult.filesToSummarize.length}`);
        this.logger.raw(`   • Total directories: ${directories.length}`);
        this.logger.raw(`   • New directories: ${analysisResult.newDirectories.length}`);
        this.logger.raw(`   • Directories to summarize: ${analysisResult.directoriesToSummarize.length}`);

        // Report deletions if any
        if (analysisResult.deletedFiles.length > 0 || analysisResult.deletedDirectories.length > 0) {
            this.logger.raw(`   • Deleted files: ${analysisResult.deletedFiles.length}`);
            this.logger.raw(`   • Deleted directories: ${analysisResult.deletedDirectories.length}`);

            // Show deleted items
            if (analysisResult.deletedFiles.length > 0) {
                this.logger.raw('\n🗑️  Deleted files:');
                analysisResult.deletedFiles.forEach(deleted => {
                    this.logger.raw(`   - ${deleted.path}`);
                });
            }
            if (analysisResult.deletedDirectories.length > 0) {
                this.logger.raw('\n🗑️  Deleted directories:');
                analysisResult.deletedDirectories.forEach(deleted => {
                    this.logger.raw(`   - ${deleted.path}`);
                });
            }
        }

        // Estimate costs before processing
        if (hasAIConfig && analysisResult.filesToSummarize.length > 0) {
            const costEstimate = IndexingUtils.estimateIndexingCostsForFiles(analysisResult.filesToSummarize, maxFileSize);
            this.logger.raw('\n💰 Cost Estimation:');
            this.logger.raw(`   • Files to summarize: ${costEstimate.filesToSummarize}`);
            this.logger.raw(`   • Estimated input tokens: ${costEstimate.estimatedInputTokens.toLocaleString()}`);
            this.logger.raw(`   • Estimated output tokens: ${costEstimate.estimatedOutputTokens.toLocaleString()}`);
            this.logger.raw(`   • Total estimated tokens: ${costEstimate.totalEstimatedTokens.toLocaleString()}`);

            const proceed = await this.promptForConfirmation(
                'Proceed with indexing? This will consume API tokens.',
                context
            );

            if (!proceed) {
                this.logger.raw('❌ Indexing cancelled');
                return true;
            }
        } else if (analysisResult.filesToSummarize.length === 0) {
            this.logger.raw('\n✅ No files need to be processed - all files are up to date!');
            const proceed = await this.promptForConfirmation(
                'Update index metadata anyway?',
                context
            );
            if (!proceed) {
                this.logger.raw('❌ Indexing cancelled');
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
        this.logger.raw('\n💾 Saving index...');
        const saveResult = safeWriteFile(indexFilePath, JSON.stringify(index, null, 2));
        if (!saveResult.success) {
            this.logger.raw(`❌ Failed to save index file: ${saveResult.error}`);
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
        this.logger.raw('\n📏 File Size Limit for AI Processing:');
        this.logger.raw('1. Small (50KB) - Fast processing, good for most source files');
        this.logger.raw('2. Medium (100KB) - Balanced processing, handles larger files');
        this.logger.raw('3. Large (200KB) - Slower processing, handles very large files');
        this.logger.raw('4. No limit - Process all files (may be slow/expensive)');

        const choice = await this.promptForInput('Choose option (1-4) or press Enter for default (2): ', context);

        switch (choice.trim()) {
            case '1': return 51200; // 50KB
            case '2': case '': return 102400; // 100KB (default)
            case '3': return 204800; // 200KB
            case '4': return -1; // No limit
            default:
                this.logger.raw('❌ Invalid choice, using default (100KB)');
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
    async processCodebase(analysisResult, files, directories, maxFileSize, includeHidden, hasAIConfig, costsManager, startTime) {
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
                    include_hidden: includeHidden
                }
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
                directories_summarized: 0
            }
        };

        this.logger.raw('\n📝 Processing files...');

        let fileSummarizerClient = null;
        if (hasAIConfig) {
            const config = ConfigManager.getInstance();
            const modelType = config.hasFastModelConfig() ? 'fast' : 'base';
            const modelConfig = config.getModel(modelType);
            fileSummarizerClient = new AIAPIClient(costsManager, modelConfig.apiKey, modelConfig.baseURL, modelConfig.model || modelConfig.baseModel);
            await fileSummarizerClient.setSystemMessage(SystemMessages.getSystemMessage('file_summarizer'), 'file_summarizer');
        }

        // Process each file using analysis results
        const allFilesToProcess = [
            ...analysisResult.newFiles,
            ...analysisResult.changedFiles,
            ...analysisResult.unchangedFiles
        ];

        for (let i = 0; i < allFilesToProcess.length; i++) {
            const fileData = allFilesToProcess[i];
            const progress = Math.round((i / allFilesToProcess.length) * 100);

            if (i % 10 === 0 || i === allFilesToProcess.length - 1) {
                this.logger.raw(`   ${progress}% (${i + 1}/${allFilesToProcess.length}) - ${fileData.file.name}`);
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
                        index.statistics.summaries_reused = (index.statistics.summaries_reused || 0) + 1;
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
                    processed_at: new Date().toISOString()
                };
            }
        }

        // Process directories (after files are processed)
        this.logger.raw('\n📁 Processing directories...');

        let directorySummarizerClient = null;
        if (hasAIConfig) {
            const config = ConfigManager.getInstance();
            const modelConfig = config.getModel('fast');
            directorySummarizerClient = new AIAPIClient(costsManager, modelConfig.apiKey, modelConfig.baseURL, modelConfig.model || modelConfig.baseModel);
            await directorySummarizerClient.setSystemMessage(SystemMessages.getSystemMessage('directory_summarizer'), 'directory_summarizer');
        }

        // Sort directories by level (deepest first) to ensure dependencies are processed correctly
        // Root directory (level 0) should be processed last to aggregate all other summaries
        const sortedDirectoriesToProcess = [
            ...analysisResult.newDirectories,
            ...analysisResult.changedDirectories,
            ...analysisResult.unchangedDirectories
        ].sort((a, b) => {
            const aLevel = a.directory.lvl || 0;
            const bLevel = b.directory.lvl || 0;

            // Root directory (level 0) should be processed last
            if (aLevel === 0 && bLevel !== 0) return 1;
            if (bLevel === 0 && aLevel !== 0) return -1;

            // For non-root directories, process deepest first
            return bLevel - aLevel;
        });

        for (let i = 0; i < sortedDirectoriesToProcess.length; i++) {
            const directoryData = sortedDirectoriesToProcess[i];
            const progress = Math.round((i / sortedDirectoriesToProcess.length) * 100);

            if (i % 10 === 0 || i === sortedDirectoriesToProcess.length - 1) {
                this.logger.raw(`   ${progress}% (${i + 1}/${sortedDirectoriesToProcess.length}) - ${directoryData.directory.name}`);
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
                        index.statistics.summaries_reused = (index.statistics.summaries_reused || 0) + 1;
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
                index.statistics.by_type['directory'] = (index.statistics.by_type['directory'] || 0) + 1;

            } catch (error) {
                this.logger.warn(`⚠️  Error processing directory ${directoryData.directory.path}:`, error.message);
                index.statistics.errors++;

                // Still add basic info even if processing failed
                index.files[directoryData.directory.path] = {
                    path: directoryData.directory.path,
                    type: 'directory',
                    error: error.message,
                    processed_at: new Date().toISOString()
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
        this.logger.raw('\n✅ Codebase indexing completed successfully!');
        this.logger.raw('─'.repeat(50));
        this.logger.raw(`📁 Index file: ${indexFilePath}`);
        this.logger.raw(`📊 Statistics:`);
        this.logger.raw(`   • Files processed: ${index.statistics.processed}`);
        this.logger.raw(`   • Directories processed: ${index.statistics.directories_processed}`);
        this.logger.raw(`   • Total entries: ${index.statistics.processed + index.statistics.directories_processed}`);
        this.logger.raw(`   • New file summaries: ${index.statistics.summarized}`);
        this.logger.raw(`   • New directory summaries: ${index.statistics.directories_summarized}`);
        if (index.statistics.summaries_reused) {
            this.logger.raw(`   • Reused summaries: ${index.statistics.summaries_reused}`);
        }
        if (index.statistics.deleted_files > 0 || index.statistics.deleted_directories > 0) {
            this.logger.raw(`   • Deleted files: ${index.statistics.deleted_files}`);
            this.logger.raw(`   • Deleted directories: ${index.statistics.deleted_directories}`);
        }
        this.logger.raw(`   • Errors: ${index.statistics.errors}`);
        this.logger.raw(`   • Processing time: ${index.metadata.processing_time_human}`);
        this.logger.raw(`   • Tokens used this run: ${index.statistics.total_tokens_used.toLocaleString()}`);
        this.logger.raw(`   • Total summary size: ${(index.statistics.total_summary_size / 1024).toFixed(1)} KB`);
        this.logger.raw(`   • By type: ${Object.entries(index.statistics.by_type).map(([type, count]) => `${type}(${count})`).join(', ')}`);
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
