/**
 * Tests for ConfigureCommand
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigureCommand } from '../../../commands/config/ConfigureCommand.js';

describe('ConfigureCommand', () => {
    let configureCommand;
    let mockContext;

    beforeEach(() => {
        configureCommand = new ConfigureCommand();

        mockContext = {
            consoleInterface: {
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn(),
            },
        };
    });

    describe('constructor', () => {
        it('should initialize with correct name and description', () => {
            expect(configureCommand.name).toBe('configure');
            expect(configureCommand.description).toBe('Interactive configuration wizard');
            expect(configureCommand.aliases).toContain('config');
        });

        it('should initialize wizard', () => {
            expect(configureCommand.wizard).toBeDefined();
        });
    });

    describe('implementation', () => {
        it('should show main menu and handle quit command', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('q');

            const result = await configureCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.consoleInterface.promptForInput).toHaveBeenCalledWith(
                'configure> ',
                expect.any(Object)
            );
        });

        it('should handle save command', async () => {
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('s')
                .mockResolvedValueOnce('q');

            // Mock the wizard save method
            vi.spyOn(configureCommand.wizard, 'saveConfiguration').mockReturnValue(true);

            const result = await configureCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(configureCommand.wizard.saveConfiguration).toHaveBeenCalled();
        });

        it('should handle provider configuration', async () => {
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('1') // Select base provider
                .mockResolvedValueOnce('b') // Back to main menu
                .mockResolvedValueOnce('q'); // Quit

            const result = await configureCommand.implementation('', mockContext);

            expect(result).toBe(true);
        });

        it('should handle reset command with confirmation', async () => {
            mockContext.consoleInterface.promptForInput
                .mockResolvedValueOnce('r') // Reset
                .mockResolvedValueOnce('q'); // Quit

            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const result = await configureCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalled();
        });
    });

    describe('_selectProvider', () => {
        it('should handle provider selection', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');

            // Mock wizard methods
            vi.spyOn(configureCommand.wizard, 'getProviders').mockReturnValue([
                { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
            ]);
            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._selectProvider(mockContext, 'base');

            expect(configureCommand.wizard.setConfigValue).toHaveBeenCalledWith(
                'SYNTHDEV_BASE_BASE_URL',
                'https://api.openai.com/v1'
            );
        });

        it('should handle cancel selection', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('c');

            vi.spyOn(configureCommand.wizard, 'getProviders').mockReturnValue([
                { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
            ]);
            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._selectProvider(mockContext, 'base');

            // Should not call setConfigValue when cancelled
            expect(configureCommand.wizard.setConfigValue).not.toHaveBeenCalled();
        });
    });

    describe('_setVerbosityLevel', () => {
        it('should set valid verbosity level', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('3');

            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._setVerbosityLevel(mockContext);

            expect(configureCommand.wizard.setConfigValue).toHaveBeenCalledWith(
                'SYNTHDEV_VERBOSITY_LEVEL',
                '3'
            );
        });

        it('should reject invalid verbosity level', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('10');

            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._setVerbosityLevel(mockContext);

            expect(configureCommand.wizard.setConfigValue).not.toHaveBeenCalled();
        });
    });

    describe('_setMaxToolCalls', () => {
        it('should set valid max tool calls', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('100');

            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._setMaxToolCalls(mockContext);

            expect(configureCommand.wizard.setConfigValue).toHaveBeenCalledWith(
                'SYNTHDEV_MAX_TOOL_CALLS',
                '100'
            );
        });

        it('should reject invalid max tool calls', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('-5');

            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._setMaxToolCalls(mockContext);

            expect(configureCommand.wizard.setConfigValue).not.toHaveBeenCalled();
        });
    });

    describe('_setPromptEnhancement', () => {
        it('should enable prompt enhancement', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('1');

            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._setPromptEnhancement(mockContext);

            expect(configureCommand.wizard.setConfigValue).toHaveBeenCalledWith(
                'SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT',
                'true'
            );
        });

        it('should disable prompt enhancement', async () => {
            mockContext.consoleInterface.promptForInput.mockResolvedValue('2');

            vi.spyOn(configureCommand.wizard, 'setConfigValue').mockImplementation(() => {});

            await configureCommand._setPromptEnhancement(mockContext);

            expect(configureCommand.wizard.setConfigValue).toHaveBeenCalledWith(
                'SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT',
                'false'
            );
        });
    });
});
