import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkflowAgent from '../../../workflow/WorkflowAgent.js';
import AIAPIClient from '../../../aiAPIClient.js';
import ConfigManager from '../../../configManager.js';

// Mock dependencies
vi.mock('../../../aiAPIClient.js');
vi.mock('../../../configManager.js');
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

// Mock SystemMessages
vi.mock('../../../core/systemMessages.js', () => ({
    default: {
        getLevel: vi.fn().mockReturnValue('default'),
    },
}));

describe('WorkflowAgent', () => {
    let workflowAgent;
    let mockContext;
    let mockAIAPIClient;
    let mockConfigManager;
    let mockToolManager;
    let mockSnapshotManager;
    let mockCostsManager;

    // Helper function to create WorkflowAgent with all required dependencies
    const createWorkflowAgent = agentConfig => {
        return new WorkflowAgent(
            agentConfig,
            mockContext,
            mockConfigManager,
            mockToolManager,
            mockSnapshotManager,
            mockCostsManager
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock context
        mockContext = {
            addMessage: vi.fn(),
            getMessages: vi.fn().mockReturnValue([]),
            getMessagesForAgent: vi.fn().mockReturnValue([]),
            clearMessages: vi.fn(),
            addAgent: vi.fn(),
            getName: vi.fn().mockReturnValue('test_context'),
        };

        // Mock AIAPIClient
        mockAIAPIClient = {
            setCallbacks: vi.fn(),
            sendUserMessage: vi.fn().mockResolvedValue('AI response'),
            getModel: vi.fn().mockReturnValue('gpt-4'),
            getToolCalls: vi.fn().mockReturnValue([]),
            getParsingToolCalls: vi.fn().mockReturnValue([]),
            setTools: vi.fn(),
            setSystemMessage: vi.fn().mockResolvedValue(),
            getFilteredToolCount: vi.fn().mockReturnValue(5),
            getTotalToolCount: vi.fn().mockReturnValue(10),
            clearConversation: vi.fn().mockResolvedValue(),
            messages: [],
        };
        vi.mocked(AIAPIClient).mockImplementation(() => mockAIAPIClient);

        // Mock ConfigManager
        mockConfigManager = {
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-4',
            }),
        };
        vi.mocked(ConfigManager.getInstance).mockReturnValue(mockConfigManager);

        // Mock additional dependencies
        mockToolManager = {
            getTools: vi.fn().mockReturnValue([]),
        };
        mockSnapshotManager = {};
        mockCostsManager = {};
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with agent configuration and context', async () => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
                model: 'gpt-4',
                system_message: 'You are a test agent',
            };

            workflowAgent = createWorkflowAgent(agentConfig);

            expect(workflowAgent.agentRole).toBe('customer');
            expect(workflowAgent.context).toBe(mockContext);
            expect(workflowAgent.lastParsingToolCall).toBeNull();
            expect(workflowAgent.lastResponseContent).toBeNull();
            expect(workflowAgent.lastRawResponse).toBeNull();
        });

        it('should set up AI client callbacks', async () => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };

            workflowAgent = createWorkflowAgent(agentConfig);

            // Wait a bit for the async _initializeAgent to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            // Check that setCallbacks was called (it's called during _initializeAgent)
            expect(mockAIAPIClient.setCallbacks).toHaveBeenCalled();

            // Verify the callback structure
            const callbacksArg = mockAIAPIClient.setCallbacks.mock.calls[0][0];
            expect(callbacksArg).toHaveProperty('onMessagePush');
            expect(callbacksArg).toHaveProperty('onResponse');
            expect(typeof callbacksArg.onMessagePush).toBe('function');
            expect(typeof callbacksArg.onResponse).toBe('function');
        });
    });

    describe('sendMessage', () => {
        beforeEach(() => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };
            workflowAgent = createWorkflowAgent(agentConfig);
        });

        it('should send message and return response', async () => {
            const message = 'Test message';
            const expectedResponse = 'AI response';

            // Mock the sendUserMessage to trigger the response callback
            mockAIAPIClient.sendUserMessage.mockImplementation(async () => {
                // Simulate the response callback being called
                const response = {
                    choices: [{ message: { content: expectedResponse } }],
                };
                workflowAgent._onResponse(response, 'customer');
            });

            const result = await workflowAgent.sendMessage(message);

            expect(mockAIAPIClient.sendUserMessage).toHaveBeenCalledWith(message);
            expect(result).toBe(expectedResponse);
        });

        it('should handle message sending errors', async () => {
            const message = 'Test message';
            const error = new Error('API error');

            mockAIAPIClient.sendUserMessage.mockRejectedValue(error);

            await expect(workflowAgent.sendMessage(message)).rejects.toThrow('API error');
        });
    });

    describe('tool call handling', () => {
        beforeEach(() => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };
            workflowAgent = createWorkflowAgent(agentConfig);
        });

        it('should get tool calls from context messages', () => {
            const toolCalls = [{ function: { name: 'test_tool' } }];
            mockContext.getMessages.mockReturnValue([
                { role: 'assistant', content: 'Response', tool_calls: toolCalls },
            ]);

            const result = workflowAgent.getToolCalls();

            expect(result).toEqual(toolCalls);
        });

        it('should return empty array when no tool calls', () => {
            mockContext.getMessages.mockReturnValue([{ role: 'assistant', content: 'Response' }]);

            const result = workflowAgent.getToolCalls();

            expect(result).toEqual([]);
        });

        it('should get parsing tool calls when available', () => {
            // Set up a parsing tool call
            workflowAgent.lastParsingToolCall = {
                function: { name: 'interaction_decision', arguments: { continue: true } },
            };

            const parsingToolCalls = workflowAgent.getParsingToolCalls();

            expect(parsingToolCalls).toHaveLength(1);
            expect(parsingToolCalls[0].function.name).toBe('interaction_decision');
        });

        it('should return empty array when no parsing tool calls', () => {
            workflowAgent.lastParsingToolCall = null;
            mockContext.getMessages.mockReturnValue([]);

            const parsingToolCalls = workflowAgent.getParsingToolCalls();

            expect(parsingToolCalls).toEqual([]);
        });
    });

    describe('response handling', () => {
        beforeEach(() => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };
            workflowAgent = createWorkflowAgent(agentConfig);
        });

        it('should capture response content and raw response', () => {
            const response = {
                choices: [
                    {
                        message: {
                            content: 'Test response content',
                            tool_calls: [],
                        },
                    },
                ],
            };

            // Simulate response callback
            const callbacks = mockAIAPIClient.setCallbacks.mock.calls[0][0];
            callbacks.onResponse(response, 'test_agent');

            expect(workflowAgent.lastResponseContent).toBe('Test response content');
            expect(workflowAgent.lastRawResponse).toBe(response);
        });

        it('should get last raw response', () => {
            const response = { test: 'response' };
            workflowAgent.lastRawResponse = response;

            const result = workflowAgent.getLastRawResponse();

            expect(result).toBe(response);
        });

        it('should get last response from context', () => {
            mockContext.getMessages.mockReturnValue([
                { role: 'user', content: 'User message' },
                { role: 'assistant', content: 'Assistant response' },
            ]);

            const result = workflowAgent.getLastResponse();

            expect(result).toBe('Assistant response');
        });
    });

    describe('configuration', () => {
        it('should use config manager for model configuration', () => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };

            workflowAgent = createWorkflowAgent(agentConfig);

            expect(mockConfigManager.getModel).toHaveBeenCalled();
            expect(AIAPIClient).toHaveBeenCalledWith(
                mockCostsManager,
                'test-key',
                'https://api.openai.com/v1',
                'gpt-4'
            );
        });

        it('should initialize with proper agent role and context role', () => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };

            workflowAgent = createWorkflowAgent(agentConfig);

            expect(workflowAgent.getRole()).toBe('customer');
            expect(workflowAgent.getContextRole()).toBe('assistant');
        });
    });

    describe('agent functionality', () => {
        beforeEach(() => {
            const agentConfig = {
                agent_role: 'customer',
                context: 'test_context',
                role: 'assistant',
            };
            workflowAgent = createWorkflowAgent(agentConfig);
        });

        it('should add user message to context', async () => {
            const message = 'Test user message';

            await workflowAgent.addUserMessage(message);

            expect(mockContext.addMessage).toHaveBeenCalledWith(
                { role: 'user', content: message },
                workflowAgent
            );
        });

        it('should clear conversation', async () => {
            await workflowAgent.clearConversation();

            expect(mockAIAPIClient.clearConversation).toHaveBeenCalled();
        });

        it('should get agent statistics', () => {
            const stats = workflowAgent.getStats();

            expect(stats).toEqual({
                id: expect.any(String),
                agentRole: 'customer',
                contextRole: 'assistant',
                contextName: 'test_context',
                toolCount: 5,
                totalToolCount: 10,
                model: 'gpt-4',
            });
        });

        it('should export agent data', () => {
            const exported = workflowAgent.export();

            expect(exported).toEqual({
                id: expect.any(String),
                agentRole: 'customer',
                contextRole: 'assistant',
                contextName: 'test_context',
                stats: expect.any(Object),
            });
        });

        it('should check for tool calls', () => {
            mockContext.getMessages.mockReturnValue([
                {
                    role: 'assistant',
                    content: 'Response',
                    tool_calls: [{ function: { name: 'test' } }],
                },
            ]);

            expect(workflowAgent.hasToolCalls()).toBe(true);

            mockContext.getMessages.mockReturnValue([{ role: 'assistant', content: 'Response' }]);

            expect(workflowAgent.hasToolCalls()).toBe(false);
        });
    });
});
