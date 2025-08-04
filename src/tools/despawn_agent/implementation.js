/**
 * Despawn Agent Tool Implementation
 * Removes AI agent instances that were previously spawned, with parent validation
 */

import { BaseTool } from '../common/base-tool.js';

export default async function despawnAgent(params) {
    const tool = new BaseTool('despawn_agent', 'Remove a spawned AI agent');

    // Parameter validation
    const validationError = tool.validateRequiredParams(params, ['agent_id']);
    if (validationError) {
        return validationError;
    }

    const typeError = tool.validateParameterTypes(params, {
        agent_id: 'string',
        reason: 'string',
    });
    if (typeError) {
        return typeError;
    }

    try {
        const { agent_id, reason = 'Task completed' } = params;

        // Get the AgentManager instance from the global app context
        const agentManager = params.costsManager?.app?.agentManager;

        if (!agentManager) {
            return tool.createErrorResponse(
                'Agent management system not available. This feature requires the AgentManager to be initialized.'
            );
        }

        // Validate agent ID is not empty
        if (!agent_id.trim()) {
            return tool.createErrorResponse('Agent ID cannot be empty');
        }

        // Get the requesting parent agent ID (this would be the current agent/session)
        const requestingParentId = params.costsManager?.sessionId || 'main-session';

        // Get agent info before despawning for logging
        const agentInfo = agentManager.getAgentInfo(agent_id);
        if (!agentInfo) {
            return tool.createErrorResponse(`Agent ${agent_id} not found`);
        }

        // Attempt to despawn the agent
        const result = await agentManager.despawnAgent(agent_id, requestingParentId);

        if (!result.success) {
            return tool.createErrorResponse(result.error);
        }

        // Log the successful despawn
        tool.logger?.info(
            `🗑️ Agent despawned: ${agent_id} (${result.agentRole}) - Reason: ${reason}`
        );

        return tool.createSuccessResponse({
            agent_id: result.agentId,
            agent_role: result.agentRole,
            despawned_at: result.despawnedAt,
            reason: reason,
            parent_agent_id: requestingParentId,
            message: `Successfully despawned ${result.agentRole} agent ${agent_id}. All associated resources have been cleaned up.`,
        });
    } catch (error) {
        return tool.createErrorResponse(`Failed to despawn agent: ${error.message}`);
    }
}
