/**
 * Update Knowledgebase tool implementation
 * Update the shared knowledgebase with new information
 */

import { BaseTool } from '../common/base-tool.js';
import knowledgebaseManager from '../common/knowledgebase-manager.js';

class UpdateKnowledgebaseTool extends BaseTool {
    constructor() {
        super('update_knowledgebase', 'Update the shared knowledgebase with new information');

        // Define parameter validation
        this.requiredParams = ['type', 'content'];
        this.parameterTypes = {
            type: 'string',
            content: 'string',
        };
    }

    async implementation(params) {
        const { type, content } = params;

        try {
            // Validate operation type
            const validTypes = ['override', 'append', 'remove'];
            if (!validTypes.includes(type)) {
                return this.createErrorResponse(
                    `Invalid operation type: ${type}. Valid types: ${validTypes.join(', ')}`,
                    {
                        type,
                        valid_types: validTypes,
                    }
                );
            }

            // Update the knowledgebase using the manager
            const result = knowledgebaseManager.update(type, content);

            if (!result.success) {
                return this.createErrorResponse(result.error, {
                    operation: type,
                    content_length: content.length,
                });
            }

            return this.createSuccessResponse({
                operation: result.operation,
                content_provided: result.content_provided,
                previous_length: result.previous_length,
                new_length: result.new_length,
                new_lines: result.new_lines,
                content_changed: result.content_changed,
                stats: knowledgebaseManager.getStats(),
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to update knowledgebase: ${error.message}`, {
                operation: type,
                content_length: content ? content.length : 0,
                stack: error.stack,
            });
        }
    }
}

// Create and export the tool instance
const updateKnowledgebaseTool = new UpdateKnowledgebaseTool();

export default async function updateKnowledgebase(params) {
    return await updateKnowledgebaseTool.execute(params);
}
