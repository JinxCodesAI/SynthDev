/**
 * Tests for ConfigurationWizard
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConfigurationWizard } from '../../../commands/config/ConfigurationWizard.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
}));

describe('ConfigurationWizard', () => {
    let wizard;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock providers.json
        const mockProviders = {
            providers: [
                {
                    name: 'OpenAI',
                    models: ['gpt-4.1', 'gpt-4.1-mini'],
                    baseUrl: 'https://api.openai.com/v1',
                },
                {
                    name: 'Anthropic',
                    models: ['claude-3-5-haiku'],
                    baseUrl: 'https://api.anthropic.com/v1/',
                },
            ],
        };

        // Mock config.example.env
        const mockExampleEnv = `# General AI Provider Configuration
SYNTHDEV_API_KEY=your_base_model_api_key
SYNTHDEV_BASE_MODEL=default-model
SYNTHDEV_BASE_URL=https://api.example.com/v1

# Verbosity Level (0-5)
SYNTHDEV_VERBOSITY_LEVEL=2`;

        // Mock config.example.openrouter.env
        const mockOpenRouterEnv = `SYNTHDEV_API_KEY=sk-or-v1-replace_me
SYNTHDEV_BASE_MODEL=google/gemini-2.5-flash-preview-05-20
SYNTHDEV_SMART_MODEL=google/gemini-2.5-flash-preview-05-20
SYNTHDEV_FAST_MODEL=google/gemini-2.5-flash-preview-05-20
SYNTHDEV_BASE_URL=https://openrouter.ai/api/v1
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
SYNTHDEV_VERBOSITY_LEVEL=2`;

        readFileSync.mockImplementation(path => {
            if (path.includes('providers.json')) {
                return JSON.stringify(mockProviders);
            } else if (path.includes('config.example.openrouter.env')) {
                return mockOpenRouterEnv;
            } else if (path.includes('config.example.env')) {
                return mockExampleEnv;
            } else if (path.includes('.env')) {
                return 'SYNTHDEV_API_KEY=test-key\nSYNTHDEV_BASE_MODEL=gpt-4.1';
            }
            return '';
        });

        existsSync.mockImplementation(path => {
            // Return true for example files so they get parsed
            if (path.includes('config.example')) {
                return true;
            }
            // Return false for .env file by default
            return false;
        });

        wizard = new ConfigurationWizard();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(wizard.providers).toBeDefined();
            expect(wizard.currentConfig).toBeDefined();
            expect(wizard.envVariables).toBeDefined();
        });

        it('should load providers configuration', () => {
            expect(wizard.providers.providers).toHaveLength(2);
            expect(wizard.providers.providers[0].name).toBe('OpenAI');
        });
    });

    describe('checkCompleteness', () => {
        it('should return incomplete when no .env file exists', () => {
            existsSync.mockReturnValue(false);
            wizard = new ConfigurationWizard();

            const result = wizard.checkCompleteness();

            expect(result.isComplete).toBe(false);
            expect(result.hasEnvFile).toBe(false);
            expect(result.missing).toContain('SYNTHDEV_API_KEY');
        });

        it('should return complete when all required fields are set', () => {
            existsSync.mockReturnValue(true);

            // Mock .env file content with complete configuration
            readFileSync.mockImplementation(path => {
                if (path.includes('providers.json')) {
                    return JSON.stringify({
                        providers: [
                            {
                                name: 'OpenAI',
                                models: ['gpt-4.1', 'gpt-4.1-mini'],
                                baseUrl: 'https://api.openai.com/v1',
                            },
                        ],
                    });
                } else if (path.includes('config.example.env')) {
                    return 'SYNTHDEV_API_KEY=your_base_model_api_key\nSYNTHDEV_VERBOSITY_LEVEL=2';
                } else if (path.includes('.env')) {
                    return 'SYNTHDEV_API_KEY=sk-test-key\nSYNTHDEV_BASE_URL=https://api.openai.com/v1\nSYNTHDEV_BASE_MODEL=gpt-4.1';
                }
                return '';
            });

            // Mock process.env with complete configuration
            const originalEnv = process.env;
            process.env = {
                ...originalEnv,
                SYNTHDEV_API_KEY: 'sk-test-key',
                SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
                SYNTHDEV_BASE_MODEL: 'gpt-4.1',
            };

            wizard = new ConfigurationWizard();
            const result = wizard.checkCompleteness();

            expect(result.isComplete).toBe(true);
            expect(result.hasEnvFile).toBe(true);
            expect(result.missing).toHaveLength(0);

            // Restore original env
            process.env = originalEnv;
        });
    });

    describe('getProviders', () => {
        it('should return list of providers', () => {
            const providers = wizard.getProviders();

            expect(providers).toHaveLength(2);
            expect(providers[0].name).toBe('OpenAI');
            expect(providers[1].name).toBe('Anthropic');
        });
    });

    describe('getModelsForProvider', () => {
        it('should return models for existing provider', () => {
            const models = wizard.getModelsForProvider('OpenAI');

            expect(models).toHaveLength(2);
            expect(models).toContain('gpt-4.1');
            expect(models).toContain('gpt-4.1-mini');
        });

        it('should return empty array for non-existing provider', () => {
            const models = wizard.getModelsForProvider('NonExistent');

            expect(models).toHaveLength(0);
        });
    });

    describe('getProvider', () => {
        it('should return provider object for existing provider', () => {
            const provider = wizard.getProvider('OpenAI');

            expect(provider).toBeDefined();
            expect(provider.name).toBe('OpenAI');
            expect(provider.baseUrl).toBe('https://api.openai.com/v1');
        });

        it('should return null for non-existing provider', () => {
            const provider = wizard.getProvider('NonExistent');

            expect(provider).toBeNull();
        });
    });

    describe('setConfigValue and getCurrentValue', () => {
        it('should set and get configuration values', () => {
            wizard.setConfigValue('TEST_KEY', 'test-value');

            const value = wizard.getCurrentValue('TEST_KEY');

            expect(value).toBe('test-value');
        });

        it('should return empty string for non-existing key', () => {
            const value = wizard.getCurrentValue('NON_EXISTING_KEY');

            expect(value).toBe('');
        });
    });

    describe('getConfigSummary', () => {
        it('should return configuration summary', () => {
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key');

            const summary = wizard.getConfigSummary();

            expect(summary.base.provider).toBe('OpenAI');
            expect(summary.base.model).toBe('gpt-4.1');
            expect(summary.base.apiKey).toBe('***set***');
        });

        it('should show "Not set" for missing values', () => {
            const summary = wizard.getConfigSummary();

            expect(summary.base.provider).toBe('Not set');
            expect(summary.base.model).toBe('Not set');
            expect(summary.base.apiKey).toBe('Not set');
        });
    });

    describe('saveConfiguration', () => {
        it('should save configuration to .env file', () => {
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1');

            const result = wizard.saveConfiguration();

            expect(result).toBe(true);
            expect(writeFileSync).toHaveBeenCalled();

            const writeCall = writeFileSync.mock.calls[0];
            expect(writeCall[1]).toContain('SYNTHDEV_API_KEY=sk-test-key');
            expect(writeCall[1]).toContain('SYNTHDEV_BASE_MODEL=gpt-4.1');
        });

        it('should handle save errors gracefully', () => {
            writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const result = wizard.saveConfiguration();

            expect(result).toBe(false);
        });
    });

    describe('getVariableDescription', () => {
        it('should return description for known variable', () => {
            const description = wizard.getVariableDescription('SYNTHDEV_VERBOSITY_LEVEL');

            expect(description).toContain('Verbosity Level');
        });

        it('should return empty string for unknown variable', () => {
            const description = wizard.getVariableDescription('UNKNOWN_VARIABLE');

            expect(description).toBe('');
        });
    });
});
