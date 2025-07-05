// tests/integration/reasoning.integration.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConfigManager from '../../src/config/managers/configManager.js';

// Mock dependencies
vi.mock('../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(),
}));

vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('Reasoning Integration Test', () => {
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
            '../../src/config/validation/configurationLoader.js'
        );
        const { getLogger } = await import('../../src/core/managers/logger.js');

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
                // Load actual providers.json to test real configuration
                const fs = require('fs');
                const path = require('path');
                const providersPath = path.join(
                    __dirname,
                    '../../src/config/defaults/providers.json'
                );
                const providersData = fs.readFileSync(providersPath, 'utf8');
                return JSON.parse(providersData);
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

    describe('Real providers.json integration', () => {
        it('should correctly identify reasoning models from actual providers.json', () => {
            // Test XAI models
            expect(configManager.isReasoningModel('grok-3-mini-beta')).toBe(true);

            // Test Google models
            expect(configManager.isReasoningModel('gemini-2.5-flash')).toBe(true);
            expect(configManager.isReasoningModel('gemini-2.5-pro')).toBe(true);
            expect(configManager.isReasoningModel('gemini-2.5-flash-lite-preview-06-17')).toBe(
                true
            );

            // Test OpenAI reasoning model
            expect(configManager.isReasoningModel('o4-mini')).toBe(true);

            // Test OpenAI non-reasoning models
            expect(configManager.isReasoningModel('gpt-4.1-mini')).toBe(false);
            expect(configManager.isReasoningModel('gpt-4.1-nano')).toBe(false);
            expect(configManager.isReasoningModel('gpt-4.1')).toBe(false);
            expect(configManager.isReasoningModel('gpt-4o')).toBe(false);
            expect(configManager.isReasoningModel('gpt-4o-mini')).toBe(false);

            // Test Anthropic models
            expect(configManager.isReasoningModel('claude-sonnet-4-20250514')).toBe(false);
            expect(configManager.isReasoningModel('claude-opus-4-20250514')).toBe(false);
            expect(configManager.isReasoningModel('claude-3-5-haiku-20241022')).toBe(false);

            // Test OpenRouter Google models
            expect(configManager.isReasoningModel('google/gemini-2.5-flash')).toBe(true);
            expect(configManager.isReasoningModel('google/gemini-2.5-pro')).toBe(true);
            expect(
                configManager.isReasoningModel('google/gemini-2.5-flash-lite-preview-06-17')
            ).toBe(true);

            // Test OpenRouter non-Google models
            expect(configManager.isReasoningModel('deepseek/deepseek-r1-0528')).toBe(false);
            expect(configManager.isReasoningModel('deepseek/deepseek-chat-v3-0324')).toBe(false);
            expect(configManager.isReasoningModel('anthropic/claude-sonnet-4')).toBe(false);
            expect(configManager.isReasoningModel('anthropic/claude-4-opus-20250522')).toBe(false);
            expect(configManager.isReasoningModel('anthropic/claude-3.5-haiku')).toBe(false);
        });

        it('should get correct model properties with provider information', () => {
            const xaiModel = configManager.getModelProperties('grok-3-mini-beta');
            expect(xaiModel).toBeDefined();
            expect(xaiModel.name).toBe('grok-3-mini-beta');
            expect(xaiModel.isReasoning).toBe(true);
            expect(xaiModel.provider).toBe('XAI');
            expect(xaiModel.baseUrl).toBe('https://api.x.ai/v1');

            const googleModel = configManager.getModelProperties('gemini-2.5-flash');
            expect(googleModel).toBeDefined();
            expect(googleModel.name).toBe('gemini-2.5-flash');
            expect(googleModel.isReasoning).toBe(true);
            expect(googleModel.provider).toBe('Google');
            expect(googleModel.baseUrl).toBe(
                'https://generativelanguage.googleapis.com/v1beta/openai/'
            );

            const openaiReasoningModel = configManager.getModelProperties('o4-mini');
            expect(openaiReasoningModel).toBeDefined();
            expect(openaiReasoningModel.name).toBe('o4-mini');
            expect(openaiReasoningModel.isReasoning).toBe(true);
            expect(openaiReasoningModel.provider).toBe('OpenAI');
            expect(openaiReasoningModel.baseUrl).toBe('https://api.openai.com/v1');

            const openaiNonReasoningModel = configManager.getModelProperties('gpt-4.1-mini');
            expect(openaiNonReasoningModel).toBeDefined();
            expect(openaiNonReasoningModel.name).toBe('gpt-4.1-mini');
            expect(openaiNonReasoningModel.isReasoning).toBe(false);
            expect(openaiNonReasoningModel.provider).toBe('OpenAI');
            expect(openaiNonReasoningModel.baseUrl).toBe('https://api.openai.com/v1');
        });

        it('should handle environment variable for reasoning effort', () => {
            // Test default
            expect(configManager.getReasoningEffort()).toBe('medium');

            // Test valid values
            process.env.SYNTHDEV_REASONING_EFFORT = 'low';
            expect(configManager.getReasoningEffort()).toBe('low');

            process.env.SYNTHDEV_REASONING_EFFORT = 'HIGH';
            expect(configManager.getReasoningEffort()).toBe('high');

            // Test invalid value falls back to default
            process.env.SYNTHDEV_REASONING_EFFORT = 'invalid';
            expect(configManager.getReasoningEffort()).toBe('medium');
        });
    });
});
