/**
 * Base Tool Class
 * Provides standardized structure and common functionality for all tool implementations
 */

import { join, resolve, relative } from 'path';
import costsManager from '../../core/managers/costsManager.js';
import { getToolConfigManager } from '../../../src/config/managers/toolConfigManager.js';
import { getLogger } from '../../core/managers/logger.js';

export class BaseTool {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.timestamp = new Date().toISOString();
        this.costsManager = costsManager;
        this.logger = getLogger();
    }

    /**
     * Create a standardized success response
     * @param {Object} data - Success data to include in response
     * @returns {Object} Standardized success response
     */
    createSuccessResponse(data = {}) {
        return {
            success: true,
            timestamp: new Date().toISOString(),
            tool_name: this.name,
            ...data,
        };
    }

    /**
     * Create a standardized error response
     * @param {string} message - Error message
     * @param {Object} metadata - Additional error metadata
     * @returns {Object} Standardized error response
     */
    createErrorResponse(message, metadata = {}) {
        return {
            success: false,
            timestamp: new Date().toISOString(),
            tool_name: this.name,
            error: message,
            ...metadata,
        };
    }

    /**
     * Validate required parameters
     * @param {Object} params - Parameters to validate
     * @param {string[]} requiredFields - Array of required field names
     * @returns {Object|null} Error response if validation fails, null if valid
     */
    validateRequiredParams(params, requiredFields) {
        const toolConfig = getToolConfigManager();
        for (const field of requiredFields) {
            if (params[field] === undefined || params[field] === null) {
                return this.createErrorResponse(
                    toolConfig.getValidationMessage('required_parameter_missing', {
                        parameter: field,
                    }),
                    { missing_parameter: field }
                );
            }
        }
        return null;
    }

    /**
     * Validate parameter types
     * @param {Object} params - Parameters to validate
     * @param {Object} typeMap - Map of parameter names to expected types
     * @returns {Object|null} Error response if validation fails, null if valid
     */
    validateParameterTypes(params, typeMap) {
        for (const [param, expectedType] of Object.entries(typeMap)) {
            if (params[param] !== undefined) {
                let isValid = false;

                if (expectedType === 'array') {
                    isValid = Array.isArray(params[param]);
                } else {
                    isValid = typeof params[param] === expectedType;
                }

                if (!isValid) {
                    const actualType = Array.isArray(params[param])
                        ? 'array'
                        : typeof params[param];
                    const toolConfig = getToolConfigManager();
                    return this.createErrorResponse(
                        toolConfig.getValidationMessage('invalid_parameter_type', {
                            parameter: param,
                            expected: expectedType,
                            actual: actualType,
                        }),
                        {
                            invalid_parameter: param,
                            expected_type: expectedType,
                            actual_type: actualType,
                        }
                    );
                }
            }
        }
        return null;
    }

    /**
     * Validate and resolve file path with security checks
     * @param {string} filePath - File path to validate
     * @param {string} cwd - Current working directory
     * @returns {Object} Object with resolved path or error
     */
    validateAndResolvePath(filePath, cwd = process.cwd()) {
        if (!filePath || typeof filePath !== 'string') {
            return {
                error: this.createErrorResponse(
                    'file_path parameter is required and must be a string'
                ),
            };
        }

        try {
            const targetPath = join(cwd, filePath);
            const resolvedPath = resolve(targetPath);

            // Security check: ensure the resolved path is within the current working directory
            const relativePath = relative(cwd, resolvedPath);
            if (relativePath.startsWith('..') || resolve(relativePath) !== resolvedPath) {
                return {
                    error: this.createErrorResponse(
                        'Access denied: file path must be within the current working directory',
                        { file_path: filePath }
                    ),
                };
            }

            return {
                targetPath,
                resolvedPath,
                relativePath,
            };
        } catch (error) {
            return {
                error: this.createErrorResponse(`Path resolution error: ${error.message}`, {
                    file_path: filePath,
                }),
            };
        }
    }

    /**
     * Execute the tool with standardized error handling
     * @param {Object} params - Tool parameters
     * @returns {Object} Tool execution result
     */
    async execute(params) {
        try {
            // Validate basic parameters if defined
            if (this.requiredParams) {
                const validationError = this.validateRequiredParams(params, this.requiredParams);
                if (validationError) {
                    return validationError;
                }
            }

            if (this.parameterTypes) {
                const typeError = this.validateParameterTypes(params, this.parameterTypes);
                if (typeError) {
                    return typeError;
                }
            }

            // Call the implementation method
            return await this.implementation(params);
        } catch (error) {
            return this.createErrorResponse(`Unexpected error: ${error.message}`, {
                stack: error.stack,
            });
        }
    }

    /**
     * Implementation method to be overridden by concrete tool classes
     * @param {Object} params - Tool parameters
     * @returns {Object} Tool execution result
     */
    async implementation(_params) {
        throw new Error('implementation method must be overridden by concrete tool classes');
    }
}

/**
 * Abstract File Tool Class
 * Base class for tools that work with files
 */
export class FileBaseTool extends BaseTool {
    constructor(name, description) {
        super(name, description);
    }

    /**
     * Check file size limits
     * @param {number} size - File size in bytes
     * @param {number} maxSize - Maximum allowed size (default 10MB)
     * @returns {Object|null} Error response if file too large, null if acceptable
     */
    validateFileSize(size, maxSize = 10 * 1024 * 1024) {
        if (size > maxSize) {
            return this.createErrorResponse(
                `File too large: ${size} bytes (max ${maxSize} bytes)`,
                { file_size: size, max_size: maxSize }
            );
        }
        return null;
    }

    /**
     * Handle common file access errors
     * @param {Error} error - File system error
     * @param {string} filePath - File path that caused the error
     * @returns {Object} Standardized error response
     */
    handleFileSystemError(error, filePath) {
        switch (error.code) {
            case 'ENOENT':
                return this.createErrorResponse(`File not found: ${filePath}`, {
                    file_path: filePath,
                    error_code: 'ENOENT',
                });
            case 'EACCES':
                return this.createErrorResponse(`Permission denied: cannot access ${filePath}`, {
                    file_path: filePath,
                    error_code: 'EACCES',
                });
            case 'EISDIR':
                return this.createErrorResponse(`Path is a directory, not a file: ${filePath}`, {
                    file_path: filePath,
                    error_code: 'EISDIR',
                });
            case 'ENOSPC':
                return this.createErrorResponse('Disk full: not enough space', {
                    file_path: filePath,
                    error_code: 'ENOSPC',
                });
            default:
                return this.createErrorResponse(`File system error: ${error.message}`, {
                    file_path: filePath,
                    error_code: error.code,
                });
        }
    }
}

/**
 * Abstract Command Tool Class
 * Base class for tools that execute system commands
 */
export class CommandBaseTool extends BaseTool {
    constructor(name, description) {
        super(name, description);
    }

    /**
     * Validate command input
     * @param {string} command - Command to validate
     * @returns {Object|null} Error response if invalid, null if valid
     */
    validateCommand(command) {
        if (!command || typeof command !== 'string') {
            return this.createErrorResponse('Command is required and must be a string', {
                provided_command: command,
            });
        }

        if (command.trim().length === 0) {
            return this.createErrorResponse('Command cannot be empty or whitespace only', {
                provided_command: command,
            });
        }

        return null;
    }

    /**
     * Create standardized command execution response
     * @param {boolean} success - Whether command succeeded
     * @param {string} stdout - Standard output
     * @param {string} stderr - Standard error
     * @param {string} error - Error message if any
     * @returns {Object} Standardized command response
     */
    createCommandResponse(success, stdout = '', stderr = '', error = null) {
        const response = this.createSuccessResponse({
            stdout: stdout,
            stderr: stderr,
        });

        if (!success) {
            response.success = false;
            response.error = error || 'Command execution failed';
            this.logger.debug(
                `Command failed: ${response.error}, stdout: ${stdout}, stderr: ${stderr}`
            );
        }

        return response;
    }
}
