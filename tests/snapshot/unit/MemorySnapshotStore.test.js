import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySnapshotStore } from '../../../src/core/snapshot/stores/MemorySnapshotStore.js';

describe('MemorySnapshotStore', () => {
    let store;

    beforeEach(() => {
        store = new MemorySnapshotStore({
            maxSnapshots: 5,
            maxMemoryMB: 1
        });
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            const defaultStore = new MemorySnapshotStore();
            expect(defaultStore.config.maxSnapshots).toBe(50);
            expect(defaultStore.config.maxMemoryMB).toBe(100);
        });

        it('should accept custom configuration', () => {
            expect(store.config.maxSnapshots).toBe(5);
            expect(store.config.maxMemoryMB).toBe(1);
        });

        it('should initialize empty storage', () => {
            expect(store.snapshots.size).toBe(0);
            expect(store.metadata.size).toBe(0);
            expect(store.stats.totalSnapshots).toBe(0);
        });
    });

    describe('store operation', () => {
        it('should store a snapshot successfully', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: { files: {} },
                metadata: { testData: 'test' }
            };

            const snapshotId = await store.store(snapshot);
            
            expect(snapshotId).toBeDefined();
            expect(typeof snapshotId).toBe('string');
            expect(store.stats.totalSnapshots).toBe(1);
        });

        it('should generate unique IDs for snapshots', async () => {
            const snapshot1 = {
                description: 'Test snapshot 1',
                fileData: { files: {} },
                metadata: {}
            };

            const snapshot2 = {
                description: 'Test snapshot 2',
                fileData: { files: {} },
                metadata: {}
            };

            const id1 = await store.store(snapshot1);
            const id2 = await store.store(snapshot2);

            expect(id1).not.toBe(id2);
        });

        it('should accept custom ID', async () => {
            const customId = 'custom-id-123';
            const snapshot = {
                id: customId,
                description: 'Test snapshot',
                fileData: { files: {} },
                metadata: {}
            };

            const snapshotId = await store.store(snapshot);
            expect(snapshotId).toBe(customId);
        });

        it('should validate snapshot data', async () => {
            const invalidSnapshot = {
                description: 'Test',
                // Missing fileData
                metadata: {}
            };

            await expect(store.store(invalidSnapshot)).rejects.toThrow('Invalid snapshot data');
        });
    });

    describe('retrieve operation', () => {
        it('should retrieve existing snapshot', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: { files: {} },
                metadata: { testData: 'test' }
            };

            const snapshotId = await store.store(snapshot);
            const retrieved = await store.retrieve(snapshotId);

            expect(retrieved).toBeDefined();
            expect(retrieved.description).toBe('Test snapshot');
            expect(retrieved.metadata.testData).toBe('test');
        });

        it('should return null for non-existent snapshot', async () => {
            const result = await store.retrieve('non-existent-id');
            expect(result).toBeNull();
        });
    });

    describe('list operation', () => {
        beforeEach(async () => {
            // Add some test snapshots
            await store.store({
                description: 'First snapshot',
                fileData: { files: {} },
                metadata: {}
            });
            // Add a small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));
            await store.store({
                description: 'Second snapshot',
                fileData: { files: {} },
                metadata: {}
            });
        });

        it('should list all snapshots', async () => {
            const snapshots = await store.list();
            expect(snapshots).toHaveLength(2);
            expect(snapshots[0].description).toBeDefined();
            expect(snapshots[1].description).toBeDefined();
        });

        it('should sort snapshots by timestamp desc by default', async () => {
            const snapshots = await store.list();
            expect(snapshots).toHaveLength(2);
            // Second snapshot should be first (newest)
            expect(snapshots[0].description).toBe('Second snapshot');
            expect(snapshots[1].description).toBe('First snapshot');
        });

        it('should apply limit parameter', async () => {
            const snapshots = await store.list({ limit: 1 });
            expect(snapshots).toHaveLength(1);
        });
    });

    describe('delete operation', () => {
        let snapshotId;

        beforeEach(async () => {
            snapshotId = await store.store({
                description: 'Test snapshot',
                fileData: { files: {} },
                metadata: {}
            });
        });

        it('should delete existing snapshot', async () => {
            const deleted = await store.delete(snapshotId);
            expect(deleted).toBe(true);
            expect(store.stats.totalSnapshots).toBe(0);
        });

        it('should return false for non-existent snapshot', async () => {
            const deleted = await store.delete('non-existent-id');
            expect(deleted).toBe(false);
        });

        it('should update statistics after deletion', async () => {
            const initialCount = store.stats.totalSnapshots;
            await store.delete(snapshotId);
            expect(store.stats.totalSnapshots).toBe(initialCount - 1);
        });
    });

    describe('exists operation', () => {
        let snapshotId;

        beforeEach(async () => {
            snapshotId = await store.store({
                description: 'Test snapshot',
                fileData: { files: {} },
                metadata: {}
            });
        });

        it('should return true for existing snapshot', async () => {
            const exists = await store.exists(snapshotId);
            expect(exists).toBe(true);
        });

        it('should return false for non-existent snapshot', async () => {
            const exists = await store.exists('non-existent-id');
            expect(exists).toBe(false);
        });
    });

    describe('getStorageStats', () => {
        it('should return storage statistics', () => {
            const stats = store.getStorageStats();
            expect(stats).toMatchObject({
                totalSnapshots: 0,
                memoryUsage: 0,
                maxSnapshots: 5,
                maxMemoryMB: 1,
                memoryUsageMB: 0,
                memoryUsagePercent: 0
            });
        });
    });

    describe('cleanup operation', () => {
        beforeEach(async () => {
            // Add multiple snapshots
            for (let i = 0; i < 3; i++) {
                await store.store({
                    description: `Snapshot ${i}`,
                    fileData: { files: {} },
                    metadata: {}
                });
            }
        });

        it('should cleanup by count', async () => {
            const deletedCount = await store.cleanup({ maxCount: 2 });
            expect(deletedCount).toBe(1);
            expect(store.stats.totalSnapshots).toBe(2);
        });

        it('should return number of deleted snapshots', async () => {
            const deletedCount = await store.cleanup({ maxCount: 1 });
            expect(deletedCount).toBe(2);
        });
    });
});