/**
 * Unit tests for content change detection system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import ContentChangeDetector from '../../../src/core/snapshot/utils/ContentChangeDetector.js';
import SnapshotIntegrityValidator from '../../../src/core/snapshot/validation/SnapshotIntegrityValidator.js';
import PerformanceOptimizer from '../../../src/core/snapshot/utils/PerformanceOptimizer.js';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';

describe('ContentChangeDetector', () => {
    let detector;
    let config;
    let testDir;
    let testFile1;
    let testFile2;

    beforeEach(async () => {
        config = new SnapshotConfig();
        detector = new ContentChangeDetector(config);

        // Create temporary test directory
        testDir = path.join(os.tmpdir(), `snapshot-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });

        testFile1 = path.join(testDir, 'test1.txt');
        testFile2 = path.join(testDir, 'test2.txt');

        // Create test files
        await writeFile(testFile1, 'initial content');
        await writeFile(testFile2, 'another file');
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

    it('should detect new files as changed', async () => {
        const hasChanged = await detector.hasFileChanged(testFile1);
        expect(hasChanged).toBe(true);
    });

    it('should detect unchanged files correctly', async () => {
        // First check - should be changed (new)
        await detector.hasFileChanged(testFile1);

        // Second check - should be unchanged
        const hasChanged = await detector.hasFileChanged(testFile1);
        expect(hasChanged).toBe(false);
    });

    it('should detect file content changes', async () => {
        // Initial check
        await detector.hasFileChanged(testFile1);

        // Modify file
        await writeFile(testFile1, 'modified content');

        // Should detect change
        const hasChanged = await detector.hasFileChanged(testFile1);
        expect(hasChanged).toBe(true);
    });

    it('should handle non-existent files', async () => {
        const nonExistentFile = path.join(testDir, 'nonexistent.txt');
        const hasChanged = await detector.hasFileChanged(nonExistentFile);
        expect(hasChanged).toBe(false);
    });

    it('should detect file deletion', async () => {
        // Initial check
        await detector.hasFileChanged(testFile1);

        // Delete file
        await unlink(testFile1);

        // Should detect change (file was deleted)
        const hasChanged = await detector.hasFileChanged(testFile1);
        expect(hasChanged).toBe(true);
    });

    it('should backup changed files', async () => {
        const result = await detector.backupFileIfChanged(testFile1);

        expect(result.backed_up).toBe(true);
        expect(result.content).toBe('initial content');
        expect(result.hash).toBeDefined();
        expect(result.size).toBe('initial content'.length);
    });

    it('should not backup unchanged files', async () => {
        // First backup
        await detector.backupFileIfChanged(testFile1);

        // Second backup attempt
        const result = await detector.backupFileIfChanged(testFile1);
        expect(result.backed_up).toBe(false);
    });

    it('should handle batch change detection', async () => {
        const files = [testFile1, testFile2];
        const results = await detector.batchCheckChanges(files);

        expect(results.size).toBe(2);
        expect(results.get(testFile1)).toBe(true); // New file
        expect(results.get(testFile2)).toBe(true); // New file
    });

    it('should provide performance metrics', () => {
        const metrics = detector.getPerformanceMetrics();

        expect(metrics).toHaveProperty('hashCalculations');
        expect(metrics).toHaveProperty('cacheHits');
        expect(metrics).toHaveProperty('cacheMisses');
        expect(metrics).toHaveProperty('cacheHitRate');
        expect(metrics).toHaveProperty('cachedFiles');
    });

    it('should cache file hashes correctly', async () => {
        // First check
        await detector.hasFileChanged(testFile1);

        const cachedHash = detector.getCachedHash(testFile1);
        expect(cachedHash).toBeDefined();
        expect(typeof cachedHash).toBe('string');
    });

    it('should clear cache correctly', async () => {
        await detector.hasFileChanged(testFile1);

        detector.clearCache(testFile1);
        const cachedHash = detector.getCachedHash(testFile1);
        expect(cachedHash).toBeNull();
    });

    it('should calculate consistent hashes', () => {
        const content = 'test content';
        const hash1 = detector.calculateHash(content);
        const hash2 = detector.calculateHash(content);

        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{32}$/); // MD5 format
    });
});

describe('SnapshotIntegrityValidator', () => {
    let validator;
    let config;

    beforeEach(() => {
        config = new SnapshotConfig();
        validator = new SnapshotIntegrityValidator(config);
    });

    it('should validate snapshot structure', () => {
        const validSnapshot = {
            id: 'snap_1642678800000_a1b2c3d4',
            instruction: 'Test instruction',
            timestamp: new Date().toISOString(),
            mode: 'file',
            files: new Map(),
        };

        const result = validator.validateSnapshotStructure(validSnapshot);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
        const invalidSnapshot = {
            instruction: 'Test instruction',
            // Missing id, timestamp, mode
        };

        const result = validator.validateSnapshotStructure(invalidSnapshot);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate content hashes', async () => {
        const snapshot = {
            id: 'snap_1642678800000_a1b2c3d4',
            mode: 'file',
            files: new Map([['test.txt', 'test content']]),
            fileChecksums: new Map([['test.txt', validator.calculateHash('test content')]]),
        };

        const result = await validator.validateContentHashes(snapshot);
        expect(result.valid).toBe(true);
        expect(result.inconsistencies).toHaveLength(0);
    });

    it('should detect hash inconsistencies', async () => {
        const snapshot = {
            id: 'snap_1642678800000_a1b2c3d4',
            mode: 'file',
            files: new Map([['test.txt', 'test content']]),
            fileChecksums: new Map([['test.txt', 'wrong_hash']]),
        };

        const result = await validator.validateContentHashes(snapshot);
        expect(result.valid).toBe(false);
        expect(result.inconsistencies.length).toBeGreaterThan(0);
    });

    it('should perform quick validation', () => {
        const validSnapshot = {
            id: 'snap_1642678800000_a1b2c3d4',
            instruction: 'Test instruction',
            timestamp: new Date().toISOString(),
            mode: 'file',
        };

        const isValid = validator.quickValidate(validSnapshot);
        expect(isValid).toBe(true);
    });

    it('should validate complete snapshot', async () => {
        const snapshot = {
            id: 'snap_1642678800000_a1b2c3d4',
            instruction: 'Test instruction',
            timestamp: new Date().toISOString(),
            mode: 'file',
            files: new Map([['test.txt', 'test content']]),
            fileChecksums: new Map([['test.txt', validator.calculateHash('test content')]]),
        };

        const result = await validator.validateSnapshot(snapshot);
        expect(result.valid).toBe(true);
        expect(result.summary).toContain('passed');
    });
});

describe('PerformanceOptimizer', () => {
    let optimizer;
    let config;
    let testDir;
    let testFile;

    beforeEach(async () => {
        config = new SnapshotConfig();
        optimizer = new PerformanceOptimizer(config);

        testDir = path.join(os.tmpdir(), `perf-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        testFile = path.join(testDir, 'test.txt');
        await writeFile(testFile, 'test content for performance testing');
    });

    afterEach(async () => {
        try {
            if (existsSync(testFile)) {
                await unlink(testFile);
            }
            if (existsSync(testDir)) {
                await rmdir(testDir);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    it('should calculate file hash', async () => {
        const hash = await optimizer.calculateLargeFileHash(testFile);
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
        expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should create LRU cache', () => {
        const cache = optimizer.createLRUCache(3);

        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        expect(cache.size()).toBe(3);
        expect(cache.get('key1')).toBe('value1');

        // Add fourth item, should evict least recently used
        cache.set('key4', 'value4');
        expect(cache.size()).toBe(3);
        expect(cache.has('key2')).toBe(false); // Should be evicted
    });

    it('should provide memory usage information', () => {
        const usage = optimizer.getMemoryUsage();

        expect(usage).toHaveProperty('rss');
        expect(usage).toHaveProperty('heapTotal');
        expect(usage).toHaveProperty('heapUsed');
        expect(typeof usage.rss).toBe('number');
    });

    it('should debounce function calls', async () => {
        let callCount = 0;
        const debouncedFn = optimizer.debounce(() => {
            callCount++;
        }, 50);

        // Call multiple times quickly
        debouncedFn();
        debouncedFn();
        debouncedFn();

        // Should only be called once after delay
        await new Promise(resolve => {
            setTimeout(() => {
                expect(callCount).toBe(1);
                resolve();
            }, 100);
        });
    });

    it('should throttle function calls', async () => {
        let callCount = 0;
        const throttledFn = optimizer.throttle(() => {
            callCount++;
        }, 50);

        // Call multiple times quickly
        throttledFn();
        throttledFn();
        throttledFn();

        // Should only be called once immediately
        expect(callCount).toBe(1);

        await new Promise(resolve => {
            setTimeout(() => {
                throttledFn();
                expect(callCount).toBe(2);
                resolve();
            }, 100);
        });
    });

    it('should provide performance recommendations', () => {
        const recommendations = optimizer.getPerformanceRecommendations();
        expect(Array.isArray(recommendations)).toBe(true);
    });
});
