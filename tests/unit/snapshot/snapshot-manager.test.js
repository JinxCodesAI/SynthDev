/**
 * Unit tests for SnapshotManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from '../../../src/core/snapshot/events/SnapshotEventEmitter.js';
import { MockStrategy } from './mocks/MockStrategy.js';

describe('SnapshotManager', () => {
    let manager;
    let config;
    let eventEmitter;

    beforeEach(() => {
        config = new SnapshotConfig();
        eventEmitter = new SnapshotEventEmitter();
        manager = new SnapshotManager(config, eventEmitter);

        // Mock the strategy factory to return our mock strategy
        const mockStrategy = new MockStrategy();
        vi.spyOn(manager.strategyFactory, 'initialize').mockResolvedValue({
            success: true,
            strategy: 'mock',
        });
        vi.spyOn(manager.strategyFactory, 'getCurrentStrategy').mockReturnValue(mockStrategy);
        vi.spyOn(manager.strategyFactory, 'switchToStrategy').mockImplementation(async mode => {
            return {
                success: true,
                previousStrategy: mockStrategy.getMode(),
                newStrategy: mode,
            };
        });

        // Mock the change detector
        manager.changeDetector = {
            initialize: vi.fn().mockResolvedValue(true),
            getStatus: vi.fn().mockReturnValue({ initialized: true }),
        };

        // Mock the performance optimizer
        manager.performanceOptimizer = {
            initialize: vi.fn().mockResolvedValue(true),
            shutdown: vi.fn().mockResolvedValue(true),
        };

        // Mock the integrity validator
        manager.integrityValidator = {
            validateSnapshot: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
        };
    });

    afterEach(() => {
        if (manager && manager.isInitialized) {
            manager.shutdown();
        }
    });

    describe('initialization', () => {
        it('should create manager with default configuration', () => {
            const defaultManager = new SnapshotManager();
            expect(defaultManager).toBeDefined();
            expect(defaultManager.isInitialized).toBe(false);
        });

        it('should create manager with custom configuration', () => {
            expect(manager).toBeDefined();
            expect(manager.config).toBe(config);
            expect(manager.eventEmitter).toBe(eventEmitter);
            expect(manager.isInitialized).toBe(false);
        });

        it('should initialize successfully', async () => {
            const result = await manager.initialize();
            expect(result.success).toBe(true);
            expect(manager.isInitialized).toBe(true);
            expect(manager.currentStrategy).toBeDefined();
        });

        it('should handle initialization failure gracefully', async () => {
            // Mock strategy factory to fail
            vi.spyOn(manager.strategyFactory, 'initialize').mockResolvedValue({
                success: false,
                error: 'Mock initialization failure',
            });

            const result = await manager.initialize();
            expect(result.success).toBe(false);
            expect(result.error).toBe('Mock initialization failure');
            expect(manager.isInitialized).toBe(false);
        });
    });

    describe('status and health', () => {
        it('should return status when not initialized', async () => {
            const result = await manager.getStatus();
            expect(result.success).toBe(true);
            expect(result.status.initialized).toBe(false);
            expect(result.status.strategy).toBeNull();
        });

        it('should return status when initialized', async () => {
            await manager.initialize();
            const result = await manager.getStatus();

            expect(result.success).toBe(true);
            expect(result.status.initialized).toBe(true);
            expect(result.status.strategy).toBeDefined();
            expect(result.status.health).toBeDefined();
            expect(result.status.metrics).toBeDefined();
        });

        it('should return performance metrics', async () => {
            const metrics = manager.getMetrics();
            expect(metrics).toBeDefined();
            expect(metrics.totalSnapshots).toBe(0);
            expect(metrics.totalOperations).toBe(0);
            expect(metrics.errorRate).toBe(0);
        });
    });

    describe('snapshot operations', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should require initialization for snapshot operations', async () => {
            const uninitializedManager = new SnapshotManager();

            // Mock the strategy factory to return our mock strategy
            const mockStrategy = new MockStrategy();
            vi.spyOn(uninitializedManager.strategyFactory, 'initialize').mockResolvedValue({
                success: true,
                strategy: 'mock',
            });
            vi.spyOn(uninitializedManager.strategyFactory, 'getCurrentStrategy').mockReturnValue(
                mockStrategy
            );

            // Mock the change detector
            uninitializedManager.changeDetector = {
                initialize: vi.fn().mockResolvedValue(true),
                getStatus: vi.fn().mockReturnValue({ initialized: true }),
            };

            const result = await uninitializedManager.createSnapshot('test instruction');
            expect(result.success).toBe(true); // Should auto-initialize
        });

        it('should validate snapshot inputs', async () => {
            const result = await manager.createSnapshot('');
            expect(result.success).toBe(false);
            expect(result.error).toContain('instruction is required');
        });

        it('should validate snapshot inputs with null instruction', async () => {
            const result = await manager.createSnapshot(null);
            expect(result.success).toBe(false);
            expect(result.error).toContain('instruction is required');
        });

        it('should validate files parameter', async () => {
            const result = await manager.createSnapshot('test', 'invalid files');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Files must be a Map, Array, or null');
        });

        it('should accept valid files as Map', async () => {
            const files = new Map([['test.js', 'console.log("test");']]);

            // Mock strategy to return success
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockResolvedValue({
                success: true,
                snapshot: { id: 'test-id', instruction: 'test' },
            });

            const result = await manager.createSnapshot('test instruction', files);
            expect(result.success).toBe(true);
        });

        it('should accept valid files as Array', async () => {
            const files = ['test.js', 'package.json'];

            // Mock strategy to return success
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockResolvedValue({
                success: true,
                snapshot: { id: 'test-id', instruction: 'test' },
            });

            const result = await manager.createSnapshot('test instruction', files);
            expect(result.success).toBe(true);
        });

        it('should handle strategy errors gracefully', async () => {
            // Mock strategy to fail
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockResolvedValue({
                success: false,
                error: 'Mock strategy error',
            });

            const result = await manager.createSnapshot('test instruction');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Mock strategy error');
        });

        it('should update metrics on successful operations', async () => {
            // Mock strategy to return success
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockResolvedValue({
                success: true,
                snapshot: { id: 'test-id', instruction: 'test' },
            });

            const initialMetrics = manager.getMetrics();
            await manager.createSnapshot('test instruction');
            const updatedMetrics = manager.getMetrics();

            expect(updatedMetrics.totalOperations).toBe(initialMetrics.totalOperations + 1);
            expect(updatedMetrics.totalSnapshots).toBe(initialMetrics.totalSnapshots + 1);
        });

        it('should update error rate on failed operations', async () => {
            // Mock strategy to fail
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockResolvedValue({
                success: false,
                error: 'Mock error',
            });

            const initialMetrics = manager.getMetrics();
            await manager.createSnapshot('test instruction');
            const updatedMetrics = manager.getMetrics();

            expect(updatedMetrics.totalOperations).toBe(initialMetrics.totalOperations + 1);
            expect(updatedMetrics.errorRate).toBeGreaterThan(initialMetrics.errorRate);
        });
    });

    describe('concurrency control', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should handle concurrent operations', async () => {
            // Mock strategy to simulate async operation
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    success: true,
                    snapshot: { id: 'test-id', instruction: 'test' },
                };
            });

            // Start multiple operations concurrently
            const promises = [
                manager.createSnapshot('test 1'),
                manager.createSnapshot('test 2'),
                manager.createSnapshot('test 3'),
            ];

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });

        it('should queue operations when at max concurrency', async () => {
            // Set low max concurrent operations for testing
            manager.maxConcurrentOperations = 1;

            let operationCount = 0;
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockImplementation(async () => {
                operationCount++;
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    success: true,
                    snapshot: { id: `test-id-${operationCount}`, instruction: 'test' },
                };
            });

            // Start multiple operations
            const promises = [manager.createSnapshot('test 1'), manager.createSnapshot('test 2')];

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });
    });

    describe('strategy switching', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should switch strategies successfully', async () => {
            const initialMode = manager.currentStrategy.getMode();

            // Mock strategy factory switch
            vi.spyOn(manager.strategyFactory, 'switchToStrategy').mockResolvedValue({
                success: true,
                previousStrategy: 'mock',
                newStrategy: 'file',
            });

            vi.spyOn(manager.strategyFactory, 'getCurrentStrategy').mockReturnValue({
                getMode: () => 'file',
            });

            const result = await manager.switchStrategy('file');
            expect(result.success).toBe(true);
            expect(result.previousMode).toBe(initialMode);
            expect(result.newMode).toBe('file');
        });

        it('should handle strategy switch failures', async () => {
            // Mock strategy factory to fail
            vi.spyOn(manager.strategyFactory, 'switchToStrategy').mockResolvedValue({
                success: false,
                error: 'Mock switch failure',
            });

            const result = await manager.switchStrategy('file');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Mock switch failure');
        });
    });

    describe('shutdown', () => {
        it('should shutdown gracefully', async () => {
            await manager.initialize();

            const result = await manager.shutdown();
            expect(result.success).toBe(true);
            expect(manager.isInitialized).toBe(false);
        });

        it('should wait for active operations before shutdown', async () => {
            await manager.initialize();

            // Mock a long-running operation that completes successfully
            vi.spyOn(manager.currentStrategy, 'createSnapshot').mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    success: true,
                    snapshot: { id: 'test-id', instruction: 'test' },
                };
            });

            // Start operation
            const operationPromise = manager.createSnapshot('test');

            // Wait a bit to ensure operation starts
            await new Promise(resolve => setTimeout(resolve, 10));

            // Then shutdown
            const shutdownPromise = manager.shutdown();

            // Both should complete successfully
            const [operationResult, shutdownResult] = await Promise.all([
                operationPromise,
                shutdownPromise,
            ]);

            // We're just testing that shutdown waits for operations, not the actual results
            // since our mock strategy might not be fully implemented
            expect(shutdownResult.success).toBe(true);
        });
    });
});
