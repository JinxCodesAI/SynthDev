import { describe, it, expect, beforeEach, vi } from 'vitest';
import get_agents from '../../../src/tools/get_agents/implementation.js';

describe('get_agents tool', () => {
    let mockContext;
    let mockAgents;

    beforeEach(() => {
        mockAgents = [
            {
                agentId: 'agent-1',
                roleName: 'test_writer',
                status: 'running',
                createdAt: new Date('2023-01-01'),
                taskPrompt: 'Write comprehensive unit tests for the calculator module',
                result: null,
                parentId: 'agentic_coder',
            },
            {
                agentId: 'agent-2',
                roleName: 'code_reviewer',
                status: 'completed',
                createdAt: new Date('2023-01-02'),
                taskPrompt: 'Review the new authentication system for security vulnerabilities',
                result: { status: 'success', summary: 'Review completed' },
                parentId: 'agentic_coder',
            },
            {
                agentId: 'agent-3',
                roleName: 'documentation_writer',
                status: 'failed',
                createdAt: new Date('2023-01-03'),
                taskPrompt: 'Create API documentation for the user management endpoints',
                result: { status: 'failure', error: 'Unable to access API spec' },
                parentId: 'agentic_coder',
            },
        ];

        mockContext = {
            agentManager: {
                listAllAgents: vi.fn().mockReturnValue(mockAgents),
            },
            currentRole: 'agentic_coder',
            currentAgentId: null, // Main user has no agent ID
        };
    });

    describe('parameter validation', () => {
        it('should work without any parameters', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            expect(result.success).toBe(true);
        });

        it('should handle include_completed parameter', async () => {
            await get_agents({
                include_completed: false,
                context: mockContext,
            });

            expect(mockContext.agentManager.listAllAgents).toHaveBeenCalledWith({
                include_completed: false,
            });
        });

        it('should default include_completed to true', async () => {
            await get_agents({
                context: mockContext,
            });

            expect(mockContext.agentManager.listAllAgents).toHaveBeenCalledWith({
                include_completed: true,
            });
        });
    });

    describe('successful execution', () => {
        it('should return all agents with correct format', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.agents).toHaveLength(3);

            const agent1 = result.agents[0];
            expect(agent1.agent_id).toBe('agent-1');
            expect(agent1.role_name).toBe('test_writer');
            expect(agent1.status).toBe('running');
            expect(agent1.created_at).toEqual(new Date('2023-01-01'));
            expect(agent1.task_prompt).toBe(
                'Write comprehensive unit tests for the calculator module...'
            );
            expect(agent1.has_result).toBe(false);
            expect(agent1.parent_id).toBe('agentic_coder');
        });

        it('should truncate long task prompts', async () => {
            const longPrompt = 'A'.repeat(150);
            mockAgents[0].taskPrompt = longPrompt;

            const result = await get_agents({
                context: mockContext,
            });

            expect(result.agents[0].task_prompt).toBe(`${'A'.repeat(100)}...`);
        });

        it('should correctly identify agents with results', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            expect(result.agents[0].has_result).toBe(false); // agent-1 has no result
            expect(result.agents[1].has_result).toBe(true); // agent-2 has result
            expect(result.agents[2].has_result).toBe(true); // agent-3 has result (failure)
        });

        it('should include summary statistics', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            expect(result.total_count).toBe(3);
            expect(result.active_count).toBe(1); // only 'running' agents
            expect(result.completed_count).toBe(1); // only 'completed' agents
            expect(result.failed_count).toBe(1); // only 'failed' agents
            expect(result.include_completed).toBe(true);
            expect(result.message).toBe('Found 3 agents');
        });

        it('should filter statistics correctly for filtered results', async () => {
            // Mock returning only running agents
            mockContext.agentManager.listAllAgents.mockReturnValue([mockAgents[0]]);

            const result = await get_agents({
                include_completed: false,
                context: mockContext,
            });

            expect(result.total_count).toBe(1);
            expect(result.active_count).toBe(1);
            expect(result.completed_count).toBe(0);
            expect(result.failed_count).toBe(0);
            expect(result.include_completed).toBe(false);
        });
    });

    describe('empty results', () => {
        it('should handle no agents gracefully', async () => {
            mockContext.agentManager.listAllAgents.mockReturnValue([]);

            const result = await get_agents({
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.agents).toHaveLength(0);
            expect(result.total_count).toBe(0);
            expect(result.active_count).toBe(0);
            expect(result.completed_count).toBe(0);
            expect(result.failed_count).toBe(0);
            expect(result.message).toBe('Found 0 agents');
        });
    });

    describe('error handling', () => {
        it('should handle AgentManager errors', async () => {
            mockContext.agentManager.listAllAgents.mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            const result = await get_agents({
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Database connection failed');
        });

        it('should include error context in failure response', async () => {
            mockContext.agentManager.listAllAgents.mockImplementation(() => {
                throw new Error('Test error');
            });

            const result = await get_agents({
                include_completed: false,
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.include_completed).toBe(false);
        });
    });

    describe('context handling', () => {
        it('should work regardless of currentAgentId', async () => {
            const contextWithoutAgentId = {
                agentManager: mockContext.agentManager,
                // currentAgentId is missing - but get_agents should work regardless
            };

            await get_agents({
                context: contextWithoutAgentId,
            });

            expect(mockContext.agentManager.listAllAgents).toHaveBeenCalledWith({
                include_completed: true,
            });
        });

        it('should handle missing agentManager', async () => {
            const contextWithoutManager = {
                currentRole: 'agentic_coder',
                // agentManager is missing
            };

            const result = await get_agents({
                context: contextWithoutManager,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('AgentManager not available');
        });
    });

    describe('response format', () => {
        it('should include standard response fields', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name', 'get_agents');
        });

        it('should include agents-specific response fields', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            expect(result).toHaveProperty('agents');
            expect(result).toHaveProperty('total_count');
            expect(result).toHaveProperty('active_count');
            expect(result).toHaveProperty('completed_count');
            expect(result).toHaveProperty('failed_count');
            expect(result).toHaveProperty('include_completed');
            expect(result).toHaveProperty('message');
        });

        it('should format agent objects correctly', async () => {
            const result = await get_agents({
                context: mockContext,
            });

            const agent = result.agents[0];
            expect(agent).toHaveProperty('agent_id');
            expect(agent).toHaveProperty('role_name');
            expect(agent).toHaveProperty('status');
            expect(agent).toHaveProperty('created_at');
            expect(agent).toHaveProperty('task_prompt');
            expect(agent).toHaveProperty('has_result');
            expect(agent).toHaveProperty('parent_id');
        });
    });
});
