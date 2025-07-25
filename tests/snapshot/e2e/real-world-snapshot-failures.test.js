/**
 * End-to-end tests that demonstrate real-world snapshot functionality failures
 * These tests should FAIL until the bugs are fixed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AutoSnapshotManager } from '../../../src/core/snapshot/AutoSnapshotManager.js';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';

// Mock logger to avoid initialization issues
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    initializeLogger: vi.fn(),
}));

describe.sequential('Real-World Snapshot Failures', () => {
    let testDir;
    let originalCwd;
    let autoSnapshotManager;
    let snapshotManager;
    let snapshotsCommand;
    let mockToolManager;

    beforeEach(async () => {
        // Create a real temporary directory for testing
        testDir = join(
            tmpdir(),
            `snapshot-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );
        mkdirSync(testDir, { recursive: true });

        // Store original directory to restore later
        originalCwd = process.cwd();

        // Change to test directory
        process.chdir(testDir);

        // Create test files including empty ones
        writeFileSync(join(testDir, 'README.md'), '# Test Project\n\nMIT License');
        writeFileSync(join(testDir, 'package.json'), '{"name": "test", "version": "1.0.0"}');
        writeFileSync(join(testDir, '.gitkeep'), ''); // Empty file that causes issues
        writeFileSync(join(testDir, 'empty-config.json'), ''); // Another empty file

        // Create subdirectory with empty file
        mkdirSync(join(testDir, 'docs'), { recursive: true });
        writeFileSync(join(testDir, 'docs', '.gitkeep'), '');

        // Create mock toolManager first
        mockToolManager = {
            executeToolCall: vi.fn().mockResolvedValue({
                success: true,
                result: 'File modified',
            }),
            getToolDefinition: vi.fn(toolName => {
                if (toolName === 'write_file') {
                    return {
                        name: 'write_file',
                        description: 'Write content to a file',
                        modifiesFiles: true,
                        fileTargets: ['file_path'],
                    };
                }
                return null;
            }),
            hasToolDefinition: vi.fn(toolName => toolName === 'write_file'),
        };

        // Initialize managers with toolManager
        autoSnapshotManager = new AutoSnapshotManager(mockToolManager);

        // Use singleton to ensure consistency
        const { getSnapshotManager } = await import(
            '../../../src/core/snapshot/SnapshotManagerSingleton.js'
        );
        snapshotManager = getSnapshotManager();
        snapshotsCommand = new SnapshotsCommand();
    });

    afterEach(async () => {
        // Restore original working directory
        if (originalCwd) {
            process.chdir(originalCwd);
        }

        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }

        // Reset singleton
        const { resetSnapshotManager } = await import(
            '../../../src/core/snapshot/SnapshotManagerSingleton.js'
        );
        resetSnapshotManager();
    });

    describe('Issue 1: Initial Snapshot Not Visible', () => {
        it('should show initial snapshot in list after AutoSnapshotManager initialization', async () => {
            // Initialize AutoSnapshotManager (should create initial snapshot)
            await autoSnapshotManager.initialize();

            // The initial snapshot should be visible when listing snapshots
            const snapshots = await snapshotManager.listSnapshots();

            // This should pass but currently FAILS
            expect(snapshots.length).toBeGreaterThan(0);
            expect(snapshots.some(s => s.triggerType === 'initial')).toBe(true);
        });

        it('should show initial snapshot via SnapshotsCommand', async () => {
            // Initialize AutoSnapshotManager
            await autoSnapshotManager.initialize();

            // Mock console interface for command
            const mockConsoleInterface = {
                showMessage: vi.fn(),
                showError: vi.fn(),
            };

            // Execute list command
            const result = await snapshotsCommand.implementation('list', {
                consoleInterface: mockConsoleInterface,
            });

            // Should show at least the initial snapshot
            // This currently FAILS because initial snapshot is not in the store
            expect(mockConsoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('1 total')
            );
        });
    });

    describe('Issue 2: No Automatic Snapshots on Tool Execution', () => {
        it('should create automatic snapshot before file modification', async () => {
            // Initialize system
            await autoSnapshotManager.initialize();

            // Get initial snapshot count
            const initialSnapshots = await snapshotManager.listSnapshots();
            const initialCount = initialSnapshots.length;

            // The mockToolManager is already integrated during initialization

            // Execute a file-modifying tool with proper toolCall format
            await mockToolManager.executeToolCall({
                id: 'test-tool-call-id',
                function: {
                    name: 'write_file',
                    arguments: JSON.stringify({
                        file_path: 'test.txt',
                        content: 'new content',
                    }),
                },
            });

            // Check if automatic snapshot was created
            const finalSnapshots = await snapshotManager.listSnapshots();

            // This should pass but currently FAILS
            expect(finalSnapshots.length).toBe(initialCount + 1);
            expect(finalSnapshots.some(s => s.triggerType === 'automatic')).toBe(true);
        });
    });

    describe('Issue 3: Non-Differential Snapshots', () => {
        it('should create differential snapshots that only store changed files', async () => {
            // Create first snapshot
            const snapshot1 = await snapshotManager.createSnapshot('Initial state');

            // Modify only one file
            writeFileSync(join(testDir, 'README.md'), '# Test Project\n\nGPL License');

            // Create second snapshot
            const snapshot2 = await snapshotManager.createSnapshot('After README change');

            // Get raw snapshots from store to check differential behavior
            const rawSnapshot1 = await snapshotManager.store.retrieve(snapshot1.id);
            const rawSnapshot2 = await snapshotManager.store.retrieve(snapshot2.id);

            // First snapshot should be full type
            expect(rawSnapshot1.type).toBe('full');

            // Second snapshot should be differential type
            expect(rawSnapshot2.type).toBe('differential');

            // Count files with actual content vs references in differential snapshot
            const filesWithContent2 = Object.values(rawSnapshot2.fileData.files).filter(
                file => file.action !== 'unchanged'
            ).length;
            const referencedFiles2 = Object.values(rawSnapshot2.fileData.files).filter(
                file => file.action === 'unchanged'
            ).length;

            // Second snapshot should have fewer files with actual content stored
            expect(filesWithContent2).toBeLessThan(Object.keys(rawSnapshot1.fileData.files).length);
            expect(referencedFiles2).toBeGreaterThan(0);
        });
    });

    describe('Issue 4: Empty File Restoration Failure', () => {
        it('should successfully restore snapshots containing empty files', async () => {
            // Create snapshot with empty files
            const snapshot = await snapshotManager.createSnapshot('With empty files');

            // Modify the empty file to have content
            writeFileSync(join(testDir, '.gitkeep'), 'not empty anymore');
            writeFileSync(join(testDir, 'empty-config.json'), '{"test": true}');

            // Attempt to restore snapshot (should restore empty files)
            // This currently FAILS with "content missing" error
            await expect(snapshotManager.restoreSnapshot(snapshot.id)).resolves.not.toThrow();

            // Verify empty files were restored correctly
            const gitkeepContent = readFileSync(join(testDir, '.gitkeep'), 'utf8');
            const configContent = readFileSync(join(testDir, 'empty-config.json'), 'utf8');

            expect(gitkeepContent).toBe('');
            expect(configContent).toBe('');
        });

        it('should handle empty files in subdirectories during restoration', async () => {
            // Create snapshot
            const snapshot = await snapshotManager.createSnapshot('With nested empty files');

            // Modify the nested empty file
            writeFileSync(join(testDir, 'docs', '.gitkeep'), 'modified content');

            // Restore should work without errors
            // This currently FAILS
            await expect(snapshotManager.restoreSnapshot(snapshot.id)).resolves.not.toThrow();

            // Verify restoration
            const content = readFileSync(join(testDir, 'docs', '.gitkeep'), 'utf8');
            expect(content).toBe('');
        });
    });

    describe('Issue 5: Integration Between Components', () => {
        it('should maintain consistency between AutoSnapshotManager and SnapshotsCommand', async () => {
            // Initialize AutoSnapshotManager
            await autoSnapshotManager.initialize();

            // Create a manual snapshot via SnapshotsCommand
            const mockConsoleInterface = {
                showMessage: vi.fn(),
                showError: vi.fn(),
            };

            await snapshotsCommand.implementation('create "Manual snapshot"', {
                consoleInterface: mockConsoleInterface,
            });

            // Both managers should see the same snapshots
            const autoSnapshots = await autoSnapshotManager.snapshotManager.listSnapshots();
            const commandSnapshots = await snapshotManager.listSnapshots();

            // This should pass but may FAIL due to different store instances
            expect(autoSnapshots.length).toBe(commandSnapshots.length);
        });
    });

    describe('Real-World File Scenarios', () => {
        it('should handle various file types correctly', async () => {
            // Create files with different characteristics
            writeFileSync(join(testDir, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header
            writeFileSync(join(testDir, 'unicode.txt'), 'Hello 世界 🌍');
            writeFileSync(join(testDir, 'large.txt'), 'x'.repeat(10000));
            writeFileSync(join(testDir, 'zero-byte'), '');

            // Create and restore snapshot
            const snapshot = await snapshotManager.createSnapshot('Various file types');

            // Modify files
            writeFileSync(join(testDir, 'unicode.txt'), 'Modified');
            writeFileSync(join(testDir, 'zero-byte'), 'not empty');

            // Restore should work for all file types
            await expect(snapshotManager.restoreSnapshot(snapshot.id)).resolves.not.toThrow();

            // Verify restoration
            const unicodeContent = readFileSync(join(testDir, 'unicode.txt'), 'utf8');
            const zeroByteContent = readFileSync(join(testDir, 'zero-byte'), 'utf8');

            expect(unicodeContent).toBe('Hello 世界 🌍');
            expect(zeroByteContent).toBe('');
        });
    });
});
