import { describe, it, expect, beforeEach, vi } from 'vitest';
import spawnAgent from '../../../src/tools/spawn_agent/implementation.js';

// Mock the BaseTool
vi.mock('../../../src/tools/common/base-tool.js', () => ({
    BaseTool: vi.fn().mockImplementation(() => ({
        validateRequiredParams: vi.fn(),
        validateParameterTypes: vi.fn(),
        createSuccessResponse: vi.fn(data => ({
            success: true,
            timestamp: new Date().toISOString(),
            tool_name: 'spawn_agent',
            ...data,
        })),
        createErrorResponse: vi.fn(error => ({
            success: false,
            timestamp: new Date().toISOString(),
            tool_name: 'spawn_agent',
            error,
        })),
        logger: {
            info: vi.fn(),
        },
    })),
}));

describe('spawn_agent tool', () => {
    let mockAgentManager;
    let mockCostsManager;
    let mockParams;

    beforeEach(() => {
        mockAgentManager = {
            spawnAgent: vi.fn(),
        };

        mockCostsManager = {
            sessionId: 'test-session',
            app: {
                agentManager: mockAgentManager,
            },
        };

        mockParams = {
            agent_role: 'coder',
            task_description: 'Write unit tests',
            costsManager: mockCostsManager,
        };

        // Reset all mocks
        vi.clearAllMocks();
    });

    describe('parameter validation', () => {
        it('should validate required parameters', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue({
                error: 'Missing required parameter',
            });

            const result = await spawnAgent({});

            expect(mockTool.validateRequiredParams).toHaveBeenCalledWith({}, [
                'agent_role',
                'task_description',
            ]);
            expect(result.error).toBe('Missing required parameter');
        });

        it('should validate parameter types', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue({ error: 'Invalid parameter type' });

            const result = await spawnAgent(mockParams);

            expect(mockTool.validateParameterTypes).toHaveBeenCalledWith(mockParams, {
                agent_role: 'string',
                task_description: 'string',
                context_name: 'string',
            });
            expect(result.error).toBe('Invalid parameter type');
        });

        it('should reject empty agent role', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const params = { ...mockParams, agent_role: '   ' };
            const result = await spawnAgent(params);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith('Agent role cannot be empty');
        });

        it('should reject empty task description', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const params = { ...mockParams, task_description: '   ' };
            const result = await spawnAgent(params);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Task description cannot be empty'
            );
        });
    });

    describe('agent manager integration', () => {
        it('should return error when agent manager is not available', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const params = { ...mockParams, costsManager: { sessionId: 'test' } }; // No app/agentManager
            const result = await spawnAgent(params);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Agent management system not available. This feature requires the AgentManager to be initialized.'
            );
        });

        it('should successfully spawn agent when all conditions are met', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const spawnResult = {
                success: true,
                agentId: 'agent-123',
                agentRole: 'coder',
                contextName: 'agent-123-context',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            mockAgentManager.spawnAgent.mockResolvedValue(spawnResult);

            const result = await spawnAgent(mockParams);

            expect(mockAgentManager.spawnAgent).toHaveBeenCalledWith(
                'coder',
                'test-session',
                undefined
            );

            expect(mockTool.createSuccessResponse).toHaveBeenCalledWith({
                agent_id: 'agent-123',
                agent_role: 'coder',
                context_name: 'agent-123-context',
                created_at: '2024-01-01T00:00:00.000Z',
                task_description: 'Write unit tests',
                parent_agent_id: 'test-session',
                message:
                    'Successfully spawned coder agent with ID agent-123. Use speak_to_agent tool to communicate with it, or despawn_agent tool to remove it when the task is complete.',
            });
        });

        it('should pass custom context name when provided', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const spawnResult = {
                success: true,
                agentId: 'agent-123',
                agentRole: 'coder',
                contextName: 'custom-context',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            mockAgentManager.spawnAgent.mockResolvedValue(spawnResult);

            const params = { ...mockParams, context_name: 'custom-context' };
            await spawnAgent(params);

            expect(mockAgentManager.spawnAgent).toHaveBeenCalledWith(
                'coder',
                'test-session',
                'custom-context'
            );
        });

        it('should handle agent manager spawn failure', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const spawnResult = {
                success: false,
                error: 'Unknown agent role: invalid-role',
            };

            mockAgentManager.spawnAgent.mockResolvedValue(spawnResult);

            const result = await spawnAgent(mockParams);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Unknown agent role: invalid-role'
            );
        });

        it('should handle unexpected errors', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            mockAgentManager.spawnAgent.mockRejectedValue(new Error('Unexpected error'));

            const result = await spawnAgent(mockParams);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Failed to spawn agent: Unexpected error'
            );
        });
    });

    describe('default session handling', () => {
        it('should use default session when costsManager has no sessionId', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const spawnResult = {
                success: true,
                agentId: 'agent-123',
                agentRole: 'coder',
                contextName: 'agent-123-context',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            mockAgentManager.spawnAgent.mockResolvedValue(spawnResult);

            const params = {
                ...mockParams,
                costsManager: {
                    app: { agentManager: mockAgentManager },
                    // No sessionId
                },
            };

            await spawnAgent(params);

            expect(mockAgentManager.spawnAgent).toHaveBeenCalledWith(
                'coder',
                'main-session', // Default session
                undefined
            );
        });
    });
});
