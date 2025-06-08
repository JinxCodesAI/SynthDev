// tests/unit/core/aiAPIClient.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AIAPIClient from '../../../aiAPIClient.js';
import { createMockOpenAI } from '../../mocks/openai.js';

// Mock dependencies
vi.mock('openai', () => ({
    OpenAI: vi.fn(),
}));

vi.mock('../../../configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../../systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(),
        getLevel: vi.fn(),
        getExcludedTools: vi.fn(),
        getReminder: vi.fn(),
    },
}));

vi.mock('../../../logger.js', () => ({
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
            getReminder: vi.fn().mockReturnValue(null),
        };

        // Setup module mocks
        const { OpenAI } = await import('openai');
        OpenAI.mockImplementation(() => mockOpenAI);

        const ConfigManager = await import('../../../configManager.js');
        ConfigManager.default.getInstance.mockReturnValue(mockConfig);

        const SystemMessages = await import('../../../systemMessages.js');
        SystemMessages.default.getSystemMessage = mockSystemMessages.getSystemMessage;
        SystemMessages.default.getLevel = mockSystemMessages.getLevel;
        SystemMessages.default.getExcludedTools = mockSystemMessages.getExcludedTools;
        SystemMessages.default.getReminder = mockSystemMessages.getReminder;

        const { getLogger } = await import('../../../logger.js');
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
            };

            aiClient.setCallbacks(callbacks);

            expect(aiClient.onThinking).toBe(callbacks.onThinking);
            expect(aiClient.onChainOfThought).toBe(callbacks.onChainOfThought);
            expect(aiClient.onFinalChainOfThought).toBe(callbacks.onFinalChainOfThought);
            expect(aiClient.onToolExecution).toBe(callbacks.onToolExecution);
            expect(aiClient.onResponse).toBe(callbacks.onResponse);
            expect(aiClient.onError).toBe(callbacks.onError);
            expect(aiClient.onReminder).toBe(callbacks.onReminder);
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

            mockSystemMessages.getExcludedTools.mockReturnValue(['excluded_tool']);
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
            mockSystemMessages.getExcludedTools.mockReturnValue(['excluded_tool']);

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
            mockSystemMessages.getExcludedTools.mockReturnValue(['tool1']);

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
            mockSystemMessages.getExcludedTools.mockImplementation(() => {
                throw new Error('SystemMessages error');
            });

            aiClient._applyToolFiltering();

            expect(aiClient.tools).toEqual(tools); // Should keep all tools on error
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Could not apply tool filtering')
            );
        });
    });
});
