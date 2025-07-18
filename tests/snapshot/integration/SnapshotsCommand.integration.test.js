/**
 * Integration tests for SnapshotsCommand
 * Tests the complete command workflow with real file operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    })
}));

describe('SnapshotsCommand Integration', () => {
    let testDir;
    let command;
    let mockContext;
    let originalCwd;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = join(tmpdir(), `snapshot-cmd-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });

        // Create test files
        await createTestFiles(testDir);

        // Change to test directory
        originalCwd = process.cwd();
        process.chdir(testDir);

        // Initialize command
        command = new SnapshotsCommand();

        // Mock console interface
        mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                showError: vi.fn(),
                showSuccess: vi.fn(),
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn()
            }
        };
    });

    afterEach(async () => {
        // Restore original directory
        process.chdir(originalCwd);

        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Complete Snapshot Workflow', () => {
        it('should execute full create-list-restore-delete workflow', async () => {
            // 1. Create a snapshot
            mockContext.consoleInterface.promptForInput.mockResolvedValue('Initial snapshot');

            const createResult = await command.implementation('create', mockContext);
            expect(createResult).toBe('success');
            expect(mockContext.consoleInterface.showSuccess).toHaveBeenCalledWith(
                expect.stringContaining('Snapshot created successfully!')
            );

            // 2. List snapshots
            const listResult = await command.implementation('list', mockContext);
            expect(listResult).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                'Found 1 snapshot:\n'
            );

            // 3. Modify a file
            await fs.writeFile(join(testDir, 'test.js'), 'console.log("modified");');

            // 4. Restore the snapshot
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            // Get the snapshot ID from the create operation
            const snapshots = await command._initializeSnapshotManager(mockContext).listSnapshots();
            const snapshotId = snapshots[0].id;

            const restoreResult = await command.implementation(`restore ${snapshotId}`, mockContext);
            expect(restoreResult).toBe('success');
            expect(mockContext.consoleInterface.showSuccess).toHaveBeenCalledWith(
                expect.stringContaining('Snapshot restored successfully!')
            );

            // Verify file was restored
            const content = await fs.readFile(join(testDir, 'test.js'), 'utf8');
            expect(content).toBe('console.log("Hello, World!");');

            // 5. Delete the snapshot
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const deleteResult = await command.implementation(`delete ${snapshotId}`, mockContext);
            expect(deleteResult).toBe('success');
            expect(mockContext.consoleInterface.showSuccess).toHaveBeenCalledWith(
                expect.stringContaining('deleted successfully')
            );

            // Verify snapshot was deleted
            const finalList = await command.implementation('list', mockContext);
            expect(finalList).toBe('empty');
        });

        it('should handle restore with explicit preview option', async () => {
            // Create snapshot
            const createResult = await command.implementation('create "Test snapshot"', mockContext);
            expect(createResult).toBe('success');

            // Get snapshot ID
            const snapshots = await command._initializeSnapshotManager(mockContext).listSnapshots();
            const snapshotId = snapshots[0].id;

            // Modify a file
            await fs.writeFile(join(testDir, 'test.js'), 'console.log("modified");');

            // Restore with explicit --preview option
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const restoreResult = await command.implementation(`restore ${snapshotId} --preview`, mockContext);
            expect(restoreResult).toBe('success');

            // Should have shown preview (due to --preview flag)
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Analyzing restore impact')
            );
        });

        it('should handle restore with command-line options', async () => {
            // Create snapshot
            const createResult = await command.implementation('create "Test snapshot"', mockContext);
            expect(createResult).toBe('success');

            // Get snapshot ID
            const snapshots = await command._initializeSnapshotManager(mockContext).listSnapshots();
            const snapshotId = snapshots[0].id;

            // Modify a file
            await fs.writeFile(join(testDir, 'test.js'), 'console.log("modified");');

            // Restore with --no-backup option
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);

            const restoreResult = await command.implementation(
                `restore ${snapshotId} --no-backup`, 
                mockContext
            );
            expect(restoreResult).toBe('success');

            // Should have mentioned no backup in confirmation
            expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalledWith(
                expect.stringContaining('WITHOUT creating a backup')
            );
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle file system errors gracefully', async () => {
            // Create a file with restricted permissions
            const restrictedFile = join(testDir, 'restricted.txt');
            await fs.writeFile(restrictedFile, 'restricted content');
            
            try {
                await fs.chmod(restrictedFile, 0o000);
            } catch (error) {
                // Skip on systems that don't support chmod
                return;
            }

            // Try to create snapshot
            const createResult = await command.implementation('create "Test with errors"', mockContext);
            
            // Should still succeed but with warnings
            expect(createResult).toBe('success');

            // Restore permissions for cleanup
            await fs.chmod(restrictedFile, 0o644);
        });

        it('should handle user cancellation at various points', async () => {
            // Test cancellation during create
            mockContext.consoleInterface.promptForInput.mockResolvedValue('');

            const createResult = await command.implementation('create', mockContext);
            expect(createResult).toBe('cancelled');

            // Create a snapshot for restore test
            mockContext.consoleInterface.promptForInput.mockResolvedValue('Test snapshot');
            await command.implementation('create', mockContext);

            const snapshots = await command._initializeSnapshotManager(mockContext).listSnapshots();
            const snapshotId = snapshots[0].id;

            // Test cancellation during restore
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const restoreResult = await command.implementation(`restore ${snapshotId}`, mockContext);
            expect(restoreResult).toBe('cancelled');

            // Test cancellation during delete
            const deleteResult = await command.implementation(`delete ${snapshotId}`, mockContext);
            expect(deleteResult).toBe('cancelled');
        });

        it('should handle invalid commands and arguments', async () => {
            // Invalid subcommand
            const invalidResult = await command.implementation('invalid', mockContext);
            expect(invalidResult).toBe('help_shown');

            // Missing arguments
            const restoreResult = await command.implementation('restore', mockContext);
            expect(restoreResult).toBe('invalid_args');

            const deleteResult = await command.implementation('delete', mockContext);
            expect(deleteResult).toBe('invalid_args');

            // Non-existent snapshot
            const restoreNonExistentResult = await command.implementation('restore non-existent', mockContext);
            expect(restoreNonExistentResult).toBe('not_found');
        });
    });

    describe('Configuration and Statistics', () => {
        it('should display configuration and statistics correctly', async () => {
            // Test config show
            const configResult = await command.implementation('config show', mockContext);
            expect(configResult).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Current Snapshot Configuration:')
            );

            // Test config stats
            const statsResult = await command.implementation('config stats', mockContext);
            expect(statsResult).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Storage Statistics:')
            );
        });

        it('should handle help command', async () => {
            const helpResult = await command.implementation('help', mockContext);
            expect(helpResult).toBe('help_shown');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Snapshot Management Commands:')
            );

            // Test empty command (should show help)
            const emptyResult = await command.implementation('', mockContext);
            expect(emptyResult).toBe('help_shown');
        });
    });

    describe('Real File Operations', () => {
        it('should preserve file content and metadata correctly', async () => {
            // Create a file with specific content and metadata
            const testFile = join(testDir, 'metadata-test.js');
            const originalContent = 'console.log("original content");';
            await fs.writeFile(testFile, originalContent);

            // Get original stats
            const originalStats = await fs.stat(testFile);

            // Create snapshot
            await command.implementation('create "Metadata test"', mockContext);

            // Modify the file
            await fs.writeFile(testFile, 'console.log("modified content");');

            // Restore snapshot
            const snapshots = await command._initializeSnapshotManager(mockContext).listSnapshots();
            const snapshotId = snapshots[0].id;

            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(true);
            await command.implementation(`restore ${snapshotId}`, mockContext);

            // Verify content was restored
            const restoredContent = await fs.readFile(testFile, 'utf8');
            expect(restoredContent).toBe(originalContent);

            // Verify file still exists and is accessible
            const restoredStats = await fs.stat(testFile);
            expect(restoredStats.isFile()).toBe(true);
        });
    });
});

/**
 * Create test files for integration testing
 */
async function createTestFiles(baseDir) {
    const files = {
        'test.js': 'console.log("Hello, World!");',
        'package.json': JSON.stringify({ name: 'test-project', version: '1.0.0' }),
        'README.md': '# Test Project\n\nThis is a test.',
        'src/main.js': 'export function main() { return "main"; }',
        'src/utils.js': 'export function utils() { return "utils"; }'
    };

    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = join(baseDir, filePath);
        await fs.mkdir(join(baseDir, 'src'), { recursive: true });
        await fs.writeFile(fullPath, content);
    }
}
