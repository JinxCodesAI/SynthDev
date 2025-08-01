import { describe, it, expect, beforeEach, vi } from 'vitest';
import AgentManager from '../../src/agents/AgentManager.js';
import get_agents from '../../src/tools/get_agents/implementation.js';
import spawn_agent from '../../src/tools/spawn_agent/implementation.js';

// Mock dependencies
vi.mock('../../src/core/logger.js', () => ({
    getLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        toolExecutionDetailed: vi.fn(),
        toolResult: vi.fn(),
    }),
}));

vi.mock('../../src/config/system-messages.js', () => ({
    default: {
        canSpawnAgent: vi.fn().mockReturnValue(true),
        getSystemMessage: vi.fn().mockReturnValue('Test system message'),
        getModelForRole: vi.fn().mockReturnValue('gpt-4'),
        isAgentic: vi.fn().mockReturnValue(true),
    },
}));

vi.mock('../../src/core/ai-api-client.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        setSystemMessage: vi.fn(),
        setCallbacks: vi.fn(),
        setTools: vi.fn(),
        addMessage: vi.fn(),
        addUserMessage: vi.fn(),
        sendMessage: vi.fn().mockResolvedValue('Mock agent response'),
        messages: [],
        role: 'test_role',
    })),
}));

describe('get_agents fix verification', () => {
    let agentManager;
    let mockContext;

    beforeEach(() => {
        // Reset singleton and clear mocks
        AgentManager.instance = null;
        vi.clearAllMocks();

        agentManager = AgentManager.getInstance();

        mockContext = {
            agentManager,
            currentRole: 'user',
            currentAgentId: null, // Main user has no agent ID
            costsManager: { trackCost: vi.fn() },
            toolManager: {
                getTools: vi.fn(() => []),
                executeToolCall: vi.fn().mockResolvedValue({ success: true }),
            },
        };
    });

    it('should list all agents in the system regardless of who spawned them', async () => {
        // Create agents directly in the AgentManager to simulate multiple agents
        // This bypasses permission issues and focuses on testing get_agents functionality

        // Manually create agents in the AgentManager
        const mockAgent1 = {
            agentId: 'agent-1',
            roleName: 'agentic.developer',
            status: 'running',
            createdAt: new Date('2023-01-01'),
            taskPrompt: 'Write tests for module A',
            result: null,
            parentId: null,
            getStatus: function () {
                return {
                    agentId: this.agentId,
                    roleName: this.roleName,
                    status: this.status,
                    createdAt: this.createdAt,
                    taskPrompt: this.taskPrompt,
                    result: this.result,
                    parentId: this.parentId,
                };
            },
        };

        const mockAgent2 = {
            agentId: 'agent-2',
            roleName: 'agentic.architect',
            status: 'inactive',
            createdAt: new Date('2023-01-02'),
            taskPrompt: 'Review code for security issues',
            result: null,
            parentId: null,
            getStatus: function () {
                return {
                    agentId: this.agentId,
                    roleName: this.roleName,
                    status: this.status,
                    createdAt: this.createdAt,
                    taskPrompt: this.taskPrompt,
                    result: this.result,
                    parentId: this.parentId,
                };
            },
        };

        const mockAgent3 = {
            agentId: 'agent-3',
            roleName: 'agentic.test-runner',
            status: 'completed',
            createdAt: new Date('2023-01-03'),
            taskPrompt: 'Run tests and provide feedback',
            result: { status: 'success', summary: 'All tests passed' },
            parentId: 'agent-1',
            getStatus: function () {
                return {
                    agentId: this.agentId,
                    roleName: this.roleName,
                    status: this.status,
                    createdAt: this.createdAt,
                    taskPrompt: this.taskPrompt,
                    result: this.result,
                    parentId: this.parentId,
                };
            },
        };

        // Add agents to the AgentManager
        agentManager.activeAgents.set('agent-1', mockAgent1);
        agentManager.activeAgents.set('agent-2', mockAgent2);
        agentManager.activeAgents.set('agent-3', mockAgent3);

        // Now call get_agents
        const listResult = await get_agents({
            context: mockContext,
        });

        // Verify that ALL agents are returned, regardless of hierarchy
        expect(listResult.success).toBe(true);
        expect(listResult.agents).toHaveLength(3);
        expect(listResult.total_count).toBe(3);

        // Verify all agent IDs are present
        const agentIds = listResult.agents.map(agent => agent.agent_id);
        expect(agentIds).toContain('agent-1');
        expect(agentIds).toContain('agent-2');
        expect(agentIds).toContain('agent-3');

        // Verify agent details
        const agent1Info = listResult.agents.find(a => a.agent_id === 'agent-1');
        expect(agent1Info.role_name).toBe('agentic.developer');
        expect(agent1Info.parent_id).toBe(null);

        const agent2Info = listResult.agents.find(a => a.agent_id === 'agent-2');
        expect(agent2Info.role_name).toBe('agentic.architect');
        expect(agent2Info.parent_id).toBe(null);

        const agent3Info = listResult.agents.find(a => a.agent_id === 'agent-3');
        expect(agent3Info.role_name).toBe('agentic.test-runner');
        expect(agent3Info.parent_id).toBe('agent-1');

        // Verify statistics
        expect(listResult.active_count).toBe(1); // only agent-1 is running
        expect(listResult.completed_count).toBe(1); // only agent-3 is completed
        expect(listResult.failed_count).toBe(0);
    });

    it('should also work when called from an agent context', async () => {
        // Create mock agents directly
        const mockAgent1 = {
            agentId: 'agent-1',
            roleName: 'agentic.developer',
            status: 'running',
            createdAt: new Date('2023-01-01'),
            taskPrompt: 'Write tests',
            result: null,
            parentId: null,
            getStatus: function () {
                return {
                    agentId: this.agentId,
                    roleName: this.roleName,
                    status: this.status,
                    createdAt: this.createdAt,
                    taskPrompt: this.taskPrompt,
                    result: this.result,
                    parentId: this.parentId,
                };
            },
        };

        const mockAgent2 = {
            agentId: 'agent-2',
            roleName: 'agentic.architect',
            status: 'inactive',
            createdAt: new Date('2023-01-02'),
            taskPrompt: 'Review code',
            result: null,
            parentId: null,
            getStatus: function () {
                return {
                    agentId: this.agentId,
                    roleName: this.roleName,
                    status: this.status,
                    createdAt: this.createdAt,
                    taskPrompt: this.taskPrompt,
                    result: this.result,
                    parentId: this.parentId,
                };
            },
        };

        // Add agents to the AgentManager
        agentManager.activeAgents.set('agent-1', mockAgent1);
        agentManager.activeAgents.set('agent-2', mockAgent2);

        // Call get_agents from agent1's context
        const agent1Context = {
            ...mockContext,
            currentAgentId: 'agent-1',
            currentRole: 'agentic.developer',
        };

        const listResult = await get_agents({
            context: agent1Context,
        });

        // Should still return ALL agents in the system
        expect(listResult.success).toBe(true);
        expect(listResult.agents).toHaveLength(2);
        expect(listResult.total_count).toBe(2);

        const agentIds = listResult.agents.map(agent => agent.agent_id);
        expect(agentIds).toContain('agent-1');
        expect(agentIds).toContain('agent-2');
    });
});
