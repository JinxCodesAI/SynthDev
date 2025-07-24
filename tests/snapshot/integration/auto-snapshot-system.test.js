/**
 * Integration tests for Auto Snapshot System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoSnapshotManager } from '../../../src/core/snapshot/AutoSnapshotManager.js';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// Mock configuration manager
const mockConfig = {
    // Phase 1 configuration
    fileFiltering: {
        defaultExclusions: ['node_modules', '.git'],
        customExclusions: [],
        maxFileSize: 10 * 1024 * 1024,
        binaryFileHandling: 'exclude',
    },
    storage: {
        type: 'memory',
        maxSnapshots: 50,
        maxMemoryMB: 100,
    },
    backup: {
        createBackups: true,
        encoding: 'utf8',
    },
    behavior: {
        autoCleanup: true,
    },
    messages: {
        success: {
            snapshotCreated: 'Snapshot created successfully',
        },
        errors: {
            invalidDescription: 'Invalid description',
        },
    },
};

const mockPhase2Config = {
    autoSnapshot: {
        enabled: true,
        createOnToolExecution: true,
        verifyFileChanges: true,
    },
    toolDeclarations: {
        defaultModifiesFiles: false,
        warnOnMissingDeclaration: false,
        cacheDeclarations: true,
    },
    triggerRules: {
        maxSnapshotsPerSession: 20,
        cooldownPeriod: 1000,
        requireActualChanges: false,
    },
    descriptionGeneration: {
        maxLength: 100,
        includeToolName: true,
        includeTargetFiles: true,
    },
    fileChangeDetection: {
        enabled: true,
        useChecksums: false, // Disabled for performance in tests
        trackModificationTime: true,
        excludePatterns: ['node_modules', '.git'],
    },
    initialSnapshot: {
        enabled: true,
        createOnStartup: true,
        skipIfSnapshotsExist: false,
    },
    integration: {
        enabled: true,
        trackFileChanges: true,
        cleanupEmptySnapshots: true,
    },
};

vi.mock('../../../src/config/managers/snapshotConfigManager.js', () => ({
    getSnapshotConfigManager: () => ({
        getConfig: () => mockConfig,
        getPhase2Config: () => mockPhase2Config,
        getFileFilteringConfig: () => mockConfig.fileFiltering,
        getStorageConfig: () => mockConfig.storage,
        getBackupConfig: () => mockConfig.backup,
        getBehaviorConfig: () => mockConfig.behavior,
        getMessagesConfig: () => mockConfig.messages,
    }),
}));

describe('AutoSnapshotManager Integration', () => {
    let autoSnapshotManager;
    let testDir;
    let mockToolManager;

    beforeEach(() => {
        // Create temporary test directory
        testDir = mkdtempSync(join(tmpdir(), 'auto-snapshot-test-'));

        // Change to test directory
        process.chdir(testDir);

        // Create mock tool manager
        mockToolManager = {
            getToolDefinition: vi.fn(),
            executeToolCall: vi.fn(),
        };

        // Create AutoSnapshotManager instance
        autoSnapshotManager = new AutoSnapshotManager(mockToolManager);
    });

    afterEach(() => {
        // Cleanup test directory
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await autoSnapshotManager.initialize();

            const status = autoSnapshotManager.getStatus();
            expect(status.enabled).toBe(true);
            expect(status.initialized).toBe(true);
            expect(status.components.toolMonitor).toBe(true);
            expect(status.components.fileChangeDetector).toBe(true);
            expect(status.components.snapshotTrigger).toBe(true);
        });

        it('should create initial snapshot on initialization', async () => {
            // Create some files to snapshot
            writeFileSync(join(testDir, 'test.txt'), 'test content');
            writeFileSync(join(testDir, 'package.json'), '{"name": "test"}');

            await autoSnapshotManager.initialize();

            const status = autoSnapshotManager.getStatus();
            expect(status.initialized).toBe(true);

            // Check if initial snapshot manager indicates it created a snapshot
            const initialManager = autoSnapshotManager.initialSnapshotManager;
            expect(initialManager.wasInitialSnapshotCreated()).toBe(true);
        });
    });

    describe('tool integration', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should detect file-modifying tools correctly', () => {
            const toolMonitor = autoSnapshotManager.toolMonitor;

            expect(toolMonitor.shouldCreateSnapshot('write_file')).toBe(true);
            expect(toolMonitor.shouldCreateSnapshot('edit_file')).toBe(true);
            expect(toolMonitor.shouldCreateSnapshot('read_file')).toBe(false);
            expect(toolMonitor.shouldCreateSnapshot('list_directory')).toBe(false);
        });

        it('should generate appropriate metadata for tools', () => {
            const toolMonitor = autoSnapshotManager.toolMonitor;
            const metadata = toolMonitor.getToolMetadata('write_file', {
                file_path: 'test.js',
                content: 'console.log("test");',
            });

            expect(metadata.toolName).toBe('write_file');
            expect(metadata.classification).toBe(true);
            expect(metadata.fileTargets).toContain('test.js');
            expect(metadata.arguments).toBeDefined();
        });
    });

    describe('file change detection', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should capture file states correctly', async () => {
            // Create test files
            writeFileSync(join(testDir, 'file1.txt'), 'content 1');
            writeFileSync(join(testDir, 'file2.txt'), 'content 2');

            const fileChangeDetector = autoSnapshotManager.fileChangeDetector;
            const state = await fileChangeDetector.captureFileStates(testDir);

            expect(state.files).toBeDefined();
            expect(Object.keys(state.files).length).toBeGreaterThan(0);
            expect(state.stats.totalFiles).toBeGreaterThan(0);
        });

        it('should detect file changes correctly', async () => {
            // Create initial file
            writeFileSync(join(testDir, 'test.txt'), 'initial content');

            const fileChangeDetector = autoSnapshotManager.fileChangeDetector;

            // Capture initial state
            const beforeState = await fileChangeDetector.captureFileStates(testDir);

            // Modify file
            writeFileSync(join(testDir, 'test.txt'), 'modified content');

            // Capture after state
            const afterState = await fileChangeDetector.captureFileStates(testDir);

            // Compare states
            const changes = fileChangeDetector.compareFileStates(beforeState, afterState);

            expect(changes.hasChanges).toBe(true);
            expect(changes.changes.modified.length).toBeGreaterThan(0);
        });
    });

    describe('snapshot triggering', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should trigger snapshots for file-modifying tools', async () => {
            const snapshotTrigger = autoSnapshotManager.snapshotTrigger;

            // Mock successful snapshot creation
            const mockCreateSnapshot = vi.fn().mockResolvedValue({
                id: 'test-snapshot-id',
                description: 'Test snapshot',
            });
            snapshotTrigger.snapshotManager.createSnapshot = mockCreateSnapshot;

            // Process trigger for file-modifying tool
            const result = await snapshotTrigger.processTrigger('write_file', {
                file_path: 'test.js',
                content: 'test',
            });

            expect(result).toBeDefined();
            expect(mockCreateSnapshot).toHaveBeenCalled();
        });

        it('should not trigger snapshots for read-only tools', async () => {
            const snapshotTrigger = autoSnapshotManager.snapshotTrigger;

            // Mock snapshot creation
            const mockCreateSnapshot = vi.fn();
            snapshotTrigger.snapshotManager.createSnapshot = mockCreateSnapshot;

            // Process trigger for read-only tool
            const result = await snapshotTrigger.processTrigger('read_file', {
                file_path: 'test.js',
            });

            expect(result).toBeNull();
            expect(mockCreateSnapshot).not.toHaveBeenCalled();
        });
    });

    describe('system statistics', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should provide comprehensive system statistics', () => {
            const stats = autoSnapshotManager.getStats();

            expect(stats.enabled).toBe(true);
            expect(stats.components).toBeDefined();
            expect(stats.components.toolMonitor).toBeDefined();
            expect(stats.components.fileChangeDetector).toBeDefined();
            expect(stats.components.snapshotTrigger).toBeDefined();
            expect(stats.config).toBeDefined();
        });
    });

    describe('configuration updates', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should update configuration across components', () => {
            const newConfig = {
                autoSnapshot: { enabled: false },
                triggerRules: { maxSnapshotsPerSession: 5 },
            };

            autoSnapshotManager.updateConfiguration(newConfig);

            expect(autoSnapshotManager.enabled).toBe(false);
            expect(autoSnapshotManager.config.autoSnapshot.enabled).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should handle initialization errors gracefully', async () => {
            // Create a manager with invalid configuration
            const invalidManager = new AutoSnapshotManager(null);

            // Force an error by corrupting the config
            invalidManager.config = null;

            // Should not throw but handle gracefully
            await expect(invalidManager.initialize()).rejects.toThrow();
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should cleanup resources properly', () => {
            // Verify components are initialized
            expect(autoSnapshotManager.toolManagerIntegration).toBeDefined();
            expect(autoSnapshotManager.snapshotTrigger).toBeDefined();

            // Cleanup
            autoSnapshotManager.cleanup();

            // Should not throw errors during cleanup
            expect(() => autoSnapshotManager.cleanup()).not.toThrow();
        });
    });
});
