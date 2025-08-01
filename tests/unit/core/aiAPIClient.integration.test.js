// tests/unit/core/aiAPIClient.integration.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AIAPIClient from '../../../src/core/ai/aiAPIClient.js';
import {
    createMockOpenAI,
    createMockOpenAIWithToolCalls,
    createMockOpenAIWithReasoning,
    createMockOpenAIWithError,
} from '../../mocks/openai.js';

// Mock dependencies
vi.mock('openai', () => ({
    OpenAI: vi.fn(),
}));

vi.mock('../../../src/config/managers/configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(),
        getLevel: vi.fn(),
        getExcludedTools: vi.fn(),
        getReminder: vi.fn(),
        getParsingTools: vi.fn(),
    },
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('AIAPIClient Integration Tests', () => {
    let aiClient;
    let mockOpenAI;
    let mockConfig;
    let mockSystemMessages;
    let mockLogger;
    let mockCostsManager;

    beforeEach(async () => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock instances
        mockOpenAI = createMockOpenAI();
        mockCostsManager = {
            addUsage: vi.fn(),
        };
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            httpRequest: vi.fn(),
        };

        mockConfig = {
            getConfig: vi.fn().mockReturnValue({
                global: { maxToolCalls: 10 },
            }),
            hasSmartModelConfig: vi.fn().mockReturnValue(false),
            hasFastModelConfig: vi.fn().mockReturnValue(false),
            getMaxTokens: vi.fn().mockReturnValue(4000),
            getModelParameters: vi.fn().mockReturnValue({}),
        };

        mockSystemMessages = {
            getSystemMessage: vi.fn().mockReturnValue('Test system message'),
            getLevel: vi.fn().mockReturnValue('base'),
            getExcludedTools: vi.fn().mockReturnValue([]),
            getReminder: vi.fn().mockReturnValue(null),
            getParsingTools: vi.fn().mockReturnValue([]),
        };

        // Setup module mocks
        const { OpenAI } = await import('openai');
        OpenAI.mockImplementation(() => mockOpenAI);

        const ConfigManager = await import('../../../src/config/managers/configManager.js');
        ConfigManager.default.getInstance.mockReturnValue(mockConfig);

        const SystemMessages = await import('../../../src/core/ai/systemMessages.js');
        SystemMessages.default.getSystemMessage = mockSystemMessages.getSystemMessage;
        SystemMessages.default.getLevel = mockSystemMessages.getLevel;
        SystemMessages.default.getExcludedTools = mockSystemMessages.getExcludedTools;
        SystemMessages.default.getReminder = mockSystemMessages.getReminder;
        SystemMessages.default.getParsingTools = mockSystemMessages.getParsingTools;

        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create AIAPIClient instance
        aiClient = new AIAPIClient(
            mockCostsManager,
            'test-api-key',
            'https://api.test.com/v1',
            'test-model'
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendUserMessage', () => {
        it('should send user message and get response', async () => {
            const onThinking = vi.fn();
            const onResponse = vi.fn();

            aiClient.setCallbacks({ onThinking, onResponse });

            await aiClient.sendUserMessage('Hello, AI!');

            expect(onThinking).toHaveBeenCalled();
            expect(aiClient.messages).toHaveLength(2); // User message + assistant response
            expect(aiClient.messages[0]).toEqual({
                role: 'user',
                content: 'Hello, AI!',
            });
            expect(aiClient.messages[1]).toEqual({
                role: 'assistant',
                content: 'Test response',
            });
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'test-model',
                    messages: expect.arrayContaining([{ role: 'user', content: 'Hello, AI!' }]),
                    tools: undefined,
                    max_completion_tokens: 4000,
                })
            );
            expect(onResponse).toHaveBeenCalled();
        });

        it('should handle reasoning content', async () => {
            const mockOpenAIWithReasoning = createMockOpenAIWithReasoning();
            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIWithReasoning);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');

            const onChainOfThought = vi.fn();
            aiClient.setCallbacks({ onChainOfThought });

            await aiClient.sendUserMessage('Test message');

            expect(onChainOfThought).toHaveBeenCalledWith('This is the reasoning process...');
        });

        it('should handle tool calls', async () => {
            const mockOpenAIWithTools = createMockOpenAIWithToolCalls();
            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIWithTools);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');

            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test_1',
                content: JSON.stringify({
                    success: true,
                    result: 'Tool executed successfully',
                }),
            });

            aiClient.setCallbacks({ onToolExecution });

            await aiClient.sendUserMessage('Execute a tool');

            expect(onToolExecution).toHaveBeenCalledWith({
                id: 'call_test_1',
                type: 'function',
                function: {
                    name: 'test_tool',
                    arguments: '{"param": "value"}',
                },
            });

            // Should have made two API calls (initial + after tool execution)
            expect(mockOpenAIWithTools.chat.completions.create).toHaveBeenCalledTimes(2);
        });

        it('should handle tool execution errors', async () => {
            const mockOpenAIWithTools = createMockOpenAIWithToolCalls();
            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIWithTools);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');

            const onToolExecution = vi.fn().mockRejectedValue(new Error('Tool execution failed'));
            aiClient.setCallbacks({ onToolExecution });

            await aiClient.sendUserMessage('Execute a tool');

            expect(onToolExecution).toHaveBeenCalled();

            // Should still continue with error message in conversation
            expect(
                aiClient.messages.some(
                    msg =>
                        msg.role === 'tool' && msg.content.includes('Error: Tool execution failed')
                )
            ).toBe(true);
        });

        it('should handle API errors', async () => {
            const mockOpenAIWithError = createMockOpenAIWithError();
            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIWithError);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');

            const onError = vi.fn();
            aiClient.setCallbacks({ onError });

            await aiClient.sendUserMessage('Test message');

            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'API Error: Rate limit exceeded',
                })
            );
        });

        it('should reset tool call counter for new user interaction', async () => {
            aiClient.toolCallCount = 5;

            await aiClient.sendUserMessage('New message');

            expect(aiClient.toolCallCount).toBe(0);
        });

        it('should ensure system message is present', async () => {
            aiClient.role = 'test-role';

            await aiClient.sendUserMessage('Test message');

            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
        });

        it('should include tools in API call when available', async () => {
            const tools = [{ function: { name: 'test_tool' } }];
            aiClient.setTools(tools);

            await aiClient.sendUserMessage('Test message');

            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    tools: tools,
                })
            );
        });

        it('should track usage and costs', async () => {
            await aiClient.sendUserMessage('Test message');

            expect(mockCostsManager.addUsage).toHaveBeenCalledWith('test-model', {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            });
        });

        it('should log HTTP requests', async () => {
            await aiClient.sendUserMessage('Test message');

            expect(mockLogger.httpRequest).toHaveBeenCalledWith(
                'POST',
                'https://api.test.com/v1/chat/completions',
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should store last API call data', async () => {
            await aiClient.sendUserMessage('Test message');

            const lastCall = aiClient.getLastAPICall();
            expect(lastCall.request).toBeDefined();
            expect(lastCall.response).toBeDefined();
            expect(lastCall.timestamp).toBeDefined();
        });
    });

    describe('_handleToolCalls', () => {
        it('should enforce maximum tool call limit when no confirmation callback is set', async () => {
            // Create a mock that always returns tool calls to simulate infinite loop
            const mockOpenAIInfinite = {
                baseURL: 'https://api.test.com/v1',
                chat: {
                    completions: {
                        create: vi.fn().mockResolvedValue({
                            id: 'chatcmpl-test',
                            object: 'chat.completion',
                            created: Date.now(),
                            model: 'test-model',
                            choices: [
                                {
                                    index: 0,
                                    message: {
                                        role: 'assistant',
                                        content: null,
                                        tool_calls: [
                                            {
                                                id: 'call_test_1',
                                                type: 'function',
                                                function: { name: 'test_tool', arguments: '{}' },
                                            },
                                            {
                                                id: 'call_test_2',
                                                type: 'function',
                                                function: { name: 'test_tool', arguments: '{}' },
                                            },
                                            {
                                                id: 'call_test_3',
                                                type: 'function',
                                                function: { name: 'test_tool', arguments: '{}' },
                                            },
                                        ],
                                        reasoning_content: null,
                                    },
                                    finish_reason: 'tool_calls',
                                },
                            ],
                            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                        }),
                    },
                },
            };

            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIInfinite);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');
            aiClient.maxToolCalls = 2; // Set low limit for testing

            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test_1',
                content: 'Tool result',
            });

            const onError = vi.fn();
            aiClient.setCallbacks({ onToolExecution, onError });

            await aiClient.sendUserMessage('Test');

            // The error should be caught and passed to onError callback
            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Maximum number of tool calls (2) exceeded'),
                })
            );
        });

        it('should request confirmation when max tool calls exceeded and callback is set', async () => {
            // Create a mock that returns tool calls first, then a normal response
            const mockOpenAI = {
                baseURL: 'https://api.test.com/v1',
                chat: {
                    completions: {
                        create: vi.fn().mockResolvedValueOnce({
                            id: 'chatcmpl-test',
                            object: 'chat.completion',
                            created: Date.now(),
                            model: 'test-model',
                            choices: [
                                {
                                    index: 0,
                                    message: {
                                        role: 'assistant',
                                        content: null,
                                        tool_calls: [
                                            {
                                                id: 'call_test_1',
                                                type: 'function',
                                                function: { name: 'test_tool', arguments: '{}' },
                                            },
                                            {
                                                id: 'call_test_2',
                                                type: 'function',
                                                function: { name: 'test_tool', arguments: '{}' },
                                            },
                                            {
                                                id: 'call_test_3',
                                                type: 'function',
                                                function: { name: 'test_tool', arguments: '{}' },
                                            },
                                        ],
                                        reasoning_content: null,
                                    },
                                    finish_reason: 'tool_calls',
                                },
                            ],
                            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                        }),
                    },
                },
            };

            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAI);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');
            aiClient.maxToolCalls = 2; // Set low limit for testing

            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test_1',
                content: 'Tool result',
            });

            const onMaxToolCallsExceeded = vi.fn().mockResolvedValue(false); // User chooses not to continue
            const onError = vi.fn();

            aiClient.setCallbacks({ onToolExecution, onMaxToolCallsExceeded, onError });

            const result = await aiClient.sendUserMessage('Test');

            // The confirmation callback should be called
            expect(onMaxToolCallsExceeded).toHaveBeenCalledWith(2);

            // Should return a message indicating operation was stopped
            expect(result).toBe('Operation stopped due to maximum tool calls limit.');

            // Error callback should not be called
            expect(onError).not.toHaveBeenCalled();
        });

        it('should continue processing when user confirms to continue', async () => {
            // Create a mock that returns tool calls first, then a normal response
            const mockOpenAI = {
                baseURL: 'https://api.test.com/v1',
                chat: {
                    completions: {
                        create: vi
                            .fn()
                            .mockResolvedValueOnce({
                                id: 'chatcmpl-test-1',
                                object: 'chat.completion',
                                created: Date.now(),
                                model: 'test-model',
                                choices: [
                                    {
                                        index: 0,
                                        message: {
                                            role: 'assistant',
                                            content: null,
                                            tool_calls: [
                                                {
                                                    id: 'call_test_1',
                                                    type: 'function',
                                                    function: {
                                                        name: 'test_tool',
                                                        arguments: '{}',
                                                    },
                                                },
                                                {
                                                    id: 'call_test_2',
                                                    type: 'function',
                                                    function: {
                                                        name: 'test_tool',
                                                        arguments: '{}',
                                                    },
                                                },
                                                {
                                                    id: 'call_test_3',
                                                    type: 'function',
                                                    function: {
                                                        name: 'test_tool',
                                                        arguments: '{}',
                                                    },
                                                },
                                            ],
                                            reasoning_content: null,
                                        },
                                        finish_reason: 'tool_calls',
                                    },
                                ],
                                usage: {
                                    prompt_tokens: 10,
                                    completion_tokens: 5,
                                    total_tokens: 15,
                                },
                            })
                            .mockResolvedValueOnce({
                                id: 'chatcmpl-test-2',
                                object: 'chat.completion',
                                created: Date.now(),
                                model: 'test-model',
                                choices: [
                                    {
                                        index: 0,
                                        message: {
                                            role: 'assistant',
                                            content: 'Task completed successfully',
                                            tool_calls: null,
                                            reasoning_content: null,
                                        },
                                        finish_reason: 'stop',
                                    },
                                ],
                                usage: {
                                    prompt_tokens: 10,
                                    completion_tokens: 5,
                                    total_tokens: 15,
                                },
                            }),
                    },
                },
            };

            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAI);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');
            aiClient.maxToolCalls = 2; // Set low limit for testing

            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test_1',
                content: 'Tool result',
            });

            const onMaxToolCallsExceeded = vi.fn().mockResolvedValue(true); // User chooses to continue
            const onError = vi.fn();

            aiClient.setCallbacks({ onToolExecution, onMaxToolCallsExceeded, onError });

            const result = await aiClient.sendUserMessage('Test');

            // The confirmation callback should be called
            expect(onMaxToolCallsExceeded).toHaveBeenCalledWith(2);

            // Should continue and return the final response
            expect(result).toBe('Task completed successfully');

            // Error callback should not be called
            expect(onError).not.toHaveBeenCalled();

            // Tool execution should have been called for all 3 tools
            expect(onToolExecution).toHaveBeenCalledTimes(3);
        });

        it('should increase limit by original amount when user confirms continuation', async () => {
            // Create a mock that will trigger multiple confirmations
            const mockOpenAI = {
                chat: {
                    completions: {
                        create: vi
                            .fn()
                            .mockResolvedValueOnce({
                                choices: [
                                    {
                                        message: {
                                            role: 'assistant',
                                            content: null,
                                            tool_calls: [
                                                {
                                                    id: 'call_1',
                                                    type: 'function',
                                                    function: {
                                                        name: 'test_tool',
                                                        arguments: '{}',
                                                    },
                                                },
                                                {
                                                    id: 'call_2',
                                                    type: 'function',
                                                    function: {
                                                        name: 'test_tool',
                                                        arguments: '{}',
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            })
                            .mockResolvedValueOnce({
                                choices: [
                                    {
                                        message: {
                                            role: 'assistant',
                                            content: null,
                                            tool_calls: [
                                                {
                                                    id: 'call_3',
                                                    type: 'function',
                                                    function: {
                                                        name: 'test_tool',
                                                        arguments: '{}',
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            })
                            .mockResolvedValueOnce({
                                choices: [
                                    {
                                        message: {
                                            role: 'assistant',
                                            content: 'Final response',
                                        },
                                    },
                                ],
                            }),
                    },
                },
            };

            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAI);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');
            aiClient.role = 'test-role';
            aiClient.maxToolCalls = 2; // Set low limit to trigger confirmation
            aiClient.originalMaxToolCalls = 2; // Store original value

            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test',
                content: 'Tool result',
            });

            const onMaxToolCallsExceeded = vi.fn().mockResolvedValue(true); // User always confirms
            const onError = vi.fn();

            aiClient.setCallbacks({ onToolExecution, onMaxToolCallsExceeded, onError });

            const result = await aiClient.sendUserMessage('Test');

            // Should have been called once when limit was first exceeded (after 2 calls)
            expect(onMaxToolCallsExceeded).toHaveBeenCalledTimes(1);
            expect(onMaxToolCallsExceeded).toHaveBeenCalledWith(2);

            // After confirmation, limit should be increased to 4 (2 + 2)
            // So the 3rd tool call should proceed without another confirmation
            expect(result).toBe('Final response');

            // All 3 tool executions should have completed
            expect(onToolExecution).toHaveBeenCalledTimes(3);

            // No errors should have occurred
            expect(onError).not.toHaveBeenCalled();
        });

        it('should handle reminder messages', async () => {
            const mockOpenAIWithTools = createMockOpenAIWithToolCalls();
            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIWithTools);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');
            aiClient.role = 'test-role';

            mockSystemMessages.getReminder.mockReturnValue('Remember to be helpful');

            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test_1',
                content: 'Tool result',
            });

            aiClient.setCallbacks({ onToolExecution });

            await aiClient.sendUserMessage('Execute a tool');

            // Should include reminder message in conversation
            expect(
                aiClient.messages.some(
                    msg => msg.role === 'user' && msg.content === 'Remember to be helpful'
                )
            ).toBe(true);
        });

        it('should handle custom reminder processing', async () => {
            const mockOpenAIWithTools = createMockOpenAIWithToolCalls();
            const { OpenAI } = await import('openai');
            OpenAI.mockImplementation(() => mockOpenAIWithTools);

            aiClient = new AIAPIClient(mockCostsManager, 'test-key');
            aiClient.role = 'test-role';

            mockSystemMessages.getReminder.mockReturnValue('Original reminder');

            const onReminder = vi.fn().mockReturnValue('Modified reminder');
            const onToolExecution = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_test_1',
                content: 'Tool result',
            });

            aiClient.setCallbacks({ onReminder, onToolExecution });

            await aiClient.sendUserMessage('Execute a tool');

            expect(onReminder).toHaveBeenCalledWith('Original reminder');
            expect(
                aiClient.messages.some(
                    msg => msg.role === 'user' && msg.content === 'Modified reminder'
                )
            ).toBe(true);
        });
    });
});
