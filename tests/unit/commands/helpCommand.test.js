// tests/unit/commands/helpCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import HelpCommand from '../../../commands/info/HelpCommand.js';

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('HelpCommand', () => {
    let helpCommand;
    let mockLogger;
    let mockContext;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create mock context
        mockContext = {
            apiClient: {
                getModel: vi.fn().mockReturnValue('gpt-4'),
                getCurrentRole: vi.fn().mockReturnValue('coder'),
                getFilteredToolCount: vi.fn().mockReturnValue(8),
                getTotalToolCount: vi.fn().mockReturnValue(12),
                getMessageCount: vi.fn().mockReturnValue(5),
                getToolCallCount: vi.fn().mockReturnValue(2),
                getMaxToolCalls: vi.fn().mockReturnValue(10),
            },
            commandRegistry: {
                generateHelpText: vi.fn().mockReturnValue(`
📖 Available Commands:
/help     - Show this help message
/tools    - List available tools
/role     - Switch role
/exit     - Exit application
`),
            },
        };

        // Create HelpCommand instance
        helpCommand = new HelpCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(helpCommand.name).toBe('help');
            expect(helpCommand.description).toBe('Show this help message');
            expect(helpCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = helpCommand.getRequiredDependencies();
            expect(dependencies).toContain('apiClient');
        });
    });

    describe('implementation', () => {
        it('should display help text and system info', async () => {
            const result = await helpCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call generateHelpText from command registry
            expect(mockContext.commandRegistry.generateHelpText).toHaveBeenCalled();

            // Should display help text
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('📖 Available Commands:')
            );

            // Should display system information
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🤖 AI Model: gpt-4')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🎭 Current Role: coder')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🔧 Tools loaded: 8/12')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('💬 Messages in conversation: 5')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🛡️ Tool calls in current interaction: 2/10')
            );
        });

        it('should handle missing command registry', async () => {
            const contextWithoutRegistry = {
                ...mockContext,
                commandRegistry: null,
            };

            const result = await helpCommand.implementation('', contextWithoutRegistry);

            expect(result).toBe(true);

            // Should display fallback help text
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('/help     - Show this help message')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('/tools    - List available tools')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('/exit     - Exit the application')
            );
        });

        it('should handle null current role', async () => {
            mockContext.apiClient.getCurrentRole.mockReturnValue(null);

            const result = await helpCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🎭 Current Role: none')
            );
        });

        it('should handle undefined current role', async () => {
            mockContext.apiClient.getCurrentRole.mockReturnValue(undefined);

            const result = await helpCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🎭 Current Role: none')
            );
        });

        it('should display correct tool counts', async () => {
            mockContext.apiClient.getFilteredToolCount.mockReturnValue(15);
            mockContext.apiClient.getTotalToolCount.mockReturnValue(20);

            const result = await helpCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🔧 Tools loaded: 15/20')
            );
        });

        it('should display correct message and tool call counts', async () => {
            mockContext.apiClient.getMessageCount.mockReturnValue(10);
            mockContext.apiClient.getToolCallCount.mockReturnValue(3);
            mockContext.apiClient.getMaxToolCalls.mockReturnValue(15);

            const result = await helpCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('💬 Messages in conversation: 10')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🛡️ Tool calls in current interaction: 3/15')
            );
        });

        it('should handle args parameter (unused)', async () => {
            const result = await helpCommand.implementation('some args', mockContext);

            expect(result).toBe(true);
            // Args should be ignored, but command should still work
            expect(mockLogger.raw).toHaveBeenCalled();
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = helpCommand.getUsage();
            expect(usage).toBe('/help');
        });
    });

    describe('error handling', () => {
        it('should handle apiClient method errors gracefully', async () => {
            mockContext.apiClient.getModel.mockImplementation(() => {
                throw new Error('API client error');
            });

            // The command will throw the error since it doesn't have error handling
            await expect(helpCommand.implementation('', mockContext)).rejects.toThrow(
                'API client error'
            );
        });

        it('should handle commandRegistry errors gracefully', async () => {
            mockContext.commandRegistry.generateHelpText.mockImplementation(() => {
                throw new Error('Registry error');
            });

            // The command will throw the error since it doesn't have error handling
            await expect(helpCommand.implementation('', mockContext)).rejects.toThrow(
                'Registry error'
            );
        });
    });

    describe('integration scenarios', () => {
        it('should work with minimal context', async () => {
            const minimalContext = {
                apiClient: {
                    getModel: vi.fn().mockReturnValue('test-model'),
                    getCurrentRole: vi.fn().mockReturnValue('test-role'),
                    getFilteredToolCount: vi.fn().mockReturnValue(0),
                    getTotalToolCount: vi.fn().mockReturnValue(0),
                    getMessageCount: vi.fn().mockReturnValue(0),
                    getToolCallCount: vi.fn().mockReturnValue(0),
                    getMaxToolCalls: vi.fn().mockReturnValue(0),
                },
            };

            const result = await helpCommand.implementation('', minimalContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalled();
        });

        it('should work with complete context', async () => {
            const result = await helpCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockContext.commandRegistry.generateHelpText).toHaveBeenCalled();
            expect(mockLogger.raw).toHaveBeenCalledTimes(2); // Help text + system info
        });
    });
});
