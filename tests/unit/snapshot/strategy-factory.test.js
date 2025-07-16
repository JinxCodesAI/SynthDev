/**
 * Unit tests for StrategyFactory
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    StrategyFactory,
    getStrategyFactory,
    resetStrategyFactory,
} from '../../../src/core/snapshot/strategies/StrategyFactory.js';
import { GitSnapshotStrategy } from '../../../src/core/snapshot/strategies/GitSnapshotStrategy.js';
import { FileSnapshotStrategy } from '../../../src/core/snapshot/strategies/FileSnapshotStrategy.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from '../../../src/core/snapshot/events/SnapshotEventEmitter.js';

// Mock the strategy classes
vi.mock('../../../src/core/snapshot/strategies/GitSnapshotStrategy.js');
vi.mock('../../../src/core/snapshot/strategies/FileSnapshotStrategy.js');

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('StrategyFactory', () => {
    let factory;
    let config;
    let eventEmitter;
    let mockGitStrategy;
    let mockFileStrategy;

    beforeEach(() => {
        // Mock process.cwd() before creating config
        process.cwd = vi.fn(() => '/tmp');

        // Reset mocks
        vi.clearAllMocks();
        resetStrategyFactory();

        config = new SnapshotConfig();
        eventEmitter = new SnapshotEventEmitter();
        factory = new StrategyFactory(config, eventEmitter);

        // Create mock strategies
        mockGitStrategy = {
            initialize: vi.fn().mockResolvedValue({ success: true }),
            isAvailable: vi.fn().mockResolvedValue({ available: true }),
            getMode: vi.fn().mockReturnValue('git'),
            getStatus: vi.fn().mockReturnValue({ mode: 'git', available: true }),
        };

        mockFileStrategy = {
            initialize: vi.fn().mockResolvedValue({ success: true }),
            isAvailable: vi.fn().mockResolvedValue({ available: true }),
            getMode: vi.fn().mockReturnValue('file'),
            getStatus: vi.fn().mockReturnValue({ mode: 'file', available: true }),
        };

        // Mock strategy constructors
        GitSnapshotStrategy.mockImplementation(() => mockGitStrategy);
        FileSnapshotStrategy.mockImplementation(() => mockFileStrategy);
    });

    afterEach(() => {
        resetStrategyFactory();

        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/tmp');
    });

    describe('initialization', () => {
        it('should initialize with auto mode and select Git strategy', async () => {
            const result = await factory.initialize();

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('git');
            expect(factory.getCurrentMode()).toBe('git');
            expect(mockGitStrategy.initialize).toHaveBeenCalled();
        });

        it('should fallback to file strategy when Git fails', async () => {
            mockGitStrategy.isAvailable.mockResolvedValue({ available: false });

            const result = await factory.initialize();

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('file');
            expect(factory.getCurrentMode()).toBe('file');
        });

        it('should respect forced Git mode', async () => {
            // Mock the config to return 'git' mode
            const gitConfig = {
                getSnapshotConfig: vi.fn().mockReturnValue({ mode: 'git' }),
            };

            const gitFactory = new StrategyFactory(gitConfig, eventEmitter);
            const result = await gitFactory.initialize();

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('git');
        });

        it('should respect forced file mode', async () => {
            // Mock the config to return 'file' mode
            const fileConfig = {
                getSnapshotConfig: vi.fn().mockReturnValue({ mode: 'file' }),
            };

            const fileFactory = new StrategyFactory(fileConfig, eventEmitter);
            const result = await fileFactory.initialize();

            expect(result.success).toBe(true);
            expect(result.strategy).toBe('file');
        });

        it('should handle initialization failure', async () => {
            mockGitStrategy.isAvailable.mockResolvedValue({ available: false });
            mockFileStrategy.initialize.mockResolvedValue({
                success: false,
                error: 'File strategy failed',
            });

            const result = await factory.initialize();

            expect(result.success).toBe(false);
            expect(result.error).toBe('File strategy failed');
        });

        it('should emit initialization event', async () => {
            const eventSpy = vi.fn();
            eventEmitter.on('strategy:factory:initialized', eventSpy);

            await factory.initialize();

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    strategy: 'git',
                    preferredMode: 'auto',
                })
            );
        });
    });

    describe('strategy selection', () => {
        it('should cache mode detection results', async () => {
            await factory.initialize();

            // Second initialization should use cache
            await factory.initialize();

            // isAvailable should only be called once due to caching
            expect(mockGitStrategy.isAvailable).toHaveBeenCalledTimes(1);
        });

        it('should refresh cache when requested', async () => {
            await factory.initialize();

            const refreshResult = await factory.refreshModeDetection();

            expect(refreshResult.success).toBe(true);
            expect(refreshResult.detectedMode).toBe('git');
        });

        it('should handle invalid strategy mode', async () => {
            await expect(factory.createStrategy('invalid')).rejects.toThrow(
                'Unknown strategy mode: invalid'
            );
        });
    });

    describe('strategy switching', () => {
        beforeEach(async () => {
            await factory.initialize(); // Start with Git
        });

        it('should switch from Git to file strategy', async () => {
            const result = await factory.switchToStrategy('file', 'manual');

            expect(result.success).toBe(true);
            expect(result.previousStrategy).toBe('git');
            expect(result.newStrategy).toBe('file');
            expect(factory.getCurrentMode()).toBe('file');
        });

        it('should not switch if already using target strategy', async () => {
            const result = await factory.switchToStrategy('git', 'manual');

            expect(result.success).toBe(true);
            expect(result.previousStrategy).toBe('git');
            expect(result.newStrategy).toBe('git');
        });

        it('should handle switch to unavailable strategy', async () => {
            mockFileStrategy.isAvailable.mockResolvedValue({ available: false });

            const result = await factory.switchToStrategy('file', 'manual');

            expect(result.success).toBe(false);
            expect(result.error).toContain('file strategy is not available');
        });

        it('should prevent concurrent switches', async () => {
            // Start a switch
            const promise1 = factory.switchToStrategy('file', 'test1');
            const promise2 = factory.switchToStrategy('file', 'test2');

            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
            expect(result2.error).toContain('switch already in progress');
        });

        it('should record switch history', async () => {
            await factory.switchToStrategy('file', 'test_reason');

            const status = factory.getStatus();
            expect(status.switchHistory).toHaveLength(1);
            expect(status.switchHistory[0]).toMatchObject({
                from: 'git',
                to: 'file',
                reason: 'test_reason',
                timestamp: expect.any(String),
            });
        });

        it('should emit switch event', async () => {
            const eventSpy = vi.fn();
            eventEmitter.on('strategy:switched', eventSpy);

            await factory.switchToStrategy('file', 'test');

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    previousStrategy: 'git',
                    newStrategy: 'file',
                    reason: 'test',
                })
            );
        });
    });

    describe('failure handling', () => {
        beforeEach(async () => {
            await factory.initialize(); // Start with Git
        });

        it('should handle Git strategy failure by switching to file', async () => {
            const error = new Error('Git operation failed');
            const result = await factory.handleStrategyFailure(error);

            expect(result.success).toBe(true);
            expect(result.newStrategy).toBe('file');
            expect(factory.getCurrentMode()).toBe('file');
        });

        it('should handle complete failure when all strategies fail', async () => {
            // Start with file strategy
            await factory.switchToStrategy('file');

            const error = new Error('File operation failed');
            const result = await factory.handleStrategyFailure(error);

            expect(result.success).toBe(false);
            expect(result.error).toBe('All strategies have failed');
        });
    });

    describe('status and information', () => {
        beforeEach(async () => {
            await factory.initialize();
        });

        it('should provide comprehensive status', () => {
            const status = factory.getStatus();

            expect(status).toMatchObject({
                currentStrategy: 'git',
                preferredMode: 'auto',
                switchingInProgress: false,
                availableStrategies: ['git', 'file'],
                switchHistory: expect.any(Array),
                modeDetectionCache: expect.objectContaining({
                    lastCheck: expect.any(String),
                    result: expect.any(String),
                    cacheValid: expect.any(Boolean),
                }),
                strategyStatus: expect.any(Object),
            });
        });

        it('should return current strategy instance', () => {
            const strategy = factory.getCurrentStrategy();
            expect(strategy).toBe(mockGitStrategy);
        });

        it('should return current mode', () => {
            const mode = factory.getCurrentMode();
            expect(mode).toBe('git');
        });
    });

    describe('singleton functionality', () => {
        it('should return same instance from getStrategyFactory', () => {
            const factory1 = getStrategyFactory();
            const factory2 = getStrategyFactory();

            expect(factory1).toBe(factory2);
        });

        it('should create new instance after reset', () => {
            const factory1 = getStrategyFactory();
            resetStrategyFactory();
            const factory2 = getStrategyFactory();

            expect(factory1).not.toBe(factory2);
        });
    });

    describe('edge cases', () => {
        it('should handle strategy creation errors', async () => {
            GitSnapshotStrategy.mockImplementation(() => {
                throw new Error('Strategy creation failed');
            });

            await expect(factory.createStrategy('git')).rejects.toThrow('Strategy creation failed');
        });

        it('should handle availability check errors', async () => {
            mockGitStrategy.isAvailable.mockRejectedValue(new Error('Availability check failed'));

            const available = await factory.isStrategyAvailable(mockGitStrategy);
            expect(available).toBe(false);
        });

        it('should validate strategy modes', () => {
            expect(factory.isValidMode('git')).toBe(true);
            expect(factory.isValidMode('file')).toBe(true);
            expect(factory.isValidMode('invalid')).toBe(false);
        });

        it('should limit switch history size', async () => {
            // Create many switches to test history limit
            for (let i = 0; i < 15; i++) {
                const mode = i % 2 === 0 ? 'file' : 'git';
                await factory.switchToStrategy(mode, `test_${i}`);
            }

            const status = factory.getStatus();
            expect(status.switchHistory.length).toBeLessThanOrEqual(5); // Only last 5 in status
        });
    });
});
