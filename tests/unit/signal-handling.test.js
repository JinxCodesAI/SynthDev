// tests/unit/signal-handling.test.js
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import AICoderConsole from '../../src/core/app.js';
import ConfigManager from '../../src/config/managers/configManager.js';

// Mock all dependencies
vi.mock('../../src/core/managers/logger.js', () => ({
    initializeLogger: vi.fn(),
    getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        user: vi.fn(),
        raw: vi.fn(),
        isFileLoggingEnabled: vi.fn().mockReturnValue(false),
        closeLogFile: vi.fn(),
    }),
}));

vi.mock('../../src/config/managers/configManager.js', () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            getConfig: vi.fn().mockReturnValue({
                ui: { defaultRole: 'test' },
            }),
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'test-url',
                baseModel: 'test-model',
            }),
            shouldStartConfigurationWizard: vi.fn().mockReturnValue(false),
            getEnvFileInfo: vi.fn().mockReturnValue({
                exists: false,
                path: 'test.env',
            }),
        }),
    },
}));

vi.mock('../../src/core/interface/consoleInterface.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        setupEventHandlers: vi.fn(),
        showStartupMessage: vi.fn(),
        prompt: vi.fn(),
        showGoodbye: vi.fn(),
        close: vi.fn(),
        resumeInput: vi.fn(),
        pauseInput: vi.fn(),
    })),
}));

vi.mock('../../src/core/managers/toolManager.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        loadTools: vi.fn(),
        getTools: vi.fn().mockReturnValue([]),
        getToolsCount: vi.fn().mockReturnValue(0),
    })),
}));

vi.mock('../../src/core/ai/aiAPIClient.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        setTools: vi.fn(),
        setSystemMessage: vi.fn(),
        getModel: vi.fn().mockReturnValue('test-model'),
        getCurrentRole: vi.fn().mockReturnValue('test-role'),
        getTotalToolCount: vi.fn().mockReturnValue(0),
        getFilteredToolCount: vi.fn().mockReturnValue(0),
    })),
}));

vi.mock('../../src/core/ai/systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn().mockReturnValue('test message'),
    },
}));

vi.mock('../../src/utils/GitUtils.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        checkGitAvailability: vi.fn().mockResolvedValue({
            available: true,
            isRepo: true,
        }),
        getCurrentBranch: vi.fn().mockResolvedValue({
            success: true,
            branch: 'main',
        }),
    })),
}));

vi.mock('../../src/core/snapshot/AutoSnapshotManager.js', () => ({
    AutoSnapshotManager: vi.fn().mockImplementation(() => ({
        initialize: vi.fn(),
        integrateWithApplication: vi.fn(),
        cleanup: vi.fn(),
    })),
}));

vi.mock('../../src/agents/AgentManager.js', () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({}),
    },
}));

describe('Signal Handling', () => {
    let app;
    let mockConfig;
    let originalProcessOn;
    let originalProcessExit;
    let originalConsoleLog;
    let originalConsoleError;
    let processListeners;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock process methods
        originalProcessOn = process.on;
        originalProcessExit = process.exit;
        originalConsoleLog = console.log;
        originalConsoleError = console.error;

        processListeners = new Map();

        process.on = vi.fn((event, handler) => {
            if (!processListeners.has(event)) {
                processListeners.set(event, []);
            }
            processListeners.get(event).push(handler);
        });

        process.exit = vi.fn();
        console.log = vi.fn();
        console.error = vi.fn();

        // Create mock config
        mockConfig = ConfigManager.getInstance();

        // Create app instance
        app = new AICoderConsole(mockConfig);
    });

    afterEach(() => {
        // Restore original methods
        process.on = originalProcessOn;
        process.exit = originalProcessExit;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    });

    describe('setupSignalHandlers', () => {
        test('should set up all required signal handlers', () => {
            app.setupSignalHandlers();

            expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
            expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
            expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
            expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
        });

        test('should set up Windows-specific signal handlers on Windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            app.setupSignalHandlers();

            expect(process.on).toHaveBeenCalledWith('SIGBREAK', expect.any(Function));
            expect(process.on).toHaveBeenCalledWith('beforeExit', expect.any(Function));
            expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function));

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle SIGINT gracefully on first call', async () => {
            app.setupSignalHandlers();
            app.handleExit = vi.fn().mockResolvedValue();

            const sigintHandler = processListeners.get('SIGINT')[0];
            sigintHandler();

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Received SIGINT (Ctrl+C). Press Ctrl+C again within 3 seconds to force exit...'
                )
            );
            expect(app.signalReceived).toBe(true);
            expect(app.handleExit).toHaveBeenCalled();
        });

        test('should force exit on second SIGINT call', () => {
            app.setupSignalHandlers();
            app.signalReceived = true; // Simulate first signal already received

            const sigintHandler = processListeners.get('SIGINT')[0];
            sigintHandler();

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Force termination requested. Exiting immediately...')
            );
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should interrupt processing when signal received during processing', () => {
            app.setupSignalHandlers();
            app.isProcessing = true;
            app.handleExit = vi.fn().mockResolvedValue();

            const sigintHandler = processListeners.get('SIGINT')[0];
            sigintHandler();

            expect(app.isProcessing).toBe(false);
            expect(app.consoleInterface.resumeInput).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('🔄 Interrupted current processing...');
        });
    });

    describe('handleExit', () => {
        test('should prevent multiple exit attempts', async () => {
            app.isExiting = true;
            const result = await app.handleExit();

            expect(result).toBeUndefined();
            expect(process.exit).not.toHaveBeenCalled();
        });

        test('should cleanup and exit properly', async () => {
            app.autoSnapshotManager = {
                cleanup: vi.fn().mockResolvedValue(),
            };

            await app.handleExit(0);

            expect(app.isExiting).toBe(true);
            expect(app.autoSnapshotManager.cleanup).toHaveBeenCalled();
            expect(app.consoleInterface.showGoodbye).toHaveBeenCalled();
            expect(app.consoleInterface.close).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        test('should handle cleanup errors gracefully', async () => {
            app.autoSnapshotManager = {
                cleanup: vi.fn().mockRejectedValue(new Error('Cleanup failed')),
            };

            await app.handleExit(1);

            expect(console.error).toHaveBeenCalledWith(
                '❌ Error during exit cleanup:',
                'Cleanup failed'
            );
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should clear force exit timer', async () => {
            const mockTimer = setTimeout(() => {}, 1000);
            app.forceExitTimer = mockTimer;
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

            await app.handleExit();

            expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimer);
            expect(app.forceExitTimer).toBeNull();
        });
    });
});
