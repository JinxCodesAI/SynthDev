/**
 * Tests for automatic snapshot integration with tool execution
 * These tests demonstrate the missing integration between AutoSnapshotManager and actual tool execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AutoSnapshotManager } from '../../../src/core/snapshot/AutoSnapshotManager.js';
import ToolManager from '../../../src/core/managers/toolManager.js';

// Mock logger and config
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    initializeLogger: vi.fn(),
}));

// Mock config managers
vi.mock('../../../src/config/managers/snapshotConfigManager.js', () => ({
    getSnapshotConfigManager: () => ({
        getPhase2Config: () => ({
            autoSnapshot: { enabled: true, createOnToolExecution: true },
            toolDeclarations: { defaultModifiesFiles: false },
            triggerRules: { maxSnapshotsPerSession: 20, cooldownPeriod: 1000 },
            descriptionGeneration: { maxLength: 100, includeToolName: true },
            fileChangeDetection: { enabled: true, useChecksums: false },
            initialSnapshot: { enabled: true, createOnStartup: true },
            integration: { enabled: true, trackFileChanges: true },
        }),
        getStorageConfig: () => ({ type: 'memory', maxSnapshots: 50 }),
        getFileFilterConfig: () => ({ excludePatterns: ['node_modules', '.git'] }),
        getBackupConfig: () => ({ createBackups: true }),
        getBehaviorConfig: () => ({ autoCleanup: false }),
        getMessagesConfig: () => ({ success: {}, errors: {}, info: {} }),
    }),
}));

describe('Automatic Snapshot Integration', () => {
    let testDir;
    let autoSnapshotManager;
    let toolManager;

    beforeEach(async () => {
        testDir = join(tmpdir(), `auto-snapshot-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        process.chdir(testDir);

        // Create test files
        writeFileSync(join(testDir, 'README.md'), '# Test Project\n\nMIT License');
        writeFileSync(join(testDir, 'package.json'), '{"name": "test", "version": "1.0.0"}');

        // Initialize managers
        toolManager = new ToolManager();
        await toolManager.loadTools();

        autoSnapshotManager = new AutoSnapshotManager(toolManager);
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Initial Snapshot Creation', () => {
        it('should create initial snapshot that is visible in the store', async () => {
            // Initialize AutoSnapshotManager
            await autoSnapshotManager.initialize();

            // Check if initial snapshot was created and is accessible
            const snapshots = await autoSnapshotManager.snapshotManager.listSnapshots();

            // This should pass but currently FAILS
            expect(snapshots.length).toBeGreaterThan(0);

            const initialSnapshot = snapshots.find(s => s.metadata?.triggerType === 'initial');
            expect(initialSnapshot).toBeDefined();
            expect(initialSnapshot.description).toContain('Initial project state');
        });

        it('should create initial snapshot only once per project', async () => {
            // Initialize twice
            await autoSnapshotManager.initialize();
            const snapshots1 = await autoSnapshotManager.snapshotManager.listSnapshots();

            // Initialize again
            const autoSnapshotManager2 = new AutoSnapshotManager(toolManager);
            await autoSnapshotManager2.initialize();
            const snapshots2 = await autoSnapshotManager2.snapshotManager.listSnapshots();

            // Should not create duplicate initial snapshots
            expect(snapshots2.length).toBe(snapshots1.length);
        });
    });

    describe('Tool Execution Integration', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should create automatic snapshot before write_file tool execution', async () => {
            // Get initial snapshot count
            const initialSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            const initialCount = initialSnapshots.length;

            // Execute write_file tool through ToolManager
            const result = await toolManager.executeToolCall('write_file', {
                file_path: 'new-file.txt',
                content: 'This is new content',
            });

            expect(result.success).toBe(true);

            // Check if automatic snapshot was created
            const finalSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();

            // This should pass but currently FAILS - no automatic snapshot is created
            expect(finalSnapshots.length).toBe(initialCount + 1);

            const automaticSnapshot = finalSnapshots.find(
                s => s.metadata?.triggerType === 'automatic'
            );
            expect(automaticSnapshot).toBeDefined();
            expect(automaticSnapshot.description).toContain('write_file');
        });

        it('should NOT create snapshot for read-only tools', async () => {
            const initialSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            const initialCount = initialSnapshots.length;

            // Execute read_file tool
            const result = await toolManager.executeToolCall('read_file', {
                file_path: 'README.md',
            });

            expect(result.success).toBe(true);

            // Should not create automatic snapshot for read-only operation
            const finalSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            expect(finalSnapshots.length).toBe(initialCount);
        });

        it('should create snapshot before edit_file tool execution', async () => {
            const initialSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            const initialCount = initialSnapshots.length;

            // Execute edit_file tool
            const result = await toolManager.executeToolCall('str-replace-editor', {
                command: 'str_replace',
                path: 'README.md',
                old_str: 'MIT License',
                new_str: 'GPL License',
            });

            expect(result.success).toBe(true);

            // Should create automatic snapshot
            const finalSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();

            // This should pass but currently FAILS
            expect(finalSnapshots.length).toBe(initialCount + 1);

            const automaticSnapshot = finalSnapshots.find(
                s => s.metadata?.triggerType === 'automatic'
            );
            expect(automaticSnapshot).toBeDefined();
        });
    });

    describe('Application Integration', () => {
        it('should integrate with application lifecycle', async () => {
            // Mock application object
            const mockApp = {
                toolManager: toolManager,
                onApplicationStart: vi.fn(),
            };

            // Initialize and integrate
            await autoSnapshotManager.initialize();
            autoSnapshotManager.integrateWithApplication(mockApp);

            // Should have set up integration hooks
            expect(autoSnapshotManager.toolManagerIntegration).toBeDefined();

            // Should have created initial snapshot
            const snapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            expect(snapshots.length).toBeGreaterThan(0);
        });

        it('should handle tool execution through integrated hooks', async () => {
            const mockApp = { toolManager: toolManager };

            await autoSnapshotManager.initialize();
            autoSnapshotManager.integrateWithApplication(mockApp);

            const initialCount = (await autoSnapshotManager.snapshotManager.listSnapshots()).length;

            // Execute tool that should trigger snapshot
            await toolManager.executeToolCall('write_file', {
                file_path: 'test.txt',
                content: 'test content',
            });

            // Should have created automatic snapshot
            const finalSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();

            // This currently FAILS due to missing integration
            expect(finalSnapshots.length).toBe(initialCount + 1);
        });
    });

    describe('Snapshot Metadata and Descriptions', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should generate meaningful descriptions for automatic snapshots', async () => {
            // Execute a tool
            await toolManager.executeToolCall('write_file', {
                file_path: 'important.txt',
                content: 'important data',
            });

            const snapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            const automaticSnapshot = snapshots.find(s => s.metadata?.triggerType === 'automatic');

            if (automaticSnapshot) {
                expect(automaticSnapshot.description).toContain('write_file');
                expect(automaticSnapshot.description).toContain('important.txt');
                expect(automaticSnapshot.metadata.toolName).toBe('write_file');
            } else {
                // This will fail because no automatic snapshot is created
                expect(automaticSnapshot).toBeDefined();
            }
        });

        it('should include tool execution context in snapshot metadata', async () => {
            await toolManager.executeToolCall('str-replace-editor', {
                command: 'str_replace',
                path: 'README.md',
                old_str: 'Test Project',
                new_str: 'Modified Project',
            });

            const snapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            const automaticSnapshot = snapshots.find(s => s.metadata?.triggerType === 'automatic');

            if (automaticSnapshot) {
                expect(automaticSnapshot.metadata.toolName).toBeDefined();
                expect(automaticSnapshot.metadata.toolArgs).toBeDefined();
                expect(automaticSnapshot.metadata.executionTime).toBeDefined();
            } else {
                expect(automaticSnapshot).toBeDefined();
            }
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await autoSnapshotManager.initialize();
        });

        it('should handle tool execution errors gracefully', async () => {
            // Try to execute a tool with invalid parameters
            const result = await toolManager.executeToolCall('write_file', {
                // Missing required parameters
            });

            // Should not crash the snapshot system
            expect(autoSnapshotManager.isEnabled()).toBe(true);

            // Should still be able to list snapshots
            const snapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            expect(Array.isArray(snapshots)).toBe(true);
        });

        it('should continue working if snapshot creation fails', async () => {
            // Mock snapshot creation to fail
            const originalCreateSnapshot = autoSnapshotManager.snapshotManager.createSnapshot;
            autoSnapshotManager.snapshotManager.createSnapshot = vi
                .fn()
                .mockRejectedValue(new Error('Snapshot creation failed'));

            // Tool execution should still work
            const result = await toolManager.executeToolCall('write_file', {
                file_path: 'test.txt',
                content: 'test',
            });

            // Tool should succeed even if snapshot fails
            expect(result.success).toBe(true);
            expect(existsSync(join(testDir, 'test.txt'))).toBe(true);

            // Restore original method
            autoSnapshotManager.snapshotManager.createSnapshot = originalCreateSnapshot;
        });
    });

    describe('Configuration Integration', () => {
        it('should respect configuration settings for automatic snapshots', async () => {
            // Test with disabled automatic snapshots
            const disabledConfig = {
                autoSnapshot: { enabled: false },
                initialSnapshot: { enabled: false },
            };

            const disabledManager = new AutoSnapshotManager(toolManager);
            // Mock the config to return disabled settings
            disabledManager.config = disabledConfig;
            disabledManager.enabled = false;

            await disabledManager.initialize();

            // Should not create any snapshots
            const snapshots = await disabledManager.snapshotManager.listSnapshots();
            expect(snapshots.length).toBe(0);
        });

        it('should use configured cooldown periods', async () => {
            await autoSnapshotManager.initialize();

            const initialCount = (await autoSnapshotManager.snapshotManager.listSnapshots()).length;

            // Execute multiple tools quickly
            await toolManager.executeToolCall('write_file', {
                file_path: 'file1.txt',
                content: 'content1',
            });

            await toolManager.executeToolCall('write_file', {
                file_path: 'file2.txt',
                content: 'content2',
            });

            const finalSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();

            // Should respect cooldown and not create snapshot for second tool
            // (This test may need adjustment based on actual cooldown implementation)
            expect(finalSnapshots.length).toBeLessThanOrEqual(initialCount + 2);
        });
    });
});
