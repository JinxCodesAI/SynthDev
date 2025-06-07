// tests/unit/core/logger.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getLogger, resetLogger, initializeLogger } from '../../../src/core/managers/logger.js';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('Logger', () => {
    let logger;
    let consoleSpy;

    beforeEach(() => {
        resetLogger();
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getLogger', () => {
        it('should create logger with default verbosity level 2', () => {
            logger = getLogger();
            expect(logger.getVerbosityLevel()).toBe(2);
        });

        it('should create logger with specified verbosity level', () => {
            logger = getLogger(4);
            expect(logger.getVerbosityLevel()).toBe(4);
        });

        it('should return same instance (singleton)', () => {
            const logger1 = getLogger();
            const logger2 = getLogger();
            expect(logger1).toBe(logger2);
        });
    });

    describe('verbosity levels', () => {
        it('should respect verbosity level 0 (user messages only)', () => {
            logger = getLogger(0);

            logger.user('User message');
            logger.status('Status message');
            logger.info('Info message');

            expect(consoleSpy.log).toHaveBeenCalledTimes(2);
            expect(consoleSpy.log).toHaveBeenCalledWith('🤖 Synth-Dev:', 'User message');
        });

        it('should respect verbosity level 1 (user + status)', () => {
            logger = getLogger(1);

            logger.user('User message');
            logger.status('Status message');
            logger.info('Info message');

            expect(consoleSpy.log).toHaveBeenCalledTimes(3);
        });

        it('should respect verbosity level 2 (default)', () => {
            logger = getLogger(2);

            logger.user('User message');
            logger.status('Status message');
            logger.info('Info message');
            logger.toolExecution('test_tool', { param: 'value' });

            expect(consoleSpy.log).toHaveBeenCalledTimes(6); // user, status, info, tool name, tool args
        });
    });

    describe('setVerbosityLevel', () => {
        it('should update verbosity level', () => {
            logger = getLogger(2);
            logger.setVerbosityLevel(4);
            expect(logger.getVerbosityLevel()).toBe(4);
        });

        it('should ignore invalid verbosity levels', () => {
            logger = getLogger(2);
            logger.setVerbosityLevel(-1);
            expect(logger.getVerbosityLevel()).toBe(2);

            logger.setVerbosityLevel(10);
            expect(logger.getVerbosityLevel()).toBe(2);
        });
    });

    describe('error logging', () => {
        it('should always log errors regardless of verbosity', () => {
            logger = getLogger(0);
            logger.error('Test error');

            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Error:', 'Test error');
        });

        it('should handle Error objects', () => {
            logger = getLogger(0);
            const error = new Error('Test error message');
            logger.error(error);

            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Error:', 'Test error message');
        });

        it('should include context when provided', () => {
            logger = getLogger(0);
            logger.error('Test error', 'Test context');

            expect(consoleSpy.error).toHaveBeenCalledWith('❌ Test context:', 'Test error');
        });
    });

    describe('tool execution logging', () => {
        it('should compress long arguments at level 2', () => {
            logger = getLogger(2);
            const longString = 'a'.repeat(100);
            logger.toolExecution('test_tool', 'test_role', { longParam: longString });

            expect(consoleSpy.log).toHaveBeenCalledWith(
                '🔧 Role: test_role Executing tool: test_tool'
            );
            expect(consoleSpy.log).toHaveBeenCalledWith('📝 Arguments:', {
                longParam: `${'a'.repeat(47)}...`,
            });
        });

        it('should show full arguments at level 3+', () => {
            logger = getLogger(3);
            const args = { param: 'value' };
            logger.toolExecutionDetailed('test_tool', 'test_role', args);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                '🔧 Role: test_role Executing tool: test_tool'
            );
            expect(consoleSpy.log).toHaveBeenCalledWith('📝 Arguments:', args);
        });
    });

    describe('HTTP request logging', () => {
        it('should log HTTP requests at level 5', () => {
            logger = getLogger(5);
            const requestData = { test: 'data' };
            const responseData = { result: 'success' };

            logger.httpRequest('POST', 'https://api.test.com', requestData, responseData);

            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('🌐 HTTP POST Request')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith('📍 URL: https://api.test.com');
        });

        it('should store HTTP requests for later retrieval', () => {
            logger = getLogger(5);
            logger.httpRequest('GET', 'https://api.test.com', {});

            const requests = logger.getRecentHttpRequests();
            expect(requests).toHaveLength(1);
            expect(requests[0].method).toBe('GET');
            expect(requests[0].url).toBe('https://api.test.com');
        });
    });

    describe('initializeLogger', () => {
        it('should initialize logger with config verbosity', () => {
            const config = { global: { verbosityLevel: 3 } };
            initializeLogger(config);

            logger = getLogger();
            expect(logger.getVerbosityLevel()).toBe(3);
        });

        it('should use default verbosity when config missing', () => {
            initializeLogger({});

            logger = getLogger();
            expect(logger.getVerbosityLevel()).toBe(2);
        });
    });

    describe('file logging', () => {
        const testLogsDir = join(process.cwd(), '.synthdev', 'logs');

        afterEach(() => {
            // Clean up test log files
            if (existsSync(testLogsDir)) {
                try {
                    rmSync(testLogsDir, { recursive: true, force: true });
                } catch (error) {
                    // Ignore cleanup errors in tests
                }
            }
        });

        it('should enable file logging when verbosity level is 5', () => {
            logger = getLogger(5);

            expect(logger.isFileLoggingEnabled()).toBe(true);
            expect(logger.getLogFilePath()).toBeTruthy();
            expect(existsSync(testLogsDir)).toBe(true);
        });

        it('should not enable file logging when verbosity level is less than 5', () => {
            logger = getLogger(4);

            expect(logger.isFileLoggingEnabled()).toBe(false);
            expect(logger.getLogFilePath()).toBe(null);
        });

        it('should write messages to log file when verbosity is 5', () => {
            logger = getLogger(5);

            const testMessage = 'Test log message';
            logger.info(testMessage);

            const logFilePath = logger.getLogFilePath();
            expect(existsSync(logFilePath)).toBe(true);

            const logContent = readFileSync(logFilePath, 'utf8');
            expect(logContent).toContain('INFO: Test log message');
        });

        it('should write HTTP requests to log file when verbosity is 5', () => {
            logger = getLogger(5);

            const testRequest = { test: 'data' };
            const testResponse = { result: 'success' };
            logger.httpRequest('POST', 'https://api.test.com', testRequest, testResponse);

            const logFilePath = logger.getLogFilePath();
            const logContent = readFileSync(logFilePath, 'utf8');

            expect(logContent).toContain('HTTP POST Request');
            expect(logContent).toContain('https://api.test.com');
            expect(logContent).toContain('"test": "data"');
            expect(logContent).toContain('"result": "success"');
        });

        it('should properly close log file', () => {
            logger = getLogger(5);
            const logFilePath = logger.getLogFilePath();

            logger.closeLogFile();

            expect(logger.isFileLoggingEnabled()).toBe(false);
            const logContent = readFileSync(logFilePath, 'utf8');
            expect(logContent).toContain('=== Synth-Dev Log Session Ended ===');
        });

        it('should enable file logging when switching to verbosity level 5', () => {
            logger = getLogger(2);
            expect(logger.isFileLoggingEnabled()).toBe(false);

            logger.setVerbosityLevel(5);
            expect(logger.isFileLoggingEnabled()).toBe(true);
            expect(existsSync(testLogsDir)).toBe(true);
        });
    });
});
