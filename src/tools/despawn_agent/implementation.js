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
                throw new Error('AgentManager not available in context');
            }

            // Despawn the agent through AgentManager
            const result = await agentManager.despawnAgent(currentAgentId, agent_id);

            return this.createSuccessResponse({
                success: result.success,
                agent_id: result.agent_id,
                role_name: result.role_name,
                status: result.status,
                despawned_at: result.despawned_at,
                message: result.message,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to despawn agent: ${error.message}`, {
                agent_id,
                error: error.stack,
            });
        }
    }
}

const despawnAgentTool = new DespawnAgentTool();
export default async function despawn_agent(params) {
    return await despawnAgentTool.execute(params);
}
