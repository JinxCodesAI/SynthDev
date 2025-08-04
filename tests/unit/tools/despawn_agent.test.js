import { describe, it, expect, beforeEach, vi } from 'vitest';
import despawn_agent from '../../../src/tools/despawn_agent/implementation.js';

describe('despawn_agent tool', () => {
    let mockContext;
    let mockAgentManager;

    beforeEach(() => {
        vi.clearAllMocks();

        mockAgentManager = {
            despawnAgent: vi.fn(),
        };

        mockContext = {
            currentAgentId: 'agent-1',
            agentManager: mockAgentManager,
        };

        // Set up context for tool execution
        // The tool will access context through the BaseTool.execute method
    });

    describe('parameter validation', () => {
        it('should return error for missing agent_id parameter', async () => {
            const result = await despawn_agent({
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('agent_id');
            expect(result.error).toContain('Required parameter missing');
        });

        it('should return error for invalid agent_id type', async () => {
            const result = await despawn_agent({
                agent_id: 123, // Should be string
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('type');
        });

        it('should accept valid parameters', async () => {
            mockAgentManager.despawnAgent.mockResolvedValue({
                success: true,
                agent_id: 'agent-2',
                role_name: 'test_writer',
                status: 'completed',
                despawned_at: '2024-01-01T00:00:00.000Z',
                message: 'Successfully despawned agent agent-2 (test_writer)',
            });

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(mockAgentManager.despawnAgent).toHaveBeenCalledWith('agent-1', 'agent-2');
        });
    });

    describe('successful execution', () => {
        it('should despawn agent successfully with valid parameters', async () => {
            const mockResult = {
                success: true,
                agent_id: 'agent-2',
                role_name: 'test_writer',
                status: 'completed',
                despawned_at: '2024-01-01T00:00:00.000Z',
                message: 'Successfully despawned agent agent-2 (test_writer)',
            };

            mockAgentManager.despawnAgent.mockResolvedValue(mockResult);

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('despawn_agent');
            expect(result.timestamp).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.agent_id).toBe('agent-2');
            expect(result.role_name).toBe('test_writer');
            expect(result.status).toBe('completed');
            expect(result.despawned_at).toBe('2024-01-01T00:00:00.000Z');
            expect(result.message).toContain('Successfully despawned');
        });

        it('should pass correct supervisor agent ID to AgentManager', async () => {
            mockAgentManager.despawnAgent.mockResolvedValue({
                success: true,
                agent_id: 'agent-2',
                role_name: 'test_writer',
                status: 'completed',
                despawned_at: '2024-01-01T00:00:00.000Z',
                message: 'Successfully despawned agent agent-2 (test_writer)',
            });

            await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(mockAgentManager.despawnAgent).toHaveBeenCalledWith('agent-1', 'agent-2');
        });

        it('should handle user context (null currentAgentId)', async () => {
            mockContext.currentAgentId = null; // User context

            mockAgentManager.despawnAgent.mockResolvedValue({
                success: true,
                agent_id: 'agent-1',
                role_name: 'pm',
                status: 'completed',
                despawned_at: '2024-01-01T00:00:00.000Z',
                message: 'Successfully despawned agent agent-1 (pm)',
            });

            const result = await despawn_agent({
                agent_id: 'agent-1',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(mockAgentManager.despawnAgent).toHaveBeenCalledWith(null, 'agent-1');
        });
    });

    describe('error handling', () => {
        it('should handle missing AgentManager in context', async () => {
            mockContext.agentManager = null;

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('AgentManager not available');
        });

        it('should handle agent not found error', async () => {
            mockAgentManager.despawnAgent.mockRejectedValue(new Error('Agent agent-2 not found'));

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Agent agent-2 not found');
            expect(result.agent_id).toBe('agent-2');
        });

        it('should handle permission denied error', async () => {
            mockAgentManager.despawnAgent.mockRejectedValue(
                new Error('Permission denied: Agent agent-1 is not the parent of agent agent-2')
            );

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
            expect(result.error).toContain('not the parent');
        });

        it('should handle invalid status error', async () => {
            mockAgentManager.despawnAgent.mockRejectedValue(
                new Error("Cannot despawn agent agent-2 with status 'running'")
            );

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot despawn');
            expect(result.error).toContain('running');
        });

        it('should handle active children error', async () => {
            mockAgentManager.despawnAgent.mockRejectedValue(
                new Error(
                    'Cannot despawn agent agent-2 because it has active children: agent-3, agent-4'
                )
            );

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('active children');
            expect(result.error).toContain('agent-3, agent-4');
        });

        it('should include stack trace in error response', async () => {
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test';
            mockAgentManager.despawnAgent.mockRejectedValue(error);

            const result = await despawn_agent({
                agent_id: 'agent-2',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Test error');
        });
    });
});
