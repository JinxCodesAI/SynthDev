// tests/unit/core/aiAPIClient.stateManagement.test.js
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
        getExamples: vi.fn(),
    },
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('AIAPIClient State Management', () => {
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
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            httpRequest: vi.fn(),
            toolExecutionDetailed: vi.fn(),
            toolResult: vi.fn(),
        };

        // Mock config manager
        mockConfig = {
            getConfig: vi.fn().mockReturnValue({
                global: { maxToolCalls: 10 },
            }),
            getMaxTokens: vi.fn().mockReturnValue(4000),
            getModelParameters: vi.fn().mockReturnValue({}),
            hasSmartModelConfig: vi.fn().mockReturnValue(false),
            hasFastModelConfig: vi.fn().mockReturnValue(false),
        };

        // Mock system messages
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
            'test-key',
            'https://api.test.com',
            'test-model'
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initial State', () => {
        it('should start in IDLE state', () => {
            expect(aiClient.getProcessingState()).toBe('idle');
            expect(aiClient.isReady()).toBe(true);
            expect(aiClient.canAcceptNewRequest()).toBe(true);
        });
    });

    describe('State Transitions During Processing', () => {
        beforeEach(() => {
            // Mock successful API response without tool calls
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Test response',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            });
        });

        it('should transition through states during sendUserMessage', async () => {
            // Check initial state
            expect(aiClient.getProcessingState()).toBe('idle');
            expect(aiClient.isReady()).toBe(true);

            // Start processing (this will change state internally)
            const resultPromise = aiClient.sendUserMessage('Test message');

            // Give a moment for state to change
            await new Promise(resolve => setTimeout(resolve, 1));

            // Wait for completion
            await resultPromise;

            // Should be back to idle after completion
            expect(aiClient.getProcessingState()).toBe('idle');
            expect(aiClient.isReady()).toBe(true);
        });

        it('should handle API call errors and return to IDLE', async () => {
            const error = new Error('API Error');
            mockOpenAI.chat.completions.create.mockRejectedValue(error);

            const result = await aiClient.sendUserMessage('Test message');

            // sendUserMessage catches errors and returns null
            expect(result).toBe(null);

            // Should return to IDLE state even after error
            expect(aiClient.getProcessingState()).toBe('idle');
            expect(aiClient.isReady()).toBe(true);
        });
    });

    describe('State Transitions During Tool Processing', () => {
        beforeEach(() => {
            // Mock API response with tool calls
            mockOpenAI.chat.completions.create
                .mockResolvedValueOnce({
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: 'I need to use a tool',
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
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                })
                .mockResolvedValueOnce({
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: 'Tool execution complete',
                            },
                        },
                    ],
                    usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 },
                });

            // Mock tool execution
            aiClient.setCallbacks({
                onToolExecution: vi.fn().mockResolvedValue({
                    role: 'tool',
                    tool_call_id: 'call_123',
                    content: 'Tool result',
                }),
            });
        });

        it('should transition through states during tool processing', async () => {
            // Check initial state
            expect(aiClient.getProcessingState()).toBe('idle');
            expect(aiClient.isReady()).toBe(true);

            // Start processing with tools
            const resultPromise = aiClient.sendUserMessage('Test message with tools');

            // Give a moment for state to change
            await new Promise(resolve => setTimeout(resolve, 1));

            // Wait for completion
            await resultPromise;

            // Should be back to idle after completion
            expect(aiClient.getProcessingState()).toBe('idle');
            expect(aiClient.isReady()).toBe(true);
        });
    });

    describe('Concurrent Access Protection', () => {
        it('should indicate not ready during processing', async () => {
            // Check initial state
            expect(aiClient.isReady()).toBe(true);

            // Mock API call with delay to simulate processing time
            let readyDuringProcessing = null;
            mockOpenAI.chat.completions.create.mockImplementation(async () => {
                // Capture ready state during API call
                readyDuringProcessing = aiClient.isReady();
                await new Promise(resolve => setTimeout(resolve, 10));
                return {
                    choices: [{ message: { role: 'assistant', content: 'Response' } }],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                };
            });

            await aiClient.sendUserMessage('Test message');

            expect(readyDuringProcessing).toBe(false); // Should not be ready during API call
            expect(aiClient.isReady()).toBe(true); // Should be ready after completion
        });
    });
});
