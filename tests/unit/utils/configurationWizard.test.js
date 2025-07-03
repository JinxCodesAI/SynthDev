/**
 * Tests for ConfigurationWizard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationWizard } from '../../../utils/ConfigurationWizard.js';

// Mock dependencies
vi.mock('../../../configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(() => ({
            providers: [
                {
                    name: 'OpenAI',
                    models: ['gpt-4.1-mini', 'gpt-4o'],
                    baseUrl: 'https://api.openai.com/v1',
                },
                {
                    name: 'Google',
                    models: ['gemini-2.5-flash'],
                    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                },
            ],
        })),
    })),
}));

vi.mock('../../../utils/EnvFileManager.js', () => ({
    EnvFileManager: vi.fn().mockImplementation(() => ({
        writeEnvFile: vi.fn(() => true),
        readEnvFile: vi.fn(() => ({})),
        envFileExists: vi.fn(() => false),
    })),
}));

vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

vi.mock('readline', () => ({
    createInterface: vi.fn(() => ({
        question: vi.fn(),
        close: vi.fn(),
    })),
}));

describe('ConfigurationWizard', () => {
    let wizard;
    let mockEnvManager;
    let mockReadline;

    beforeEach(async () => {
        wizard = new ConfigurationWizard();

        // Get the mocked env manager instance
        mockEnvManager = wizard.envManager;

        // Mock readline interface
        mockReadline = {
            question: vi.fn(),
            close: vi.fn(),
        };

        const { createInterface } = await import('readline');
        createInterface.mockReturnValue(mockReadline);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with correct properties', () => {
            expect(wizard).toBeDefined();
            expect(wizard.envManager).toBeDefined();
            expect(wizard.configLoader).toBeDefined();
            expect(wizard.logger).toBeDefined();
        });
    });

    describe('Provider Loading', () => {
        it('should load providers configuration', () => {
            const providers = wizard._loadProviders();

            expect(providers).toBeDefined();
            expect(providers.providers).toBeInstanceOf(Array);
            expect(providers.providers.length).toBeGreaterThan(0);
        });

        it('should handle provider loading failure with fallback', () => {
            // Mock the config loader to throw an error
            wizard.configLoader.loadConfig.mockImplementation(() => {
                throw new Error('Config load failed');
            });

            const providers = wizard._loadProviders();

            expect(providers).toBeDefined();
            expect(providers.providers).toBeInstanceOf(Array);
            expect(providers.providers[0].name).toBe('OpenAI');
        });
    });

    describe('Welcome Message', () => {
        it('should show welcome message for manual start', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            wizard._showWelcome(false);

            expect(consoleSpy).toHaveBeenCalledWith('\n🔧 Synth-Dev Configuration Wizard');
            expect(consoleSpy).toHaveBeenCalledWith(
                "Welcome! Let's configure your Synth-Dev setup.\n"
            );

            consoleSpy.mockRestore();
        });

        it('should show welcome message for auto start', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            wizard._showWelcome(true);

            expect(consoleSpy).toHaveBeenCalledWith('\n🔧 Synth-Dev Configuration Wizard');
            expect(consoleSpy).toHaveBeenCalledWith('⚠️  Configuration is incomplete or missing.');

            consoleSpy.mockRestore();
        });
    });

    describe('Provider Selection', () => {
        it('should handle valid provider selection', async () => {
            wizard.providers = {
                providers: [
                    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
                    {
                        name: 'Google',
                        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                    },
                ],
            };

            // Set up the readline interface
            wizard.rl = mockReadline;

            // Mock user selecting first provider
            mockReadline.question.mockImplementation((prompt, callback) => {
                callback('1');
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._chooseProvider();

            expect(result).toEqual({
                name: 'OpenAI',
                baseUrl: 'https://api.openai.com/v1',
            });

            consoleSpy.mockRestore();
        });

        it('should handle cancellation', async () => {
            wizard.providers = {
                providers: [{ name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
            };

            // Set up the readline interface
            wizard.rl = mockReadline;

            // Mock user cancelling
            mockReadline.question.mockImplementation((prompt, callback) => {
                callback('0');
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await expect(wizard._chooseProvider()).rejects.toThrow('WIZARD_CANCELLED');

            consoleSpy.mockRestore();
        });

        it('should handle invalid selection and retry', async () => {
            wizard.providers = {
                providers: [{ name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
            };

            // Set up the readline interface
            wizard.rl = mockReadline;

            let callCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                callCount++;
                if (callCount === 1) {
                    callback('99'); // Invalid choice
                } else {
                    callback('1'); // Valid choice
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._chooseProvider();

            expect(result.name).toBe('OpenAI');
            expect(callCount).toBe(2);

            consoleSpy.mockRestore();
        });
    });

    describe('Model Selection', () => {
        it('should handle model selection', async () => {
            const provider = {
                name: 'OpenAI',
                models: ['gpt-4.1-mini', 'gpt-4o'],
                baseUrl: 'https://api.openai.com/v1',
            };

            // Set up the readline interface
            wizard.rl = mockReadline;

            // Mock user selecting first model
            mockReadline.question.mockImplementation((prompt, callback) => {
                callback('1');
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._chooseModel(provider);

            expect(result).toBe('gpt-4.1-mini');

            consoleSpy.mockRestore();
        });

        it('should handle pagination for many models', async () => {
            const provider = {
                name: 'OpenAI',
                models: ['model1', 'model2', 'model3', 'model4', 'model5', 'model6', 'model7'],
                baseUrl: 'https://api.openai.com/v1',
            };

            // Set up the readline interface
            wizard.rl = mockReadline;

            let callCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                callCount++;
                if (callCount === 1) {
                    callback('n'); // Next page
                } else {
                    callback('6'); // Select model 6
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._chooseModel(provider);

            expect(result).toBe('model6');
            expect(callCount).toBe(2);

            consoleSpy.mockRestore();
        });
    });

    describe('API Key Entry', () => {
        it('should accept valid API key', async () => {
            const provider = { name: 'OpenAI' };
            const validApiKey = 'sk-1234567890abcdef';

            // Set up the readline interface
            wizard.rl = mockReadline;

            mockReadline.question.mockImplementation((prompt, callback) => {
                callback(validApiKey);
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._enterApiKey(provider);

            expect(result).toBe(validApiKey);

            consoleSpy.mockRestore();
        });

        it('should reject empty API key and retry', async () => {
            const provider = { name: 'OpenAI' };
            const validApiKey = 'sk-1234567890abcdef';

            // Set up the readline interface
            wizard.rl = mockReadline;

            let callCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                callCount++;
                if (callCount === 1) {
                    callback(''); // Empty key
                } else {
                    callback(validApiKey); // Valid key
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._enterApiKey(provider);

            expect(result).toBe(validApiKey);
            expect(callCount).toBe(2);

            consoleSpy.mockRestore();
        });

        it('should reject short API key and retry', async () => {
            const provider = { name: 'OpenAI' };
            const validApiKey = 'sk-1234567890abcdef';

            // Set up the readline interface
            wizard.rl = mockReadline;

            let callCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                callCount++;
                if (callCount === 1) {
                    callback('short'); // Too short
                } else {
                    callback(validApiKey); // Valid key
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._enterApiKey(provider);

            expect(result).toBe(validApiKey);
            expect(callCount).toBe(2);

            consoleSpy.mockRestore();
        });

        it('should handle cancellation', async () => {
            const provider = { name: 'OpenAI' };

            // Set up the readline interface
            wizard.rl = mockReadline;

            mockReadline.question.mockImplementation((prompt, callback) => {
                callback('cancel');
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await expect(wizard._enterApiKey(provider)).rejects.toThrow('WIZARD_CANCELLED');

            consoleSpy.mockRestore();
        });
    });

    describe('Global Settings', () => {
        it('should configure verbosity level', async () => {
            // Set up the readline interface
            wizard.rl = mockReadline;

            mockReadline.question.mockImplementation((prompt, callback) => {
                if (prompt.includes('verbosity')) {
                    callback('3');
                } else {
                    callback(''); // Default for other settings
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._configureGlobalSettings();

            expect(result.SYNTHDEV_VERBOSITY_LEVEL).toBe(3);

            consoleSpy.mockRestore();
        });

        it('should configure max tool calls', async () => {
            // Set up the readline interface
            wizard.rl = mockReadline;

            mockReadline.question.mockImplementation((prompt, callback) => {
                if (prompt.includes('tool calls')) {
                    callback('100');
                } else {
                    callback(''); // Default for other settings
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._configureGlobalSettings();

            expect(result.SYNTHDEV_MAX_TOOL_CALLS).toBe(100);

            consoleSpy.mockRestore();
        });

        it('should use defaults when empty input', async () => {
            // Set up the readline interface
            wizard.rl = mockReadline;

            mockReadline.question.mockImplementation((prompt, callback) => {
                callback(''); // Empty input for all
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._configureGlobalSettings();

            expect(result).toEqual({});

            consoleSpy.mockRestore();
        });
    });

    describe('Full Wizard Flow', () => {
        it('should complete full wizard successfully', async () => {
            wizard.providers = {
                providers: [
                    {
                        name: 'OpenAI',
                        models: ['gpt-4.1-mini'],
                        baseUrl: 'https://api.openai.com/v1',
                    },
                ],
            };

            let questionCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                questionCount++;
                if (prompt.includes('Select provider')) {
                    callback('1'); // Select OpenAI
                } else if (prompt.includes('Select model')) {
                    callback('1'); // Select first model
                } else if (prompt.includes('API key')) {
                    callback('sk-1234567890abcdef'); // Valid API key
                } else if (prompt.includes('Configure smart model')) {
                    callback('n'); // Skip smart model
                } else if (prompt.includes('Configure fast model')) {
                    callback('n'); // Skip fast model
                } else {
                    callback(''); // Default for other settings
                }
            });

            mockEnvManager.writeEnvFile.mockReturnValue(true);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockEnvManager.writeEnvFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    SYNTHDEV_API_KEY: 'sk-1234567890abcdef',
                    SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
                    SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
                })
            );

            consoleSpy.mockRestore();
        });

        it('should handle wizard cancellation', async () => {
            wizard.providers = {
                providers: [
                    {
                        name: 'OpenAI',
                        models: ['gpt-4.1-mini'],
                        baseUrl: 'https://api.openai.com/v1',
                    },
                ],
            };

            // Set up the readline interface
            wizard.rl = mockReadline;

            mockReadline.question.mockImplementation((prompt, callback) => {
                callback('0'); // Cancel
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(false);
            expect(mockEnvManager.writeEnvFile).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle env file write failure', async () => {
            wizard.providers = {
                providers: [
                    {
                        name: 'OpenAI',
                        models: ['gpt-4.1-mini'],
                        baseUrl: 'https://api.openai.com/v1',
                    },
                ],
            };

            mockReadline.question.mockImplementation((prompt, callback) => {
                if (prompt.includes('Select provider')) {
                    callback('1');
                } else if (prompt.includes('Select model')) {
                    callback('1');
                } else if (prompt.includes('API key')) {
                    callback('sk-1234567890abcdef');
                } else if (prompt.includes('Configure smart model')) {
                    callback('n'); // Skip smart model
                } else if (prompt.includes('Configure fast model')) {
                    callback('n'); // Skip fast model
                } else {
                    callback('');
                }
            });

            mockEnvManager.writeEnvFile.mockReturnValue(false); // Simulate failure
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(false);

            consoleSpy.mockRestore();
        });

        it('should configure smart and fast models when requested', async () => {
            wizard.providers = {
                providers: [
                    {
                        name: 'OpenAI',
                        models: ['gpt-4.1-mini', 'gpt-4o'],
                        baseUrl: 'https://api.openai.com/v1',
                    },
                ],
            };

            let questionCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                questionCount++;
                if (prompt.includes('Select provider')) {
                    callback('1'); // Select OpenAI
                } else if (prompt.includes('Select model')) {
                    callback('1'); // Select first model
                } else if (prompt.includes('API key')) {
                    callback('sk-1234567890abcdef'); // Valid API key
                } else if (prompt.includes('Configure smart model')) {
                    callback('y'); // Configure smart model
                } else if (prompt.includes('Configure fast model')) {
                    callback('y'); // Configure fast model
                } else if (prompt.includes('Use same provider')) {
                    callback('y'); // Use same provider
                } else {
                    callback(''); // Default for other settings
                }
            });

            mockEnvManager.writeEnvFile.mockReturnValue(true);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockEnvManager.writeEnvFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    SYNTHDEV_API_KEY: 'sk-1234567890abcdef',
                    SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
                    SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
                    SYNTHDEV_SMART_MODEL: 'gpt-4.1-mini',
                    SYNTHDEV_FAST_MODEL: 'gpt-4.1-mini',
                })
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Smart and Fast Model Configuration', () => {
        beforeEach(async () => {
            wizard.rl = mockReadline;
        });

        it('should configure smart model with separate provider', async () => {
            wizard.providers = {
                providers: [
                    {
                        name: 'OpenAI',
                        models: ['gpt-4.1-mini'],
                        baseUrl: 'https://api.openai.com/v1',
                    },
                    {
                        name: 'Google',
                        models: ['gemini-2.5-flash'],
                        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                    },
                ],
            };

            let questionCount = 0;
            mockReadline.question.mockImplementation((prompt, callback) => {
                questionCount++;
                if (prompt.includes('Configure smart model')) {
                    callback('y'); // Configure smart model
                } else if (prompt.includes('Use same provider')) {
                    callback('n'); // Use different provider
                } else if (prompt.includes('Select provider')) {
                    callback('2'); // Select Google
                } else if (prompt.includes('Select model')) {
                    callback('1'); // Select first model
                } else if (prompt.includes('API key')) {
                    callback('google-api-key-123'); // Different API key
                } else {
                    callback('');
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._configureSmartModel();

            expect(result).toEqual({
                SYNTHDEV_SMART_API_KEY: 'google-api-key-123',
                SYNTHDEV_SMART_MODEL: 'gemini-2.5-flash',
                SYNTHDEV_SMART_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            });

            consoleSpy.mockRestore();
        });

        it('should skip smart model configuration when declined', async () => {
            mockReadline.question.mockImplementation((prompt, callback) => {
                if (prompt.includes('Configure smart model')) {
                    callback('n'); // Skip smart model
                } else {
                    callback('');
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._configureSmartModel();

            expect(result).toEqual({});

            consoleSpy.mockRestore();
        });

        it('should configure prompt enhancement setting', async () => {
            mockReadline.question.mockImplementation((prompt, callback) => {
                if (prompt.includes('Enable prompt enhancement')) {
                    callback('y'); // Enable prompt enhancement
                } else {
                    callback('');
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard._choosePromptEnhancement();

            expect(result).toBe(true);

            consoleSpy.mockRestore();
        });
    });
});
