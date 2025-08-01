import { describe, it, expect, beforeEach, vi } from 'vitest';
import speak_to_agent from '../../../src/tools/speak_to_agent/implementation.js';

describe('speak_to_agent tool', () => {
    let mockContext;

    beforeEach(() => {
        mockContext = {
            agentManager: {
                getAgentStatus: vi.fn(),
                sendMessageToAgent: vi.fn().mockResolvedValue({
                    message_sent: true,
                    agent_id: 'agent-123',
                    status: 'running',
                    message:
                        'Message has been sent, response will be sent in future message. If response blocks your progress wait, otherwise continue operation.',
                }),
            },
        };
    });

    describe('parameter validation', () => {
        it('should return error for missing agent_id', async () => {
            const result = await speak_to_agent({
                message: 'Test message',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('agent_id');
        });

        it('should return error for missing message', async () => {
            const result = await speak_to_agent({
                agent_id: 'agent-123',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('message');
        });

        it('should return error for invalid parameter types', async () => {
            const result = await speak_to_agent({
                agent_id: 123, // Wrong type
                message: 'Test message',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('type');
        });
    });

    describe('successful execution', () => {
        beforeEach(() => {
            mockContext.agentManager.getAgentStatus.mockReturnValue({
                agentId: 'agent-123',
                status: 'running',
                roleName: 'test_writer',
            });
        });

        it('should send message to agent successfully', async () => {
            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Please focus on edge cases',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.agent_id).toBe('agent-123');
            expect(result.message_sent).toBe(true);
            expect(result.agent_status).toBe('running');
            expect(result.timestamp).toBeDefined();
            expect(result.message).toContain('Message has been sent');

            expect(mockContext.agentManager.getAgentStatus).toHaveBeenCalledWith('agent-123');
            expect(mockContext.agentManager.sendMessageToAgent).toHaveBeenCalledWith(
                'agent-123',
                'speak_to_agent call from user to agent-123 with message: Please focus on edge cases '
            );
        });

        it('should work with completed agents', async () => {
            mockContext.agentManager.getAgentStatus.mockReturnValue({
                agentId: 'agent-123',
                status: 'completed',
                roleName: 'test_writer',
            });

            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Can you add more tests?',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.message_sent).toBe(true);
        });

        it('should work with inactive agents', async () => {
            mockContext.agentManager.getAgentStatus.mockReturnValue({
                agentId: 'agent-123',
                status: 'inactive',
                roleName: 'test_writer',
            });

            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Continue with your task',
                context: mockContext,
            });

            expect(result.success).toBe(true);
            expect(result.message_sent).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle non-existent agent', async () => {
            mockContext.agentManager.getAgentStatus.mockReturnValue(null);

            const result = await speak_to_agent({
                agent_id: 'non-existent',
                message: 'Test message',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should handle failed agents', async () => {
            mockContext.agentManager.getAgentStatus.mockReturnValue({
                agentId: 'agent-123',
                status: 'failed',
                roleName: 'test_writer',
            });

            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Test message',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('has failed and cannot process messages');
        });

        it('should handle AgentManager errors', async () => {
            mockContext.agentManager.getAgentStatus.mockReturnValue({
                agentId: 'agent-123',
                status: 'running',
            });
            mockContext.agentManager.sendMessageToAgent.mockRejectedValue(
                new Error('Communication error')
            );

            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Test message',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Communication error');
        });

        it('should include error context in failure response', async () => {
            mockContext.agentManager.getAgentStatus.mockReturnValue(null);

            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Test message',
                context: mockContext,
            });

            expect(result.success).toBe(false);
            expect(result.agent_id).toBe('agent-123');
            expect(result.message).toBe('Test message');
        });
    });

    describe('context handling', () => {
        it('should handle missing agentManager', async () => {
            const contextWithoutManager = {
                // agentManager is missing
            };

            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Test message',
                context: contextWithoutManager,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('AgentManager not available');
        });
    });

    describe('response format', () => {
        beforeEach(() => {
            mockContext.agentManager.getAgentStatus.mockReturnValue({
                agentId: 'agent-123',
                status: 'running',
            });
        });

        it('should include standard response fields', async () => {
            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Test message',
                context: mockContext,
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name', 'speak_to_agent');
        });

        it('should include communication-specific response fields', async () => {
            const result = await speak_to_agent({
                agent_id: 'agent-123',
                message: 'Test message',
                context: mockContext,
            });

            expect(result).toHaveProperty('agent_id');
            expect(result).toHaveProperty('message_sent');
            expect(result).toHaveProperty('agent_status');
            expect(result).toHaveProperty('message');
        });
    });
});
