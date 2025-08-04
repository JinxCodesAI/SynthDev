import { BaseTool } from '../common/base-tool.js';

class DespawnAgentTool extends BaseTool {
    constructor() {
        super('despawn_agent', 'Despawns a completed or failed agent that is no longer needed');

        this.requiredParams = ['agent_id'];
        this.parameterTypes = {
            agent_id: 'string',
        };
    }

    async implementation(params) {
        const { agent_id } = params;

        try {
            // Get current agent ID from context (null for main user)
            const currentAgentId = this.context?.currentAgentId || null;

            // Get AgentManager from context
            const agentManager = this.context.agentManager;
            if (!agentManager) {
                return this.createErrorResponse('AgentManager not available in context', {
                    agent_id,
                });
            }

            // Despawn the agent through AgentManager
            const result = await agentManager.despawnAgent(currentAgentId, agent_id);

            // Check if the operation was successful
            if (result.success) {
                return this.createSuccessResponse({
                    success: result.success,
                    agent_id: result.agent_id,
                    role_name: result.role_name,
                    status: result.status,
                    despawned_at: result.despawned_at,
                    message: result.message,
                });
            } else {
                // Return the error from AgentManager without exposing stack traces
                return this.createErrorResponse(result.error, {
                    agent_id: result.agent_id,
                    status: result.status,
                    children: result.children,
                });
            }
        } catch (error) {
            // Handle unexpected errors without exposing stack traces
            return this.createErrorResponse(
                `Unexpected error while despawning agent: ${error.message}`,
                {
                    agent_id,
                }
            );
        }
    }
}

const despawnAgentTool = new DespawnAgentTool();
export default async function despawn_agent(params) {
    return await despawnAgentTool.execute(params);
}
