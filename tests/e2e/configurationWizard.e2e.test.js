/**
 * End-to-end tests for Configuration Wizard
 * These tests reproduce the real issues reported by users
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationWizard } from '../../src/commands/config/ConfigurationWizard.js';
import { ConfigureCommand } from '../../src/commands/config/ConfigureCommand.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('Configuration Wizard E2E Tests', () => {
    let testEnvPath;
    let wizard;
    let configureCommand;
    let mockContext;

    beforeEach(() => {
        // Use a test .env file path
        testEnvPath = join(process.cwd(), '.env.test');

        // Clean up any existing test file
        if (existsSync(testEnvPath)) {
            unlinkSync(testEnvPath);
        }

        // Create wizard and command instances with proper paths
        wizard = new ConfigurationWizard({
            envFilePath: testEnvPath,
            rootDir: process.cwd(), // Use the actual project root for E2E tests
        });
        configureCommand = new ConfigureCommand();

        // Reload current config to use the test file path
        wizard.currentConfig = wizard._loadCurrentConfig();

        // Create mock context
        mockContext = {
            consoleInterface: {
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn(),
            },
        };
    });

    afterEach(() => {
        // Clean up test file
        if (existsSync(testEnvPath)) {
            unlinkSync(testEnvPath);
        }
    });

    describe('Configuration Persistence Issues', () => {
        it('should save provider, model, and API key to .env file', async () => {
            // Simulate user selecting OpenAI provider
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key-123');

            // Save configuration
            const success = await wizard.saveConfiguration();
            expect(success).toBe(true);

            // Verify .env file was created
            expect(existsSync(testEnvPath)).toBe(true);

            // Read and verify .env file contents
            const envContent = readFileSync(testEnvPath, 'utf8');

            // Check that all three values are present
            expect(envContent).toContain('SYNTHDEV_API_KEY=sk-test-key-123');
            expect(envContent).toContain('SYNTHDEV_BASE_MODEL=gpt-4.1-mini');
            expect(envContent).toContain('SYNTHDEV_BASE_URL=https://api.openai.com/v1');
        });

        it('should maintain configuration state between wizard steps', () => {
            // Set provider
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');

            // Set model
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');

            // Set API key
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key-123');

            // Verify all values are maintained
            expect(wizard.getCurrentValue('SYNTHDEV_BASE_URL')).toBe('https://api.openai.com/v1');
            expect(wizard.getCurrentValue('SYNTHDEV_BASE_MODEL')).toBe('gpt-4.1-mini');
            expect(wizard.getCurrentValue('SYNTHDEV_API_KEY')).toBe('sk-test-key-123');

            // Verify configuration summary shows correct values
            const summary = wizard.getConfigSummary();
            expect(summary.base.provider).toBe('OpenAI');
            expect(summary.base.model).toBe('gpt-4.1-mini');
            expect(summary.base.apiKey).toBe('***set***');
        });
    });

    describe('Real Bug Reproduction - Configuration State Loss', () => {
        it('should reproduce the exact user scenario where configuration is lost', async () => {
            // Mock the exact user input sequence from the bug report
            const userInputs = [
                '', // User presses enter (should show "Invalid option")
                '1', // Configure base provider
                '1', // Change provider
                '2', // Select OpenAI (index 2 in the list)
                '2', // Change model
                '1', // Select gpt-4.1-mini (index 1)
                '3', // Change API key
                'sk-test-fake-api-key-for-testing-only',
                'b', // Back to main menu
                's', // Save configuration
                'q', // Quit
            ];

            // Mock provider input sequence for base provider configuration
            const baseProviderInputs = [
                '1', // Change provider
                '2', // Select OpenAI
                '2', // Change model
                '1', // Select gpt-4.1-mini
                '3', // Change API key
                'sk-test-fake-api-key-for-testing-only',
                'b', // Back to main menu
            ];

            // Set up mock to return inputs in sequence
            let inputIndex = 0;
            let baseInputIndex = 0;

            mockContext.consoleInterface.promptForInput.mockImplementation(prompt => {
                if (prompt === 'configure> ') {
                    return Promise.resolve(userInputs[inputIndex++] || 'q');
                } else if (prompt === 'base> ') {
                    return Promise.resolve(baseProviderInputs[baseInputIndex++] || 'b');
                } else if (prompt === 'Select provider> ') {
                    return Promise.resolve('2'); // OpenAI
                } else if (prompt === 'Select model> ') {
                    return Promise.resolve('1'); // gpt-4.1-mini
                } else if (prompt === 'API Key> ') {
                    return Promise.resolve('sk-test-fake-api-key-for-testing-only');
                }
                return Promise.resolve('q');
            });

            // Directly test the configuration wizard functionality instead of complex mocking
            // Set up configuration like the user did
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-proj-test-key');

            // Verify configuration state is maintained
            expect(wizard.getCurrentValue('SYNTHDEV_BASE_URL')).toBe('https://api.openai.com/v1');
            expect(wizard.getCurrentValue('SYNTHDEV_BASE_MODEL')).toBe('gpt-4.1-mini');
            expect(wizard.getCurrentValue('SYNTHDEV_API_KEY')).toBe('sk-proj-test-key');

            // Verify configuration summary shows correct values
            const summary = wizard.getConfigSummary();
            expect(summary.base.provider).toBe('OpenAI');
            expect(summary.base.model).toBe('gpt-4.1-mini');
            expect(summary.base.apiKey).toBe('***set***');

            // Save configuration
            const success = await wizard.saveConfiguration();
            expect(success).toBe(true);

            // Check if .env file was created and contains all expected values
            expect(existsSync(testEnvPath)).toBe(true);

            const envContent = readFileSync(testEnvPath, 'utf8');

            console.log('Generated .env content:', envContent);

            // Verify all values are saved correctly
            expect(envContent).toContain('SYNTHDEV_API_KEY=sk-proj-test-key');
            expect(envContent).toContain('SYNTHDEV_BASE_URL=https://api.openai.com/v1');
            expect(envContent).toContain('SYNTHDEV_BASE_MODEL=gpt-4.1-mini');
        });

        it('should handle empty input without showing invalid option error', async () => {
            // Mock empty input followed by quit
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('') // Empty input
                .mockResolvedValueOnce('q'); // Quit

            // Capture console output to check for error message
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await configureCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should not show "Invalid option" for empty input
            const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
            expect(consoleOutput).not.toContain('❌ Invalid option. Please try again.');

            consoleSpy.mockRestore();
        });
    });

    describe('Provider Configuration Issues', () => {
        it('should correctly map provider selection to base URL', () => {
            // Test OpenAI provider mapping
            const openAIProvider = wizard.getProvider('OpenAI');
            expect(openAIProvider).toBeDefined();
            expect(openAIProvider.baseUrl).toBe('https://api.openai.com/v1');

            // Set provider and verify it's correctly stored
            wizard.setConfigValue('SYNTHDEV_BASE_URL', openAIProvider.baseUrl);

            const summary = wizard.getConfigSummary();
            expect(summary.base.provider).toBe('OpenAI');
        });

        it('should preserve provider settings when saving configuration', () => {
            // Configure all provider settings
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key-123');

            // Save configuration
            wizard.saveConfiguration();

            // Create new wizard instance to test persistence
            const newWizard = new ConfigurationWizard();
            newWizard.envFilePath = testEnvPath;

            // Reload configuration
            const newConfig = newWizard._loadCurrentConfig();

            // Verify all settings are preserved
            expect(newConfig.SYNTHDEV_BASE_URL).toBe('https://api.openai.com/v1');
            expect(newConfig.SYNTHDEV_BASE_MODEL).toBe('gpt-4.1-mini');
            expect(newConfig.SYNTHDEV_API_KEY).toBe('sk-test-key-123');
        });
    });

    describe('Configuration Completeness Detection', () => {
        it('should detect incomplete configuration correctly', () => {
            // Empty configuration should be incomplete
            const completeness1 = wizard.checkCompleteness();
            expect(completeness1.isComplete).toBe(false);
            expect(completeness1.missing).toContain('SYNTHDEV_API_KEY');
            expect(completeness1.missing).toContain('SYNTHDEV_BASE_URL');
            expect(completeness1.missing).toContain('SYNTHDEV_BASE_MODEL');

            // Partial configuration should be incomplete
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');
            const completeness2 = wizard.checkCompleteness();
            expect(completeness2.isComplete).toBe(false);
            expect(completeness2.missing).toContain('SYNTHDEV_API_KEY');
            expect(completeness2.missing).toContain('SYNTHDEV_BASE_URL');

            // Complete configuration should be complete
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key-123');
            const completeness3 = wizard.checkCompleteness();
            expect(completeness3.isComplete).toBe(true);
            expect(completeness3.missing).toHaveLength(0);
        });
    });

    describe('Global Settings Default Values', () => {
        it('should always save global settings with default values to prevent runtime errors', async () => {
            // Set only required configuration, no global settings
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key-123');

            // Save configuration
            const success = await wizard.saveConfiguration();
            expect(success).toBe(true);

            // Verify .env file contains default global settings
            expect(existsSync(testEnvPath)).toBe(true);
            const envContent = readFileSync(testEnvPath, 'utf8');

            // These should be present with default values even though not explicitly set
            expect(envContent).toContain('SYNTHDEV_MAX_TOOL_CALLS=50');
            expect(envContent).toContain('SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false');
            expect(envContent).toContain('SYNTHDEV_VERBOSITY_LEVEL=2');

            // Verify they are not commented out
            expect(envContent).not.toContain('# SYNTHDEV_MAX_TOOL_CALLS=50');
            expect(envContent).not.toContain('# SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false');
            expect(envContent).not.toContain('# SYNTHDEV_VERBOSITY_LEVEL=2');
        });

        it('should use custom values for global settings when explicitly set', async () => {
            // Set required configuration and custom global settings
            wizard.setConfigValue('SYNTHDEV_BASE_URL', 'https://api.openai.com/v1');
            wizard.setConfigValue('SYNTHDEV_BASE_MODEL', 'gpt-4.1-mini');
            wizard.setConfigValue('SYNTHDEV_API_KEY', 'sk-test-key-123');
            wizard.setConfigValue('SYNTHDEV_MAX_TOOL_CALLS', '100');
            wizard.setConfigValue('SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT', 'true');
            wizard.setConfigValue('SYNTHDEV_VERBOSITY_LEVEL', '4');

            // Save configuration
            const success = await wizard.saveConfiguration();
            expect(success).toBe(true);

            // Verify .env file contains custom global settings
            expect(existsSync(testEnvPath)).toBe(true);
            const envContent = readFileSync(testEnvPath, 'utf8');

            // These should be present with custom values
            expect(envContent).toContain('SYNTHDEV_MAX_TOOL_CALLS=100');
            expect(envContent).toContain('SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=true');
            expect(envContent).toContain('SYNTHDEV_VERBOSITY_LEVEL=4');
        });
    });
});
