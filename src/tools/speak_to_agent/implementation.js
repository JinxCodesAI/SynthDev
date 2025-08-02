import { BaseTool } from '../common/base-tool.js';

class SpeakToAgentTool extends BaseTool {
    constructor() {
        super('speak_to_agent', 'Sends a message to a previously spawned agent');

        this.requiredParams = ['agent_id', 'message'];
        this.parameterTypes = {
            agent_id: 'string',
            message: 'string',
        };
    }

    async implementation(params) {
        const { agent_id, message } = params;

        try {
            const agentManager = this.context.agentManager;
            if (!agentManager) {
                throw new Error('AgentManager not available in context');
            }

            // Validate agent exists and is accessible
            const agentStatus = agentManager.getAgentStatus(agent_id);
            if (!agentStatus) {
                return this.createErrorResponse(
                    `Failed to send message to agent: ${error.message}`,
                    {
                        agent_id,
                        message,
                        error: `Agent with ID ${agent_id} not found use get_agents to list all agents or spawn_agent to create new agent`,
                    }
                );
            }

            // Note: Completed agents can still receive messages for corrections or follow-up tasks
            // The supervisor may always request modifications or additional work
            if (agentStatus.status === 'failed') {
                throw new Error(`Agent ${agent_id} has failed and cannot process messages`);
            }

            const currentAgentId = this.context?.currentAgentId || null;

            const fullMessage = `speak_to_agent call from ${currentAgentId ?? 'user'} to ${agent_id} with message: ${message} `;
            // Send message (now asynchronous)
            const response = await agentManager.sendMessageToAgent(agent_id, fullMessage);

            return this.createSuccessResponse({
                agent_id: agent_id,
                message_sent: response.message_sent,
                agent_status: response.status,
                timestamp: new Date().toISOString(),
                message: response.message,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to send message to agent: ${error.message}`, {
                agent_id,
                message,
                error: error.stack ?? error,
            });
        }
    }
}

const speakToAgentTool = new SpeakToAgentTool();
export default async function speak_to_agent(params) {
    return await speakToAgentTool.execute(params);
}
