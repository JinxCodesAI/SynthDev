/**
 * Exact Search tool implementation
 * Searches for exact occurrences of a given string in all files
 */

import { join } from 'path';
import { scanDirectory, safeReadFile } from '../common/fs_utils.js';
import { BaseTool } from '../common/base-tool.js';

class ExactSearchTool extends BaseTool {
    constructor() {
        super(
            'exact_search',
            'Searches for exact occurrences of a given string in all files listed by list_directory tool, returning matching fragments with context lines'
        );

        // Define parameter validation
        this.requiredParams = ['search_string'];
        this.parameterTypes = {
            search_string: 'string',
        };
    }

    async implementation(params) {
        const { search_string } = params;

        // Additional validation for search string
        if (search_string.length === 0) {
            return this.createErrorResponse('search_string cannot be empty', {
                search_string,
                length: search_string.length,
            });
        }

        try {
            const rootPath = process.cwd();

            // Get all files in the directory
            let filesAndDirs;
            try {
                filesAndDirs = scanDirectory(rootPath, { depth: -1, includeHidden: false });
            } catch (scanError) {
                return this.createErrorResponse(`Failed to scan directory: ${scanError.message}`, {
                    root_path: rootPath,
                    error_code: scanError.code,
                });
            }

            const files = filesAndDirs.filter(entry => entry.type === 'file');
            const results = [];
            let totalFilesScanned = 0;
            let filesWithMatches = 0;
            let totalMatches = 0;

            for (const fileEntry of files) {
                const fullFilePath = join(rootPath, fileEntry.path);
                const content = safeReadFile(fullFilePath);

                if (content === null) {
                    continue; // Skip files that can't be read
                }

                totalFilesScanned++;
                const lines = content.split(/\r?\n/);
                let fileHasMatches = false;

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(search_string)) {
                        if (!fileHasMatches) {
                            filesWithMatches++;
                            fileHasMatches = true;
                        }

                        totalMatches++;
                        const startLine = Math.max(0, i - 4);
                        const endLine = Math.min(lines.length - 1, i + 4);
                        const fragmentLines = lines.slice(startLine, endLine + 1);
                        const fragment = fragmentLines.join('\n');

                        results.push({
                            filename: fileEntry.path.replace(/\\/g, '/'),
                            fragment,
                            line_number: i + 1,
                        });
                    }
                }
            }

            return this.createSuccessResponse({
                search_string,
                results,
                statistics: {
                    total_files_scanned: totalFilesScanned,
                    files_with_matches: filesWithMatches,
                    total_matches: totalMatches,
                },
            });
        } catch (error) {
            return this.createErrorResponse(`Unexpected error during search: ${error.message}`, {
                search_string,
                stack: error.stack,
            });
        }
    }
}

// Create and export the tool instance
const exactSearchTool = new ExactSearchTool();

export default async function exactSearch(params) {
    return await exactSearchTool.execute(params);
}
