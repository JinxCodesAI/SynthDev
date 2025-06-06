/**
 * Edit File tool implementation
 * Edits a file content by replacing text between two unique boundary strings.
 * Both boundary strings are included in the replacement.
 *
 * Parameters:
 * - file_path: relative path to the file
 * - operation: 'replace' or 'delete'
 * - boundary_start: unique string marking the beginning of the section (included in replacement)
 * - boundary_end: unique string marking the end of the section (included in replacement)
 * - new_content: new content to replace with (only for replace operation)
 * - encoding: file encoding (default 'utf8')
 *
 * Returns JSON with success status, file size, encoding, and error messages if applicable.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { FileBaseTool } from '../common/base-tool.js';

class EditFileTool extends FileBaseTool {
    constructor() {
        super('edit_file', 'Edit content of a file by replacing text between two unique boundary strings');
        
        // Define parameter validation
        this.requiredParams = ['file_path', 'operation', 'boundary_start', 'boundary_end'];
        this.parameterTypes = {
            file_path: 'string',
            operation: 'string',
            boundary_start: 'string',
            boundary_end: 'string',
            new_content: 'string',
            encoding: 'string'
        };
    }

    async implementation(params) {
        const { file_path, operation, boundary_start, boundary_end, new_content = '', encoding = 'utf8' } = params;

        // Additional validation for operation
        if (!['replace', 'delete'].includes(operation)) {
            return this.createErrorResponse(
                "operation must be 'replace' or 'delete'",
                { file_path, operation, valid_operations: ['replace', 'delete'] }
            );
        }

        if (operation === 'replace' && typeof new_content !== 'string') {
            return this.createErrorResponse(
                'new_content parameter is required for replace operation and must be a string',
                { file_path, operation }
            );
        }

        // Validate and resolve the file path
        const pathValidation = this.validateAndResolvePath(file_path);
        if (pathValidation.error) {
            return pathValidation.error;
        }

        const { resolvedPath } = pathValidation;

        try {
            // Check file existence
            if (!existsSync(resolvedPath)) {
                return this.createErrorResponse(
                    'File does not exist',
                    { file_path, resolved_path: resolvedPath }
                );
            }

            // Read file content
            let content;
            try {
                content = readFileSync(resolvedPath, encoding);
            } catch (readError) {
                return this.handleFileSystemError(readError, file_path);
            }

            // Find all indices of boundary_start and boundary_end
            const startIndices = [];
            const endIndices = [];

            let idx = -1;
            while (true) {
                idx = content.indexOf(boundary_start, idx + 1);
                if (idx === -1) break;
                startIndices.push(idx);
            }

            idx = -1;
            while (true) {
                idx = content.indexOf(boundary_end, idx + 1);
                if (idx === -1) break;
                endIndices.push(idx);
            }

            // Check that there's exactly one match for both boundaries
            if (startIndices.length === 0) {
                return this.createErrorResponse(
                    'boundary_start string not found in file',
                    { file_path, boundary_start, found_count: 0 }
                );
            }
            if (startIndices.length > 1) {
                return this.createErrorResponse(
                    `boundary_start string found ${startIndices.length} times, must be unique`,
                    { file_path, boundary_start, found_count: startIndices.length, indices: startIndices }
                );
            }
            if (endIndices.length === 0) {
                return this.createErrorResponse(
                    'boundary_end string not found in file',
                    { file_path, boundary_end, found_count: 0 }
                );
            }
            if (endIndices.length > 1) {
                return this.createErrorResponse(
                    `boundary_end string found ${endIndices.length} times, must be unique`,
                    { file_path, boundary_end, found_count: endIndices.length, indices: endIndices }
                );
            }

            const startIdx = startIndices[0];
            const endIdx = endIndices[0];

            // Ensure boundary_start comes before boundary_end
            if (startIdx >= endIdx) {
                return this.createErrorResponse(
                    'boundary_start string must appear before boundary_end string in the file',
                    { file_path, start_index: startIdx, end_index: endIdx }
                );
            }

            let newContent;
            if (operation === 'replace') {
                // Replace everything from boundary_start to boundary_end (inclusive) with new_content
                newContent = content.slice(0, startIdx) + new_content + content.slice(endIdx + boundary_end.length);
            } else if (operation === 'delete') {
                // Delete everything from boundary_start to boundary_end (inclusive)
                newContent = content.slice(0, startIdx) + content.slice(endIdx + boundary_end.length);
            }

            // Write back to file
            try {
                writeFileSync(resolvedPath, newContent, encoding);
            } catch (writeError) {
                return this.handleFileSystemError(writeError, file_path);
            }

            // Get new file size
            const stats = statSync(resolvedPath);

            return this.createSuccessResponse({
                file_path,
                size: stats.size,
                encoding,
                edited: true,
                operation,
                bytes_changed: content.length - newContent.length
            });

        } catch (error) {
            return this.createErrorResponse(
                `Unexpected error: ${error.message}`,
                { file_path, stack: error.stack }
            );
        }
    }
}

// Create and export the tool instance
const editFileTool = new EditFileTool();

export default async function editFile(params) {
    return await editFileTool.execute(params);
}
