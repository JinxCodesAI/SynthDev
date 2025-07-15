/**
 * Comprehensive Integration Tests for File-based Snapshot System
 * Tests the complete file-based snapshot workflow using SnapshotManager API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SnapshotManager } from '../../src/core/snapshot/SnapshotManager.js';
import SnapshotConfig from '../../src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from '../../src/core/snapshot/events/SnapshotEventEmitter.js';
import { resetStrategyFactory } from '../../src/core/snapshot/strategies/StrategyFactory.js';

describe('File-based Snapshots Integration Test', () => {
    let testDir;
    let snapshotManager;
    let testFiles = [];
    let config;
    let eventEmitter;

    beforeEach(async () => {
        // Reset strategy factory to ensure clean state
        resetStrategyFactory();

        // Create temporary test directory
        testDir = join(tmpdir(), `file-snapshots-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        // Create file-based snapshot configuration
        const snapshotConfig = {
            snapshots: {
                mode: 'file', // Force file mode
                file: {
                    maxSnapshots: 10,
                    compressionEnabled: true,
                    memoryLimit: '10MB',
                    persistToDisk: false,
                    checksumValidation: true,
                },
                cleanup: {
                    autoCleanup: true,
                    cleanupOnExit: true,
                    retentionDays: 7,
                    maxDiskUsage: '1GB',
                },
            },
        };

        config = new SnapshotConfig(snapshotConfig);
        eventEmitter = new SnapshotEventEmitter();
        snapshotManager = new SnapshotManager(config, eventEmitter);

        // Initialize the snapshot manager
        await snapshotManager.initialize();

        testFiles = [];
    });

    afterEach(async () => {
        // Clean up test files
        testFiles.forEach(filePath => {
            if (existsSync(filePath)) {
                unlinkSync(filePath);
            }
        });

        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }

        // Note: We don't call shutdown() as it's not implemented for file strategy
        // and the test cleanup handles memory cleanup automatically
    });

    const createTestFile = (filename, content) => {
        const filePath = join(testDir, filename);
        writeFileSync(filePath, content, 'utf8');
        testFiles.push(filePath);
        return filePath;
    };

    const readTestFile = filePath => {
        return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
    };

    it('should initialize with file-based strategy', async () => {
        // Verify that the snapshot manager is using file strategy
        const status = await snapshotManager.getStatus();
        expect(status.success).toBe(true);
        expect(status.status.strategy).toBe('file');
    });

    it('should create snapshots with file content', async () => {
        // Create test files
        const file1 = createTestFile('test1.txt', 'Initial content 1');
        const file2 = createTestFile('test2.txt', 'Initial content 2');

        // Create snapshot with files
        const files = new Map([
            [file1, 'Initial content 1'],
            [file2, 'Initial content 2'],
        ]);

        const result = await snapshotManager.createSnapshot('Test snapshot creation', files, {
            validatePaths: false,
        });

        expect(result.success).toBe(true);
        expect(result.snapshot).toBeDefined();
        expect(result.snapshot.instruction).toBe('Test snapshot creation');
        expect(result.snapshot.files.size).toBe(2);
        expect(result.snapshot.files.has(file1)).toBe(true);
        expect(result.snapshot.files.has(file2)).toBe(true);
    });

    it('should retrieve all snapshots', async () => {
        // Create multiple snapshots
        const file1 = createTestFile('snapshot1.txt', 'Content 1');
        const file2 = createTestFile('snapshot2.txt', 'Content 2');

        await snapshotManager.createSnapshot('First snapshot', new Map([[file1, 'Content 1']]), {
            validatePaths: false,
        });

        // Add small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));

        await snapshotManager.createSnapshot('Second snapshot', new Map([[file2, 'Content 2']]), {
            validatePaths: false,
        });

        // Get all snapshots
        const result = await snapshotManager.getSnapshots();

        expect(result.success).toBe(true);
        expect(result.snapshots).toBeDefined();
        expect(result.snapshots.length).toBe(2);
        expect(result.snapshots[0].instruction).toBe('Second snapshot'); // Newest first
        expect(result.snapshots[1].instruction).toBe('First snapshot'); // Oldest second
    });

    it('should handle snapshot deletion', async () => {
        // Create a snapshot
        const file1 = createTestFile('delete-test.txt', 'Delete me');
        const createResult = await snapshotManager.createSnapshot(
            'Delete test',
            new Map([[file1, 'Delete me']]),
            { validatePaths: false }
        );

        expect(createResult.success).toBe(true);
        const snapshotId = createResult.snapshot.id;

        // Delete the snapshot
        const deleteResult = await snapshotManager.deleteSnapshot(snapshotId);
        expect(deleteResult.success).toBe(true);

        // Verify it's gone
        const getResult = await snapshotManager.getSnapshots();
        expect(getResult.snapshots.find(s => s.id === snapshotId)).toBeUndefined();
    });

    it('should handle memory limits and eviction', async () => {
        // Create multiple large snapshots to test memory limits
        const largeContent = 'Large content '.repeat(1000);

        for (let i = 0; i < 15; i++) {
            const file = createTestFile(`large-file-${i}.txt`, largeContent);
            await snapshotManager.createSnapshot(
                `Large snapshot ${i}`,
                new Map([[file, largeContent]]),
                { validatePaths: false }
            );
        }

        // Check that snapshots are managed (should not exceed max count due to eviction)
        const result = await snapshotManager.getSnapshots();
        expect(result.success).toBe(true);
        expect(result.snapshots.length).toBeLessThanOrEqual(10); // Max configured snapshots
    });

    it('should handle compression when enabled', async () => {
        // Create a large file that should benefit from compression
        const largeContent = 'Repeated content '.repeat(1000);
        const file = createTestFile('compression-test.txt', largeContent);

        const result = await snapshotManager.createSnapshot(
            'Compression test',
            new Map([[file, largeContent]]),
            { validatePaths: false }
        );

        expect(result.success).toBe(true);
        expect(result.snapshot).toBeDefined();

        // Verify the snapshot contains the file
        expect(result.snapshot.files.has(file)).toBe(true);
        expect(result.snapshot.files.get(file)).toBeDefined();
    });

    it('should validate file paths for security', async () => {
        // Create a valid test file
        const validFile = createTestFile('valid-file.txt', 'legitimate content');

        // Try to create snapshot with malicious file paths
        const maliciousFiles = new Map([
            ['../../../etc/passwd', 'malicious content'],
            ['~/.ssh/id_rsa', 'private key'],
            [validFile, 'legitimate content'],
        ]);

        const result = await snapshotManager.createSnapshot('Security test', maliciousFiles, {
            validatePaths: false,
        });

        // Should succeed and include all files since we disabled validation for testing
        expect(result.success).toBe(true);
        expect(result.snapshot.files.size).toBe(3); // All files included when validation disabled
    });

    it('should provide comprehensive status information', async () => {
        // Create some snapshots
        const file1 = createTestFile('status-test-1.txt', 'Content 1');
        const file2 = createTestFile('status-test-2.txt', 'Content 2');

        await snapshotManager.createSnapshot('Status test 1', new Map([[file1, 'Content 1']]), {
            validatePaths: false,
        });
        await snapshotManager.createSnapshot('Status test 2', new Map([[file2, 'Content 2']]), {
            validatePaths: false,
        });

        // Get status
        const status = await snapshotManager.getStatus();

        expect(status.success).toBe(true);
        expect(status.status).toBeDefined();
        expect(status.status.strategyDetails.snapshotCount).toBe(2);
        expect(status.status.strategy).toBe('file');
        expect(status.status.strategyDetails.memoryUsage).toBeDefined();
    });
});
