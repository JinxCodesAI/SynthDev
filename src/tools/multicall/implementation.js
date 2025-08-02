import { BaseTool } from '../common/base-tool.js';
import { v4 as uuidv4 } from 'uuid';

class MulticallTool extends BaseTool {
    constructor() {
        super('multicall', 'Execute multiple tool calls in a single operation');

        // Define parameter validation
        this.requiredParams = ['tool_calls'];
        this.parameterTypes = {
            tool_calls: 'array',
        };
    }

    async implementation(params) {
        const { tool_calls, context } = params;

        try {
            // Validate tool_calls array structure
            const validationError = this._validateToolCalls(tool_calls);
            if (validationError) {
                return validationError;
            }

            // Check if we have access to toolManager through context
            if (!context?.toolManager) {
                return this.createErrorResponse('Multicall tool requires toolManager in context', {
                    missing_dependency: 'toolManager',
                });
            }

            // Generate unique IDs for each expanded tool call
            const expandedToolCalls = this._generateExpandedToolCalls(tool_calls);

            // Execute each tool call individually
            const results = [];
            const errors = [];

            for (const [index, expandedCall] of expandedToolCalls.entries()) {
                try {
                    this.logger.debug(
                        `Executing multicall tool ${index + 1}/${expandedToolCalls.length}: ${expandedCall.function.name}`
                    );

                    // Create console interface for individual tool execution
                    const consoleInterface = this._createConsoleInterface(
                        expandedCall.function.name
                    );

                    // Execute the individual tool call
                    const result = await context.toolManager.executeToolCall(
                        expandedCall,
                        consoleInterface,
                        null, // No snapshot manager for multicall
                        context
                    );

                    // Parse the result content
                    let parsedResult;
                    try {
                        parsedResult = JSON.parse(result.content);
                    } catch (parseError) {
                        parsedResult = {
                            success: false,
                            error: 'Failed to parse tool result',
                            raw_content: result.content,
                        };
                    }

                    results.push({
                        tool_name: expandedCall.function.name,
                        tool_call_id: expandedCall.id,
                        original_index: index,
                        success: parsedResult.success || false,
                        result: parsedResult,
                    });
                } catch (error) {
                    errors.push({
                        tool_name: expandedCall.function.name,
                        tool_call_id: expandedCall.id,
                        original_index: index,
                        error: error.message,
                        stack: error.stack,
                    });
                }
            }

            // Calculate overall success
            const totalCalls = expandedToolCalls.length;
            const successfulCalls = results.filter(r => r.success).length;
            const failedCalls = errors.length + results.filter(r => !r.success).length;

            // Create aggregated response
            return this.createSuccessResponse({
                multicall_summary: {
                    total_calls: totalCalls,
                    successful_calls: successfulCalls,
                    failed_calls: failedCalls,
                    success_rate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
                },
                results: results,
                errors: errors,
                expanded_tool_calls: expandedToolCalls.map(call => ({
                    id: call.id,
                    type: call.type,
                    function: {
                        name: call.function.name,
                        arguments: call.function.arguments,
                    },
                })),
            });
        } catch (error) {
            return this.createErrorResponse(`Multicall execution failed: ${error.message}`, {
                stack: error.stack,
            });
        }
    }

    /**
     * Validate the structure of tool_calls array
     * @param {Array} tool_calls - Array of tool call objects
     * @returns {Object|null} Error response if validation fails, null if valid
     */
    _validateToolCalls(tool_calls) {
        if (!Array.isArray(tool_calls)) {
            return this.createErrorResponse('tool_calls must be an array');
        }

        if (tool_calls.length === 0) {
            return this.createErrorResponse('tool_calls array cannot be empty');
        }

        for (const [index, toolCall] of tool_calls.entries()) {
            if (!toolCall || typeof toolCall !== 'object') {
                return this.createErrorResponse(`tool_calls[${index}] must be an object`, {
                    invalid_index: index,
                });
            }

            if (!toolCall.function_name || typeof toolCall.function_name !== 'string') {
                return this.createErrorResponse(
                    `tool_calls[${index}].function_name is required and must be a string`,
                    { invalid_index: index }
                );
            }

            if (!toolCall.arguments || typeof toolCall.arguments !== 'string') {
                return this.createErrorResponse(
                    `tool_calls[${index}].arguments is required and must be a JSON string`,
                    { invalid_index: index }
                );
            }

            // Validate that arguments is valid JSON
            try {
                JSON.parse(toolCall.arguments);
            } catch (parseError) {
                return this.createErrorResponse(
                    `tool_calls[${index}].arguments must be valid JSON: ${parseError.message}`,
                    { invalid_index: index, parse_error: parseError.message }
                );
            }
        }

        return null;
    }

    /**
     * Generate expanded tool calls with unique IDs
     * @param {Array} tool_calls - Original tool calls array
     * @returns {Array} Array of expanded tool call objects with OpenAI format
     */
    _generateExpandedToolCalls(tool_calls) {
        return tool_calls.map((toolCall, index) => ({
            id: this._generateToolCallId(),
            type: 'function',
            function: {
                name: toolCall.function_name,
                arguments: toolCall.arguments,
            },
            // Store original index for tracking
            _multicall_index: index,
        }));
    }

    /**
     * Generate a unique tool call ID in the format expected by OpenAI
     * @returns {string} Unique tool call ID
     */
    _generateToolCallId() {
        // Generate ID in the format: call_ + random string (similar to OpenAI's format)
        const randomSuffix = uuidv4().replace(/-/g, '').substring(0, 24);
        return `call_${randomSuffix}`;
    }

    /**
     * Create a minimal console interface for individual tool execution
     * @param {string} toolName - Name of the tool being executed
     * @returns {Object} Console interface object
     */
    _createConsoleInterface(toolName) {
        return {
            showToolExecution: (name, args, role) => {
                this.logger.debug(`[Multicall] Executing ${name} with args:`, args);
            },
            showToolResult: result => {
                this.logger.debug(`[Multicall] Tool ${toolName} result:`, result);
            },
            showToolCancelled: name => {
                this.logger.debug(`[Multicall] Tool ${name} cancelled`);
            },
            promptForConfirmation: async () => {
                // Auto-approve for multicall context
                // Individual tools within multicall should be auto-run
                return true;
            },
        };
    }
}

// Create and export the tool instance
const multicallTool = new MulticallTool();

export default async function multicall(params) {
    return await multicallTool.execute(params);
}
