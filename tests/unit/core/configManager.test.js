// tests/unit/core/configManager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConfigManager from '../../../src/config/managers/configManager.js';
import { mockEnvVars } from '../../helpers/testUtils.js';
import { existsSync, readFileSync } from 'fs';

// Mock fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    };
});

// Mock configuration loader
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(() => ({
            models: {
                base: {
                    model: 'gpt-4.1-mini',
                    baseUrl: 'https://api.openai.com/v1',
                },
                smart: {
                    model: null,
                    baseUrl: null,
                },
                fast: {
                    model: null,
                    baseUrl: null,
                },
            },
            global_settings: {
                maxToolCalls: 50,
                enablePromptEnhancement: false,
                verbosityLevel: 2,
            },
            ui_settings: {
                defaultRole: 'dude',
                showStartupBanner: true,
                enableColors: true,
                promptPrefix: '💭 You: ',
            },
            tool_settings: {
                autoRun: true,
                defaultEncoding: 'utf8',
                modifiesFiles: false,
                maxFileSize: 10485760,
                defaultTimeout: 10000,
            },
            safety: {
                enableAISafetyCheck: true,
                fallbackToPatternMatching: true,
                maxScriptSize: 50000,
                scriptTimeout: {
                    min: 1000,
                    max: 30000,
                    default: 10000,
                },
            },
        })),
    })),
}));

// Mock configuration validator
vi.mock('../../../src/config/validation/configurationValidator.js', () => ({
    getConfigurationValidator: vi.fn(() => ({
        validateConfiguration: vi.fn(() => ({ success: true, errors: [] })),
    })),
}));

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
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
            SYNTHDEV_API_KEY: 'sk-test1234567890',
            SYNTHDEV_BASE_MODEL: 'gpt-4-mini',
            SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
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
                SYNTHDEV_API_KEY: '',
                SYNTHDEV_BASE_MODEL: '',
                SYNTHDEV_BASE_URL: '',
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

    describe('configuration completeness', () => {
        it('should not start wizard when configuration is complete with default-model', async () => {
            // Reset singleton instance
            ConfigManager.instance = null;

            // Mock .env file exists
            existsSync.mockReturnValue(true);

            // Set up complete configuration with default-model
            restoreEnv();
            restoreEnv = mockEnvVars({
                SYNTHDEV_API_KEY: 'sk-test1234567890',
                SYNTHDEV_BASE_MODEL: 'default-model',
                SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            });

            const instance = ConfigManager.getInstance();
            await instance.initialize();
            expect(instance.shouldStartConfigurationWizard()).toBe(false);
        });

        it('should start wizard when configuration has placeholder values', async () => {
            // Reset singleton instance
            ConfigManager.instance = null;

            // Mock .env file exists
            existsSync.mockReturnValue(true);

            // Set up configuration with placeholder values
            restoreEnv();
            restoreEnv = mockEnvVars({
                SYNTHDEV_API_KEY: 'your_base_model_api_key',
                SYNTHDEV_BASE_MODEL: 'default-model',
                SYNTHDEV_BASE_URL: 'https://api.example.com/v1',
            });

            const instance = ConfigManager.getInstance();
            await instance.initialize();
            expect(instance.shouldStartConfigurationWizard()).toBe(true);
        });

        it('should start wizard when required values are missing', async () => {
            // Reset singleton instance
            ConfigManager.instance = null;

            // Mock .env file exists
            existsSync.mockReturnValue(true);

            // Set up incomplete configuration
            restoreEnv();
            restoreEnv = mockEnvVars({
                SYNTHDEV_API_KEY: '',
                SYNTHDEV_BASE_MODEL: 'default-model',
                SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            });

            const instance = ConfigManager.getInstance();
            await instance.initialize();
            expect(instance.shouldStartConfigurationWizard()).toBe(true);
        });

        it('should start wizard when .env file does not exist', async () => {
            // Reset singleton instance
            ConfigManager.instance = null;

            // Mock .env file does not exist
            existsSync.mockReturnValue(false);

            // Set up environment variables (but no .env file)
            restoreEnv();
            restoreEnv = mockEnvVars({
                SYNTHDEV_API_KEY: 'sk-test1234567890',
                SYNTHDEV_BASE_MODEL: 'default-model',
                SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            });

            const instance = ConfigManager.getInstance();
            await instance.initialize();
            expect(instance.shouldStartConfigurationWizard()).toBe(true);
        });
    });
});
