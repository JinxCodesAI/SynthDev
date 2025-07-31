import { describe, it, expect, beforeEach, vi } from 'vitest';
import AgentProcess from '../../src/agents/AgentProcess.js';
import AIAPIClient from '../../src/core/ai/aiAPIClient.js';
import SystemMessages from '../../src/core/ai/systemMessages.js';
import ConfigManager from '../../src/config/managers/configManager.js';

// Mock dependencies
vi.mock('../../src/core/ai/aiAPIClient.js');
vi.mock('../../src/core/ai/systemMessages.js');
vi.mock('../../src/config/managers/configManager.js');
vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

describe('AgentProcess', () => {
    let agentProcess;
    let mockCostsManager;
    let mockToolManager;
    let mockAPIClient;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        mockCostsManager = { trackCost: vi.fn() };
        mockToolManager = { getTools: vi.fn() };

        // Mock AIAPIClient
        mockAPIClient = {
            setSystemMessage: vi.fn(),
            setTools: vi.fn(),
            addMessage: vi.fn(),
            addUserMessage: vi.fn(),
            sendMessage: vi.fn().mockResolvedValue('Mock AI response'),
            messages: [],
        };
        AIAPIClient.mockImplementation(() => mockAPIClient);

        // Mock SystemMessages
        SystemMessages.getLevel.mockReturnValue('base');
        SystemMessages.getSystemMessage.mockReturnValue('Mock system message for test_writer');

        // Mock ConfigManager
        const mockConfigManager = {
            getModel: vi.fn(level => {
                const configs = {
                    base: {
                        apiKey: 'mock-api-key',
                        baseUrl: 'https://mock-api.com',
                        model: 'gpt-4.1-mini',
                        baseModel: 'gpt-4.1-mini',
                    },
                    smart: {
                        apiKey: 'mock-api-key',
                        baseUrl: 'https://mock-api.com',
                        model: 'smart',
                        baseModel: 'smart',
                    },
                    fast: {
                        apiKey: 'mock-api-key',
                        baseUrl: 'https://mock-api.com',
                        model: 'fast',
                        baseModel: 'fast',
                    },
                };
                return configs[level] || configs.base;
            }),
        };
        ConfigManager.getInstance = vi.fn(() => mockConfigManager);

        agentProcess = new AgentProcess(
            'agent-1',
            'test_writer',
            'Write comprehensive tests',
            'parent-123',
            mockCostsManager,
            mockToolManager
        );
    });

    describe('initialization', () => {
        it('should create agent with proper properties', () => {
            expect(agentProcess.agentId).toBeDefined();
            expect(agentProcess.roleName).toBe('test_writer');
            expect(agentProcess.taskPrompt).toBe('Write comprehensive tests');
            expect(agentProcess.parentId).toBe('parent-123');
            expect(agentProcess.status).toBe('running');
            expect(agentProcess.createdAt).toBeInstanceOf(Date);
            expect(agentProcess.result).toBeNull();
        });

        it('should initialize AIAPIClient with correct parameters', () => {
            expect(AIAPIClient).toHaveBeenCalledWith(
                mockCostsManager,
                'mock-api-key',
                'https://mock-api.com',
                'gpt-4.1-mini'
            );
        });

        it('should get role level from SystemMessages', () => {
            expect(SystemMessages.getLevel).toHaveBeenCalledWith('test_writer');
        });

        it('should use ConfigManager to get model configuration', () => {
            expect(ConfigManager.getInstance).toHaveBeenCalled();
            const mockConfigManager = ConfigManager.getInstance();
            expect(mockConfigManager.getModel).toHaveBeenCalledWith('base');
        });

        it('should set system message and initial task', () => {
            expect(SystemMessages.getSystemMessage).toHaveBeenCalledWith('test_writer');
            expect(mockAPIClient.setSystemMessage).toHaveBeenCalledWith(
                'Mock system message for test_writer',
                'test_writer'
            );
            expect(mockAPIClient.addMessage).toHaveBeenCalledWith({
                role: 'user',
                content: 'Write comprehensive tests',
            });
        });

        it('should set tools from toolManager', () => {
            const mockTools = [{ name: 'tool1' }, { name: 'tool2' }];
            mockToolManager.getTools.mockReturnValue(mockTools);

            new AgentProcess(
                'agent-test',
                'test_writer',
                'Write comprehensive tests',
                'parent-123',
                mockCostsManager,
                mockToolManager
            );

            expect(mockAPIClient.setTools).toHaveBeenCalledWith(mockTools);
        });
    });

    describe('addMessage', () => {
        it('should add message to API client', () => {
            const message = { role: 'user', content: 'Additional instruction' };

            agentProcess.addMessage(message);

            expect(mockAPIClient.addMessage).toHaveBeenCalledWith(message);
        });
    });

    describe('execute', () => {
        it('should call API client sendMessage and return response', async () => {
            const response = await agentProcess.execute();

            expect(mockAPIClient.sendMessage).toHaveBeenCalled();
            expect(response).toBe('Mock AI response');
        });

        it('should handle API client errors', async () => {
            const error = new Error('API Error');
            mockAPIClient.sendMessage.mockRejectedValue(error);

            await expect(agentProcess.execute()).rejects.toThrow('API Error');
            expect(agentProcess.status).toBe('failed');
            expect(agentProcess.result.status).toBe('failure');
            expect(agentProcess.result.error).toBe('API Error');
        });
    });

    describe('getStatus', () => {
        it('should return complete status information', () => {
            const status = agentProcess.getStatus();

            expect(status).toEqual({
                agentId: agentProcess.agentId,
                roleName: 'test_writer',
                status: 'running',
                createdAt: agentProcess.createdAt,
                parentId: 'parent-123',
                taskPrompt: 'Write comprehensive tests',
                result: null,
            });
        });

        it('should include result when available', () => {
            const result = { status: 'success', summary: 'Tests completed' };
            agentProcess.markCompleted(result);

            const status = agentProcess.getStatus();

            expect(status.result).toEqual(result);
            expect(status.status).toBe('completed');
        });
    });

    describe('markCompleted', () => {
        it('should mark agent as completed with result', () => {
            const result = {
                status: 'success',
                summary: 'Task completed successfully',
                artifacts: [],
                known_issues: [],
            };

            agentProcess.markCompleted(result);

            expect(agentProcess.status).toBe('completed');
            expect(agentProcess.result).toEqual(result);
        });
    });

    describe('markFailed', () => {
        it('should mark agent as failed with error details', () => {
            const error = new Error('Something went wrong');
            error.stack = 'Error stack trace';

            agentProcess.markFailed(error);

            expect(agentProcess.status).toBe('failed');
            expect(agentProcess.result).toEqual({
                status: 'failure',
                error: 'Something went wrong',
                stack: 'Error stack trace',
            });
        });
    });

    describe('markInactive', () => {
        it('should mark agent as inactive', () => {
            agentProcess.markInactive();

            expect(agentProcess.status).toBe('inactive');
        });
    });

    describe('role-specific model selection', () => {
        it('should use smart level for smart roles', () => {
            SystemMessages.getLevel.mockReturnValue('smart');

            const smartAgent = new AgentProcess(
                'agent-2',
                'smart_role',
                'Complex task',
                'parent',
                mockCostsManager,
                mockToolManager
            );

            expect(AIAPIClient).toHaveBeenLastCalledWith(
                mockCostsManager,
                'mock-api-key',
                'https://mock-api.com',
                'smart'
            );
        });

        it('should use fast level for fast roles', () => {
            SystemMessages.getLevel.mockReturnValue('fast');

            const fastAgent = new AgentProcess(
                'agent-3',
                'fast_role',
                'Quick task',
                'parent',
                mockCostsManager,
                mockToolManager
            );

            expect(AIAPIClient).toHaveBeenLastCalledWith(
                mockCostsManager,
                'mock-api-key',
                'https://mock-api.com',
                'fast'
            );
        });
    });

    describe('simple agent IDs', () => {
        it('should use provided simple IDs for different agents', () => {
            const agent1 = new AgentProcess(
                'agent-4',
                'role1',
                'task1',
                'parent',
                mockCostsManager,
                mockToolManager
            );
            const agent2 = new AgentProcess(
                'agent-5',
                'role2',
                'task2',
                'parent',
                mockCostsManager,
                mockToolManager
            );

            expect(agent1.agentId).not.toBe(agent2.agentId);
            expect(agent1.agentId).toBe('agent-4'); // Simple ID format
            expect(agent2.agentId).toBe('agent-5'); // Simple ID format
        });
    });
});
