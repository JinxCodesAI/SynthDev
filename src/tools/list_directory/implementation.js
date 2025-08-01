/**
 * List Directory tool implementation
 * Lists directory contents with detailed information about files and subdirectories
 */

import { statSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative, extname, resolve } from 'path';
import { scanDirectory } from '../common/fs_utils.js';
import { FileBaseTool } from '../common/base-tool.js';
import { getToolConfigManager } from '../../../src/config/managers/toolConfigManager.js';
import { getInternalDataManager } from '../../core/managers/InternalDataManager.js';

class ListDirectoryTool extends FileBaseTool {
    constructor() {
        const toolConfig = getToolConfigManager();
        super('list_directory', toolConfig.getToolDescription('list_directory'));

        // Define parameter validation
        this.requiredParams = ['directory_path'];
        this.parameterTypes = {
            directory_path: 'string',
            recursive: 'boolean',
            include_hidden: 'boolean',
            max_depth: 'number',
            exclusion_list: 'array',
            include_summaries: 'boolean',
        };

        this.toolConfig = toolConfig;
    }

    /**
     * Load and parse the .synthdev/index/codebase-index.json file
     * @returns {Object|null} Parsed index data or null if not available
     */
    _loadIndexData() {
        try {
            const internalDataManager = getInternalDataManager();
            const result = internalDataManager.readInternalFile('index', 'codebase-index.json', {
                parseJson: true,
            });

            if (result.success) {
                return result.data;
            }

            // Silently handle errors - index file may not exist or be corrupted
            return null;
        } catch (error) {
            // Silently handle parsing errors - index file may be corrupted or incomplete
            return null;
        }
    }

    /**
     * Get AI summary for a file from the index data
     * @param {Object} indexData - Parsed index data
     * @param {string} filePath - File path to look up
     * @returns {string|undefined} AI summary if available
     */
    _getAISummary(indexData, filePath) {
        if (!indexData || !indexData.files) {
            return undefined;
        }

        // Normalize path for lookup - handle both Windows and Unix paths
        const normalizedPath = filePath.replace(/\\/g, '/');
        const windowsPath = filePath.replace(/\//g, '\\');

        // Try both normalized and original paths
        const fileEntry =
            indexData.files[filePath] ||
            indexData.files[normalizedPath] ||
            indexData.files[windowsPath];

        return fileEntry?.ai_summary;
    }

    async implementation(params) {
        let { directory_path = '.' } = params;

        const {
            recursive = false,
            include_hidden = false,
            max_depth = 5,
            include_summaries = false,
            exclusion_list = [
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
            ],
        } = params;

        if (!directory_path || directory_path.trim() === '') {
            directory_path = '.';
        }

        // Additional validation for max_depth
        if (typeof max_depth !== 'number' || max_depth < 1 || max_depth > 10) {
            return this.createErrorResponse(
                'max_depth parameter must be a number between 1 and 10',
                { directory_path, max_depth, valid_range: '1-10' }
            );
        }

        // Validate and resolve the directory path
        const pathValidation = this.validateAndResolvePath(directory_path);
        if (pathValidation.error) {
            return pathValidation.error;
        }

        const { resolvedPath } = pathValidation;

        try {
            // Check if path exists and is a directory
            let stats;
            try {
                stats = statSync(resolvedPath);
            } catch (statError) {
                return this.handleFileSystemError(statError, directory_path);
            }

            if (!stats.isDirectory()) {
                return this.createErrorResponse('Path is not a directory', {
                    directory_path,
                    path_type: 'file',
                });
            }

            // Load index data if summaries are requested
            let indexData = null;
            if (include_summaries) {
                indexData = this._loadIndexData();
            }

            // Use scanDirectory for recursive scanning
            if (recursive) {
                try {
                    const scanResults = scanDirectory(resolvedPath, {
                        depth: max_depth,
                        includeHidden: include_hidden,
                        exclusionList: exclusion_list,
                    });

                    const directories = scanResults.filter(entry => entry.type === 'directory');
                    const files = scanResults.filter(entry => entry.type === 'file');

                    return this.createSuccessResponse({
                        directory_path,
                        total_items: scanResults.length,
                        directories: directories.map(dir => ({
                            name: dir.name,
                            path: dir.path.replace(/\\/g, '/'),
                            type: 'directory',
                            depth: dir.lvl,
                        })),
                        files: files.map(file => {
                            const fileObj = {
                                name: file.name,
                                path: file.path.replace(/\\/g, '/'),
                                type: 'file',
                                size: file.size,
                                extension: extname(file.name),
                                depth: file.lvl,
                            };

                            // Add AI summary if requested and available
                            if (include_summaries && indexData) {
                                const aiSummary = this._getAISummary(indexData, file.path);
                                if (aiSummary) {
                                    fileObj.ai_summary = aiSummary;
                                }
                            }

                            return fileObj;
                        }),
                    });
                } catch (scanError) {
                    return this.createErrorResponse(
                        `Failed to scan directory recursively: ${scanError.message}`,
                        { directory_path, error_code: scanError.code }
                    );
                }
            } else {
                // Non-recursive listing
                let items;
                try {
                    items = readdirSync(resolvedPath);
                } catch (readError) {
                    return this.handleFileSystemError(readError, directory_path);
                }

                const directories = [];
                const files = [];
                let excludedItems = 0;
                const cwd = process.cwd();

                for (const item of items) {
                    if (!include_hidden && item.startsWith('.')) {
                        excludedItems++;
                        continue;
                    }

                    if (exclusion_list.includes(item)) {
                        excludedItems++;
                        continue;
                    }

                    const itemPath = join(resolvedPath, item);
                    let itemStats;
                    try {
                        itemStats = statSync(itemPath);
                    } catch {
                        excludedItems++;
                        continue;
                    }

                    const relativeName = relative(cwd, itemPath).replace(/\\/g, '/');

                    if (itemStats.isDirectory()) {
                        directories.push({
                            name: item,
                            path: relativeName,
                            type: 'directory',
                            depth: 0,
                        });
                    } else if (itemStats.isFile()) {
                        const fileObj = {
                            name: item,
                            path: relativeName,
                            type: 'file',
                            size: itemStats.size,
                            extension: extname(item),
                            depth: 0,
                        };

                        // Add AI summary if requested and available
                        if (include_summaries && indexData) {
                            const aiSummary = this._getAISummary(indexData, relativeName);
                            if (aiSummary) {
                                fileObj.ai_summary = aiSummary;
                            }
                        }

                        files.push(fileObj);
                    }
                }

                return this.createSuccessResponse({
                    directory_path,
                    total_items: directories.length + files.length,
                    directories,
                    files,
                    excluded_items: excludedItems,
                });
            }
        } catch (error) {
            return this.createErrorResponse(`Unexpected error: ${error.message}`, {
                directory_path,
                stack: error.stack,
            });
        }
    }
}

// Create and export the tool instance
const listDirectoryTool = new ListDirectoryTool();

export default async function listDirectory(params) {
    return await listDirectoryTool.execute(params);
}
