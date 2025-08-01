import { BaseTool } from '../common/base-tool.js';

class GetAgentsTool extends BaseTool {
    constructor() {
        super('get_agents', 'Lists all currently active agents in the system');

        this.requiredParams = [];
        this.parameterTypes = {
            include_completed: 'boolean',
        };
    }

    async implementation(params) {
        const { include_completed = true } = params;

        try {
            const agentManager = this.context.agentManager;
            if (!agentManager) {
                throw new Error('AgentManager not available in context');
            }

            // Get all agents in the system regardless of supervisor
            const agents = agentManager.listAllAgents({ include_completed });

            // Format agent information for response
            const agentList = agents.map(agent => ({
                agent_id: agent.agentId,
                role_name: agent.roleName,
                status: agent.status,
                created_at: agent.createdAt,
                task_prompt: `${agent.taskPrompt.substring(0, 100)}...`, // Truncated for readability
                has_result: !!agent.result,
                parent_id: agent.parentId,
            }));

            return this.createSuccessResponse({
                agents: agentList,
                total_count: agentList.length,
                active_count: agentList.filter(a => a.status === 'running').length,
                completed_count: agentList.filter(a => a.status === 'completed').length,
                failed_count: agentList.filter(a => a.status === 'failed').length,
                include_completed: include_completed,
                message: `Found ${agentList.length} agents`,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to retrieve agents: ${error.message}`, {
                include_completed,
                error: error.stack,
            });
        }
    }
}

const getAgentsTool = new GetAgentsTool();
export default async function get_agents(params) {
    return await getAgentsTool.execute(params);
}
