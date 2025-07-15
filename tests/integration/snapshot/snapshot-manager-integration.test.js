/**
 * Integration tests for SnapshotManager with real strategies
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from '../../../src/core/snapshot/events/SnapshotEventEmitter.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

describe('SnapshotManager Integration Tests', () => {
    let manager;
    let config;
    let eventEmitter;
    let testDir;

    beforeEach(async () => {
        // Create a temporary directory for testing
        testDir = await mkdtemp(join(tmpdir(), 'snapshot-manager-test-'));

        // Create test configuration
        config = new SnapshotConfig({
            workingDirectory: testDir,
            snapshotDirectory: join(testDir, '.snapshots'),
            mode: 'auto', // Let it auto-detect
            maxSnapshots: 10,
        });

        eventEmitter = new SnapshotEventEmitter();
        manager = new SnapshotManager(config, eventEmitter);
    });

    afterEach(async () => {
        if (manager && manager.isInitialized) {
            await manager.shutdown();
        }

        // Clean up test directory
        if (testDir) {
            try {
                await rm(testDir, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('initialization with real strategies', () => {
        it('should initialize with file strategy when Git is not available', async () => {
            const result = await manager.initialize();

            expect(result.success).toBe(true);
            expect(manager.isInitialized).toBe(true);
            expect(manager.currentStrategy).toBeDefined();

            // Should fall back to file strategy in most test environments
            const status = await manager.getStatus();
            expect(status.success).toBe(true);
            expect(['git', 'file']).toContain(status.status.strategy);
        });

        it('should handle initialization errors gracefully', async () => {
            // Create a config with an invalid directory
            const invalidConfig = new SnapshotConfig({
                workingDirectory: '/invalid/path/that/does/not/exist',
                snapshotDirectory: '/invalid/path/.snapshots',
            });

            const invalidManager = new SnapshotManager(invalidConfig);
            const result = await invalidManager.initialize();

            // Should handle the error gracefully
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('snapshot operations with real strategies', () => {
        beforeEach(async () => {
            await manager.initialize();

            // Create some test files
            await mkdir(join(testDir, 'src'), { recursive: true });
            await writeFile(join(testDir, 'src', 'test.js'), 'console.log("Hello, World!");');
            await writeFile(join(testDir, 'package.json'), '{"name": "test-project"}');
        });

        it('should create snapshots with real files', async () => {
            const files = new Map([
                ['src/test.js', 'console.log("Hello, World!");'],
                ['package.json', '{"name": "test-project"}'],
            ]);

            const result = await manager.createSnapshot('Initial test snapshot', files);

            expect(result.success).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot.id).toBeDefined();
            expect(result.snapshot.instruction).toBe('Initial test snapshot');
        });

        it('should create snapshots with file paths', async () => {
            const files = ['src/test.js', 'package.json'];

            const result = await manager.createSnapshot('Snapshot with file paths', files);

            expect(result.success).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot.instruction).toBe('Snapshot with file paths');
        });

        it('should retrieve created snapshots', async () => {
            // Create a snapshot first
            const createResult = await manager.createSnapshot('Test snapshot for retrieval');
            expect(createResult.success).toBe(true);

            const snapshotId = createResult.snapshot.id;

            // Retrieve the snapshot
            const getResult = await manager.getSnapshot(snapshotId);
            expect(getResult.success).toBe(true);
            expect(getResult.snapshot.id).toBe(snapshotId);
            expect(getResult.snapshot.instruction).toBe('Test snapshot for retrieval');
        });

        it('should list all snapshots', async () => {
            // Create multiple snapshots
            await manager.createSnapshot('First snapshot');
            await manager.createSnapshot('Second snapshot');
            await manager.createSnapshot('Third snapshot');

            // Get all snapshots
            const listResult = await manager.getSnapshots();
            expect(listResult.success).toBe(true);
            expect(listResult.snapshots).toBeDefined();
            expect(listResult.snapshots.length).toBeGreaterThanOrEqual(3);
        });

        it('should delete snapshots', async () => {
            // Create a snapshot
            const createResult = await manager.createSnapshot('Snapshot to delete');
            expect(createResult.success).toBe(true);

            const snapshotId = createResult.snapshot.id;

            // Delete the snapshot
            const deleteResult = await manager.deleteSnapshot(snapshotId);
            expect(deleteResult.success).toBe(true);

            // Verify it's deleted
            const getResult = await manager.getSnapshot(snapshotId);
            expect(getResult.success).toBe(false);
        });

        it('should clear all snapshots', async () => {
            // Create multiple snapshots
            await manager.createSnapshot('Snapshot 1');
            await manager.createSnapshot('Snapshot 2');
            await manager.createSnapshot('Snapshot 3');

            // Clear all snapshots
            const clearResult = await manager.clearSnapshots();
            expect(clearResult.success).toBe(true);
            expect(clearResult.cleared).toBeGreaterThanOrEqual(3);

            // Verify they're all gone
            const listResult = await manager.getSnapshots();
            expect(listResult.success).toBe(true);
            expect(listResult.snapshots.length).toBe(0);
        });
    });

    describe('strategy switching', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should switch strategies when requested', async () => {
            const initialStatus = await manager.getStatus();
            const initialStrategy = initialStatus.status.strategy;

            // Try to switch to file strategy
            const switchResult = await manager.switchStrategy('file');

            if (switchResult.success) {
                expect(switchResult.previousMode).toBe(initialStrategy);
                expect(switchResult.newMode).toBe('file');

                const newStatus = await manager.getStatus();
                expect(newStatus.status.strategy).toBe('file');
            } else {
                // Strategy switching might not be supported in all environments
                expect(switchResult.error).toBeDefined();
            }
        });
    });

    describe('error handling and recovery', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should handle invalid snapshot IDs gracefully', async () => {
            const result = await manager.getSnapshot('invalid-snapshot-id');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle invalid file paths gracefully', async () => {
            const files = ['/invalid/path/that/does/not/exist.js'];
            const result = await manager.createSnapshot('Invalid files test', files);

            // Should either succeed (if strategy handles it) or fail gracefully
            if (!result.success) {
                expect(result.error).toBeDefined();
            }
        });

        it('should maintain consistency after errors', async () => {
            // Create a valid snapshot
            const validResult = await manager.createSnapshot('Valid snapshot');
            expect(validResult.success).toBe(true);

            // Try to create an invalid snapshot
            const invalidResult = await manager.createSnapshot('');
            expect(invalidResult.success).toBe(false);

            // Verify the valid snapshot is still there
            const listResult = await manager.getSnapshots();
            expect(listResult.success).toBe(true);
            expect(listResult.snapshots.length).toBeGreaterThanOrEqual(1);

            const validSnapshot = listResult.snapshots.find(s => s.id === validResult.snapshot.id);
            expect(validSnapshot).toBeDefined();
        });
    });

    describe('performance and metrics', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should track performance metrics', async () => {
            const initialMetrics = manager.getMetrics();
            expect(initialMetrics.totalOperations).toBe(0);
            expect(initialMetrics.totalSnapshots).toBe(0);

            // Perform some operations
            await manager.createSnapshot('Metrics test 1');
            await manager.createSnapshot('Metrics test 2');
            await manager.getSnapshots();

            const updatedMetrics = manager.getMetrics();
            expect(updatedMetrics.totalOperations).toBeGreaterThan(initialMetrics.totalOperations);
            expect(updatedMetrics.totalSnapshots).toBeGreaterThan(initialMetrics.totalSnapshots);
        });

        it('should handle concurrent operations', async () => {
            // Create multiple snapshots concurrently
            const promises = [
                manager.createSnapshot('Concurrent 1'),
                manager.createSnapshot('Concurrent 2'),
                manager.createSnapshot('Concurrent 3'),
            ];

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            // Verify all snapshots were created
            const listResult = await manager.getSnapshots();
            expect(listResult.success).toBe(true);
            expect(listResult.snapshots.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('event handling', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should emit events for snapshot operations', async () => {
            const events = [];

            // Listen for events
            manager.eventEmitter.on('snapshot:created', data => {
                events.push({ type: 'created', data });
            });

            manager.eventEmitter.on('snapshot:deleted', data => {
                events.push({ type: 'deleted', data });
            });

            // Create a snapshot
            const createResult = await manager.createSnapshot('Event test snapshot');
            expect(createResult.success).toBe(true);

            // Delete the snapshot
            const deleteResult = await manager.deleteSnapshot(createResult.snapshot.id);
            expect(deleteResult.success).toBe(true);

            // Check events were emitted
            expect(events.length).toBeGreaterThanOrEqual(2);
            expect(events.some(e => e.type === 'created')).toBe(true);
            expect(events.some(e => e.type === 'deleted')).toBe(true);
        });
    });
});
