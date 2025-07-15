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
import { getToolConfigManager } from '../../../src/config/managers/toolConfigManager.js';

class EditFileTool extends FileBaseTool {
    constructor() {
        const toolConfig = getToolConfigManager();
        super('edit_file', toolConfig.getToolDescription('edit_file'));

        // Define parameter validation
        this.requiredParams = ['file_path', 'operation', 'boundary_start', 'boundary_end'];
        this.parameterTypes = {
            file_path: 'string',
            operation: 'string',
            boundary_start: 'string',
            boundary_end: 'string',
            new_content: 'string',
            encoding: 'string',
        };

        this.toolConfig = toolConfig;
    }

    async implementation(params) {
        const {
            file_path,
            operation,
            boundary_start,
            boundary_end,
            new_content = '',
            encoding = 'utf8',
        } = params;

        // Additional validation for operation
        if (!['replace', 'delete'].includes(operation)) {
            return this.createErrorResponse(this.toolConfig.getErrorMessage('invalid_operation'), {
                file_path,
                operation,
                valid_operations: ['replace', 'delete'],
            });
        }

        if (operation === 'replace' && typeof new_content !== 'string') {
            return this.createErrorResponse(
                this.toolConfig.getValidationMessage('required_parameter_missing', {
                    parameter: 'new_content',
                }),
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
                return this.createErrorResponse('File does not exist', {
                    file_path,
                    resolved_path: resolvedPath,
                });
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
                if (idx === -1) {
                    break;
                }
                startIndices.push(idx);
            }

            idx = -1;
            while (true) {
                idx = content.indexOf(boundary_end, idx + 1);
                if (idx === -1) {
                    break;
                }
                endIndices.push(idx);
            }

            // Collect all boundary validation errors before returning
            const boundaryErrors = [];

            // Check boundary_start
            if (startIndices.length === 0) {
                boundaryErrors.push({
                    boundary: 'boundary_start',
                    error: 'boundary_start string not found in file',
                    found_count: 0,
                });
            } else if (startIndices.length > 1) {
                boundaryErrors.push({
                    boundary: 'boundary_start',
                    error: `boundary_start string found ${startIndices.length} times, must be unique`,
                    found_count: startIndices.length,
                    indices: startIndices,
                });
            }

            // Check boundary_end
            if (endIndices.length === 0) {
                boundaryErrors.push({
                    boundary: 'boundary_end',
                    error: 'boundary_end string not found in file',
                    found_count: 0,
                });
            } else if (endIndices.length > 1) {
                boundaryErrors.push({
                    boundary: 'boundary_end',
                    error: `boundary_end string found ${endIndices.length} times, must be unique`,
                    found_count: endIndices.length,
                    indices: endIndices,
                });
            }

            // Try recovery procedure for replace operation if there are multiple matches
            let recoveredBoundaries = null;
            if (operation === 'replace' && boundaryErrors.length > 0) {
                const hasMultipleStarts = startIndices.length > 1;
                const hasMultipleEnds = endIndices.length > 1;

                if (hasMultipleStarts || hasMultipleEnds) {
                    recoveredBoundaries = this.attemptBoundaryRecovery(
                        content,
                        boundary_start,
                        boundary_end,
                        new_content,
                        startIndices,
                        endIndices
                    );

                    if (recoveredBoundaries.success) {
                        // Clear boundary errors if recovery was successful
                        boundaryErrors.length = 0;
                    }
                }
            }

            // If there are still boundary errors after recovery attempt, return enhanced error
            if (boundaryErrors.length > 0) {
                const errorMessages = boundaryErrors.map(err => err.error).join('; ');
                return this.createErrorResponse(errorMessages, {
                    file_path,
                    boundary_errors: boundaryErrors,
                    boundary_start,
                    boundary_end,
                    original_file_content: content,
                    recovery_attempted: operation === 'replace' && recoveredBoundaries !== null,
                    recovery_result: recoveredBoundaries,
                });
            }

            // Get the final boundary indices (either original or recovered)
            let startIdx, endIdx;
            if (recoveredBoundaries && recoveredBoundaries.success) {
                startIdx = recoveredBoundaries.startIdx;
                endIdx = recoveredBoundaries.endIdx;
            } else {
                startIdx = startIndices[0];
                endIdx = endIndices[0];
            }

            // Ensure boundary_start comes before boundary_end
            if (startIdx >= endIdx) {
                return this.createErrorResponse(
                    'boundary_start string must appear before boundary_end string in the file',
                    {
                        file_path,
                        start_index: startIdx,
                        end_index: endIdx,
                        original_file_content: content,
                        recovery_used: recoveredBoundaries && recoveredBoundaries.success,
                    }
                );
            }

            // Determine the actual boundary strings used (original or recovered)
            let actualBoundaryEnd = boundary_end;
            if (recoveredBoundaries && recoveredBoundaries.success) {
                actualBoundaryEnd = recoveredBoundaries.recoveredEnd;
            }

            let newContent;
            if (operation === 'replace') {
                // Replace everything from boundary_start to boundary_end (inclusive) with new_content
                newContent =
                    content.slice(0, startIdx) +
                    new_content +
                    content.slice(endIdx + actualBoundaryEnd.length);
            } else if (operation === 'delete') {
                // Delete everything from boundary_start to boundary_end (inclusive)
                newContent =
                    content.slice(0, startIdx) + content.slice(endIdx + actualBoundaryEnd.length);
            }

            // Write back to file
            try {
                writeFileSync(resolvedPath, newContent, encoding);
            } catch (writeError) {
                return this.handleFileSystemError(writeError, file_path);
            }

            // Get new file size
            const stats = statSync(resolvedPath);

            const successResponse = {
                file_path,
                size: stats.size,
                encoding,
                edited: true,
                operation,
                bytes_changed: content.length - newContent.length,
            };

            // Add recovery information if recovery was used
            if (recoveredBoundaries && recoveredBoundaries.success) {
                successResponse.boundary_recovery_used = true;
                successResponse.original_boundaries = {
                    start: boundary_start,
                    end: boundary_end,
                };
                successResponse.recovered_boundaries = {
                    start: recoveredBoundaries.recoveredStart,
                    end: recoveredBoundaries.recoveredEnd,
                };
            }

            return this.createSuccessResponse(successResponse);
        } catch (error) {
            return this.createErrorResponse(`Unexpected error: ${error.message}`, {
                file_path,
                stack: error.stack,
            });
        }
    }

    /**
     * Attempt to recover from boundary conflicts by extending boundaries with content from new_content
     * @param {string} content - Original file content
     * @param {string} boundary_start - Original start boundary
     * @param {string} boundary_end - Original end boundary
     * @param {string} new_content - New content to replace with
     * @param {number[]} startIndices - All found start boundary indices
     * @param {number[]} endIndices - All found end boundary indices
     * @returns {Object} Recovery result with success flag and recovered indices
     */
    attemptBoundaryRecovery(
        content,
        boundary_start,
        boundary_end,
        new_content,
        startIndices,
        endIndices
    ) {
        try {
            let recoveredStart = boundary_start;
            let recoveredEnd = boundary_end;
            let recoveredStartIndices = [...startIndices];
            let recoveredEndIndices = [...endIndices];

            // Try to make boundary_start unique by extending it with characters from new_content
            if (startIndices.length > 1 && new_content.includes(boundary_start)) {
                const startInNewContent = new_content.indexOf(boundary_start);
                if (startInNewContent !== -1) {
                    // Try extending the boundary by adding characters after it from new_content
                    for (let extendLength = 1; extendLength <= 50; extendLength++) {
                        const endPos = startInNewContent + boundary_start.length + extendLength;
                        if (endPos > new_content.length) {
                            break;
                        }

                        const extendedBoundary = new_content.substring(startInNewContent, endPos);
                        const extendedIndices = [];

                        let idx = -1;
                        while (true) {
                            idx = content.indexOf(extendedBoundary, idx + 1);
                            if (idx === -1) {
                                break;
                            }
                            extendedIndices.push(idx);
                        }

                        if (extendedIndices.length === 1) {
                            recoveredStart = extendedBoundary;
                            recoveredStartIndices = extendedIndices;
                            break;
                        }
                    }
                }
            }

            // Try to make boundary_end unique by extending it with characters from new_content
            if (endIndices.length > 1 && new_content.includes(boundary_end)) {
                const endInNewContent = new_content.lastIndexOf(boundary_end);
                if (endInNewContent !== -1) {
                    // Try extending the boundary by adding characters before it from new_content
                    for (let extendLength = 1; extendLength <= 50; extendLength++) {
                        const startPos = endInNewContent - extendLength;
                        if (startPos < 0) {
                            break;
                        }

                        const extendedBoundary = new_content.substring(
                            startPos,
                            endInNewContent + boundary_end.length
                        );
                        const extendedIndices = [];

                        let idx = -1;
                        while (true) {
                            idx = content.indexOf(extendedBoundary, idx + 1);
                            if (idx === -1) {
                                break;
                            }
                            extendedIndices.push(idx);
                        }

                        if (extendedIndices.length === 1) {
                            recoveredEnd = extendedBoundary;
                            recoveredEndIndices = extendedIndices;
                            break;
                        }
                    }
                }
            }

            // Check if recovery was successful
            const startRecovered = recoveredStartIndices.length === 1;
            const endRecovered = recoveredEndIndices.length === 1;

            if (startRecovered && endRecovered) {
                const startIdx = recoveredStartIndices[0];
                const endIdx = recoveredEndIndices[0];

                // Ensure start comes before end
                if (startIdx < endIdx) {
                    return {
                        success: true,
                        startIdx,
                        endIdx,
                        recoveredStart,
                        recoveredEnd,
                        originalStart: boundary_start,
                        originalEnd: boundary_end,
                    };
                }
            }

            return {
                success: false,
                startRecovered,
                endRecovered,
                recoveredStart,
                recoveredEnd,
                recoveredStartIndices,
                recoveredEndIndices,
                reason:
                    !startRecovered && !endRecovered
                        ? 'Both boundaries could not be made unique'
                        : !startRecovered
                          ? 'Start boundary could not be made unique'
                          : !endRecovered
                            ? 'End boundary could not be made unique'
                            : 'Start boundary appears after end boundary',
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                reason: 'Recovery procedure failed with error',
            };
        }
    }
}

// Create and export the tool instance
const editFileTool = new EditFileTool();

export default async function editFile(params) {
    return await editFileTool.execute(params);
}
