// tests/unit/core/aiAPIClient.messageOrdering.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AIAPIClient from '../../../src/core/ai/aiAPIClient.js';

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

describe('AIAPIClient Message Ordering Tests', () => {
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
        mockOpenAI = {
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
                                    content: 'Test response',
                                },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                    }),
                },
            },
        };

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
            getReminder: vi.fn().mockReturnValue(null),
            getParsingTools: vi.fn().mockReturnValue([]),
        };

        // Setup module mocks
        const { OpenAI } = await import('openai');
        OpenAI.mockImplementation(() => mockOpenAI);

        const { default: ConfigManager } = await import(
            '../../../src/config/managers/configManager.js'
        );
        ConfigManager.getInstance.mockReturnValue(mockConfig);

        const { default: SystemMessages } = await import('../../../src/core/ai/systemMessages.js');
        Object.assign(SystemMessages, mockSystemMessages);

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

    describe('_ensureMessageOrdering', () => {
        it('should move tool message directly after corresponding assistant message', () => {
            // Setup messages with tool message out of order
            aiClient.messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'user', content: 'Another message' },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
            ];

            // Call the private method directly for testing
            aiClient._ensureMessageOrdering();

            // Verify tool message is now directly after assistant message
            expect(aiClient.messages).toEqual([
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
                { role: 'user', content: 'Another message' },
            ]);
        });

        it('should handle multiple tool calls in correct order', () => {
            // Setup messages with multiple tool calls out of order
            aiClient.messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [
                        { id: 'call_123', function: { name: 'tool_1' } },
                        { id: 'call_456', function: { name: 'tool_2' } },
                    ],
                },
                { role: 'user', content: 'Another message' },
                { role: 'tool', tool_call_id: 'call_456', content: 'Tool 2 result' },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool 1 result' },
            ];

            aiClient._ensureMessageOrdering();

            // Verify tool messages are in correct order after assistant message
            expect(aiClient.messages).toEqual([
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [
                        { id: 'call_123', function: { name: 'tool_1' } },
                        { id: 'call_456', function: { name: 'tool_2' } },
                    ],
                },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool 1 result' },
                { role: 'tool', tool_call_id: 'call_456', content: 'Tool 2 result' },
                { role: 'user', content: 'Another message' },
            ]);
        });

        it('should not modify already correctly ordered messages', () => {
            const originalMessages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
                { role: 'assistant', content: 'Final response' },
            ];

            aiClient.messages = [...originalMessages];
            aiClient._ensureMessageOrdering();

            expect(aiClient.messages).toEqual(originalMessages);
        });

        it('should handle messages with no tool calls', () => {
            const originalMessages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' },
                { role: 'user', content: 'How are you?' },
                { role: 'assistant', content: 'I am fine, thank you!' },
            ];

            aiClient.messages = [...originalMessages];
            aiClient._ensureMessageOrdering();

            expect(aiClient.messages).toEqual(originalMessages);
        });

        it('should handle orphaned tool messages gracefully', () => {
            // Tool message without corresponding assistant message
            const originalMessages = [
                { role: 'user', content: 'Hello' },
                { role: 'tool', tool_call_id: 'call_orphan', content: 'Orphaned tool result' },
                { role: 'assistant', content: 'Response' },
            ];

            aiClient.messages = [...originalMessages];
            aiClient._ensureMessageOrdering();

            // Should not crash and leave orphaned tool message in place
            expect(aiClient.messages).toEqual(originalMessages);
        });
    });

    describe('_makeAPICall with message ordering', () => {
        it('should call _ensureMessageOrdering before making API call', async () => {
            // Spy on the _ensureMessageOrdering method
            const ensureOrderingSpy = vi.spyOn(aiClient, '_ensureMessageOrdering');

            // Setup some messages
            aiClient.messages = [{ role: 'user', content: 'Test message' }];

            await aiClient._makeAPICall();

            expect(ensureOrderingSpy).toHaveBeenCalledBefore(mockOpenAI.chat.completions.create);
        });

        it('should send properly ordered messages to API', async () => {
            // Setup messages with tool message out of order
            aiClient.messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'user', content: 'Another message' },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
            ];

            await aiClient._makeAPICall();

            // Verify API was called with properly ordered messages
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: [
                        { role: 'user', content: 'Hello' },
                        {
                            role: 'assistant',
                            tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                        },
                        { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
                        { role: 'user', content: 'Another message' },
                    ],
                })
            );
        });
    });
});
