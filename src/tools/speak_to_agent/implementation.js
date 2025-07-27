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

            // Validate agent exists and is accessible
            const agentStatus = agentManager.getAgentStatus(agent_id);
            if (!agentStatus) {
                throw new Error(`Agent with ID ${agent_id} not found`);
            }

            // Note: Completed agents can still receive messages for corrections or follow-up tasks
            // The supervisor may always request modifications or additional work
            if (agentStatus.status === 'failed') {
                throw new Error(`Agent ${agent_id} has failed and cannot process messages`);
            }

            // Send message and get response
            const response = await agentManager.sendMessageToAgent(agent_id, message);

            return this.createSuccessResponse({
                agent_id: agent_id,
                message_sent: true,
                agent_response: response.content,
                agent_status: response.status,
                timestamp: new Date().toISOString(),
                message: `Message sent to agent ${agent_id} successfully`,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to send message to agent: ${error.message}`, {
                agent_id,
                message,
                error: error.stack,
            });
        }
    }
}

const speakToAgentTool = new SpeakToAgentTool();
export default async function speak_to_agent(params) {
    return await speakToAgentTool.execute(params);
}
