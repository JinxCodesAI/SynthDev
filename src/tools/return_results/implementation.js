import { BaseTool } from '../common/base-tool.js';

class ReturnResultsTool extends BaseTool {
    constructor() {
        super('return_results', 'Signals task completion and returns structured results');

        this.requiredParams = ['result'];
        this.parameterTypes = {
            result: 'object',
        };
    }

    async implementation(params) {
        const { result } = params;

        try {
            // Validate result structure
            this._validateResultStructure(result);

            const agentManager = this.context.agentManager;

            // Get current agent ID from context or determine from role
            // Results are sent as messages to the parent supervisor
            const currentAgentId = this.context?.currentAgentId || this.context?.agentId;

            if (!currentAgentId) {
                // If no agent ID in context, this might be called by the main supervisor
                // In that case, we need to handle it differently
                throw new Error(
                    'Cannot determine current agent ID for result reporting. This tool should only be called by worker agents.'
                );
            }

            // Add completion metadata
            const enrichedResult = {
                ...result,
                completed_at: new Date().toISOString(),
                agent_id: currentAgentId,
            };

            // Report result to AgentManager
            await agentManager.reportResult(currentAgentId, enrichedResult);

            return this.createSuccessResponse({
                task_completed: true,
                agent_id: currentAgentId,
                result_status: result.status,
                summary: result.summary,
                artifacts_count: result.artifacts?.length || 0,
                completed_at: enrichedResult.completed_at,
                message: `Task completed successfully with status: ${result.status}`,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to return results: ${error.message}`, {
                result,
                error: error.stack,
            });
        }
    }

    _validateResultStructure(result) {
        if (!result || typeof result !== 'object') {
            throw new Error('Result must be a valid object');
        }

        if (!result.status || !['success', 'failure', 'partial'].includes(result.status)) {
            throw new Error('Result must have a valid status: success, failure, or partial');
        }

        if (!result.summary || typeof result.summary !== 'string') {
            throw new Error('Result must have a non-empty summary string');
        }

        if (result.artifacts && !Array.isArray(result.artifacts)) {
            throw new Error('Artifacts must be an array of file objects');
        }

        if (result.artifacts) {
            for (const artifact of result.artifacts) {
                if (!artifact.file_path || !artifact.description || !artifact.change_type) {
                    throw new Error(
                        'Each artifact must have file_path, description, and change_type'
                    );
                }
                if (
                    !['created', 'modified', 'deleted', 'referenced'].includes(artifact.change_type)
                ) {
                    throw new Error(
                        'Artifact change_type must be: created, modified, deleted, or referenced'
                    );
                }
            }
        }

        if (result.known_issues && !Array.isArray(result.known_issues)) {
            throw new Error('Known issues must be an array of strings');
        }
    }
}

const returnResultsTool = new ReturnResultsTool();
export default async function return_results(params) {
    return await returnResultsTool.execute(params);
}
