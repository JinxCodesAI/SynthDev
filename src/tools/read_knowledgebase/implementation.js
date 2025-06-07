/**
 * Read Knowledgebase tool implementation
 * Read the current content of the shared knowledgebase
 */

import { BaseTool } from '../common/base-tool.js';
import knowledgebaseManager from '../common/knowledgebase-manager.js';

class ReadKnowledgebaseTool extends BaseTool {
    constructor() {
        super('read_knowledgebase', 'Read the current content of the shared knowledgebase');

        // Define parameter validation
        this.requiredParams = []; // No required parameters
        this.parameterTypes = {}; // No parameters
    }

    async implementation(params) {
        try {
            // Read from the knowledgebase manager
            const result = knowledgebaseManager.read();

            if (!result.success) {
                return this.createErrorResponse(result.error, {
                    operation: 'read',
                });
            }

            return this.createSuccessResponse({
                content: result.content,
                length: result.length,
                lines: result.lines,
                is_empty: result.content.length === 0,
                stats: knowledgebaseManager.getStats(),
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to read knowledgebase: ${error.message}`, {
                operation: 'read',
                stack: error.stack,
            });
        }
    }
}

// Create and export the tool instance
const readKnowledgebaseTool = new ReadKnowledgebaseTool();

export default async function readKnowledgebase(params) {
    return await readKnowledgebaseTool.execute(params);
}
