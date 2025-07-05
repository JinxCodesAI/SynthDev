// tests/unit/core/aiAPIClient.reasoning.test.js
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
        getReminder: vi.fn(),
        getParsingTools: vi.fn(),
    },
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('AIAPIClient Reasoning Functionality', () => {
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
            isReasoningModel: vi.fn(),
            getReasoningEffort: vi.fn().mockReturnValue('medium'),
        };

        mockSystemMessages = {
            getSystemMessage: vi.fn().mockReturnValue('System message'),
            getLevel: vi.fn().mockReturnValue('base'),
            getExcludedTools: vi.fn().mockReturnValue([]),
            getReminder: vi.fn().mockReturnValue(''),
            getParsingTools: vi.fn().mockReturnValue([]),
        };

        // Mock the imports
        const { OpenAI } = await import('openai');
        const ConfigManager = (await import('../../../src/config/managers/configManager.js'))
            .default;
        const SystemMessages = (await import('../../../src/core/ai/systemMessages.js')).default;
        const { getLogger } = await import('../../../src/core/managers/logger.js');

        OpenAI.mockImplementation(() => mockOpenAI);
        ConfigManager.getInstance.mockReturnValue(mockConfig);
        Object.assign(SystemMessages, mockSystemMessages);
        getLogger.mockReturnValue(mockLogger);

        aiClient = new AIAPIClient(mockCostsManager, 'test-key');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('_makeAPICall with reasoning', () => {
        it('should add reasoning configuration for reasoning models', async () => {
            // Mock model as reasoning model
            mockConfig.isReasoningModel.mockReturnValue(true);
            mockConfig.getReasoningEffort.mockReturnValue('high');

            aiClient.model = 'o4-mini';
            aiClient.messages = [{ role: 'user', content: 'Test message' }];
            aiClient.tools = [];

            await aiClient._makeAPICall();

            // Verify the API call was made with reasoning configuration
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'o4-mini',
                    messages: [{ role: 'user', content: 'Test message' }],
                    reasoning: {
                        effort: 'high',
                        exclude: false,
                        enabled: true,
                    },
                })
            );

            // Verify debug log was called
            expect(mockLogger.debug).toHaveBeenCalledWith(
                '🧠 Adding reasoning configuration with effort: high'
            );
        });

        it('should not add reasoning configuration for non-reasoning models', async () => {
            // Mock model as non-reasoning model
            mockConfig.isReasoningModel.mockReturnValue(false);

            aiClient.model = 'gpt-4.1-mini';
            aiClient.messages = [{ role: 'user', content: 'Test message' }];
            aiClient.tools = [];

            await aiClient._makeAPICall();

            // Verify the API call was made without reasoning configuration
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gpt-4.1-mini',
                    messages: [{ role: 'user', content: 'Test message' }],
                })
            );

            // Verify reasoning property is not present
            const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty('reasoning');

            // Verify debug log for reasoning was not called
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('🧠 Adding reasoning configuration')
            );
        });

        it('should use different effort levels', async () => {
            mockConfig.isReasoningModel.mockReturnValue(true);

            aiClient.model = 'gemini-2.5-flash';
            aiClient.messages = [{ role: 'user', content: 'Test message' }];
            aiClient.tools = [];

            // Test low effort
            mockConfig.getReasoningEffort.mockReturnValue('low');
            await aiClient._makeAPICall();

            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    reasoning: expect.objectContaining({
                        effort: 'low',
                    }),
                })
            );

            // Reset mock
            mockOpenAI.chat.completions.create.mockClear();

            // Test medium effort
            mockConfig.getReasoningEffort.mockReturnValue('medium');
            await aiClient._makeAPICall();

            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    reasoning: expect.objectContaining({
                        effort: 'medium',
                    }),
                })
            );
        });

        it('should work with tools and reasoning together', async () => {
            mockConfig.isReasoningModel.mockReturnValue(true);
            mockConfig.getReasoningEffort.mockReturnValue('high');

            aiClient.model = 'grok-3-mini-beta';
            aiClient.messages = [{ role: 'user', content: 'Test message' }];
            aiClient.tools = [
                {
                    type: 'function',
                    function: {
                        name: 'test_tool',
                        description: 'A test tool',
                        parameters: {},
                    },
                },
            ];

            await aiClient._makeAPICall();

            // Verify both tools and reasoning are included
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'grok-3-mini-beta',
                    tools: aiClient.tools,
                    reasoning: {
                        effort: 'high',
                        exclude: false,
                        enabled: true,
                    },
                })
            );
        });
    });
});
