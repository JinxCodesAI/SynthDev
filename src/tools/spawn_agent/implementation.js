import { BaseTool } from '../common/base-tool.js';

class SpawnAgentTool extends BaseTool {
    constructor() {
        super('spawn_agent', 'Spawns a new, specialized AI agent to perform a specific task');

        this.requiredParams = ['role_name', 'task_prompt'];
        this.parameterTypes = {
            role_name: 'string',
            task_prompt: 'string',
        };
    }

    async implementation(params) {
        const { role_name, task_prompt } = params;

        try {
            // Get current role from context (passed through tool execution)
            const currentRole = this.context?.currentRole || 'unknown';

            // Spawn agent through AgentManager
            const agentManager = this.context.agentManager;
            const result = await agentManager.spawnAgent(
                currentRole,
                role_name,
                task_prompt,
                this.context // Share context for CostsManager and ToolManager access
            );

            return this.createSuccessResponse({
                agent_id: result.agentId,
                status: result.status,
                role_name: role_name,
                created_at: result.createdAt,
                message: `Successfully spawned ${role_name} agent with ID: ${result.agentId}. Continue spawning other agents if necessary or wait for messages with results`,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to spawn agent: ${error.message}`, {
                role_name,
                task_prompt,
                error: error.stack,
            });
        }
    }
}

const spawnAgentTool = new SpawnAgentTool();
export default async function spawn_agent(params) {
    return await spawnAgentTool.execute(params);
}
