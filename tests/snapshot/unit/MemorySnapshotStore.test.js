/**
 * Unit tests for MemorySnapshotStore
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemorySnapshotStore } from '../../../src/core/snapshot/stores/MemorySnapshotStore.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    }),
}));

describe('MemorySnapshotStore', () => {
    let store;
    let mockConfig;

    beforeEach(() => {
        mockConfig = {
            maxSnapshots: 5,
            maxMemoryMB: 1, // 1MB for testing
            persistToDisk: false,
        };
        store = new MemorySnapshotStore(mockConfig);
    });

    describe('constructor', () => {
        it('should initialize with default config', () => {
            const defaultStore = new MemorySnapshotStore();
            expect(defaultStore.config.maxSnapshots).toBe(50);
            expect(defaultStore.config.maxMemoryMB).toBe(100);
            expect(defaultStore.config.persistToDisk).toBe(false);
        });

        it('should initialize with custom config', () => {
            expect(store.config.maxSnapshots).toBe(5);
            expect(store.config.maxMemoryMB).toBe(1);
            expect(store.config.persistToDisk).toBe(false);
        });

        it('should initialize empty storage', () => {
            expect(store.snapshots.size).toBe(0);
            expect(store.memoryUsage).toBe(0);
        });
    });

    describe('store', () => {
        it('should store a snapshot with generated ID', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: { 'test.js': 'console.log("test");' },
            };

            const snapshotId = await store.store(snapshot);

            expect(snapshotId).toBeDefined();
            expect(typeof snapshotId).toBe('string');
            expect(store.snapshots.size).toBe(1);
            expect(store.memoryUsage).toBeGreaterThan(0);
        });

        it('should store a snapshot with custom ID', async () => {
            const snapshot = {
                id: 'custom-id',
                description: 'Test snapshot',
                fileData: { 'test.js': 'console.log("test");' },
            };

            const snapshotId = await store.store(snapshot);

            expect(snapshotId).toBe('custom-id');
            expect(store.snapshots.has('custom-id')).toBe(true);
        });

        it('should reject duplicate IDs', async () => {
            const snapshot = {
                id: 'duplicate-id',
                description: 'Test snapshot',
            };

            await store.store(snapshot);

            await expect(store.store(snapshot)).rejects.toThrow(
                'Snapshot with ID duplicate-id already exists'
            );
        });

        it('should add timestamp and metadata to snapshot', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: {},
            };

            const snapshotId = await store.store(snapshot);
            const stored = await store.retrieve(snapshotId);

            expect(stored.timestamp).toBeDefined();
            expect(stored.metadata).toBeDefined();
            expect(stored.description).toBe('Test snapshot');
        });
    });

    describe('retrieve', () => {
        it('should retrieve existing snapshot', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: { 'test.js': 'console.log("test");' },
            };

            const snapshotId = await store.store(snapshot);
            const retrieved = await store.retrieve(snapshotId);

            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(snapshotId);
            expect(retrieved.description).toBe('Test snapshot');
            expect(retrieved.fileData['test.js']).toBe('console.log("test");');
        });

        it('should return null for non-existent snapshot', async () => {
            const retrieved = await store.retrieve('non-existent-id');
            expect(retrieved).toBeNull();
        });

        it('should return deep copy to prevent external modifications', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: { 'test.js': 'console.log("test");' },
            };

            const snapshotId = await store.store(snapshot);
            const retrieved1 = await store.retrieve(snapshotId);
            const retrieved2 = await store.retrieve(snapshotId);

            // Modify one copy
            retrieved1.description = 'Modified';

            // Other copy should be unchanged
            expect(retrieved2.description).toBe('Test snapshot');
        });
    });

    describe('list', () => {
        beforeEach(async () => {
            // Add some test snapshots
            await store.store({
                description: 'First snapshot',
                fileData: { 'file1.js': 'content1' },
            });
            await store.store({
                description: 'Second snapshot',
                fileData: { 'file2.js': 'content2' },
            });
            await store.store({
                description: 'Third snapshot',
                fileData: { 'file3.js': 'content3' },
            });
        });

        it('should list all snapshots', async () => {
            const snapshots = await store.list();

            expect(snapshots).toHaveLength(3);
            expect(snapshots[0]).toHaveProperty('id');
            expect(snapshots[0]).toHaveProperty('description');
            expect(snapshots[0]).toHaveProperty('timestamp');
            expect(snapshots[0]).toHaveProperty('fileCount');
            expect(snapshots[0]).toHaveProperty('size');
        });

        it('should sort snapshots by timestamp (newest first by default)', async () => {
            const snapshots = await store.list();

            // Should be sorted newest first
            expect(new Date(snapshots[0].timestamp)).toBeInstanceOf(Date);
            expect(new Date(snapshots[1].timestamp)).toBeInstanceOf(Date);
            expect(new Date(snapshots[2].timestamp)).toBeInstanceOf(Date);
        });

        it('should apply limit', async () => {
            const snapshots = await store.list({ limit: 2 });
            expect(snapshots).toHaveLength(2);
        });

        it('should filter by description', async () => {
            const snapshots = await store.list({
                filter: { description: 'First' },
            });

            expect(snapshots).toHaveLength(1);
            expect(snapshots[0].description).toBe('First snapshot');
        });
    });

    describe('delete', () => {
        it('should delete existing snapshot', async () => {
            const snapshot = {
                description: 'Test snapshot',
                fileData: { 'test.js': 'console.log("test");' },
            };

            const snapshotId = await store.store(snapshot);
            const initialMemoryUsage = store.memoryUsage;

            const success = await store.delete(snapshotId);

            expect(success).toBe(true);
            expect(store.snapshots.has(snapshotId)).toBe(false);
            expect(store.memoryUsage).toBeLessThan(initialMemoryUsage);
        });

        it('should return false for non-existent snapshot', async () => {
            const success = await store.delete('non-existent-id');
            expect(success).toBe(false);
        });
    });

    describe('exists', () => {
        it('should return true for existing snapshot', async () => {
            const snapshot = { description: 'Test snapshot' };
            const snapshotId = await store.store(snapshot);

            const exists = await store.exists(snapshotId);
            expect(exists).toBe(true);
        });

        it('should return false for non-existent snapshot', async () => {
            const exists = await store.exists('non-existent-id');
            expect(exists).toBe(false);
        });
    });

    describe('getStorageStats', () => {
        it('should return correct storage statistics', async () => {
            await store.store({ description: 'Test 1' });
            await store.store({ description: 'Test 2' });

            const stats = store.getStorageStats();

            expect(stats.snapshotCount).toBe(2);
            expect(stats.memoryUsageMB).toBeGreaterThan(0);
            expect(stats.maxSnapshots).toBe(5);
            expect(stats.maxMemoryMB).toBe(1);
            expect(stats.utilizationPercent).toBe(40); // 2/5 * 100
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            // Add test snapshots
            for (let i = 0; i < 3; i++) {
                await store.store({
                    description: `Snapshot ${i}`,
                    fileData: { [`file${i}.js`]: `content${i}` },
                });
            }
        });

        it('should cleanup oldest snapshots first', async () => {
            const cleanedCount = await store.cleanup({
                strategy: 'oldest_first',
                count: 2,
            });

            expect(cleanedCount).toBe(2);
            expect(store.snapshots.size).toBe(1);
        });

        it('should cleanup to free target size', async () => {
            const targetSize = 100; // bytes
            const cleanedCount = await store.cleanup({
                strategy: 'oldest_first',
                targetSize,
            });

            expect(cleanedCount).toBeGreaterThan(0);
        });

        it('should return 0 when no snapshots to cleanup', async () => {
            // Delete all snapshots first
            const snapshots = await store.list();
            for (const snapshot of snapshots) {
                await store.delete(snapshot.id);
            }

            const cleanedCount = await store.cleanup({
                strategy: 'oldest_first',
                count: 1,
            });

            expect(cleanedCount).toBe(0);
        });
    });
});
