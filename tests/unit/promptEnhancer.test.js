// tests/unit/promptEnhancer.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PromptEnhancer from '../../promptEnhancer.js';

// Mock dependencies
vi.mock('../../configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../aiAPIClient.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(),
    },
}));

vi.mock('../../logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('PromptEnhancer', () => {
    let promptEnhancer;
    let mockCostsManager;
    let mockToolManager;
    let mockConfigManager;
    let mockAIAPIClient;
    let mockSystemMessages;
    let mockLogger;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock dependencies
        mockCostsManager = {
            addCost: vi.fn(),
        };

        mockToolManager = {
            getTools: vi.fn().mockReturnValue([]),
        };

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            raw: vi.fn(),
        };

        // Setup ConfigManager mock
        const ConfigManagerModule = await import('../../configManager.js');
        mockConfigManager = {
            getConfig: vi.fn().mockReturnValue({
                global: { enablePromptEnhancement: true },
            }),
            hasFastModelConfig: vi.fn().mockReturnValue(true),
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'test-url',
                model: 'test-model',
            }),
        };
        ConfigManagerModule.default.getInstance.mockReturnValue(mockConfigManager);

        // Setup AIAPIClient mock
        const AIAPIClientModule = await import('../../aiAPIClient.js');
        mockAIAPIClient = {
            setTools: vi.fn(),
            setSystemMessage: vi.fn(),
            setCallbacks: vi.fn(),
            sendUserMessage: vi.fn(),
        };
        AIAPIClientModule.default.mockImplementation(() => mockAIAPIClient);

        // Setup SystemMessages mock
        const SystemMessagesModule = await import('../../systemMessages.js');
        mockSystemMessages = SystemMessagesModule.default;
        mockSystemMessages.getSystemMessage.mockReturnValue('Test system message');

        // Setup logger mock
        const loggerModule = await import('../../logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        // Create PromptEnhancer instance
        promptEnhancer = new PromptEnhancer(mockCostsManager, mockToolManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct dependencies', () => {
            expect(promptEnhancer.costsManager).toBe(mockCostsManager);
            expect(promptEnhancer.toolManager).toBe(mockToolManager);
            expect(promptEnhancer.config).toBe(mockConfigManager);
            expect(promptEnhancer.logger).toBe(mockLogger);
        });
    });

    describe('isEnabled', () => {
        it('should return true when prompt enhancement is enabled', () => {
            mockConfigManager.getConfig.mockReturnValue({
                global: { enablePromptEnhancement: true },
            });

            const result = promptEnhancer.isEnabled();

            expect(result).toBe(true);
        });

        it('should return false when prompt enhancement is disabled', () => {
            mockConfigManager.getConfig.mockReturnValue({
                global: { enablePromptEnhancement: false },
            });

            const result = promptEnhancer.isEnabled();

            expect(result).toBe(false);
        });
    });

    describe('enhancePrompt', () => {
        it('should return error when enhancement is disabled', async () => {
            mockConfigManager.getConfig.mockReturnValue({
                global: { enablePromptEnhancement: false },
            });

            const result = await promptEnhancer.enhancePrompt('test prompt');

            expect(result).toEqual({
                success: false,
                error: 'Prompt enhancement is disabled',
            });
        });

        it('should return error for invalid prompt - null', async () => {
            const result = await promptEnhancer.enhancePrompt(null);

            expect(result).toEqual({
                success: false,
                error: 'Invalid prompt provided',
            });
        });

        it('should return error for invalid prompt - empty string', async () => {
            const result = await promptEnhancer.enhancePrompt('');

            expect(result).toEqual({
                success: false,
                error: 'Invalid prompt provided',
            });
        });

        it('should return error for invalid prompt - whitespace only', async () => {
            const result = await promptEnhancer.enhancePrompt('   ');

            expect(result).toEqual({
                success: false,
                error: 'Invalid prompt provided',
            });
        });

        it('should return error for invalid prompt - non-string', async () => {
            const result = await promptEnhancer.enhancePrompt(123);

            expect(result).toEqual({
                success: false,
                error: 'Invalid prompt provided',
            });
        });

        it('should successfully enhance a valid prompt', async () => {
            const originalPrompt = 'test prompt';
            const enhancedResponse = 'Enhanced prompt: This is a much better test prompt';
            let storedCallbacks;

            // Mock AI response - callbacks are called during sendUserMessage
            mockAIAPIClient.setCallbacks.mockImplementation(callbacks => {
                storedCallbacks = callbacks;
            });

            mockAIAPIClient.sendUserMessage.mockImplementation(async () => {
                // Simulate the AI response during the sendUserMessage call
                if (storedCallbacks) {
                    storedCallbacks.onResponse({
                        choices: [
                            {
                                message: {
                                    content: enhancedResponse,
                                },
                            },
                        ],
                    });
                }
            });

            const result = await promptEnhancer.enhancePrompt(originalPrompt);

            expect(result).toEqual({
                success: true,
                enhancedPrompt: 'This is a much better test prompt',
            });

            // Verify AI client setup
            expect(mockAIAPIClient.setTools).toHaveBeenCalledWith([]);
            expect(mockAIAPIClient.setSystemMessage).toHaveBeenCalledWith(
                'Test system message',
                'prompt_enhancer'
            );
            expect(mockAIAPIClient.sendUserMessage).toHaveBeenCalled();
        });

        it('should use base model when fast model is not available', async () => {
            mockConfigManager.hasFastModelConfig.mockReturnValue(false);
            mockConfigManager.getModel.mockReturnValue({
                apiKey: 'base-key',
                baseUrl: 'base-url',
                baseModel: 'base-model',
            });

            const originalPrompt = 'test prompt';
            const enhancedResponse = 'Enhanced version: Better test prompt';
            let storedCallbacks;

            mockAIAPIClient.setCallbacks.mockImplementation(callbacks => {
                storedCallbacks = callbacks;
            });

            mockAIAPIClient.sendUserMessage.mockImplementation(async () => {
                if (storedCallbacks) {
                    storedCallbacks.onResponse({
                        choices: [{ message: { content: enhancedResponse } }],
                    });
                }
            });

            const result = await promptEnhancer.enhancePrompt(originalPrompt);

            expect(result.success).toBe(true);
            expect(mockConfigManager.getModel).toHaveBeenCalledWith('base');
        });

        it('should handle AI response error', async () => {
            const originalPrompt = 'test prompt';
            const errorMessage = 'AI processing failed';
            let storedCallbacks;

            mockAIAPIClient.setCallbacks.mockImplementation(callbacks => {
                storedCallbacks = callbacks;
            });

            mockAIAPIClient.sendUserMessage.mockImplementation(async () => {
                if (storedCallbacks) {
                    storedCallbacks.onError(new Error(errorMessage));
                }
            });

            const result = await promptEnhancer.enhancePrompt(originalPrompt);

            expect(result).toEqual({
                success: false,
                error: `AI processing failed: ${errorMessage}`,
            });
        });

        it('should handle no response from AI', async () => {
            const originalPrompt = 'test prompt';

            mockAIAPIClient.setCallbacks.mockImplementation(callbacks => {
                // Simulate no response
            });

            const result = await promptEnhancer.enhancePrompt(originalPrompt);

            expect(result).toEqual({
                success: false,
                error: 'No response received from AI',
            });
        });

        it('should handle invalid AI response format', async () => {
            const originalPrompt = 'test prompt';
            let storedCallbacks;

            mockAIAPIClient.setCallbacks.mockImplementation(callbacks => {
                storedCallbacks = callbacks;
            });

            mockAIAPIClient.sendUserMessage.mockImplementation(async () => {
                if (storedCallbacks) {
                    // Send empty content that will fail extraction
                    storedCallbacks.onResponse({
                        choices: [{ message: { content: '   ' } }], // whitespace only
                    });
                }
            });

            const result = await promptEnhancer.enhancePrompt(originalPrompt);

            expect(result).toEqual({
                success: false,
                error: 'Failed to extract enhanced prompt from AI response',
            });
        });

        it('should handle exceptions during enhancement', async () => {
            const originalPrompt = 'test prompt';
            const errorMessage = 'Network error';

            mockAIAPIClient.sendUserMessage.mockRejectedValue(new Error(errorMessage));

            const result = await promptEnhancer.enhancePrompt(originalPrompt);

            expect(result).toEqual({
                success: false,
                error: `Enhancement failed: ${errorMessage}`,
            });
        });

        it('should handle onReminder callback', async () => {
            const originalPrompt = 'test prompt';
            let reminderCallback;

            mockAIAPIClient.setCallbacks.mockImplementation(callbacks => {
                reminderCallback = callbacks.onReminder;
                setTimeout(() => {
                    callbacks.onResponse({
                        choices: [{ message: { content: 'Enhanced: Better prompt' } }],
                    });
                }, 0);
            });

            await promptEnhancer.enhancePrompt(originalPrompt);

            // Test reminder callback
            const reminderResult = reminderCallback('Test reminder');
            expect(reminderResult).toBe(`Test reminder\n Original prompt was: ${originalPrompt}`);
        });
    });

    describe('_extractEnhancedPrompt', () => {
        it('should extract prompt without prefix', () => {
            const response = 'This is a clean enhanced prompt';
            const result = promptEnhancer._extractEnhancedPrompt(response);
            expect(result).toBe('This is a clean enhanced prompt');
        });

        it('should remove "Enhanced prompt:" prefix', () => {
            const response = 'Enhanced prompt: This is the enhanced version';
            const result = promptEnhancer._extractEnhancedPrompt(response);
            expect(result).toBe('This is the enhanced version');
        });

        it('should remove "Here is the enhanced prompt:" prefix', () => {
            const response = 'Here is the enhanced prompt: Better version';
            const result = promptEnhancer._extractEnhancedPrompt(response);
            expect(result).toBe('Better version');
        });

        it('should handle case insensitive prefixes', () => {
            const response = 'ENHANCED PROMPT: Uppercase prefix';
            const result = promptEnhancer._extractEnhancedPrompt(response);
            expect(result).toBe('Uppercase prefix');
        });

        it('should return null for null input', () => {
            const result = promptEnhancer._extractEnhancedPrompt(null);
            expect(result).toBeNull();
        });

        it('should return null for non-string input', () => {
            const result = promptEnhancer._extractEnhancedPrompt(123);
            expect(result).toBeNull();
        });

        it('should handle empty string', () => {
            const result = promptEnhancer._extractEnhancedPrompt('');
            expect(result).toBeNull();
        });

        it('should trim whitespace', () => {
            const response = '   Enhanced prompt:   Trimmed content   ';
            const result = promptEnhancer._extractEnhancedPrompt(response);
            expect(result).toBe('Trimmed content');
        });
    });
});
