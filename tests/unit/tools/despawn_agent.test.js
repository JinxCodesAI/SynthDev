import { describe, it, expect, beforeEach, vi } from 'vitest';
import despawnAgent from '../../../src/tools/despawn_agent/implementation.js';

// Mock the BaseTool
vi.mock('../../../src/tools/common/base-tool.js', () => ({
    BaseTool: vi.fn().mockImplementation(() => ({
        validateRequiredParams: vi.fn(),
        validateParameterTypes: vi.fn(),
        createSuccessResponse: vi.fn(data => ({
            success: true,
            timestamp: new Date().toISOString(),
            tool_name: 'despawn_agent',
            ...data,
        })),
        createErrorResponse: vi.fn(error => ({
            success: false,
            timestamp: new Date().toISOString(),
            tool_name: 'despawn_agent',
            error,
        })),
        logger: {
            info: vi.fn(),
        },
    })),
}));

describe('despawn_agent tool', () => {
    let mockAgentManager;
    let mockCostsManager;
    let mockParams;

    beforeEach(() => {
        mockAgentManager = {
            getAgentInfo: vi.fn(),
            despawnAgent: vi.fn(),
        };

        mockCostsManager = {
            sessionId: 'test-session',
            app: {
                agentManager: mockAgentManager,
            },
        };

        mockParams = {
            agent_id: 'agent-123',
            reason: 'Task completed',
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

            const result = await despawnAgent({});

            expect(mockTool.validateRequiredParams).toHaveBeenCalledWith({}, ['agent_id']);
            expect(result.error).toBe('Missing required parameter');
        });

        it('should validate parameter types', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue({ error: 'Invalid parameter type' });

            const result = await despawnAgent(mockParams);

            expect(mockTool.validateParameterTypes).toHaveBeenCalledWith(mockParams, {
                agent_id: 'string',
                reason: 'string',
            });
            expect(result.error).toBe('Invalid parameter type');
        });

        it('should reject empty agent ID', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const params = { ...mockParams, agent_id: '   ' };
            const result = await despawnAgent(params);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith('Agent ID cannot be empty');
        });

        it('should use default reason when not provided', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const agentInfo = {
                agentId: 'agent-123',
                agentRole: 'coder',
                parentAgentId: 'test-session',
            };

            const despawnResult = {
                success: true,
                agentId: 'agent-123',
                agentRole: 'coder',
                despawnedAt: '2024-01-01T00:00:00.000Z',
            };

            mockAgentManager.getAgentInfo.mockReturnValue(agentInfo);
            mockAgentManager.despawnAgent.mockResolvedValue(despawnResult);

            const params = { ...mockParams };
            delete params.reason; // Remove reason to test default

            await despawnAgent(params);

            expect(mockTool.createSuccessResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'Task completed', // Default reason
                })
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
            const result = await despawnAgent(params);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Agent management system not available. This feature requires the AgentManager to be initialized.'
            );
        });

        it('should return error when agent does not exist', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            mockAgentManager.getAgentInfo.mockReturnValue(null);

            const result = await despawnAgent(mockParams);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith('Agent agent-123 not found');
        });

        it('should successfully despawn agent when all conditions are met', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const agentInfo = {
                agentId: 'agent-123',
                agentRole: 'coder',
                parentAgentId: 'test-session',
            };

            const despawnResult = {
                success: true,
                agentId: 'agent-123',
                agentRole: 'coder',
                despawnedAt: '2024-01-01T00:00:00.000Z',
            };

            mockAgentManager.getAgentInfo.mockReturnValue(agentInfo);
            mockAgentManager.despawnAgent.mockResolvedValue(despawnResult);

            const result = await despawnAgent(mockParams);

            expect(mockAgentManager.despawnAgent).toHaveBeenCalledWith('agent-123', 'test-session');

            expect(mockTool.createSuccessResponse).toHaveBeenCalledWith({
                agent_id: 'agent-123',
                agent_role: 'coder',
                despawned_at: '2024-01-01T00:00:00.000Z',
                reason: 'Task completed',
                parent_agent_id: 'test-session',
                message:
                    'Successfully despawned coder agent agent-123. All associated resources have been cleaned up.',
            });
        });

        it('should handle agent manager despawn failure', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const agentInfo = {
                agentId: 'agent-123',
                agentRole: 'coder',
                parentAgentId: 'test-session',
            };

            const despawnResult = {
                success: false,
                error: 'Access denied: Agent can only be despawned by its parent',
            };

            mockAgentManager.getAgentInfo.mockReturnValue(agentInfo);
            mockAgentManager.despawnAgent.mockResolvedValue(despawnResult);

            const result = await despawnAgent(mockParams);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Access denied: Agent can only be despawned by its parent'
            );
        });

        it('should handle unexpected errors', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const agentInfo = {
                agentId: 'agent-123',
                agentRole: 'coder',
                parentAgentId: 'test-session',
            };

            mockAgentManager.getAgentInfo.mockReturnValue(agentInfo);
            mockAgentManager.despawnAgent.mockRejectedValue(new Error('Unexpected error'));

            const result = await despawnAgent(mockParams);

            expect(mockTool.createErrorResponse).toHaveBeenCalledWith(
                'Failed to despawn agent: Unexpected error'
            );
        });
    });

    describe('default session handling', () => {
        it('should use default session when costsManager has no sessionId', async () => {
            const { BaseTool } = await import('../../../src/tools/common/base-tool.js');
            const mockTool = new BaseTool();
            mockTool.validateRequiredParams.mockReturnValue(null);
            mockTool.validateParameterTypes.mockReturnValue(null);

            const agentInfo = {
                agentId: 'agent-123',
                agentRole: 'coder',
                parentAgentId: 'main-session',
            };

            const despawnResult = {
                success: true,
                agentId: 'agent-123',
                agentRole: 'coder',
                despawnedAt: '2024-01-01T00:00:00.000Z',
            };

            mockAgentManager.getAgentInfo.mockReturnValue(agentInfo);
            mockAgentManager.despawnAgent.mockResolvedValue(despawnResult);

            const params = {
                ...mockParams,
                costsManager: {
                    app: { agentManager: mockAgentManager },
                    // No sessionId
                },
            };

            await despawnAgent(params);

            expect(mockAgentManager.despawnAgent).toHaveBeenCalledWith('agent-123', 'main-session');
        });
    });
});
