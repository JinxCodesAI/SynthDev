/**
 * Indexing Utilities
 * Helper functions for codebase indexing operations
 */

import { readFileSync } from 'fs';
import { extname } from 'path';
import { scanDirectory, getFileMetadata, calculateFileChecksum, calculateDirectoryChecksum } from '../../tools/common/fs_utils.js';
import AIAPIClient from '../../aiAPIClient.js';
import SystemMessages from '../../systemMessages.js';
import ConfigManager from '../../configManager.js';
import { getLogger } from '../../logger.js';

export class IndexingUtils {
    /**
     * Scan codebase for files and directories
     * @param {boolean} includeHidden - Whether to include hidden files
     * @returns {Array} Array of file and directory entries
     */
    static scanCodebase(includeHidden) {
        const options = {
            depth: -1, // Unlimited depth
            includeHidden,
            exclusionList: [
                'node_modules', '.git', '.svn', 'build', 'dist', '.cache',
                '__pycache__', '.DS_Store', 'Thumbs.db', '.index'
            ]
        };

        const entries = scanDirectory('.', options);

        // Add the root directory itself to the entries
        // scanDirectory only returns contents, not the directory itself
        const rootDirectory = {
            name: '.',
            type: 'directory',
            path: '.',
            lvl: 0
        };

        // Add root directory at the beginning
        entries.unshift(rootDirectory);

        return entries;
    }

    /**
     * Determine if a file should be summarized by AI
     * @param {Object} fileInfo - File information object
     * @returns {boolean} True if file should be summarized
     */
    static shouldSummarizeFile(fileInfo) {
        // File type categories for better organization
        const fileTypeCategories = {
            source: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.swift'],
            config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.env'],
            documentation: ['.md', '.txt', '.rst', '.adoc', '.tex'],
            web: ['.html', '.htm', '.css', '.scss', '.sass', '.less'],
            data: ['.xml', '.csv', '.sql', '.graphql', '.proto'],
            build: ['.dockerfile', '.makefile', '.gradle', '.maven', '.cmake']
        };

        // Process text-based files
        const textExtensions = [
            ...fileTypeCategories.source,
            ...fileTypeCategories.config,
            ...fileTypeCategories.documentation,
            ...fileTypeCategories.web,
            ...fileTypeCategories.data,
            ...fileTypeCategories.build
        ];

        return textExtensions.includes(fileInfo.extension) || fileInfo.extension === '';
    }

    /**
     * Get file category based on extension
     * @param {string} filePath - File path
     * @returns {string} File category
     */
    static getFileCategory(filePath) {
        const ext = extname(filePath).toLowerCase();

        const fileTypeCategories = {
            source: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.swift'],
            config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.env'],
            documentation: ['.md', '.txt', '.rst', '.adoc', '.tex'],
            web: ['.html', '.htm', '.css', '.scss', '.sass', '.less'],
            data: ['.xml', '.csv', '.sql', '.graphql', '.proto'],
            build: ['.dockerfile', '.makefile', '.gradle', '.maven', '.cmake']
        };

        for (const [category, extensions] of Object.entries(fileTypeCategories)) {
            if (extensions.includes(ext)) {
                return category;
            }
        }

        return 'other';
    }

    /**
     * Estimate indexing costs for files
     * @param {Array} filesToSummarize - Array of files to summarize
     * @param {number} maxFileSize - Maximum file size to process
     * @returns {Object} Cost estimation
     */
    static estimateIndexingCostsForFiles(filesToSummarize, maxFileSize) {
        let estimatedInputTokens = 0;
        const estimatedOutputTokens = 200; // Max tokens per summary

        for (const fileData of filesToSummarize) {
            const file = fileData.file;
            // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
            let contentSize = file.size || 0;
            if (maxFileSize > 0 && contentSize > maxFileSize) {
                contentSize = maxFileSize;
            }

            // Add prompt overhead (approximately 100 tokens for the prompt template)
            const promptOverhead = 100 * 4; // 100 tokens * 4 bytes per token
            const totalInputSize = contentSize + promptOverhead;
            const inputTokens = Math.ceil(totalInputSize / 4); // 1 token ≈ 4 bytes

            estimatedInputTokens += inputTokens;
        }

        const totalOutputTokens = filesToSummarize.length * estimatedOutputTokens;
        const totalEstimatedTokens = estimatedInputTokens + totalOutputTokens;

        return {
            filesToSummarize: filesToSummarize.length,
            estimatedInputTokens,
            estimatedOutputTokens: totalOutputTokens,
            totalEstimatedTokens
        };
    }

    /**
     * Analyze file changes using checksums
     * @param {Array} files - Array of files to analyze
     * @param {Object} existingIndex - Existing index data
     * @param {number} maxFileSize - Maximum file size
     * @returns {Object} Analysis results
     */
    static async analyzeFileChanges(files, existingIndex, maxFileSize) {
        const newFiles = [];
        const changedFiles = [];
        const unchangedFiles = [];
        const filesToSummarize = [];

        const logger = getLogger();
        logger.raw('   Calculating checksums...');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (i % 50 === 0 || i === files.length - 1) {
                const progress = Math.round((i / files.length) * 100);
                logger.raw(`   ${progress}% (${i + 1}/${files.length}) checksums calculated`);
            }

            const checksum = calculateFileChecksum(file.path);
            if (!checksum) {
                // Skip files that can't be read
                continue;
            }

            const existingInfo = existingIndex.files?.[file.path];
            const fileData = {
                file,
                checksum,
                existingInfo,
                needsSummary: false
            };

            if (!existingInfo) {
                // New file
                newFiles.push(fileData);
                if (this.shouldSummarizeFile({ extension: extname(file.path).toLowerCase() })) {
                    fileData.needsSummary = true;
                    filesToSummarize.push(fileData);
                }
            } else if (existingInfo.checksum !== checksum) {
                // File has changed
                changedFiles.push(fileData);
                if (this.shouldSummarizeFile({ extension: extname(file.path).toLowerCase() })) {
                    fileData.needsSummary = true;
                    filesToSummarize.push(fileData);
                }
            } else {
                // File unchanged
                unchangedFiles.push(fileData);
            }
        }

        return {
            newFiles,
            changedFiles,
            unchangedFiles,
            filesToSummarize
        };
    }

    /**
     * Detect deleted entries by comparing existing index with current filesystem
     * @param {Array} currentFiles - Current files from filesystem scan
     * @param {Array} currentDirectories - Current directories from filesystem scan
     * @param {Object} existingIndex - Existing index data
     * @returns {Object} Deleted entries analysis
     */
    static detectDeletedEntries(currentFiles, currentDirectories, existingIndex) {
        const deletedFiles = [];
        const deletedDirectories = [];

        if (!existingIndex.files) {
            return { deletedFiles, deletedDirectories };
        }

        // Create sets of current paths for efficient lookup
        const currentFilePaths = new Set(currentFiles.map(f => f.path));
        const currentDirectoryPaths = new Set(currentDirectories.map(d => d.path));

        // Check each entry in existing index
        for (const [path, entry] of Object.entries(existingIndex.files)) {
            if (entry.type === 'file') {
                if (!currentFilePaths.has(path)) {
                    deletedFiles.push({ path, entry });
                }
            } else if (entry.type === 'directory') {
                if (!currentDirectoryPaths.has(path)) {
                    deletedDirectories.push({ path, entry });
                }
            }
        }

        return { deletedFiles, deletedDirectories };
    }

    /**
     * Analyze directory changes
     * @param {Array} directories - Array of directories to analyze
     * @param {Object} existingIndex - Existing index data
     * @returns {Object} Analysis results
     */
    static async analyzeDirectoryChanges(directories, existingIndex) {
        const newDirectories = [];
        const changedDirectories = [];
        const unchangedDirectories = [];
        const directoriesToSummarize = [];

        const logger = getLogger();
        logger.raw('   Analyzing directories...');

        for (let i = 0; i < directories.length; i++) {
            const directory = directories[i];

            if (i % 50 === 0 || i === directories.length - 1) {
                const progress = Math.round((i / directories.length) * 100);
                logger.raw(`   ${progress}% (${i + 1}/${directories.length}) directories analyzed`);
            }

            const existingInfo = existingIndex.files?.[directory.path];
            const directoryData = {
                directory,
                existingInfo,
                needsSummary: false
            };

            if (!existingInfo) {
                // New directory
                newDirectories.push(directoryData);
                directoryData.needsSummary = true;
                directoriesToSummarize.push(directoryData);
            } else {
                // Directory exists - calculate checksum to determine if changed
                // This will be refined during actual processing

                // For now, assume all existing directories need to be checked
                // The actual change detection will happen during processing
                directoryData.needsSummary = true;
                directoriesToSummarize.push(directoryData);

                // We'll categorize as changed/unchanged during processing
                // For analysis purposes, assume it's unchanged unless proven otherwise
                unchangedDirectories.push(directoryData);
            }
        }

        return {
            newDirectories,
            changedDirectories,
            unchangedDirectories,
            directoriesToSummarize
        };
    }

    /**
     * Format duration in human-readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    static formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    }

    /**
     * Generate AI summary for a file
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @param {Object} costsManager - Costs manager instance
     * @returns {Promise<Object>} Summary result
     */
    static async generateAISummary(filePath, content, costsManager) {
        try {
            // Initialize AI client for file summarization
            const config = ConfigManager.getInstance();
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');

            const aiClient = new AIAPIClient(
                costsManager,
                modelConfig.apiKey,
                modelConfig.baseUrl,
                modelConfig.model || modelConfig.baseModel
            );

            // Set the file_summarizer role
            const systemMessage = SystemMessages.getSystemMessage('file_summarizer');
            await aiClient.setSystemMessage(systemMessage, 'file_summarizer');

            // Construct user prompt
            const userPrompt = `Analyze this file and provide a concise summary (up to 150 words):

File: ${filePath}
Content:
${content}

Focus on:
1. Primary purpose/functionality
2. Key components or exports
3. Relationships to other parts of the codebase

Summary:`;

            // Create a promise to capture the response
            let responseContent = null;
            let responseError = null;
            let responseUsage = null;

            // Set up response callback
            aiClient.setCallbacks({
                onResponse: (response) => {
                    if (response && response.choices && response.choices[0] && response.choices[0].message) {
                        responseContent = response.choices[0].message.content;
                        responseUsage = response.usage;
                    }
                },
                onError: (error) => {
                    responseError = error;
                }
            });

            // Send the user message and wait for response
            await aiClient.sendUserMessage(userPrompt);

            // Check for errors
            if (responseError) {
                throw new Error(`AI summary generation failed: ${responseError.message}`);
            }

            // Check if we got a response
            if (!responseContent) {
                throw new Error('No response received from AI');
            }

            const summary = responseContent.trim();
            const tokensUsed = responseUsage ? (responseUsage.prompt_tokens + responseUsage.completion_tokens) : 0;

            return {
                summary,
                usage: responseUsage,
                tokensUsed
            };
        } catch (error) {
            throw new Error(`AI summary generation failed: ${error.message}`);
        }
    }

    /**
     * Generate AI summary for a directory
     * @param {string} dirPath - Directory path
     * @param {string} contentSummaries - Content summaries
     * @param {Object} costsManager - Costs manager instance
     * @returns {Promise<Object>} Summary result
     */
    static async generateDirectorySummary(dirPath, contentSummaries, costsManager) {
        try {
            // Initialize AI client for directory summarization
            const config = ConfigManager.getInstance();
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');

            const aiClient = new AIAPIClient(
                costsManager,
                modelConfig.apiKey,
                modelConfig.baseUrl,
                modelConfig.model || modelConfig.baseModel
            );

            // Set the directory_summarizer role
            const systemMessage = SystemMessages.getSystemMessage('directory_summarizer');
            await aiClient.setSystemMessage(systemMessage, 'directory_summarizer');

            // Construct user prompt with special handling for root directory
            const isRootDirectory = dirPath === '.';
            const directoryDescription = isRootDirectory ? 'root directory (entire project)' : `directory: ${dirPath}`;
            const focusPoints = isRootDirectory
                ? `Focus on:
1. Overall project purpose and architecture
2. Main components and their organization
3. Technology stack and project structure
4. Key directories and their roles`
                : `Focus on:
1. Overall purpose and functionality of this directory
2. Key components and their relationships
3. Role within the larger codebase structure`;

            const userPrompt = `Analyze this ${directoryDescription} and provide a concise summary (up to 150 words) based on its contents:

Directory: ${dirPath}
Content summaries:
${contentSummaries}

${focusPoints}

Directory Summary:`;

            // Create a promise to capture the response
            let responseContent = null;
            let responseError = null;
            let responseUsage = null;

            // Set up response callback
            aiClient.setCallbacks({
                onResponse: (response) => {
                    if (response && response.choices && response.choices[0] && response.choices[0].message) {
                        responseContent = response.choices[0].message.content;
                        responseUsage = response.usage;
                    }
                },
                onError: (error) => {
                    responseError = error;
                }
            });

            // Send the user message and wait for response
            await aiClient.sendUserMessage(userPrompt);

            // Check for errors
            if (responseError) {
                throw new Error(`AI directory summary generation failed: ${responseError.message}`);
            }

            // Check if we got a response
            if (!responseContent) {
                throw new Error('No response received from AI');
            }

            const summary = responseContent.trim();
            const tokensUsed = responseUsage ? (responseUsage.prompt_tokens + responseUsage.completion_tokens) : 0;

            return {
                summary,
                usage: responseUsage,
                tokensUsed
            };
        } catch (error) {
            throw new Error(`AI directory summary generation failed: ${error.message}`);
        }
    }

    /**
     * Process a file with checksum validation
     * @param {Object} file - File object
     * @param {string} checksum - File checksum
     * @param {boolean} needsSummary - Whether file needs AI summary
     * @param {number} maxFileSize - Maximum file size to process
     * @param {Object} costsManager - Costs manager instance
     * @param {Object} existingFileInfo - Existing file information
     * @returns {Promise<Object>} Processed file information
     */
    static async processFileWithChecksum(file, checksum, needsSummary, maxFileSize, costsManager, existingFileInfo) {
        const filePath = file.path;
        const metadata = getFileMetadata(filePath);

        if (!metadata) {
            throw new Error('Could not read file metadata');
        }

        const fileInfo = {
            path: filePath,
            name: file.name,
            type: 'file',
            size: metadata.size,
            modified: metadata.modified.toISOString(),
            checksum: checksum,
            extension: extname(filePath).toLowerCase(),
            category: this.getFileCategory(filePath),
            processed_at: new Date().toISOString()
        };

        // If file hasn't changed and we have existing summary, reuse it
        if (existingFileInfo && existingFileInfo.checksum === checksum && existingFileInfo.ai_summary) {
            fileInfo.ai_summary = existingFileInfo.ai_summary;
            fileInfo.summary_reused = true;
            fileInfo.summary_size = existingFileInfo.summary_size ||
                Buffer.byteLength(existingFileInfo.ai_summary, 'utf8');
            // Don't copy tokens_used for reused summaries - we didn't use tokens in this run
            fileInfo.tokens_used_previous = existingFileInfo.tokens_used || 0;
            return fileInfo;
        }

        // Generate new summary if needed
        if (needsSummary && costsManager) {
            try {
                let content = readFileSync(filePath, 'utf8');

                // Truncate content to maxFileSize if needed
                if (maxFileSize > 0 && content.length > maxFileSize) {
                    content = content.substring(0, maxFileSize);
                    fileInfo.content_truncated = true;
                    fileInfo.original_size = metadata.size;
                }

                const summaryResult = await this.generateAISummary(filePath, content, costsManager);
                fileInfo.ai_summary = summaryResult.summary;
                fileInfo.summary_size = Buffer.byteLength(summaryResult.summary, 'utf8');
                fileInfo.tokens_used = summaryResult.tokensUsed;
                fileInfo.content_preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');

            } catch (error) {
                fileInfo.summary_error = error.message;
            }
        } else {
            fileInfo.summary_skipped = needsSummary ? 'Costs manager not available' : 'File criteria not met';
        }

        return fileInfo;
    }

    /**
     * Process a directory with checksum validation
     * @param {Object} directory - Directory object
     * @param {boolean} needsSummary - Whether directory needs AI summary
     * @param {Object} costsManager - Costs manager instance
     * @param {Object} existingDirectoryInfo - Existing directory information
     * @param {Array} allProcessedEntries - All processed entries (files and directories)
     * @returns {Promise<Object>} Processed directory information
     */
    static async processDirectoryWithChecksum(directory, needsSummary, costsManager, existingDirectoryInfo, allProcessedEntries) {
        const dirPath = directory.path;
        const metadata = getFileMetadata(dirPath);

        if (!metadata) {
            throw new Error('Could not read directory metadata');
        }

        // Get direct contents of this directory
        const directContents = allProcessedEntries.filter(entry => {
            // For Windows paths, handle both forward and backward slashes
            const normalizedEntryPath = entry.path.replace(/\\/g, '/');
            const normalizedDirPath = dirPath.replace(/\\/g, '/');

            const entryDir = normalizedEntryPath.substring(0, normalizedEntryPath.lastIndexOf('/')) || '.';
            return entryDir === normalizedDirPath || (normalizedDirPath === '.' && !normalizedEntryPath.includes('/'));
        });

        // Calculate directory checksum from direct contents
        const contentChecksums = directContents.map(entry => entry.checksum).filter(Boolean);
        const directoryChecksum = calculateDirectoryChecksum(contentChecksums);

        const directoryInfo = {
            path: dirPath,
            name: directory.name,
            type: 'directory',
            modified: metadata.modified.toISOString(),
            checksum: directoryChecksum,
            lvl: directory.lvl,
            processed_at: new Date().toISOString(),
            content_count: directContents.length
        };

        // If directory hasn't changed and we have existing summary, reuse it
        if (existingDirectoryInfo && existingDirectoryInfo.checksum === directoryChecksum && existingDirectoryInfo.ai_summary) {
            directoryInfo.ai_summary = existingDirectoryInfo.ai_summary;
            directoryInfo.summary_reused = true;
            directoryInfo.summary_size = existingDirectoryInfo.summary_size ||
                Buffer.byteLength(existingDirectoryInfo.ai_summary, 'utf8');
            directoryInfo.tokens_used_previous = existingDirectoryInfo.tokens_used || 0;
            return directoryInfo;
        }

        // Generate new summary if needed
        if (needsSummary && costsManager && directContents.length > 0) {
            try {
                // Collect AI summaries from direct contents
                const contentSummaries = directContents
                    .filter(entry => entry.ai_summary)
                    .map(entry => `${entry.name} (${entry.type}): ${entry.ai_summary}`)
                    .join('\n\n');

                if (contentSummaries) {
                    const summaryResult = await this.generateDirectorySummary(dirPath, contentSummaries, costsManager);
                    directoryInfo.ai_summary = summaryResult.summary;
                    directoryInfo.summary_size = Buffer.byteLength(summaryResult.summary, 'utf8');
                    directoryInfo.tokens_used = summaryResult.tokensUsed;
                } else {
                    directoryInfo.summary_skipped = 'No content summaries available';
                }
            } catch (error) {
                directoryInfo.summary_error = error.message;
            }
        } else {
            directoryInfo.summary_skipped = needsSummary ?
                (directContents.length === 0 ? 'Empty directory' : 'Costs manager not available') :
                'Summary not requested';
        }

        return directoryInfo;
    }
}

export default IndexingUtils;
