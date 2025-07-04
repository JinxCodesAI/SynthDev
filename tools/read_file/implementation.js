/**
 * Read File tool implementation
 * Safely reads file contents from relative paths with comprehensive error handling
 * Returns JSON output with file content and metadata
 */

import { readFileSync, statSync } from 'fs';
import { FileBaseTool } from '../common/base-tool.js';
import { getToolConfigManager } from '../../src/config/managers/toolConfigManager.js';

class ReadFileTool extends FileBaseTool {
    constructor() {
        const toolConfig = getToolConfigManager();
        super('read_file', toolConfig.getToolDescription('read_file'));

        // Define parameter validation
        this.requiredParams = ['file_path'];
        this.parameterTypes = {
            file_path: 'string',
            encoding: 'string',
            start_line: 'number',
            end_line: 'number',
        };

        this.toolConfig = toolConfig;
    }

    async implementation(params) {
        const { file_path, encoding = 'utf8', start_line, end_line } = params;

        // Validate and resolve the file path
        const pathValidation = this.validateAndResolvePath(file_path);
        if (pathValidation.error) {
            return pathValidation.error;
        }

        const { resolvedPath } = pathValidation;

        try {
            // Get file statistics first to check if file exists and get metadata
            let stats;
            try {
                stats = statSync(resolvedPath);
            } catch (statError) {
                return this.handleFileSystemError(statError, file_path);
            }

            if (start_line || end_line) {
                if (typeof start_line !== 'number' || start_line < 1) {
                    return this.createErrorResponse('start_line must be a positive integer', {
                        file_path,
                        start_line,
                    });
                }
                if (typeof end_line !== 'number' || end_line < start_line) {
                    return this.createErrorResponse(
                        'end_line must be a positive integer greater than or equal to start_line',
                        { file_path, end_line, start_line }
                    );
                }
            }

            // Check if it's a file (not a directory)
            if (!stats.isFile()) {
                return this.createErrorResponse(`Path is not a file: ${file_path}`, {
                    file_path,
                    path_type: 'directory',
                });
            }

            // Check file size (prevent reading extremely large files)
            const sizeValidation = this.validateFileSize(stats.size);
            if (sizeValidation) {
                return sizeValidation;
            }

            // Read the entire file content
            let content;
            try {
                content = readFileSync(resolvedPath, encoding);
            } catch (readError) {
                return this.handleFileSystemError(readError, file_path);
            }

            // If start_line or end_line specified, extract the lines
            if (typeof start_line === 'number' || typeof end_line === 'number') {
                // Normalize start_line to at least 1
                const start = typeof start_line === 'number' && start_line > 0 ? start_line : 1;
                // Normalize end_line to at most total number of lines
                const lines = content.split(/\r?\n/);
                if (end_line > lines.length) {
                    return this.createErrorResponse('end_line is beyond the end of the file', {
                        file_path,
                        end_line,
                        total_lines: lines.length,
                    });
                }
                const end =
                    typeof end_line === 'number' && end_line >= start && end_line <= lines.length
                        ? end_line
                        : lines.length;

                // Extract the specified line range (1-based inclusive)
                const selectedLines = lines.slice(start - 1, end);
                content = selectedLines.join('\n');
            }

            // Return successful result with file content and metadata
            return this.createSuccessResponse({
                file_path,
                content,
                size: Buffer.byteLength(content, encoding),
                encoding,
                modified: stats.mtime.toISOString(),
            });
        } catch (error) {
            return this.createErrorResponse(`Unexpected error: ${error.message}`, {
                file_path,
                stack: error.stack,
            });
        }
    }
}

// Create and export the tool instance
const readFileTool = new ReadFileTool();

export default async function readFile(params) {
    return await readFileTool.execute(params);
}
