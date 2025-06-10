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
            app: {
                handleExit: vi.fn(),
            },
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
            expect(dependencies).toContain('app');
        });
    });

    describe('implementation', () => {
        it('should call app.handleExit', async () => {
            await exitCommand.implementation('', mockContext);

            // Should call app.handleExit
            expect(mockContext.app.handleExit).toHaveBeenCalled();
        });

        it('should handle args parameter (unused)', async () => {
            await exitCommand.implementation('some args', mockContext);

            // Args should be ignored, but command should still work
            expect(mockContext.app.handleExit).toHaveBeenCalled();
        });

        it('should work with minimal context', async () => {
            const minimalContext = {
                app: {
                    handleExit: vi.fn(),
                },
            };

            await exitCommand.implementation('', minimalContext);

            expect(minimalContext.app.handleExit).toHaveBeenCalled();
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = exitCommand.getUsage();
            expect(usage).toBe('/exit or /quit');
        });
    });

    describe('error handling', () => {
        it('should handle app.handleExit errors', async () => {
            mockContext.app.handleExit.mockImplementation(() => {
                throw new Error('App error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(exitCommand.implementation('', mockContext)).rejects.toThrow('App error');
        });

        it('should handle missing app', async () => {
            const contextWithoutApp = {
                app: null,
            };

            // The command doesn't check for null app, so it will throw
            await expect(exitCommand.implementation('', contextWithoutApp)).rejects.toThrow();
        });
    });

    describe('aliases', () => {
        it('should have quit as an alias', () => {
            expect(exitCommand.aliases).toContain('quit');
        });

        it('should work the same way regardless of how it was called', async () => {
            // The implementation doesn't change based on how it was called
            await exitCommand.implementation('', mockContext);

            expect(mockContext.app.handleExit).toHaveBeenCalled();
        });
    });

    describe('integration scenarios', () => {
        it('should work in a complete application context', async () => {
            const fullContext = {
                app: {
                    handleExit: vi.fn(),
                },
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

            // Should only use the app
            expect(fullContext.app.handleExit).toHaveBeenCalled();
        });

        it('should exit immediately without waiting', async () => {
            const startTime = Date.now();

            await exitCommand.implementation('', mockContext);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute very quickly (less than 100ms)
            expect(executionTime).toBeLessThan(100);
            expect(mockContext.app.handleExit).toHaveBeenCalled();
        });
    });

    describe('process exit behavior', () => {
        it('should call app.handleExit', async () => {
            await exitCommand.implementation('', mockContext);

            expect(mockContext.app.handleExit).toHaveBeenCalled();
            expect(mockContext.app.handleExit).toHaveBeenCalledTimes(1);
        });

        it('should not return a value (void function)', async () => {
            const result = await exitCommand.implementation('', mockContext);

            // The function doesn't return anything because it exits
            expect(result).toBeUndefined();
        });
    });
});
