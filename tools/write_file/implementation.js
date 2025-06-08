/**
 * Write File tool implementation
 * Safely writes content to files with comprehensive error handling and directory creation
 * Returns JSON output with operation status and metadata
 */

import { writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { FileBaseTool } from '../common/base-tool.js';

class WriteFileTool extends FileBaseTool {
    constructor() {
        super('write_file', 'Write content to a file in the file system using a relative path');

        // Define parameter validation
        this.requiredParams = ['file_path', 'content'];
        this.parameterTypes = {
            file_path: 'string',
            content: 'string',
            encoding: 'string',
            create_directories: 'boolean',
            overwrite: 'boolean',
        };
    }

    async implementation(params) {
        const {
            file_path,
            content,
            encoding = 'utf8',
            create_directories = true,
            overwrite = true,
        } = params;

        // Validate and resolve the file path
        const pathValidation = this.validateAndResolvePath(file_path);
        if (pathValidation.error) {
            return pathValidation.error;
        }

        const { resolvedPath } = pathValidation;
        const cwd = process.cwd();

        try {
            // Check if file already exists
            const fileExists = existsSync(resolvedPath);
            let wasOverwritten = false;

            if (fileExists && !overwrite) {
                return this.createErrorResponse('File already exists and overwrite is disabled', {
                    file_path,
                    overwrite_disabled: true,
                });
            }

            if (fileExists) {
                // Check if it's actually a file (not a directory)
                try {
                    const stats = statSync(resolvedPath);
                    if (!stats.isFile()) {
                        return this.createErrorResponse(
                            'Path exists but is not a file (may be a directory)',
                            { file_path, path_type: 'directory' }
                        );
                    }
                    wasOverwritten = true;
                } catch (statError) {
                    return this.handleFileSystemError(statError, file_path);
                }
            }

            // Create directories if needed
            const createdDirectories = [];
            if (create_directories) {
                const dirPath = dirname(resolvedPath);
                if (!existsSync(dirPath)) {
                    try {
                        // Get all directories that need to be created
                        const pathParts = join(dirPath)
                            .replace(cwd, '')
                            .split(/[/\\]/)
                            .filter(part => part);
                        let currentPath = cwd;

                        for (const part of pathParts) {
                            currentPath = join(currentPath, part);
                            if (!existsSync(currentPath)) {
                                mkdirSync(currentPath);
                                createdDirectories.push(
                                    currentPath.replace(`${cwd}/`, '').replace(`${cwd}\\`, '')
                                );
                            }
                        }
                    } catch (mkdirError) {
                        return this.createErrorResponse(
                            `Cannot create directories: ${mkdirError.message}`,
                            { file_path, error_code: mkdirError.code }
                        );
                    }
                }
            }

            // Write the file content
            try {
                writeFileSync(resolvedPath, content, encoding);
            } catch (writeError) {
                return this.handleFileSystemError(writeError, file_path);
            }

            // Get file statistics after writing
            let stats;
            try {
                stats = statSync(resolvedPath);
            } catch (_statsError) {
                // File was written but we can't get stats (shouldn't happen)
                return this.createSuccessResponse({
                    file_path,
                    size: Buffer.byteLength(content, encoding),
                    encoding,
                    created_directories: createdDirectories,
                    overwritten: wasOverwritten,
                    warning: 'File written but metadata unavailable',
                });
            }

            // Return successful result with file metadata
            return this.createSuccessResponse({
                file_path,
                size: stats.size,
                encoding,
                created_directories: createdDirectories,
                overwritten: wasOverwritten,
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
const writeFileTool = new WriteFileTool();

export default async function writeFile(params) {
    return await writeFileTool.execute(params);
}
