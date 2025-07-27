import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AgentManager from '../../src/agents/AgentManager.js';
import spawn_agent from '../../src/tools/spawn_agent/implementation.js';
import speak_to_agent from '../../src/tools/speak_to_agent/implementation.js';
import get_agents from '../../src/tools/get_agents/implementation.js';
import return_results from '../../src/tools/return_results/implementation.js';
import SystemMessages from '../../src/core/ai/systemMessages.js';

// Mock dependencies
vi.mock('../../src/core/ai/aiAPIClient.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        setSystemMessage: vi.fn(),
        addMessage: vi.fn(),
        sendMessage: vi.fn().mockResolvedValue('Mock agent response'),
        messages: [],
    })),
}));

vi.mock('../../src/core/ai/systemMessages.js');

vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

describe.sequential('Agent Collaboration Integration', () => {
    let agentManager;
    let mockContext;

    beforeEach(() => {
        // Reset singleton and clear mocks
        AgentManager.instance = null;
        vi.clearAllMocks();

        agentManager = AgentManager.getInstance();

        mockContext = {
            agentManager,
            currentRole: 'agentic_coder',
            costsManager: { trackCost: vi.fn() },
            toolManager: { getTools: vi.fn().mockReturnValue([]) },
        };

        // Mock SystemMessages
        SystemMessages.canSpawnAgent.mockReturnValue(true);
        SystemMessages.getLevel.mockReturnValue('base');
        SystemMessages.getSystemMessage.mockReturnValue('Mock system message');

        // Mock environment variables
        process.env.OPENAI_API_KEY = 'mock-api-key';
        process.env.OPENAI_BASE_URL = 'https://mock-api.com';
    });

    afterEach(() => {
        if (agentManager) {
            agentManager.reset();
        }
    });

    it('should complete full agent collaboration workflow', async () => {
        // Step 1: Spawn agent
        const spawnResult = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write unit tests for the calculator module',
            context: mockContext,
        });

        expect(spawnResult.success).toBe(true);
        expect(spawnResult.agent_id).toBeDefined();
        expect(spawnResult.role_name).toBe('test_writer');
        expect(spawnResult.status).toBe('running');

        const agentId = spawnResult.agent_id;

        // Step 2: Check agent appears in agent list
        const listResult = await get_agents({
            context: mockContext,
        });

        expect(listResult.success).toBe(true);
        expect(listResult.agents).toHaveLength(1);
        expect(listResult.agents[0].agent_id).toBe(agentId);
        expect(listResult.agents[0].role_name).toBe('test_writer');
        expect(listResult.agents[0].status).toBe('running');
        expect(listResult.total_count).toBe(1);
        expect(listResult.active_count).toBe(1);
        expect(listResult.completed_count).toBe(0);

        // Step 3: Send follow-up message to agent
        const speakResult = await speak_to_agent({
            agent_id: agentId,
            message: 'Please focus on edge cases and error handling',
            context: mockContext,
        });

        expect(speakResult.success).toBe(true);
        expect(speakResult.agent_id).toBe(agentId);
        expect(speakResult.message_sent).toBe(true);
        expect(speakResult.agent_response).toBe('Mock agent response');
        expect(speakResult.agent_status).toBe('running');

        // Step 4: Agent returns results
        const returnResult = await return_results({
            result: {
                status: 'success',
                summary: 'Created comprehensive unit tests with 95% coverage',
                artifacts: [
                    {
                        file_path: 'tests/calculator.test.js',
                        description:
                            'Main test file with comprehensive unit tests covering all functions',
                        change_type: 'created',
                    },
                    {
                        file_path: 'tests/helpers/testUtils.js',
                        description: 'Helper utilities for test setup and mocking',
                        change_type: 'created',
                    },
                ],
                known_issues: [],
            },
            context: { ...mockContext, currentAgentId: agentId },
        });

        expect(returnResult.success).toBe(true);
        expect(returnResult.task_completed).toBe(true);
        expect(returnResult.agent_id).toBe(agentId);
        expect(returnResult.result_status).toBe('success');
        expect(returnResult.artifacts_count).toBe(2);

        // Step 5: Verify agent status changed to completed
        const agentStatus = agentManager.getAgentStatus(agentId);
        expect(agentStatus.status).toBe('completed');
        expect(agentStatus.result).toBeDefined();
        expect(agentStatus.result.status).toBe('success');

        // Step 6: Verify completed agent appears in updated list
        const finalListResult = await get_agents({
            context: mockContext,
        });

        expect(finalListResult.success).toBe(true);
        expect(finalListResult.agents).toHaveLength(1);
        expect(finalListResult.agents[0].status).toBe('completed');
        expect(finalListResult.agents[0].has_result).toBe(true);
        expect(finalListResult.active_count).toBe(0);
        expect(finalListResult.completed_count).toBe(1);
    });

    it('should handle multiple agents concurrently', async () => {
        // Spawn multiple agents
        const testWriterResult = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write unit tests',
            context: mockContext,
        });

        const reviewerResult = await spawn_agent({
            role_name: 'code_reviewer',
            task_prompt: 'Review code quality',
            context: mockContext,
        });

        const docWriterResult = await spawn_agent({
            role_name: 'documentation_writer',
            task_prompt: 'Write API documentation',
            context: mockContext,
        });

        expect(testWriterResult.success).toBe(true);
        expect(reviewerResult.success).toBe(true);
        expect(docWriterResult.success).toBe(true);

        // Verify all agents are listed
        const listResult = await get_agents({
            context: mockContext,
        });

        expect(listResult.success).toBe(true);
        expect(listResult.agents).toHaveLength(3);
        expect(listResult.total_count).toBe(3);
        expect(listResult.active_count).toBe(3);

        // Complete one agent
        await return_results({
            result: {
                status: 'success',
                summary: 'Tests completed',
                artifacts: [],
                known_issues: [],
            },
            context: { ...mockContext, currentAgentId: testWriterResult.agent_id },
        });

        // Verify statistics updated correctly
        const updatedListResult = await get_agents({
            context: mockContext,
        });

        expect(updatedListResult.active_count).toBe(2);
        expect(updatedListResult.completed_count).toBe(1);
    });

    it('should handle permission violations', async () => {
        // Mock permission denial
        SystemMessages.canSpawnAgent.mockReturnValue(false);

        const unauthorizedContext = {
            ...mockContext,
            currentRole: 'basic_role', // Role without enabled_agents
        };

        const result = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write tests',
            context: unauthorizedContext,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not authorized');

        // Verify no agent was created
        const listResult = await get_agents({
            context: unauthorizedContext,
        });

        expect(listResult.agents).toHaveLength(0);
    });

    it('should handle agent communication with completed agents', async () => {
        // Spawn and complete an agent
        const spawnResult = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write tests',
            context: mockContext,
        });

        const agentId = spawnResult.agent_id;

        await return_results({
            result: {
                status: 'success',
                summary: 'Initial tests completed',
                artifacts: [],
                known_issues: ['Need more edge case tests'],
            },
            context: { ...mockContext, currentAgentId: agentId },
        });

        // Send follow-up message to completed agent
        const speakResult = await speak_to_agent({
            agent_id: agentId,
            message: 'Please add the missing edge case tests',
            context: mockContext,
        });

        expect(speakResult.success).toBe(true);
        expect(speakResult.message_sent).toBe(true);
        expect(speakResult.agent_response).toBe('Mock agent response');
    });

    it('should handle agent failure scenarios', async () => {
        const spawnResult = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write tests',
            context: mockContext,
        });

        const agentId = spawnResult.agent_id;

        // Simulate agent failure
        const agent = agentManager.getAgentStatus(agentId);
        const agentProcess = agentManager.activeAgents.get(agentId);
        agentProcess.markFailed(new Error('Simulated failure'));

        // Verify failed agent cannot receive messages
        const speakResult = await speak_to_agent({
            agent_id: agentId,
            message: 'Try to continue',
            context: mockContext,
        });

        expect(speakResult.success).toBe(false);
        expect(speakResult.error).toContain('has failed and cannot process messages');

        // Verify failed agent appears in statistics
        const listResult = await get_agents({
            context: mockContext,
        });

        expect(listResult.failed_count).toBe(1);
        expect(listResult.active_count).toBe(0);
    });

    it('should handle agent filtering options', async () => {
        // Create agents in different states
        const agent1Result = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write tests',
            context: mockContext,
        });

        const agent2Result = await spawn_agent({
            role_name: 'code_reviewer',
            task_prompt: 'Review code',
            context: mockContext,
        });

        // Complete one agent
        await return_results({
            result: {
                status: 'success',
                summary: 'Work completed',
                artifacts: [],
                known_issues: [],
            },
            context: { ...mockContext, currentAgentId: agent1Result.agent_id },
        });

        // Test filtering out completed agents
        const filteredResult = await get_agents({
            include_completed: false,
            context: mockContext,
        });

        expect(filteredResult.agents).toHaveLength(1);
        expect(filteredResult.agents[0].agent_id).toBe(agent2Result.agent_id);
        expect(filteredResult.agents[0].status).toBe('running');

        // Test including all agents
        const allAgentsResult = await get_agents({
            include_completed: true,
            context: mockContext,
        });

        expect(allAgentsResult.agents).toHaveLength(2);
    });

    it('should maintain agent hierarchy correctly', async () => {
        const spawnResult = await spawn_agent({
            role_name: 'test_writer',
            task_prompt: 'Write tests',
            context: mockContext,
        });

        expect(spawnResult.success).toBe(true);

        // Verify hierarchy tracking
        expect(agentManager.agentHierarchy.has('agentic_coder')).toBe(true);
        expect(agentManager.agentHierarchy.get('agentic_coder').has(spawnResult.agent_id)).toBe(
            true
        );

        // Verify agent knows its parent
        const agentStatus = agentManager.getAgentStatus(spawnResult.agent_id);
        expect(agentStatus.parentId).toBe('agentic_coder');
    });
});
