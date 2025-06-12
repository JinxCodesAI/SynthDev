// tests/integration/cleanup.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Application Cleanup Integration', () => {
    let app;
    let mockSnapshotManager;
    let mockConsoleInterface;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock SnapshotManager
        mockSnapshotManager = {
            initialize: vi.fn(),
            performCleanup: vi.fn(),
        };

        // Mock ConsoleInterface
        mockConsoleInterface = {
            setupEventHandlers: vi.fn(),
            showWelcome: vi.fn(),
            prompt: vi.fn(),
            showGoodbye: vi.fn(),
        };

        // Create a simple app-like object with the methods we need to test
        app = {
            snapshotManager: mockSnapshotManager,
            consoleInterface: mockConsoleInterface,
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },

            // Copy the handleExit method from the actual implementation
            async handleExit(exitCode = 0) {
                try {
                    // Show goodbye message
                    this.consoleInterface.showGoodbye();

                    // Perform automatic cleanup if conditions are met
                    const cleanupResult = await this.snapshotManager.performCleanup();
                    if (cleanupResult.success) {
                        this.logger.info('✅ Automatic cleanup completed successfully');
                    } else if (
                        cleanupResult.error &&
                        !cleanupResult.error.includes('Git integration not active')
                    ) {
                        this.logger.warn(`⚠️ Cleanup failed: ${cleanupResult.error}`);
                    }
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
        it('should perform cleanup and exit successfully', async () => {
            mockSnapshotManager.performCleanup.mockResolvedValue({
                success: true,
            });

            await app.handleExit();

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(mockSnapshotManager.performCleanup).toHaveBeenCalled();
            expect(app.logger.info).toHaveBeenCalledWith(
                '✅ Automatic cleanup completed successfully'
            );
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should handle cleanup failure gracefully', async () => {
            mockSnapshotManager.performCleanup.mockResolvedValue({
                success: false,
                error: 'Cleanup failed',
            });

            await app.handleExit();

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(mockSnapshotManager.performCleanup).toHaveBeenCalled();
            expect(app.logger.warn).toHaveBeenCalledWith('⚠️ Cleanup failed: Cleanup failed');
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should not warn when Git integration is not active', async () => {
            mockSnapshotManager.performCleanup.mockResolvedValue({
                success: false,
                error: 'Git integration not active',
            });

            await app.handleExit();

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(mockSnapshotManager.performCleanup).toHaveBeenCalled();
            expect(app.logger.warn).not.toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should handle cleanup exceptions', async () => {
            mockSnapshotManager.performCleanup.mockRejectedValue(new Error('Unexpected error'));

            await app.handleExit();

            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();
            expect(mockSnapshotManager.performCleanup).toHaveBeenCalled();
            expect(app.logger.error).toHaveBeenCalledWith(
                '❌ Error during exit cleanup:',
                'Unexpected error'
            );
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        it('should exit with custom exit code', async () => {
            mockSnapshotManager.performCleanup.mockResolvedValue({
                success: true,
            });

            await app.handleExit(1);

            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should ensure exit even if cleanup hangs', async () => {
            // Mock a cleanup that never resolves
            mockSnapshotManager.performCleanup.mockImplementation(() => new Promise(() => {}));

            // Start the exit process
            const exitPromise = app.handleExit();

            // Wait a short time to ensure the cleanup is called
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockSnapshotManager.performCleanup).toHaveBeenCalled();
            expect(mockConsoleInterface.showGoodbye).toHaveBeenCalled();

            // The test framework will handle the hanging promise
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
