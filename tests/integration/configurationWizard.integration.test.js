/**
 * Integration tests for ConfigurationWizard
 * Tests end-to-end functionality including user input handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationWizard } from '../../utils/ConfigurationWizard.js';

// Mock readline module
vi.mock('readline', () => ({
    createInterface: vi.fn(),
}));

// Mock dependencies
vi.mock('../../configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(() => ({
            providers: [
                {
                    name: 'OpenAI',
                    models: ['gpt-4.1-mini', 'gpt-4o'],
                    baseUrl: 'https://api.openai.com/v1',
                },
            ],
        })),
    })),
}));

vi.mock('../../utils/EnvFileManager.js', () => ({
    EnvFileManager: vi.fn().mockImplementation(() => ({
        writeEnvFile: vi.fn(() => true),
        readEnvFile: vi.fn(() => ({
            SYNTHDEV_API_KEY: 'existing-key',
            SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
        })),
        envFileExists: vi.fn(() => true),
    })),
}));

vi.mock('../../logger.js', () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

describe('ConfigurationWizard Integration Tests', () => {
    let wizard;
    let mockReadline;
    let inputSequence;
    let inputIndex;

    beforeEach(async () => {
        wizard = new ConfigurationWizard();
        inputSequence = [];
        inputIndex = 0;

        // Mock readline interface with proper input simulation
        mockReadline = {
            question: vi.fn((prompt, callback) => {
                // Simulate async input
                setTimeout(() => {
                    const input = inputSequence[inputIndex] || '0'; // Default to cancel
                    inputIndex++;
                    callback(input);
                }, 10);
            }),
            close: vi.fn(),
        };

        // Mock createInterface to return our mock
        const { createInterface } = await import('readline');
        createInterface.mockReturnValue(mockReadline);
    });

    afterEach(() => {
        vi.clearAllMocks();
        inputIndex = 0;
        inputSequence = [];
    });

    describe('User Input Handling', () => {
        it('should handle configuration menu navigation correctly', async () => {
            // Simulate user selecting "Change Verbosity Level" then "Save and Exit"
            inputSequence = ['4', '3', '8'];

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(3);

            // Check that the questions were asked in the right order
            const calls = mockReadline.question.mock.calls;
            expect(calls[0][0]).toContain('Select option (0-8)');
            expect(calls[1][0]).toContain('Choose verbosity');
            expect(calls[2][0]).toContain('Select option (0-8)');

            consoleSpy.mockRestore();
        });

        it('should handle provider selection correctly', async () => {
            // Simulate user selecting "Change Base Model" -> Provider 1 -> Model 1 -> API key -> Save
            inputSequence = ['1', '1', '1', 'sk-test123456789', '8'];

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(5);

            consoleSpy.mockRestore();
        });

        it('should handle cancellation correctly', async () => {
            // Simulate user cancelling
            inputSequence = ['0'];

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(false);
            expect(mockReadline.question).toHaveBeenCalledTimes(1);

            consoleSpy.mockRestore();
        });

        it('should handle invalid input and retry', async () => {
            // Simulate invalid input then valid selection
            inputSequence = ['99', '8']; // Invalid option, then save and exit

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });

        it('should handle full configuration setup', async () => {
            // Simulate full setup: menu option 7 -> provider 1 -> model 1 -> api key -> skip smart -> skip fast -> defaults for global
            inputSequence = ['7', '1', '1', 'sk-test123456789', 'n', 'n', '', '', ''];

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(9);

            consoleSpy.mockRestore();
        });

        it('should show current configuration before menu', async () => {
            inputSequence = ['8']; // Just save and exit

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await wizard.startWizard(false);

            // Check that current configuration was displayed
            const logCalls = consoleSpy.mock.calls.map(call => call[0]);
            expect(
                logCalls.some(call => call && call.includes('Current Configuration Status'))
            ).toBe(true);
            expect(logCalls.some(call => call && call.includes('Base Model:'))).toBe(true);
            expect(logCalls.some(call => call && call.includes('Smart Model:'))).toBe(true);
            expect(logCalls.some(call => call && call.includes('Fast Model:'))).toBe(true);

            consoleSpy.mockRestore();
        });

        it('should handle smart model configuration with same provider', async () => {
            // Configure smart model using same provider
            inputSequence = ['2', 'y', 'y', '2', '8']; // Smart model -> yes -> same provider -> model 2 -> save

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(5);

            consoleSpy.mockRestore();
        });

        it('should handle smart model configuration with different provider', async () => {
            // Configure smart model with different provider
            inputSequence = ['2', 'y', 'n', '1', '1', 'sk-smart123456789', '8']; // Smart model -> yes -> different provider -> provider 1 -> model 1 -> api key -> save

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(7);

            consoleSpy.mockRestore();
        });

        it('should show pending changes after each configuration', async () => {
            // Change verbosity, then save
            inputSequence = ['4', '3', '8'];

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await wizard.startWizard(false);

            // Check that pending changes were shown
            const logCalls = consoleSpy.mock.calls.map(call => call[0]);
            expect(logCalls.some(call => call && call.includes('Pending Changes'))).toBe(true);
            expect(logCalls.some(call => call && call.includes('SYNTHDEV_VERBOSITY_LEVEL'))).toBe(
                true
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Auto-start Behavior', () => {
        it('should run full setup when auto-started', async () => {
            // Mock empty configuration for auto-start
            wizard.envManager.readEnvFile.mockReturnValue({});

            // Simulate full setup for auto-start
            inputSequence = ['1', '1', 'sk-test123456789', 'n', 'n', '', '', ''];

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(true); // auto-start = true

            expect(result).toBe(true);
            expect(mockReadline.question).toHaveBeenCalledTimes(8);

            consoleSpy.mockRestore();
        });
    });

    describe('Error Handling', () => {
        it('should handle readline errors gracefully', async () => {
            // Mock readline to throw an error
            mockReadline.question.mockImplementation((prompt, callback) => {
                throw new Error('Readline error');
            });

            const result = await wizard.startWizard(false);

            expect(result).toBe(false);
        });

        it('should handle env file write errors', async () => {
            wizard.envManager.writeEnvFile.mockReturnValue(false);
            inputSequence = ['8']; // Save and exit

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await wizard.startWizard(false);

            expect(result).toBe(false);

            consoleSpy.mockRestore();
        });
    });
});
