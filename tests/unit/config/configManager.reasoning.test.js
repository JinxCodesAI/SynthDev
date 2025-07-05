// tests/unit/config/configManager.reasoning.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConfigManager from '../../../src/config/managers/configManager.js';

// Mock dependencies
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(),
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('ConfigManager Reasoning Functionality', () => {
    let configManager;
    let mockConfigLoader;
    let mockLogger;

    beforeEach(async () => {
        // Reset singleton
        ConfigManager.instance = null;

        // Clear all mocks
        vi.clearAllMocks();

        mockLogger = {
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        };

        mockConfigLoader = {
            loadConfig: vi.fn(),
        };

        // Mock the imports
        const { getConfigurationLoader } = await import(
            '../../../src/config/validation/configurationLoader.js'
        );
        const { getLogger } = await import('../../../src/core/managers/logger.js');

        getConfigurationLoader.mockReturnValue(mockConfigLoader);
        getLogger.mockReturnValue(mockLogger);

        // Mock application defaults
        mockConfigLoader.loadConfig.mockImplementation(path => {
            if (path === 'defaults/application.json') {
                return {
                    models: {},
                    global_settings: {},
                    ui_settings: {
                        defaultRole: 'assistant',
                        showStartupBanner: true,
                        enableColors: true,
                        promptPrefix: '> ',
                    },
                    tool_settings: {},
                    safety: {},
                };
            }
            if (path === 'defaults/providers.json') {
                return {
                    providers: [
                        {
                            name: 'OpenAI',
                            models: [
                                {
                                    name: 'gpt-4.1-mini',
                                    isReasoning: false,
                                    contextSize: 1000000,
                                },
                                {
                                    name: 'o4-mini',
                                    isReasoning: true,
                                    contextSize: 200000,
                                },
                            ],
                            baseUrl: 'https://api.openai.com/v1',
                        },
                        {
                            name: 'Google',
                            models: [
                                {
                                    name: 'gemini-2.5-flash',
                                    isReasoning: true,
                                    contextSize: 1000000,
                                },
                            ],
                            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                        },
                        {
                            name: 'XAI',
                            models: [
                                {
                                    name: 'grok-3-mini-beta',
                                    isReasoning: true,
                                    contextSize: 131072,
                                },
                            ],
                            baseUrl: 'https://api.x.ai/v1',
                        },
                    ],
                };
            }
            return {};
        });

        // Set environment variables
        process.env.SYNTHDEV_API_KEY = 'test-key';
        process.env.SYNTHDEV_BASE_MODEL = 'gpt-4.1-mini';
        process.env.SYNTHDEV_BASE_URL = 'https://api.openai.com/v1';

        configManager = ConfigManager.getInstance();
    });

    afterEach(() => {
        // Clean up environment variables
        delete process.env.SYNTHDEV_REASONING_EFFORT;
        vi.restoreAllMocks();
    });

    describe('getModelProperties', () => {
        it('should return model properties for existing model', () => {
            const props = configManager.getModelProperties('gpt-4.1-mini');

            expect(props).toBeDefined();
            expect(props.name).toBe('gpt-4.1-mini');
            expect(props.isReasoning).toBe(false);
            expect(props.provider).toBe('OpenAI');
            expect(props.baseUrl).toBe('https://api.openai.com/v1');
        });

        it('should return null for non-existing model', () => {
            const props = configManager.getModelProperties('non-existing-model');
            expect(props).toBeNull();
        });

        it('should find models across different providers', () => {
            const openaiModel = configManager.getModelProperties('gpt-4.1-mini');
            const googleModel = configManager.getModelProperties('gemini-2.5-flash');
            const xaiModel = configManager.getModelProperties('grok-3-mini-beta');

            expect(openaiModel.provider).toBe('OpenAI');
            expect(googleModel.provider).toBe('Google');
            expect(xaiModel.provider).toBe('XAI');
        });
    });

    describe('isReasoningModel', () => {
        it('should return true for reasoning models', () => {
            expect(configManager.isReasoningModel('o4-mini')).toBe(true);
            expect(configManager.isReasoningModel('gemini-2.5-flash')).toBe(true);
            expect(configManager.isReasoningModel('grok-3-mini-beta')).toBe(true);
        });

        it('should return false for non-reasoning models', () => {
            expect(configManager.isReasoningModel('gpt-4.1-mini')).toBe(false);
        });

        it('should return false for non-existing models', () => {
            expect(configManager.isReasoningModel('non-existing-model')).toBe(false);
        });
    });

    describe('getReasoningEffort', () => {
        it('should return default "medium" when no environment variable is set', () => {
            expect(configManager.getReasoningEffort()).toBe('medium');
        });

        it('should return valid effort levels from environment variable', () => {
            process.env.SYNTHDEV_REASONING_EFFORT = 'low';
            expect(configManager.getReasoningEffort()).toBe('low');

            process.env.SYNTHDEV_REASONING_EFFORT = 'medium';
            expect(configManager.getReasoningEffort()).toBe('medium');

            process.env.SYNTHDEV_REASONING_EFFORT = 'high';
            expect(configManager.getReasoningEffort()).toBe('high');
        });

        it('should handle case insensitive effort levels', () => {
            process.env.SYNTHDEV_REASONING_EFFORT = 'HIGH';
            expect(configManager.getReasoningEffort()).toBe('high');

            process.env.SYNTHDEV_REASONING_EFFORT = 'Low';
            expect(configManager.getReasoningEffort()).toBe('low');
        });

        it('should return default "medium" for invalid effort levels', () => {
            process.env.SYNTHDEV_REASONING_EFFORT = 'invalid';
            expect(configManager.getReasoningEffort()).toBe('medium');

            process.env.SYNTHDEV_REASONING_EFFORT = '';
            expect(configManager.getReasoningEffort()).toBe('medium');
        });
    });

    describe('getProvidersConfig', () => {
        it('should return providers configuration', () => {
            const config = configManager.getProvidersConfig();

            expect(config).toBeDefined();
            expect(config.providers).toBeInstanceOf(Array);
            expect(config.providers.length).toBeGreaterThan(0);

            // Should be a copy, not the original
            expect(config).not.toBe(configManager.providersConfig);
        });
    });
});
