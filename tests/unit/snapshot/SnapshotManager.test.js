/**
 * Tests for SnapshotManager prefix ID resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';
import { MemorySnapshotStore } from '../../../src/core/snapshot/stores/MemorySnapshotStore.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// Mock FileBackup to avoid real file operations
vi.mock('../../../src/core/snapshot/FileBackup.js', () => ({
    FileBackup: vi.fn().mockImplementation(() => ({
        captureFiles: vi.fn().mockResolvedValue({
            files: {
                'test.txt': {
                    content: 'test content',
                    size: 12,
                    modified: new Date().toISOString(),
                    checksum: 'abc123',
                },
            },
            stats: {
                totalSize: 12,
                fileCount: 1,
            },
        }),
        previewRestore: vi.fn().mockResolvedValue({
            stats: { impactedFiles: 1 },
        }),
        restoreFiles: vi.fn().mockResolvedValue({
            stats: { restoredFiles: 1 },
            restored: ['test.txt'],
            errors: [],
        }),
    })),
}));

// Mock FileFilter
vi.mock('../../../src/core/snapshot/FileFilter.js', () => ({
    FileFilter: vi.fn().mockImplementation(() => ({
        getFilterStats: vi.fn().mockReturnValue({
            excludedFiles: 0,
            includedFiles: 1,
        }),
    })),
}));

describe('SnapshotManager ID Resolution', () => {
    let manager;
    let testSnapshots = [];

    beforeEach(async () => {
        manager = new SnapshotManager();
        testSnapshots = [];

        // Create test snapshots with known IDs (now uses mocked file operations)
        const snapshot1 = await manager.createSnapshot('Test snapshot 1');
        const snapshot2 = await manager.createSnapshot('Test snapshot 2');

        testSnapshots.push(snapshot1, snapshot2);
    });

    describe('resolveSnapshotId', () => {
        it('should resolve full ID directly', async () => {
            const fullId = testSnapshots[0].id;
            const resolved = await manager.resolveSnapshotId(fullId);
            expect(resolved).toBe(fullId);
        });

        it('should resolve partial ID with unique prefix', async () => {
            const fullId = testSnapshots[0].id;
            const prefix = fullId.substring(0, 8);
            const resolved = await manager.resolveSnapshotId(prefix);
            expect(resolved).toBe(fullId);
        });

        it('should throw error for non-existent partial ID', async () => {
            await expect(manager.resolveSnapshotId('nonexistent')).rejects.toThrow(
                'Snapshot not found: nonexistent'
            );
        });

        it('should throw error for ambiguous partial ID', async () => {
            // Mock the store to return multiple snapshots with the same prefix
            const mockSnapshots = [
                { id: 'abc123-def456-ghi789', description: 'Test 1' },
                { id: 'abc456-def789-ghi012', description: 'Test 2' },
            ];

            // Mock the store's exists method to return false for direct lookup
            vi.spyOn(manager.store, 'exists').mockResolvedValue(false);

            // Mock the store's list method to return our mock snapshots
            vi.spyOn(manager.store, 'list').mockResolvedValue(mockSnapshots);

            // Test with prefix that matches both
            await expect(manager.resolveSnapshotId('abc')).rejects.toThrow(/Ambiguous snapshot ID/);

            // Restore original methods
            manager.store.exists.mockRestore();
            manager.store.list.mockRestore();
        });
    });

    describe('getSnapshotDetails with partial ID', () => {
        it('should get details with partial ID', async () => {
            const fullId = testSnapshots[0].id;
            const prefix = fullId.substring(0, 8);
            const details = await manager.getSnapshotDetails(prefix);
            expect(details.id).toBe(fullId);
            expect(details.description).toBe('Test snapshot 1');
        });
    });

    describe('deleteSnapshot with partial ID', () => {
        it('should delete with partial ID', async () => {
            const fullId = testSnapshots[0].id;
            const prefix = fullId.substring(0, 8);
            const result = await manager.deleteSnapshot(prefix);
            expect(result.id).toBe(fullId);
            expect(result.deleted).toBe(true);
        });
    });

    describe('restoreSnapshot with partial ID', () => {
        it('should restore with partial ID in preview mode', async () => {
            const fullId = testSnapshots[0].id;
            const prefix = fullId.substring(0, 8);
            const result = await manager.restoreSnapshot(prefix, { preview: true });
            expect(result.snapshotId).toBe(fullId);
            expect(result.type).toBe('preview');
        });
    });
});
