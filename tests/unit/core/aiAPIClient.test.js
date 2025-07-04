// tests/unit/core/aiAPIClient.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AIAPIClient from '../../../src/core/ai/aiAPIClient.js';
import { createMockOpenAI } from '../../mocks/openai.js';

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
        isToolExcluded: vi.fn(),
        isToolIncluded: vi.fn(),
        getReminder: vi.fn(),
        getParsingTools: vi.fn(),
    },
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('AIAPIClient', () => {
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
        };

        mockSystemMessages = {
            getSystemMessage: vi.fn().mockReturnValue('Test system message'),
            getLevel: vi.fn().mockReturnValue('base'),
            getExcludedTools: vi.fn().mockReturnValue([]),
            isToolExcluded: vi.fn().mockReturnValue(false),
            isToolIncluded: vi.fn().mockReturnValue(true),
            getReminder: vi.fn().mockReturnValue(null),
            getParsingTools: vi.fn().mockReturnValue([]),
            getExamples: vi.fn().mockReturnValue([]),
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
        SystemMessages.default.isToolExcluded = mockSystemMessages.isToolExcluded;
        SystemMessages.default.isToolIncluded = mockSystemMessages.isToolIncluded;
        SystemMessages.default.getReminder = mockSystemMessages.getReminder;
        SystemMessages.default.getParsingTools = mockSystemMessages.getParsingTools;
        SystemMessages.default.getExamples = mockSystemMessages.getExamples;

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

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(aiClient.baseModel).toBe('test-model');
            expect(aiClient.model).toBe('test-model');
            expect(aiClient.costsManager).toBe(mockCostsManager);
            expect(aiClient.messages).toEqual([]);
            expect(aiClient.tools).toEqual([]);
            expect(aiClient.allTools).toEqual([]);
            expect(aiClient.role).toBeNull();
            expect(aiClient.maxToolCalls).toBe(10);
            expect(aiClient.toolCallCount).toBe(0);
        });

        it('should initialize model configurations', () => {
            expect(aiClient.modelConfigs.base).toBeDefined();
            expect(aiClient.modelConfigs.base.client).toBe(aiClient.baseClient);
            expect(aiClient.modelConfigs.base.model).toBe('test-model');
        });

        it('should initialize callbacks as null', () => {
            expect(aiClient.onThinking).toBeNull();
            expect(aiClient.onChainOfThought).toBeNull();
            expect(aiClient.onFinalChainOfThought).toBeNull();
            expect(aiClient.onToolExecution).toBeNull();
            expect(aiClient.onResponse).toBeNull();
            expect(aiClient.onError).toBeNull();
            expect(aiClient.onContentDisplay).toBeNull();
        });
    });

    describe('setCallbacks', () => {
        it('should set all callbacks correctly', () => {
            const callbacks = {
                onThinking: vi.fn(),
                onChainOfThought: vi.fn(),
                onFinalChainOfThought: vi.fn(),
                onToolExecution: vi.fn(),
                onResponse: vi.fn(),
                onError: vi.fn(),
                onReminder: vi.fn(),
                onContentDisplay: vi.fn(),
            };

            aiClient.setCallbacks(callbacks);

            expect(aiClient.onThinking).toBe(callbacks.onThinking);
            expect(aiClient.onChainOfThought).toBe(callbacks.onChainOfThought);
            expect(aiClient.onFinalChainOfThought).toBe(callbacks.onFinalChainOfThought);
            expect(aiClient.onToolExecution).toBe(callbacks.onToolExecution);
            expect(aiClient.onResponse).toBe(callbacks.onResponse);
            expect(aiClient.onError).toBe(callbacks.onError);
            expect(aiClient.onReminder).toBe(callbacks.onReminder);
            expect(aiClient.onContentDisplay).toBe(callbacks.onContentDisplay);
        });

        it('should handle partial callback setting', () => {
            const callbacks = {
                onThinking: vi.fn(),
                onResponse: vi.fn(),
            };

            aiClient.setCallbacks(callbacks);

            expect(aiClient.onThinking).toBe(callbacks.onThinking);
            expect(aiClient.onResponse).toBe(callbacks.onResponse);
            expect(aiClient.onChainOfThought).toBeNull();
            expect(aiClient.onToolExecution).toBeNull();
            expect(aiClient.onContentDisplay).toBeNull();
        });
    });

    describe('setTools', () => {
        it('should set tools correctly', () => {
            const tools = [{ function: { name: 'tool1' } }, { function: { name: 'tool2' } }];

            aiClient.setTools(tools);

            expect(aiClient.tools).toEqual(tools);
            expect(aiClient.allTools).toEqual(tools);
        });

        it('should apply tool filtering if role is set', () => {
            const tools = [
                { function: { name: 'tool1' } },
                { function: { name: 'tool2' } },
                { function: { name: 'excluded_tool' } },
            ];

            mockSystemMessages.isToolIncluded.mockImplementation(
                (_role, toolName) => toolName !== 'excluded_tool'
            );
            aiClient.role = 'test-role';

            aiClient.setTools(tools);

            expect(aiClient.allTools).toEqual(tools);
            expect(aiClient.tools).toHaveLength(2);
            expect(aiClient.tools.map(t => t.function.name)).toEqual(['tool1', 'tool2']);
        });
    });

    describe('setSystemMessage', () => {
        it('should set system message correctly', async () => {
            await aiClient.setSystemMessage('Test system message', 'test-role');

            expect(aiClient.messages).toHaveLength(1);
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
            expect(aiClient.role).toBe('test-role');
        });

        it('should replace existing system message', async () => {
            aiClient.messages = [
                { role: 'system', content: 'Old system message' },
                { role: 'user', content: 'User message' },
            ];

            await aiClient.setSystemMessage('New system message', 'test-role');

            expect(aiClient.messages).toHaveLength(2);
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'New system message',
            });
            expect(aiClient.messages[1]).toEqual({
                role: 'user',
                content: 'User message',
            });
        });

        it('should switch model based on role level', async () => {
            mockSystemMessages.getLevel.mockReturnValue('smart');
            mockConfig.hasSmartModelConfig.mockReturnValue(true);
            mockConfig.getModel = vi.fn().mockReturnValue({
                apiKey: 'smart-key',
                baseUrl: 'https://smart.api.com',
                model: 'smart-model',
            });

            // Reinitialize to set up smart model config
            aiClient = new AIAPIClient(mockCostsManager, 'test-key');

            await aiClient.setSystemMessage('Test message', 'smart-role');

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Switched to smart model')
            );
        });

        it('should add examples when role has examples', async () => {
            const mockExamples = [
                { role: 'user', content: 'Example user message' },
                { role: 'assistant', content: 'Example assistant response' },
            ];
            mockSystemMessages.getExamples.mockReturnValue(mockExamples);

            await aiClient.setSystemMessage('Test system message', 'test-role');

            expect(aiClient.messages).toHaveLength(3); // system + 2 examples
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
            expect(aiClient.messages[1]).toEqual({
                role: 'user',
                content: 'Example user message',
            });
            expect(aiClient.messages[2]).toEqual({
                role: 'assistant',
                content: 'Example assistant response',
            });
            expect(aiClient.exampleMessageCount).toBe(2);
        });

        it('should replace previous examples when switching roles', async () => {
            // First role with examples
            const firstExamples = [
                { role: 'user', content: 'First example' },
                { role: 'assistant', content: 'First response' },
            ];
            mockSystemMessages.getExamples.mockReturnValueOnce(firstExamples);

            await aiClient.setSystemMessage('First system message', 'first-role');
            expect(aiClient.messages).toHaveLength(3);
            expect(aiClient.exampleMessageCount).toBe(2);

            // Add a user message
            aiClient.addUserMessage('User message');
            expect(aiClient.messages).toHaveLength(4);

            // Switch to second role with different examples
            const secondExamples = [
                { role: 'user', content: 'Second example' },
                { role: 'function', name: 'test_function', content: 'Function result' },
            ];
            mockSystemMessages.getExamples.mockReturnValueOnce(secondExamples);

            await aiClient.setSystemMessage('Second system message', 'second-role');

            // Should have: system message + 2 new examples + user message
            expect(aiClient.messages).toHaveLength(4);
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Second system message',
            });
            expect(aiClient.messages[1]).toEqual({
                role: 'user',
                content: 'Second example',
            });
            expect(aiClient.messages[2]).toEqual({
                role: 'function',
                name: 'test_function',
                content: 'Function result',
            });
            expect(aiClient.messages[3]).toEqual({
                role: 'user',
                content: 'User message',
            });
            expect(aiClient.exampleMessageCount).toBe(2);
        });

        it('should handle function examples with arguments', async () => {
            const mockExamples = [
                { role: 'user', content: 'Test function call' },
                {
                    role: 'function',
                    name: 'test_function',
                    arguments: '{"param": "value"}',
                    content: 'Function result',
                },
            ];
            mockSystemMessages.getExamples.mockReturnValue(mockExamples);

            await aiClient.setSystemMessage('Test system message', 'test-role');

            expect(aiClient.messages).toHaveLength(3);
            expect(aiClient.messages[2]).toEqual({
                role: 'function',
                name: 'test_function',
                arguments: '{"param": "value"}',
                content: 'Function result',
            });
        });

        it('should handle roles without examples', async () => {
            mockSystemMessages.getExamples.mockReturnValue([]);

            await aiClient.setSystemMessage('Test system message', 'test-role');

            expect(aiClient.messages).toHaveLength(1);
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
            expect(aiClient.exampleMessageCount).toBe(0);
        });

        it('should handle getExamples errors gracefully', async () => {
            mockSystemMessages.getExamples.mockImplementation(() => {
                throw new Error('Failed to get examples');
            });

            await aiClient.setSystemMessage('Test system message', 'test-role');

            expect(aiClient.messages).toHaveLength(1);
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
            expect(aiClient.exampleMessageCount).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Could not add examples for role')
            );
        });
    });

    describe('getCurrentRole', () => {
        it('should return current role', () => {
            aiClient.role = 'test-role';
            expect(aiClient.getCurrentRole()).toBe('test-role');
        });

        it('should return null when no role is set', () => {
            expect(aiClient.getCurrentRole()).toBeNull();
        });
    });

    describe('getFilteredToolCount', () => {
        it('should return correct filtered tool count', () => {
            aiClient.tools = [{ name: 'tool1' }, { name: 'tool2' }];
            expect(aiClient.getFilteredToolCount()).toBe(2);
        });
    });

    describe('getTotalToolCount', () => {
        it('should return correct total tool count', () => {
            aiClient.allTools = [{ name: 'tool1' }, { name: 'tool2' }, { name: 'tool3' }];
            expect(aiClient.getTotalToolCount()).toBe(3);
        });
    });

    describe('addUserMessage', () => {
        it('should add user message to conversation', () => {
            aiClient.addUserMessage('Test user message');

            expect(aiClient.messages).toHaveLength(1);
            expect(aiClient.messages[0]).toEqual({
                role: 'user',
                content: 'Test user message',
            });
        });

        it('should add multiple user messages', () => {
            aiClient.addUserMessage('First message');
            aiClient.addUserMessage('Second message');

            expect(aiClient.messages).toHaveLength(2);
            expect(aiClient.messages[1]).toEqual({
                role: 'user',
                content: 'Second message',
            });
        });
    });

    describe('clearConversation', () => {
        it('should clear all messages', () => {
            aiClient.messages = [
                { role: 'user', content: 'User message' },
                { role: 'assistant', content: 'Assistant message' },
            ];

            aiClient.clearConversation();

            expect(aiClient.messages).toEqual([]);
        });

        it('should restore system message for current role', () => {
            aiClient.role = 'test-role';
            aiClient.messages = [
                { role: 'user', content: 'User message' },
                { role: 'assistant', content: 'Assistant message' },
            ];

            aiClient.clearConversation();

            expect(aiClient.messages).toHaveLength(1);
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
        });

        it('should reset example message count', () => {
            aiClient.exampleMessageCount = 3;
            aiClient.messages = [
                { role: 'user', content: 'User message' },
                { role: 'assistant', content: 'Assistant message' },
            ];

            aiClient.clearConversation();

            expect(aiClient.exampleMessageCount).toBe(0);
        });

        it('should restore system message and examples for current role', () => {
            const mockExamples = [
                { role: 'user', content: 'Example user message' },
                { role: 'assistant', content: 'Example assistant response' },
            ];
            mockSystemMessages.getExamples.mockReturnValue(mockExamples);

            aiClient.role = 'test-role';
            aiClient.messages = [
                { role: 'user', content: 'User message' },
                { role: 'assistant', content: 'Assistant message' },
            ];

            aiClient.clearConversation();

            expect(aiClient.messages).toHaveLength(3); // system + 2 examples
            expect(aiClient.messages[0]).toEqual({
                role: 'system',
                content: 'Test system message',
            });
            expect(aiClient.messages[1]).toEqual({
                role: 'user',
                content: 'Example user message',
            });
            expect(aiClient.messages[2]).toEqual({
                role: 'assistant',
                content: 'Example assistant response',
            });
            expect(aiClient.exampleMessageCount).toBe(2);
        });
    });

    describe('getters', () => {
        it('should return correct model', () => {
            expect(aiClient.getModel()).toBe('test-model');
        });

        it('should return correct message count', () => {
            aiClient.messages = [
                { role: 'user', content: 'Message 1' },
                { role: 'assistant', content: 'Message 2' },
            ];
            expect(aiClient.getMessageCount()).toBe(2);
        });

        it('should return copy of messages', () => {
            const originalMessages = [{ role: 'user', content: 'Message 1' }];
            aiClient.messages = originalMessages;

            const returnedMessages = aiClient.getMessages();

            expect(returnedMessages).toEqual(originalMessages);
            expect(returnedMessages).not.toBe(originalMessages); // Should be a copy
        });

        it('should return tool call count', () => {
            aiClient.toolCallCount = 5;
            expect(aiClient.getToolCallCount()).toBe(5);
        });

        it('should return max tool calls', () => {
            expect(aiClient.getMaxToolCalls()).toBe(10);
        });

        it('should return last API call', () => {
            const mockAPICall = {
                request: { model: 'test' },
                response: { id: 'test' },
                timestamp: '2024-01-01T00:00:00.000Z',
            };
            aiClient.lastAPICall = mockAPICall;

            expect(aiClient.getLastAPICall()).toBe(mockAPICall);
        });

        it('should return example message count', () => {
            aiClient.exampleMessageCount = 3;
            expect(aiClient.getExampleMessageCount()).toBe(3);
        });
    });

    describe('sendUserMessage', () => {
        beforeEach(() => {
            // Setup mock API response
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Test response content',
                        },
                    },
                ],
                usage: {
                    total_tokens: 100,
                    prompt_tokens: 50,
                    completion_tokens: 50,
                },
            });
        });

        it('should display content when both content and tool_calls are present', async () => {
            const onContentDisplayCallback = vi.fn();
            const onResponseCallback = vi.fn();
            const onToolExecutionCallback = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_123',
                content: 'Tool result',
            });

            aiClient.setCallbacks({
                onContentDisplay: onContentDisplayCallback,
                onResponse: onResponseCallback,
                onToolExecution: onToolExecutionCallback,
            });

            // Mock API response with both content and tool_calls
            mockOpenAI.chat.completions.create.mockResolvedValueOnce({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'I will help you with that. Let me use a tool.',
                            tool_calls: [
                                {
                                    id: 'call_123',
                                    type: 'function',
                                    function: {
                                        name: 'test_tool',
                                        arguments: '{"param": "value"}',
                                    },
                                },
                            ],
                        },
                    },
                ],
                usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
            });

            // Mock final response after tool execution
            mockOpenAI.chat.completions.create.mockResolvedValueOnce({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Task completed successfully.',
                        },
                    },
                ],
                usage: { total_tokens: 80, prompt_tokens: 40, completion_tokens: 40 },
            });

            await aiClient.sendUserMessage('Test user input');

            // Verify that onContentDisplay was called for the initial content
            expect(onContentDisplayCallback).toHaveBeenCalledWith(
                'I will help you with that. Let me use a tool.',
                null
            );

            // Verify that tool execution was called
            expect(onToolExecutionCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'call_123',
                    function: expect.objectContaining({
                        name: 'test_tool',
                    }),
                })
            );
        });

        it('should display content immediately for regular responses without tools', async () => {
            const onResponseCallback = vi.fn();
            aiClient.setCallbacks({ onResponse: onResponseCallback });

            await aiClient.sendUserMessage('Test user input');

            expect(onResponseCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    choices: [
                        expect.objectContaining({
                            message: expect.objectContaining({
                                content: 'Test response content',
                            }),
                        }),
                    ],
                }),
                null
            );
        });

        it('should display both initial content and final response', async () => {
            const onContentDisplayCallback = vi.fn();
            const onResponseCallback = vi.fn();
            const onToolExecutionCallback = vi.fn().mockResolvedValue({
                role: 'tool',
                tool_call_id: 'call_123',
                content: 'Tool result',
            });

            aiClient.setCallbacks({
                onContentDisplay: onContentDisplayCallback,
                onResponse: onResponseCallback,
                onToolExecution: onToolExecutionCallback,
            });

            // Mock initial response with content and tool_calls
            mockOpenAI.chat.completions.create.mockResolvedValueOnce({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Initial content with tools',
                            tool_calls: [
                                {
                                    id: 'call_123',
                                    type: 'function',
                                    function: { name: 'test_tool', arguments: '{}' },
                                },
                            ],
                        },
                    },
                ],
                usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
            });

            // Mock final response with different content
            mockOpenAI.chat.completions.create.mockResolvedValueOnce({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Task completed successfully.',
                        },
                    },
                ],
                usage: { total_tokens: 50, prompt_tokens: 30, completion_tokens: 20 },
            });

            await aiClient.sendUserMessage('Test user input');

            // Should be called once for initial content display
            expect(onContentDisplayCallback).toHaveBeenCalledWith(
                'Initial content with tools',
                null
            );

            // Should be called once for final response
            expect(onResponseCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    choices: [
                        expect.objectContaining({
                            message: expect.objectContaining({
                                content: 'Task completed successfully.',
                            }),
                        }),
                    ],
                }),
                null
            );
        });
    });

    describe('_applyToolFiltering', () => {
        it('should filter out excluded tools', () => {
            const tools = [
                { function: { name: 'allowed_tool' } },
                { function: { name: 'excluded_tool' } },
                { function: { name: 'another_allowed_tool' } },
            ];

            aiClient.allTools = tools;
            aiClient.role = 'test-role';
            mockSystemMessages.isToolIncluded.mockImplementation(
                (_role, toolName) => toolName !== 'excluded_tool'
            );

            aiClient._applyToolFiltering();

            expect(aiClient.tools).toHaveLength(2);
            expect(aiClient.tools.map(t => t.function.name)).toEqual([
                'allowed_tool',
                'another_allowed_tool',
            ]);
        });

        it('should handle tools without function property', () => {
            const tools = [{ name: 'tool1' }, { function: { name: 'tool2' } }];

            aiClient.allTools = tools;
            aiClient.role = 'test-role';
            mockSystemMessages.isToolIncluded.mockImplementation(
                (_role, toolName) => toolName !== 'tool1'
            );

            aiClient._applyToolFiltering();

            expect(aiClient.tools).toHaveLength(1);
            expect(aiClient.tools[0].function.name).toBe('tool2');
        });

        it('should not modify tools if no role is set', () => {
            const tools = [{ function: { name: 'tool1' } }, { function: { name: 'tool2' } }];

            aiClient.allTools = tools;
            aiClient.tools = []; // Start with empty tools
            aiClient.role = null;

            aiClient._applyToolFiltering();

            // Should not modify tools array when no role is set
            expect(aiClient.tools).toEqual([]);
        });

        it('should handle SystemMessages errors gracefully', () => {
            const tools = [{ function: { name: 'tool1' } }];

            aiClient.allTools = tools;
            aiClient.role = 'test-role';
            mockSystemMessages.isToolIncluded.mockImplementation(() => {
                throw new Error('SystemMessages error');
            });

            aiClient._applyToolFiltering();

            expect(aiClient.tools).toEqual(tools); // Should keep all tools on error
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Could not apply tool filtering')
            );
        });

        it('should work with pattern matching exclusions', () => {
            const tools = [
                { function: { name: 'read_file' } },
                { function: { name: 'write_file' } },
                { function: { name: 'edit_file' } },
                { function: { name: 'execute_command' } },
                { function: { name: 'get_time' } },
                { function: { name: 'calculate' } },
            ];

            aiClient.allTools = tools;
            aiClient.role = 'test-role';

            // Mock pattern matching: include only tools that don't end with '_file' and don't start with 'execute_'
            mockSystemMessages.isToolIncluded.mockImplementation(
                (_role, toolName) => !toolName.endsWith('_file') && !toolName.startsWith('execute_')
            );

            aiClient._applyToolFiltering();

            expect(aiClient.tools).toHaveLength(2);
            expect(aiClient.tools.map(t => t.function.name)).toEqual(['get_time', 'calculate']);
        });
    });
});
