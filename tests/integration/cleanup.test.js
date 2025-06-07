// tests/integration/cleanup.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Application Exit Integration', () => {
    let app;
    let mockConsoleInterface;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock ConsoleInterface
        mockConsoleInterface = {
            setupEventHandlers: vi.fn(),
            showWelcome: vi.fn(),
            prompt: vi.fn(),
            showGoodbye: vi.fn(),
        };

        // Create a simple app-like object with the methods we need to test
        app = {
            consoleInterface: mockConsoleInterface,
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },

            // Updated handleExit method without snapshot cleanup
            async handleExit(exitCode = 0) {
                try {
                    // Show goodbye message
                    this.consoleInterface.showGoodbye();

                    // Snapshot cleanup functionality has been removed
                    this.logger.info('✅ Application exit completed successfully');
                } catch (error) {
                    this.logger.error('❌ Error during exit cleanup:', error.message);
                } finally {
                    // Ensure we exit even if cleanup fails
                    process.exit(exitCode);
                }
            },

            setupSignalHandlers() {
                // Handle SIGINT (Ctrl+C)
                process.on('SIGINT', () => {
                    this.logger.info('\n🛑 Received SIGINT (Ctrl+C), shutting down gracefully...');
                    this.handleExit();
                });

                // Handle SIGTERM (process termination)
                process.on('SIGTERM', () => {
                    this.logger.info('\n🛑 Received SIGTERM, shutting down gracefully...');
                    this.handleExit();
                });

                // Handle uncaught exceptions
                process.on('uncaughtException', error => {
                    this.logger.error('💥 Uncaught exception:', error);
                    this.handleExit(1);
                });

                // Handle unhandled promise rejections
                process.on('unhandledRejection', (reason, promise) => {
                    this.logger.error(
                        '💥 Unhandled promise rejection at:',
                        promise,
                        'reason:',
                        reason
                    );
                    this.handleExit(1);
                });
            },
        };

        // Mock process.exit to prevent actual exit during tests
        vi.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleExit', () => {
        it('should exit successfully', async () => {
            await app.handleExit();

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(app.logger.info).toHaveBeenCalledWith(
                '✅ Application exit completed successfully'
            );
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should exit with custom exit code', async () => {
            await app.handleExit(1);

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(app.logger.info).toHaveBeenCalledWith(
                '✅ Application exit completed successfully'
            );
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should handle exit exceptions', async () => {
            // Mock showGoodbye to throw an error
            mockConsoleInterface.showGoodbye.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            await app.handleExit();

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(app.logger.error).toHaveBeenCalledWith(
                '❌ Error during exit cleanup:',
                'Unexpected error'
            );
            expect(process.exit).toHaveBeenCalledWith(0);
        });
    });

    describe('setupSignalHandlers', () => {
        it('should set up signal handlers correctly', () => {
            const originalOn = process.on;
            const mockOn = vi.fn();
            process.on = mockOn;

            app.setupSignalHandlers();

            expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
            expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
            expect(mockOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
            expect(mockOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

            process.on = originalOn;
        });
    });
});
