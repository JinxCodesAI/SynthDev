/**
 * Spawn Agent Tool Implementation
 * Creates new AI agent instances that can work independently on specific tasks
 */

import { BaseTool } from '../common/base-tool.js';

export default async function spawnAgent(params) {
    const tool = new BaseTool('spawn_agent', 'Spawn a new AI agent with specific role');

    // Parameter validation
    const validationError = tool.validateRequiredParams(params, ['agent_role', 'task_description']);
    if (validationError) {
        return validationError;
    }

    const typeError = tool.validateParameterTypes(params, {
        agent_role: 'string',
        task_description: 'string',
        context_name: 'string',
    });
    if (typeError) {
        return typeError;
    }

    try {
        const { agent_role, task_description, context_name } = params;

        // Get the AgentManager instance from the global app context
        // We need to access this through the costsManager which has access to the app
        const agentManager = params.costsManager?.app?.agentManager;

        if (!agentManager) {
            return tool.createErrorResponse(
                'Agent management system not available. This feature requires the AgentManager to be initialized.'
            );
        }

        // Validate agent role is not empty
        if (!agent_role.trim()) {
            return tool.createErrorResponse('Agent role cannot be empty');
        }

        // Validate task description is not empty
        if (!task_description.trim()) {
            return tool.createErrorResponse('Task description cannot be empty');
        }

        // Generate a parent agent ID (this would be the current agent/session)
        // For now, we'll use a session-based identifier
        const parentAgentId = params.costsManager?.sessionId || 'main-session';

        // Attempt to spawn the agent
        const result = await agentManager.spawnAgent(agent_role, parentAgentId, context_name);

        if (!result.success) {
            return tool.createErrorResponse(result.error);
        }

        // Log the successful spawn
        tool.logger?.info(
            `🤖 Agent spawned: ${result.agentId} (${agent_role}) for task: ${task_description}`
        );

        return tool.createSuccessResponse({
            agent_id: result.agentId,
            agent_role: result.agentRole,
            context_name: result.contextName,
            created_at: result.createdAt,
            task_description: task_description,
            parent_agent_id: parentAgentId,
            message: `Successfully spawned ${agent_role} agent with ID ${result.agentId}. Use speak_to_agent tool to communicate with it, or despawn_agent tool to remove it when the task is complete.`,
        });
    } catch (error) {
        return tool.createErrorResponse(`Failed to spawn agent: ${error.message}`);
    }
}
