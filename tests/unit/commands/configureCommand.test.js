/**
 * Tests for ConfigureCommand
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ConfigureCommand from '../../../commands/configuration/ConfigureCommand.js';
import { ConfigurationWizard } from '../../../utils/ConfigurationWizard.js';

// Mock the ConfigurationWizard
vi.mock('../../../utils/ConfigurationWizard.js', () => ({
    ConfigurationWizard: vi.fn().mockImplementation(() => ({
        startWizard: vi.fn(),
    })),
}));

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(() => ({
        user: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

// Mock readline
vi.mock('readline', () => ({
    createInterface: vi.fn(() => ({
        question: vi.fn(),
        close: vi.fn(),
    })),
}));

describe('ConfigureCommand', () => {
    let command;
    let mockContext;
    let mockWizard;
    let mockConfigManager;

    beforeEach(() => {
        command = new ConfigureCommand();

        mockConfigManager = {
            isConfigurationComplete: vi.fn(() => ({
                isComplete: false,
                isMinimallyComplete: true,
                missing: [],
                incomplete: ['SYNTHDEV_BASE_MODEL'],
            })),
        };

        mockContext = {
            app: {
                config: mockConfigManager,
            },
        };

        // Reset the mock
        ConfigurationWizard.mockClear();
        mockWizard = {
            startWizard: vi.fn(),
        };
        ConfigurationWizard.mockImplementation(() => mockWizard);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Properties', () => {
        it('should have correct name and category', () => {
            expect(command.name).toBe('configure');
            expect(command.category).toBe('configuration');
            expect(command.description).toBe(
                'Interactive configuration wizard for Synth-Dev setup'
            );
        });

        it('should provide help text', () => {
            const help = command.getHelp();
            expect(help).toBe('Interactive configuration wizard for Synth-Dev setup');
        });

        it('should provide usage text', () => {
            const usage = command.getUsage();
            expect(usage).toBe('/configure [force|help] - Start configuration wizard');
        });

        it('should provide command info', () => {
            const info = command.getInfo();
            expect(info).toEqual({
                name: 'configure',
                category: 'configuration',
                description: 'Interactive configuration wizard for Synth-Dev setup',
                usage: '/configure [force|help] - Start configuration wizard',
                help: 'Interactive configuration wizard for Synth-Dev setup',
                examples: [
                    '/configure - Start configuration wizard',
                    '/configure force - Force reconfiguration',
                    '/configure help - Show help',
                ],
            });
        });
    });

    describe('Help Command', () => {
        it('should show help when args is "help"', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await command.execute('help', mockContext);

            expect(result).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith('\n🔧 Configure Command Help');

            consoleSpy.mockRestore();
        });

        it('should show help when args is "--help"', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await command.execute('--help', mockContext);

            expect(result).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith('\n🔧 Configure Command Help');

            consoleSpy.mockRestore();
        });
    });

    describe('Configuration Wizard Execution', () => {
        it('should start wizard when configuration is incomplete', async () => {
            mockWizard.startWizard.mockResolvedValue(true);

            // Mock the restart confirmation to avoid timeout
            const mockConfirmRestart = vi
                .spyOn(command, '_confirmRestart')
                .mockResolvedValue(false);

            const result = await command.execute('', mockContext);

            expect(ConfigurationWizard).toHaveBeenCalledTimes(1);
            expect(mockWizard.startWizard).toHaveBeenCalledWith(false);
            expect(result).toBe(true);

            mockConfirmRestart.mockRestore();
        });

        it('should start wizard with force flag', async () => {
            mockConfigManager.isConfigurationComplete.mockReturnValue({
                isComplete: true,
                isMinimallyComplete: true,
                missing: [],
                incomplete: [],
            });
            mockWizard.startWizard.mockResolvedValue(true);

            // Mock the restart confirmation to avoid timeout
            const mockConfirmRestart = vi
                .spyOn(command, '_confirmRestart')
                .mockResolvedValue(false);

            const result = await command.execute('force', mockContext);

            expect(ConfigurationWizard).toHaveBeenCalledTimes(1);
            expect(mockWizard.startWizard).toHaveBeenCalledWith(false);
            expect(result).toBe(true);

            mockConfirmRestart.mockRestore();
        });

        it('should start wizard with --force flag', async () => {
            mockConfigManager.isConfigurationComplete.mockReturnValue({
                isComplete: true,
                isMinimallyComplete: true,
                missing: [],
                incomplete: [],
            });
            mockWizard.startWizard.mockResolvedValue(true);

            // Mock the restart confirmation to avoid timeout
            const mockConfirmRestart = vi
                .spyOn(command, '_confirmRestart')
                .mockResolvedValue(false);

            const result = await command.execute('--force', mockContext);

            expect(ConfigurationWizard).toHaveBeenCalledTimes(1);
            expect(mockWizard.startWizard).toHaveBeenCalledWith(false);
            expect(result).toBe(true);

            mockConfirmRestart.mockRestore();
        });

        it('should handle wizard failure', async () => {
            mockWizard.startWizard.mockResolvedValue(false);

            const result = await command.execute('', mockContext);

            expect(result).toBe(true);
        });

        it('should handle wizard error', async () => {
            mockWizard.startWizard.mockRejectedValue(new Error('Wizard error'));

            const result = await command.execute('', mockContext);

            expect(result).toBe('error');
        });
    });

    describe('Configuration Status Handling', () => {
        it('should handle missing config manager', async () => {
            const contextWithoutConfig = { app: null };
            mockWizard.startWizard.mockResolvedValue(true);

            const result = await command.execute('', contextWithoutConfig);

            expect(ConfigurationWizard).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('should handle missing app context', async () => {
            const contextWithoutApp = {};
            mockWizard.startWizard.mockResolvedValue(true);

            const result = await command.execute('', contextWithoutApp);

            expect(ConfigurationWizard).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });
    });

    describe('Confirmation Prompts', () => {
        it('should handle complete configuration with confirmation', async () => {
            mockConfigManager.isConfigurationComplete.mockReturnValue({
                isComplete: true,
                isMinimallyComplete: true,
                missing: [],
                incomplete: [],
            });

            // Mock the confirmation to return false (don't reconfigure)
            const mockPromptConfirmation = vi
                .spyOn(command, '_promptConfirmation')
                .mockResolvedValue(false);

            const result = await command.execute('', mockContext);

            expect(mockPromptConfirmation).toHaveBeenCalled();
            expect(ConfigurationWizard).not.toHaveBeenCalled();
            expect(result).toBe(true);

            mockPromptConfirmation.mockRestore();
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            // Mock an error in the wizard creation
            ConfigurationWizard.mockImplementation(() => {
                throw new Error('Failed to create wizard');
            });

            const result = await command.execute('', mockContext);

            expect(result).toBe('error');
        });

        it('should handle context errors', async () => {
            // Mock config manager to throw error
            mockConfigManager.isConfigurationComplete.mockImplementation(() => {
                throw new Error('Config error');
            });

            const result = await command.execute('', mockContext);

            expect(result).toBe('error');
        });
    });
});
