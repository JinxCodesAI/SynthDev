// tests/unit/commands/exitCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExitCommand } from '../../../commands/system/ExitCommand.js';

describe('ExitCommand', () => {
    let exitCommand;
    let mockContext;
    let originalExit;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock process.exit to prevent actual exit during tests
        originalExit = process.exit;
        process.exit = vi.fn();

        // Create mock context
        mockContext = {
            consoleInterface: {
                showGoodbye: vi.fn(),
            },
        };

        // Create ExitCommand instance
        exitCommand = new ExitCommand();
    });

    afterEach(() => {
        // Restore original process.exit
        process.exit = originalExit;
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(exitCommand.name).toBe('exit');
            expect(exitCommand.description).toBe('Exit the application');
            expect(exitCommand.aliases).toEqual(['quit']);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = exitCommand.getRequiredDependencies();
            expect(dependencies).toContain('consoleInterface');
        });
    });

    describe('implementation', () => {
        it('should show goodbye message and exit', async () => {
            await exitCommand.implementation('', mockContext);

            // Should call showGoodbye
            expect(mockContext.consoleInterface.showGoodbye).toHaveBeenCalled();

            // Should call process.exit with code 0
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should handle args parameter (unused)', async () => {
            await exitCommand.implementation('some args', mockContext);

            // Args should be ignored, but command should still work
            expect(mockContext.consoleInterface.showGoodbye).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should work with minimal context', async () => {
            const minimalContext = {
                consoleInterface: {
                    showGoodbye: vi.fn(),
                },
            };

            await exitCommand.implementation('', minimalContext);

            expect(minimalContext.consoleInterface.showGoodbye).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = exitCommand.getUsage();
            expect(usage).toBe('/exit or /quit');
        });
    });

    describe('error handling', () => {
        it('should handle consoleInterface errors', async () => {
            mockContext.consoleInterface.showGoodbye.mockImplementation(() => {
                throw new Error('Console error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(exitCommand.implementation('', mockContext)).rejects.toThrow(
                'Console error'
            );
        });

        it('should handle missing consoleInterface', async () => {
            const contextWithoutConsole = {
                consoleInterface: null,
            };

            // The command doesn't check for null consoleInterface, so it will throw
            await expect(exitCommand.implementation('', contextWithoutConsole)).rejects.toThrow();
        });
    });

    describe('aliases', () => {
        it('should have quit as an alias', () => {
            expect(exitCommand.aliases).toContain('quit');
        });

        it('should work the same way regardless of how it was called', async () => {
            // The implementation doesn't change based on how it was called
            await exitCommand.implementation('', mockContext);

            expect(mockContext.consoleInterface.showGoodbye).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });
    });

    describe('integration scenarios', () => {
        it('should work in a complete application context', async () => {
            const fullContext = {
                consoleInterface: {
                    showGoodbye: vi.fn(),
                    showMessage: vi.fn(),
                    close: vi.fn(),
                },
                apiClient: {
                    // Other components that might be present
                },
                toolManager: {
                    // Other components that might be present
                },
            };

            await exitCommand.implementation('', fullContext);

            // Should only use the consoleInterface
            expect(fullContext.consoleInterface.showGoodbye).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should exit immediately without waiting', async () => {
            const startTime = Date.now();

            await exitCommand.implementation('', mockContext);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute very quickly (less than 100ms)
            expect(executionTime).toBeLessThan(100);
            expect(process.exit).toHaveBeenCalledWith(0);
        });
    });

    describe('process exit behavior', () => {
        it('should exit with code 0 (success)', async () => {
            await exitCommand.implementation('', mockContext);

            expect(process.exit).toHaveBeenCalledWith(0);
            expect(process.exit).toHaveBeenCalledTimes(1);
        });

        it('should not return a value (void function)', async () => {
            const result = await exitCommand.implementation('', mockContext);

            // The function doesn't return anything because it exits
            expect(result).toBeUndefined();
        });
    });
});
