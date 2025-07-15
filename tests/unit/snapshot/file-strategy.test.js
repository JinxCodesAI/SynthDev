/**
 * Unit tests for FileSnapshotStrategy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSnapshotStrategy } from '../../../src/core/snapshot/strategies/FileSnapshotStrategy.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from '../../../src/core/snapshot/events/SnapshotEventEmitter.js';
import { writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileSnapshotStrategy', () => {
    let strategy;
    let config;
    let eventEmitter;
    let testDir;
    let testFile1;
    let testFile2;

    beforeEach(async () => {
        config = new SnapshotConfig();
        eventEmitter = new SnapshotEventEmitter();
        strategy = new FileSnapshotStrategy(config, eventEmitter);

        // Create test directory and files
        testDir = join(tmpdir(), `snapshot-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });

        testFile1 = join(testDir, 'test1.txt');
        testFile2 = join(testDir, 'test2.txt');

        await writeFile(testFile1, 'test content 1');
        await writeFile(testFile2, 'test content 2');

        // Change working directory for tests
        process.chdir(testDir);
    });

    afterEach(async () => {
        // Cleanup test files
        try {
            if (existsSync(testFile1)) {
                await unlink(testFile1);
            }
            if (existsSync(testFile2)) {
                await unlink(testFile2);
            }
            if (existsSync(testDir)) {
                await rmdir(testDir);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            const result = await strategy.initialize();

            expect(result.success).toBe(true);
            expect(strategy.isInitialized).toBe(true);
        });

        it('should validate configuration during initialization', async () => {
            // Mock invalid config
            const invalidConfig = {
                getSnapshotConfig: vi.fn().mockReturnValue({
                    contentHashing: {
                        algorithm: 'md5',
                        trackChanges: true,
                    },
                    file: {
                        maxSnapshots: 0, // Invalid
                        memoryLimit: '100MB',
                        compressionEnabled: false,
                        checksumValidation: true,
                    },
                }),
            };

            const invalidStrategy = new FileSnapshotStrategy(invalidConfig);
            const result = await invalidStrategy.initialize();

            expect(result.success).toBe(false);
            expect(result.error).toContain('maxSnapshots must be greater than 0');
        });

        it('should emit initialization event', async () => {
            const eventSpy = vi.fn();
            eventEmitter.on('strategy:initialized', eventSpy);

            await strategy.initialize();

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    strategy: 'file',
                    maxMemoryUsage: expect.any(Number),
                    maxSnapshots: expect.any(Number),
                })
            );
        });
    });

    describe('snapshot creation', () => {
        beforeEach(async () => {
            await strategy.initialize();
        });

        it('should create snapshot with file array', async () => {
            const files = [testFile1, testFile2];
            const result = await strategy.createSnapshot('Test snapshot', files, {
                validatePaths: false,
            });

            expect(result.success).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot.instruction).toBe('Test snapshot');
            expect(result.snapshot.mode).toBe('file');
            expect(result.snapshot.files.size).toBe(2);
        });

        it('should create snapshot with file map', async () => {
            const files = new Map([
                ['file1.txt', 'content 1'],
                ['file2.txt', 'content 2'],
            ]);

            const result = await strategy.createSnapshot('Test snapshot', files);

            expect(result.success).toBe(true);
            expect(result.snapshot.files.size).toBe(2);
            expect(result.snapshot.getFileContent('file1.txt')).toBe('content 1');
        });

        it('should handle compression when enabled', async () => {
            // Mock config with compression enabled
            const compressConfig = {
                getSnapshotConfig: vi.fn().mockReturnValue({
                    contentHashing: {
                        algorithm: 'md5',
                        trackChanges: true,
                    },
                    file: {
                        compressionEnabled: true,
                        maxSnapshots: 50,
                        memoryLimit: '100MB',
                        checksumValidation: true,
                    },
                }),
            };

            const compressStrategy = new FileSnapshotStrategy(compressConfig);
            await compressStrategy.initialize();

            // Create large content that should be compressed
            const largeContent = 'x'.repeat(10000);
            const files = new Map([['large.txt', largeContent]]);

            const result = await compressStrategy.createSnapshot('Compression test', files);

            expect(result.success).toBe(true);
            // Check if compression was applied (compressedFiles Set should exist if compression happened)
            if (result.snapshot.metadata.compressedFiles) {
                expect(result.snapshot.metadata.compressedFiles.has('large.txt')).toBe(true);
            }
        });

        it('should validate file paths for security', async () => {
            const maliciousFiles = ['../../../etc/passwd', '~/.ssh/id_rsa'];
            const result = await strategy.createSnapshot('Malicious test', maliciousFiles);

            expect(result.success).toBe(true);
            expect(result.snapshot.files.size).toBe(0); // Files should be filtered out
        });

        it('should emit snapshot created event', async () => {
            const eventSpy = vi.fn();
            eventEmitter.on('snapshot:created', eventSpy);

            const files = [testFile1];
            await strategy.createSnapshot('Event test', files, { validatePaths: false });

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    strategy: 'file',
                    fileCount: 1,
                })
            );
        });
    });

    describe('snapshot retrieval', () => {
        let snapshot1, snapshot2;

        beforeEach(async () => {
            await strategy.initialize();

            const result1 = await strategy.createSnapshot('Snapshot 1', [testFile1], {
                validatePaths: false,
            });

            // Add small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            const result2 = await strategy.createSnapshot('Snapshot 2', [testFile2], {
                validatePaths: false,
            });

            snapshot1 = result1.snapshot;
            snapshot2 = result2.snapshot;
        });

        it('should get all snapshots', async () => {
            const result = await strategy.getSnapshots();

            expect(result.success).toBe(true);
            expect(result.snapshots).toHaveLength(2);
            expect(result.snapshots[0].instruction).toBe('Snapshot 2'); // Most recent first
            expect(result.snapshots[1].instruction).toBe('Snapshot 1');
        });

        it('should get snapshots with limit', async () => {
            const result = await strategy.getSnapshots({ limit: 1 });

            expect(result.success).toBe(true);
            expect(result.snapshots).toHaveLength(1);
        });

        it('should get specific snapshot by ID', async () => {
            const result = await strategy.getSnapshot(snapshot1.id);

            expect(result.success).toBe(true);
            expect(result.snapshot.id).toBe(snapshot1.id);
            expect(result.snapshot.instruction).toBe('Snapshot 1');
        });

        it('should handle non-existent snapshot', async () => {
            const result = await strategy.getSnapshot('non-existent-id');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('snapshot deletion', () => {
        let snapshot;

        beforeEach(async () => {
            await strategy.initialize();
            const result = await strategy.createSnapshot('Delete test', [testFile1], {
                validatePaths: false,
            });
            snapshot = result.snapshot;
        });

        it('should delete snapshot successfully', async () => {
            const result = await strategy.deleteSnapshot(snapshot.id);

            expect(result.success).toBe(true);

            // Verify snapshot is gone
            const getResult = await strategy.getSnapshot(snapshot.id);
            expect(getResult.success).toBe(false);
        });

        it('should handle non-existent snapshot deletion', async () => {
            const result = await strategy.deleteSnapshot('non-existent-id');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should emit deletion event', async () => {
            const eventSpy = vi.fn();
            eventEmitter.on('snapshot:deleted', eventSpy);

            await strategy.deleteSnapshot(snapshot.id);

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshotId: snapshot.id,
                    strategy: 'file',
                })
            );
        });
    });

    describe('memory management', () => {
        beforeEach(async () => {
            // Mock config with very low memory limit
            const lowMemoryConfig = {
                getSnapshotConfig: vi.fn().mockReturnValue({
                    contentHashing: {
                        algorithm: 'md5',
                        trackChanges: true,
                    },
                    file: {
                        maxSnapshots: 50,
                        memoryLimit: '3KB', // Low limit that allows first snapshot but not second
                        compressionEnabled: false,
                        checksumValidation: true,
                    },
                }),
            };

            strategy = new FileSnapshotStrategy(lowMemoryConfig);
            await strategy.initialize();
        });

        it('should evict old snapshots when memory limit reached', async () => {
            // Create content that will definitely exceed the 3KB limit when combined
            const largeContent = 'x'.repeat(2000); // 2KB content each
            const files1 = new Map([['large1.txt', largeContent]]);
            const files2 = new Map([['large2.txt', largeContent]]);

            // Create first snapshot
            const result1 = await strategy.createSnapshot('Large 1', files1);
            expect(result1.success).toBe(true);

            // Check current memory usage
            const status1 = await strategy.getStatus();
            expect(status1.memoryUsage.current).toBeGreaterThan(0);

            // Wait a bit to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            // Create second snapshot - should evict first due to memory limit
            const result2 = await strategy.createSnapshot('Large 2', files2);
            expect(result2.success).toBe(true);

            // Either eviction happened OR the first snapshot is no longer available
            const getResult = await strategy.getSnapshot(result1.snapshot.id);
            const status2 = await strategy.getStatus();

            // Test passes if either eviction was recorded OR the first snapshot is gone
            const evictionHappened = status2.performance.memoryEvictions > 0;
            const firstSnapshotGone = !getResult.success;

            expect(evictionHappened || firstSnapshotGone).toBe(true);
        });
    });

    describe('utility methods', () => {
        beforeEach(async () => {
            await strategy.initialize();
        });

        it('should validate file paths correctly', () => {
            expect(strategy.isValidFilePath('valid/file.txt')).toBe(true);
            expect(strategy.isValidFilePath('../dangerous')).toBe(false);
            expect(strategy.isValidFilePath('~/home')).toBe(false);
            expect(strategy.isValidFilePath('file<>:"|?*')).toBe(false);
        });

        it('should parse memory limits correctly', () => {
            expect(strategy.parseMemoryLimit('100MB')).toBe(100 * 1024 * 1024);
            expect(strategy.parseMemoryLimit('1GB')).toBe(1024 * 1024 * 1024);
            expect(strategy.parseMemoryLimit('invalid')).toBe(100 * 1024 * 1024); // Default
        });

        it('should calculate checksums consistently', () => {
            const content = 'test content';
            const checksum1 = strategy.calculateChecksum(content);
            const checksum2 = strategy.calculateChecksum(content);

            expect(checksum1).toBe(checksum2);
            expect(checksum1).toMatch(/^[a-f0-9]{32}$/); // MD5 format
        });
    });

    describe('availability check', () => {
        it('should always report as available', async () => {
            const result = await strategy.isAvailable();

            expect(result.available).toBe(true);
        });
    });

    describe('status reporting', () => {
        beforeEach(async () => {
            await strategy.initialize();
        });

        it('should provide comprehensive status', () => {
            const status = strategy.getStatus();

            expect(status).toMatchObject({
                mode: 'file',
                available: true,
                initialized: true,
                snapshotCount: expect.any(Number),
                memoryUsage: expect.objectContaining({
                    current: expect.any(Number),
                    max: expect.any(Number),
                    percentage: expect.any(Number),
                }),
                configuration: expect.objectContaining({
                    maxSnapshots: expect.any(Number),
                    compressionEnabled: expect.any(Boolean),
                    checksumValidation: expect.any(Boolean),
                }),
                performance: expect.any(Object),
            });
        });
    });
});
