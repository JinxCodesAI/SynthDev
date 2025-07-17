/**
 * Unit tests for snapshot data models and storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Snapshot from '../../../src/core/snapshot/models/Snapshot.js';
import SnapshotMetadata from '../../../src/core/snapshot/models/SnapshotMetadata.js';
import MemorySnapshotStore from '../../../src/core/snapshot/storage/MemorySnapshotStore.js';
import SnapshotSerializer from '../../../src/core/snapshot/utils/SnapshotSerializer.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('Snapshot Model', () => {
    let snapshot;

    beforeEach(() => {
        snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });
    });

    it('should create snapshot with required fields', () => {
        expect(snapshot.id).toBeDefined();
        expect(snapshot.instruction).toBe('Test instruction');
        expect(snapshot.mode).toBe('file');
        expect(snapshot.timestamp).toBeInstanceOf(Date);
    });

    it('should validate required fields', () => {
        expect(() => new Snapshot({ instruction: '', mode: 'file' })).toThrow();
        expect(() => new Snapshot({ instruction: 'test', mode: 'invalid' })).toThrow();
    });

    it('should add and retrieve files', () => {
        snapshot.addFile('test.txt', 'test content', 'checksum123');

        expect(snapshot.hasFile('test.txt')).toBe(true);
        expect(snapshot.getFileContent('test.txt')).toBe('test content');
        expect(snapshot.getFilePaths()).toContain('test.txt');
        expect(snapshot.getModifiedFilePaths()).toContain('test.txt');
    });

    it('should remove files', () => {
        snapshot.addFile('test.txt', 'test content');
        snapshot.removeFile('test.txt');

        expect(snapshot.hasFile('test.txt')).toBe(false);
        expect(snapshot.getFileContent('test.txt')).toBeNull();
    });

    it('should manage tags', () => {
        snapshot.addTag('important');
        snapshot.addTag('feature');

        expect(snapshot.hasTag('important')).toBe(true);
        expect(snapshot.tags).toContain('important');
        expect(snapshot.tags).toContain('feature');

        snapshot.removeTag('important');
        expect(snapshot.hasTag('important')).toBe(false);
    });

    it('should manage metadata', () => {
        snapshot.setMetadata('author', 'test-user');
        snapshot.setMetadata('priority', 'high');

        expect(snapshot.getMetadata('author')).toBe('test-user');
        expect(snapshot.getMetadata('priority')).toBe('high');
    });

    it('should calculate size', () => {
        snapshot.addFile('test.txt', 'test content');
        const size = snapshot.calculateSize();

        expect(size).toBeGreaterThan(0);
        expect(typeof size).toBe('number');
    });

    it('should serialize and deserialize', () => {
        snapshot.addFile('test.txt', 'test content');
        snapshot.addTag('test');

        const obj = snapshot.toObject();
        const restored = Snapshot.fromObject(obj);

        expect(restored.id).toBe(snapshot.id);
        expect(restored.instruction).toBe(snapshot.instruction);
        expect(restored.hasFile('test.txt')).toBe(true);
        expect(restored.hasTag('test')).toBe(true);
    });

    it('should clone snapshot', () => {
        snapshot.addFile('test.txt', 'test content');
        const cloned = snapshot.clone();

        expect(cloned.id).toBe(snapshot.id);
        expect(cloned.hasFile('test.txt')).toBe(true);
        expect(cloned).not.toBe(snapshot); // Different instances
    });

    it('should compare snapshots', () => {
        const snapshot2 = new Snapshot({
            instruction: 'Different instruction',
            mode: 'file',
        });

        snapshot.addFile('file1.txt', 'content1');
        snapshot2.addFile('file2.txt', 'content2');

        const diff = snapshot.compare(snapshot2);

        expect(diff.instruction).toBe(true);
        expect(diff.files.added).toContain('file2.txt');
        expect(diff.files.removed).toContain('file1.txt');
    });

    it('should generate summary', () => {
        snapshot.addFile('test.txt', 'content');
        const summary = snapshot.getSummary();

        expect(summary.id).toBe(snapshot.id);
        expect(summary.shortId).toBeDefined();
        expect(summary.fileCount).toBe(1);
        expect(summary.mode).toBe('file');
    });
});

describe('SnapshotMetadata', () => {
    let metadata;
    let config;

    beforeEach(() => {
        // Mock process.cwd() before creating config
        process.cwd = vi.fn(() => '/tmp');
        config = new SnapshotConfig();
        metadata = new SnapshotMetadata(config);
    });

    afterEach(() => {
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/tmp');
    });

    it('should add and retrieve snapshot metadata', () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });

        metadata.addSnapshot(snapshot);
        const retrievedMetadata = metadata.getMetadata(snapshot.id);

        expect(retrievedMetadata).toBeDefined();
        expect(retrievedMetadata.instruction).toBe('Test instruction');
        expect(retrievedMetadata.mode).toBe('file');
    });

    it('should remove snapshot metadata', () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });

        metadata.addSnapshot(snapshot);
        const removed = metadata.removeSnapshot(snapshot.id);

        expect(removed).toBe(true);
        expect(metadata.getMetadata(snapshot.id)).toBeNull();
    });

    it('should search by criteria', () => {
        const snapshot1 = new Snapshot({
            instruction: 'Add authentication system',
            mode: 'git',
        });
        const snapshot2 = new Snapshot({
            instruction: 'Fix responsive layout',
            mode: 'file',
        });

        metadata.addSnapshot(snapshot1);
        metadata.addSnapshot(snapshot2);

        const gitResults = metadata.search({ mode: 'git' });
        expect(gitResults).toContain(snapshot1.id);
        expect(gitResults).not.toContain(snapshot2.id);

        const instructionResults = metadata.search({ instruction: 'authentication' });
        expect(instructionResults).toContain(snapshot1.id);
    });

    it('should sort by timestamp', () => {
        const snapshot1 = new Snapshot({
            instruction: 'First',
            mode: 'file',
            timestamp: new Date('2024-01-01'),
        });
        const snapshot2 = new Snapshot({
            instruction: 'Second',
            mode: 'file',
            timestamp: new Date('2024-01-02'),
        });

        metadata.addSnapshot(snapshot1);
        metadata.addSnapshot(snapshot2);

        const sorted = metadata.getSortedByTimestamp(false); // Newest first
        expect(sorted[0]).toBe(snapshot2.id);
        expect(sorted[1]).toBe(snapshot1.id);
    });

    it('should provide statistics', () => {
        const snapshot = new Snapshot({
            instruction: 'Test',
            mode: 'file',
        });

        metadata.addSnapshot(snapshot);
        const stats = metadata.getStatistics();

        expect(stats.totalSnapshots).toBe(1);
        expect(stats.modeDistribution.file).toBe(1);
        expect(stats.oldestSnapshot).toBeDefined();
        expect(stats.newestSnapshot).toBeDefined();
    });

    it('should clear all metadata', () => {
        const snapshot = new Snapshot({
            instruction: 'Test',
            mode: 'file',
        });

        metadata.addSnapshot(snapshot);
        metadata.clear();

        expect(metadata.getMetadata(snapshot.id)).toBeNull();
        expect(metadata.getStatistics().totalSnapshots).toBe(0);
    });
});

describe('MemorySnapshotStore', () => {
    let store;
    let config;

    beforeEach(async () => {
        // Mock process.cwd() before creating config
        process.cwd = vi.fn(() => '/tmp');
        config = new SnapshotConfig();
        store = new MemorySnapshotStore(config);
        await store.initialize();
    });

    afterEach(() => {
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/tmp');
    });

    it('should store and retrieve snapshots', async () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });

        await store.storeSnapshot(snapshot);
        const retrieved = await store.getSnapshot(snapshot.id);

        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe(snapshot.id);
        expect(retrieved.instruction).toBe(snapshot.instruction);
    });

    it('should get all snapshots', async () => {
        const snapshot1 = new Snapshot({ instruction: 'First', mode: 'file' });
        const snapshot2 = new Snapshot({ instruction: 'Second', mode: 'file' });

        await store.storeSnapshot(snapshot1);
        await store.storeSnapshot(snapshot2);

        const all = await store.getAllSnapshots();
        expect(all).toHaveLength(2);
        expect(all.map(s => s.id)).toContain(snapshot1.id);
        expect(all.map(s => s.id)).toContain(snapshot2.id);
    });

    it('should delete snapshots', async () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });

        await store.storeSnapshot(snapshot);
        const deleted = await store.deleteSnapshot(snapshot.id);

        expect(deleted).toBe(true);

        const retrieved = await store.getSnapshot(snapshot.id);
        expect(retrieved).toBeNull();
    });

    it('should clear all snapshots', async () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });

        await store.storeSnapshot(snapshot);
        await store.clearAll();

        const all = await store.getAllSnapshots();
        expect(all).toHaveLength(0);
    });

    it('should provide storage statistics', async () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });

        await store.storeSnapshot(snapshot);
        const stats = await store.getStats();

        expect(stats.type).toBe('memory');
        expect(stats.totalSnapshots).toBe(1);
        expect(stats.memoryUsage.current).toBeGreaterThan(0);
    });

    it('should search snapshots', async () => {
        const snapshot1 = new Snapshot({
            instruction: 'Add authentication',
            mode: 'git',
        });
        const snapshot2 = new Snapshot({
            instruction: 'Fix layout',
            mode: 'file',
        });

        await store.storeSnapshot(snapshot1);
        await store.storeSnapshot(snapshot2);

        const results = await store.searchSnapshots({ mode: 'git' });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe(snapshot1.id);
    });

    it('should handle memory limits', async () => {
        // Create a large snapshot that would exceed memory limits
        const largeSnapshot = new Snapshot({
            instruction: 'Large snapshot',
            mode: 'file',
        });

        // Add large file content
        const largeContent = 'x'.repeat(1024 * 1024); // 1MB
        largeSnapshot.addFile('large.txt', largeContent);

        // This should work (assuming memory limit is reasonable)
        await store.storeSnapshot(largeSnapshot);

        const retrieved = await store.getSnapshot(largeSnapshot.id);
        expect(retrieved).toBeDefined();
    });
});

describe('SnapshotSerializer', () => {
    let serializer;
    let config;

    beforeEach(() => {
        // Mock process.cwd() before creating config
        process.cwd = vi.fn(() => '/tmp');
        config = new SnapshotConfig();
        serializer = new SnapshotSerializer(config);
    });

    afterEach(() => {
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/tmp');
    });

    it('should serialize and deserialize JSON', async () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });
        snapshot.addFile('test.txt', 'test content');

        const serialized = await serializer.serializeToJSON(snapshot, false);
        const deserialized = await serializer.deserializeFromJSON(serialized, false);

        expect(deserialized.id).toBe(snapshot.id);
        expect(deserialized.instruction).toBe(snapshot.instruction);
        expect(deserialized.hasFile('test.txt')).toBe(true);
        expect(deserialized.getFileContent('test.txt')).toBe('test content');
    });

    it('should handle compression', async () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });
        snapshot.addFile('test.txt', 'test content'.repeat(100)); // Larger content

        const compressed = await serializer.serializeToJSON(snapshot, true);
        const uncompressed = await serializer.serializeToJSON(snapshot, false);

        expect(Buffer.isBuffer(compressed)).toBe(true);
        expect(typeof uncompressed).toBe('string');

        const deserialized = await serializer.deserializeFromJSON(compressed, true);
        expect(deserialized.id).toBe(snapshot.id);
    });

    it('should create and extract archives', async () => {
        const snapshot1 = new Snapshot({ instruction: 'First', mode: 'file' });
        const snapshot2 = new Snapshot({ instruction: 'Second', mode: 'file' });

        const archive = await serializer.serializeToArchive([snapshot1, snapshot2]);
        const extracted = await serializer.deserializeFromArchive(archive);

        expect(extracted).toHaveLength(2);
        expect(extracted.map(s => s.instruction)).toContain('First');
        expect(extracted.map(s => s.instruction)).toContain('Second');
    });

    it('should export to readable format', () => {
        const snapshot = new Snapshot({
            instruction: 'Test instruction',
            mode: 'file',
        });
        snapshot.addFile('test.txt', 'content');
        snapshot.addTag('important');

        const readable = serializer.exportToReadableFormat(snapshot);

        expect(readable).toContain('SNAPSHOT:');
        expect(readable).toContain('Test instruction');
        expect(readable).toContain('test.txt');
        expect(readable).toContain('important');
    });

    it('should create diffs', () => {
        const snapshot1 = new Snapshot({ instruction: 'First', mode: 'file' });
        const snapshot2 = new Snapshot({ instruction: 'Second', mode: 'file' });

        snapshot1.addFile('file1.txt', 'content1');
        snapshot2.addFile('file2.txt', 'content2');

        const diff = serializer.createDiff(snapshot1, snapshot2);

        expect(diff).toContain('SNAPSHOT DIFF:');
        expect(diff).toContain('Instruction changed:');
        expect(diff).toContain('Added files:');
        expect(diff).toContain('Removed files:');
    });
});
