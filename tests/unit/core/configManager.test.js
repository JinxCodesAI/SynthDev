// tests/unit/core/configManager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConfigManager from '../../../configManager.js';
import { mockEnvVars } from '../../helpers/testUtils.js';

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
}));

describe('ConfigManager', () => {
    let restoreEnv;

    beforeEach(() => {
        // Reset singleton instance
        ConfigManager.instance = null;
        vi.clearAllMocks();

        // Mock environment variables
        restoreEnv = mockEnvVars({
            API_KEY: 'sk-test1234567890',
            BASE_MODEL: 'gpt-4-mini',
            BASE_URL: 'https://api.openai.com/v1',
        });
    });

    afterEach(() => {
        if (restoreEnv) {
            restoreEnv();
        }
    });

    describe('getInstance', () => {
        it('should create singleton instance', () => {
            const instance1 = ConfigManager.getInstance();
            const instance2 = ConfigManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should accept CLI options', () => {
            const options = { apiKey: 'sk-cli1234567890' };
            const instance = ConfigManager.getInstance(options);
            expect(instance.cliOptions.apiKey).toBe('sk-cli1234567890');
        });

        it('should prioritize CLI options over environment variables', () => {
            const options = { apiKey: 'sk-cli1234567890', baseModel: 'cli-model' };
            const instance = ConfigManager.getInstance(options);

            expect(instance.cliOptions.apiKey).toBe('sk-cli1234567890');
            expect(instance.cliOptions.baseModel).toBe('cli-model');
        });
    });

    describe('configuration loading', () => {
        it('should load configuration from environment variables', () => {
            const instance = ConfigManager.getInstance();
            const config = instance.config;

            expect(config.base.apiKey).toBe('sk-test1234567890');
            expect(config.base.baseModel).toBe('gpt-4-mini');
            expect(config.base.baseUrl).toBe('https://api.openai.com/v1');
        });

        it('should use CLI options over environment variables', () => {
            const options = {
                apiKey: 'sk-cli1234567890',
                baseModel: 'cli-model',
            };
            const instance = ConfigManager.getInstance(options);
            const config = instance.config;

            expect(config.base.apiKey).toBe('sk-cli1234567890');
            expect(config.base.baseModel).toBe('cli-model');
        });

        it('should fall back to defaults when no env vars or CLI options', () => {
            // Clear environment variables
            restoreEnv();
            restoreEnv = mockEnvVars({
                API_KEY: '',
                BASE_MODEL: '',
                BASE_URL: '',
            });

            const instance = ConfigManager.getInstance();
            const config = instance.config;

            expect(config.base.baseModel).toBe('gpt-4.1-mini');
            expect(config.base.baseUrl).toBe('https://api.openai.com/v1');
        });
    });

    describe('getModel', () => {
        it('should return base model configuration', () => {
            const instance = ConfigManager.getInstance();
            const modelConfig = instance.getModel('base');

            expect(modelConfig).toHaveProperty('apiKey');
            expect(modelConfig).toHaveProperty('baseModel');
            expect(modelConfig).toHaveProperty('baseUrl');
        });

        it('should return smart model configuration when available', () => {
            const options = {
                smartApiKey: 'sk-smart1234567890',
                smartModel: 'gpt-4',
                smartUrl: 'https://smart.api.com',
            };
            const instance = ConfigManager.getInstance(options);
            const modelConfig = instance.getModel('smart');

            expect(modelConfig.apiKey).toBe('sk-smart1234567890');
            expect(modelConfig.model).toBe('gpt-4');
            expect(modelConfig.baseUrl).toBe('https://smart.api.com');
        });
    });

    describe('validation', () => {
        it('should not be validated initially', () => {
            const instance = ConfigManager.getInstance();
            expect(instance.isValidated).toBe(false);
        });

        it('should mark as validated after initialize', async () => {
            const instance = ConfigManager.getInstance();
            await instance.initialize();
            expect(instance.isValidated).toBe(true);
        });
    });
});
