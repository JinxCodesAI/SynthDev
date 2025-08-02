/**
 * Read Files tool implementation
 * Safely reads file contents from one or more relative paths with comprehensive error handling
 * Returns JSON output with file content and metadata
 */

import { readFileSync, statSync } from 'fs';
import { FileBaseTool } from '../common/base-tool.js';
import { getToolConfigManager } from '../../../src/config/managers/toolConfigManager.js';

class ReadFilesTool extends FileBaseTool {
    constructor() {
        const toolConfig = getToolConfigManager();
        super(
            'read_files',
            toolConfig.getToolDescription('read_files') ||
                'Read the contents of one or more files from the file system using relative paths'
        );

        // Define parameter validation
        this.requiredParams = ['file_paths'];
        this.parameterTypes = {
            file_paths: 'array',
            encoding: 'string',
            start_line: 'number',
            end_line: 'number',
        };

        this.toolConfig = toolConfig;
    }

    async implementation(params) {
        const { file_paths, encoding = 'utf8', start_line, end_line } = params;

        // file_paths should always be an array now
        const filePathsArray = file_paths;
        const isSingleRequest = file_paths.length === 1;

        // Validate file_paths
        if (!file_paths || file_paths.length === 0) {
            return this.createErrorResponse('At least one file path must be provided', {
                provided_file_paths: file_paths,
            });
        }

        // Validate individual file paths but don't fail the entire request
        const validFilePaths = [];
        const invalidFilePaths = [];

        for (const filePath of filePathsArray) {
            if (!filePath || (typeof filePath === 'string' && filePath.trim() === '')) {
                invalidFilePaths.push({
                    file_path: filePath,
                    error: 'File path cannot be empty',
                });
            } else {
                validFilePaths.push(filePath);
            }
        }

        // If all file paths are invalid, return error
        if (validFilePaths.length === 0) {
            return this.createErrorResponse('All provided file paths are invalid', {
                provided_file_paths: file_paths,
                invalid_file_paths: invalidFilePaths,
            });
        }

        try {
            const results = [];
            const failed = [...invalidFilePaths]; // Start with invalid file paths

            // Process each valid file path
            for (const filePath of validFilePaths) {
                try {
                    const fileResult = await this.readSingleFile(
                        filePath,
                        encoding,
                        start_line,
                        end_line
                    );
                    if (fileResult.success) {
                        results.push(fileResult.data);
                    } else {
                        failed.push({
                            file_path: filePath,
                            error: fileResult.error,
                        });
                    }
                } catch (fileError) {
                    failed.push({
                        file_path: filePath,
                        error: `Failed to process file: ${fileError.message}`,
                    });
                }
            }

            // For single requests, return the file directly if found, or error if not found
            if (isSingleRequest) {
                if (results.length === 1 && failed.length === 0) {
                    return this.createSuccessResponse(results[0]);
                } else if (results.length === 0 && failed.length === 1) {
                    return this.createErrorResponse(failed[0].error, {
                        file_path: filePathsArray[0],
                    });
                }
                // If we have mixed results for a single request, something went wrong
                // This shouldn't happen since we only have one file path, but handle it gracefully
                if (results.length === 0) {
                    return this.createErrorResponse(failed[0].error, {
                        file_path: filePathsArray[0],
                    });
                } else {
                    return this.createSuccessResponse(results[0]);
                }
            }

            // For batch requests, return array with metadata
            const responseData = {
                files: results,
                total_requested: filePathsArray.length,
                total_read: results.length,
            };

            if (failed.length > 0) {
                responseData.failed = failed;
            }

            return this.createSuccessResponse(responseData);
        } catch (error) {
            return this.createErrorResponse(`Failed to read files: ${error.message}`, {
                file_paths: file_paths,
                stack: error.stack,
            });
        }
    }

    /**
     * Read a single file with all validation and processing
     * @param {string} filePath - File path to read
     * @param {string} encoding - File encoding
     * @param {number} startLine - Optional start line
     * @param {number} endLine - Optional end line
     * @returns {Object} Result object with success flag and data/error
     */
    async readSingleFile(filePath, encoding, startLine, endLine) {
        // Validate and resolve the file path
        const pathValidation = this.validateAndResolvePath(filePath);
        if (pathValidation.error) {
            return {
                success: false,
                error: pathValidation.error.error,
            };
        }

        const { resolvedPath } = pathValidation;

        try {
            // Get file statistics first to check if file exists and get metadata
            let stats;
            try {
                stats = statSync(resolvedPath);
            } catch (statError) {
                const errorResponse = this.handleFileSystemError(statError, filePath);
                return {
                    success: false,
                    error: errorResponse.error,
                };
            }

            if (startLine || endLine) {
                if (typeof startLine !== 'number' || startLine < 1) {
                    return {
                        success: false,
                        error: 'start_line must be a positive integer',
                    };
                }
                if (typeof endLine !== 'number' || endLine < startLine) {
                    return {
                        success: false,
                        error: 'end_line must be a positive integer greater than or equal to start_line',
                    };
                }
            }

            // Check if it's a file (not a directory)
            if (!stats.isFile()) {
                return {
                    success: false,
                    error: `Path is not a file: ${filePath}`,
                };
            }

            // Check file size (prevent reading extremely large files)
            const sizeValidation = this.validateFileSize(stats.size);
            if (sizeValidation) {
                return {
                    success: false,
                    error: sizeValidation.error,
                };
            }

            // Read the entire file content
            let content;
            try {
                content = readFileSync(resolvedPath, encoding);
            } catch (readError) {
                const errorResponse = this.handleFileSystemError(readError, filePath);
                return {
                    success: false,
                    error: errorResponse.error,
                };
            }

            // If start_line or end_line specified, extract the lines
            if (typeof startLine === 'number' || typeof endLine === 'number') {
                // Normalize start_line to at least 1
                const start = typeof startLine === 'number' && startLine > 0 ? startLine : 1;
                // Normalize end_line to at most total number of lines
                const lines = content.split(/\r?\n/);
                if (endLine > lines.length) {
                    return {
                        success: false,
                        error: 'end_line is beyond the end of the file',
                    };
                }
                const end =
                    typeof endLine === 'number' && endLine >= start && endLine <= lines.length
                        ? endLine
                        : lines.length;

                // Extract the specified line range (1-based inclusive)
                const selectedLines = lines.slice(start - 1, end);
                content = selectedLines.join('\n');
            }

            // Return successful result with file content and metadata
            return {
                success: true,
                data: {
                    file_path: filePath,
                    content,
                    size: Buffer.byteLength(content, encoding),
                    encoding,
                    modified: stats.mtime.toISOString(),
                },
            };
        } catch (error) {
            return {
                success: false,
                error: `Unexpected error: ${error.message}`,
            };
        }
    }
}

// Create and export the tool instance
const readFilesTool = new ReadFilesTool();

export default async function readFiles(params) {
    return await readFilesTool.execute(params);
}
