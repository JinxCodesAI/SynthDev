import { describe, it, expect, beforeEach, vi } from 'vitest';
import spawn_agent from '../../../src/tools/spawn_agent/implementation.js';

describe('spawn_agent tool', () => {
    let mockContext;

    beforeEach(() => {
        mockContext = {
            agentManager: {
                spawnAgent: vi.fn().mockResolvedValue({
                    agentId: 'agent-123',
                    status: 'running',
                    createdAt: new Date(),
                }),
            },
            currentRole: 'agentic_coder',
        };
    });

    describe('parameter validation', () => {
        it('should return error for missing role_name', async () => {
            const result = await spawn_agent({
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('role_name');
        });

        it('should return error for missing task_prompt', async () => {
            const result = await spawn_agent({
                role_name: 'test_writer',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('task_prompt');
        });

        it('should return error for invalid parameter types', async () => {
            const result = await spawn_agent({
                role_name: 123, // Wrong type
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('type');
        });
    });

    describe('successful execution', () => {
        it('should spawn agent successfully', async () => {
            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write comprehensive tests',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.agent_id).toBe('agent-123');
            expect(result.status).toBe('running');
            expect(result.role_name).toBe('test_writer');
            expect(result.message).toContain('Successfully spawned');
            expect(mockContext.agentManager.spawnAgent).toHaveBeenCalledWith(
                'agentic_coder',
                'test_writer',
                'Write comprehensive tests',
                mockContext
            );
        });

        it('should include creation timestamp', async () => {
            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.created_at).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle permission errors', async () => {
            mockContext.agentManager.spawnAgent.mockRejectedValue(
                new Error("Role 'basic_role' is not authorized to spawn 'test_writer' agents")
            );

            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not authorized');
        });

        it('should handle AgentManager errors', async () => {
            mockContext.agentManager.spawnAgent.mockRejectedValue(new Error('Unknown role'));

            const result = await spawn_agent({
                role_name: 'unknown_role',
                task_prompt: 'Do something',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown role');
        });

        it('should include error context in failure response', async () => {
            mockContext.agentManager.spawnAgent.mockRejectedValue(new Error('Test error'));

            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.role_name).toBe('test_writer');
            expect(result.task_prompt).toBe('Write tests');
            expect(result.error).toContain('Test error');
        });
    });

    describe('context handling', () => {
        it('should use unknown role when currentRole is missing', async () => {
            const contextWithoutRole = {
                agentManager: mockContext.agentManager,
                // currentRole is missing
            };

            await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: contextWithoutRole,
            });

            expect(mockContext.agentManager.spawnAgent).toHaveBeenCalledWith(
                'unknown',
                'test_writer',
                'Write tests',
                contextWithoutRole
            );
        });

        it('should handle missing agentManager', async () => {
            const contextWithoutManager = {
                currentRole: 'agentic_coder',
                // agentManager is missing
            };

            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: contextWithoutManager,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('AgentManager not available');
        });
    });

    describe('response format', () => {
        it('should include standard response fields', async () => {
            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name', 'spawn_agent');
        });

        it('should include agent-specific response fields', async () => {
            const result = await spawn_agent({
                role_name: 'test_writer',
                task_prompt: 'Write tests',
                context: mockContext,
            });

            expect(result).toHaveProperty('agent_id');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('role_name');
            expect(result).toHaveProperty('created_at');
            expect(result).toHaveProperty('message');
        });
    });
});
