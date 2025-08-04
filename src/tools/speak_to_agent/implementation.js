/**
 * Speak to Agent Tool Implementation
 * Enables communication with spawned AI agents
 */

import { BaseTool } from '../common/base-tool.js';

export default async function speakToAgent(params) {
    const tool = new BaseTool('speak_to_agent', 'Send message to a spawned AI agent');

    // Parameter validation
    const validationError = tool.validateRequiredParams(params, ['agent_id', 'message']);
    if (validationError) {
        return validationError;
    }

    const typeError = tool.validateParameterTypes(params, {
        agent_id: 'string',
        message: 'string',
    });
    if (typeError) {
        return typeError;
    }

    try {
        const { agent_id, message } = params;

        // Get the AgentManager instance from the global app context
        const agentManager = params.costsManager?.app?.agentManager;

        if (!agentManager) {
            return tool.createErrorResponse(
                'Agent management system not available. This feature requires the AgentManager to be initialized.'
            );
        }

        // Validate inputs are not empty
        if (!agent_id.trim()) {
            return tool.createErrorResponse('Agent ID cannot be empty');
        }

        if (!message.trim()) {
            return tool.createErrorResponse('Message cannot be empty');
        }

        // Check if agent exists and get its info
        const agentInfo = agentManager.getAgentInfo(agent_id);
        if (!agentInfo) {
            return tool.createErrorResponse(
                `Agent ${agent_id} not found. Make sure the agent was spawned and hasn't been despawned.`
            );
        }

        // Send message to the agent
        const result = await agentManager.sendMessageToAgent(agent_id, message);

        if (!result.success) {
            return tool.createErrorResponse(result.error);
        }

        // Log the successful communication
        tool.logger?.info(
            `💬 Message sent to agent ${agent_id} (${agentInfo.agentRole}): "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`
        );

        return tool.createSuccessResponse({
            agent_id: result.agentId,
            agent_role: agentInfo.agentRole,
            message_sent: message,
            agent_response: result.response,
            response_timestamp: new Date().toISOString(),
            message: `Agent ${agent_id} (${agentInfo.agentRole}) responded successfully.`,
        });
    } catch (error) {
        return tool.createErrorResponse(`Failed to communicate with agent: ${error.message}`);
    }
}
