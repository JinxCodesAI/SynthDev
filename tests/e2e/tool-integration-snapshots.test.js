/**
 * Integration Tests for Tool Integration Snapshot Hooks
 * Tests that snapshots are automatically created before file-modifying tools execute
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import ToolManager from '../../src/core/managers/toolManager.js';
import { SnapshotManager } from '../../src/core/snapshot/SnapshotManager.js';
import SnapshotConfig from '../../src/core/snapshot/SnapshotConfig.js';

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

/**
 * Get safe temporary directory with robust fallback handling
 * @returns {string} Temporary directory path
 */
async function getSafeTempDirectory() {
    try {
        return tmpdir();
    } catch (error) {
        console.warn('Failed to get system temp directory:', error.message);

        // Fallback to common temp locations
        const fallbacks = [
            '/tmp', // Unix/Linux standard
            '/var/tmp', // Alternative Unix temp
            process.env.TMPDIR, // Environment variable
            process.env.TEMP, // Windows
            process.env.TMP, // Windows alternative
            '/home/runner/tmp', // GitHub Actions
            './tmp', // Relative fallback
        ].filter(Boolean); // Remove undefined values

        for (const fallback of fallbacks) {
            try {
                const { existsSync } = await import('fs');
                if (existsSync(fallback)) {
                    console.warn(`Using fallback temp directory: ${fallback}`);
                    return fallback;
                }
            } catch (_fallbackError) {
                // Continue to next fallback
                continue;
            }
        }

        // Last resort: current directory or root
        console.warn('All temp directory fallbacks failed, using current directory');
        try {
            return process.cwd();
        } catch (_cwdError) {
            console.warn('Current directory also failed, using root');
            return '/';
        }
    }
}

describe('Tool Integration Snapshots', () => {
    let toolManager;
    let snapshotManager;
    let testDir;
    let testDirRelative;
    let mockConsoleInterface;

    beforeEach(async () => {
        // Use system temporary directory with fallback handling
        const tempDir = await getSafeTempDirectory();

        // Mock process.cwd() to use temp directory
        process.cwd = vi.fn(() => tempDir);

        // Create test directory within temporary directory
        const testDirName = `tool-integration-test-${Date.now()}`;
        testDirRelative = join('test-temp', testDirName);
        testDir = join(tempDir, testDirRelative);
        mkdirSync(testDir, { recursive: true });

        // Initialize tool manager
        toolManager = new ToolManager();
        await toolManager.loadTools();

        // Initialize snapshot manager with file-based strategy
        const config = new SnapshotConfig({
            snapshots: {
                mode: 'file',
                file: {
                    maxSnapshots: 10,
                    memoryLimit: '10MB',
                    compressionEnabled: false,
                    persistToDisk: false,
                    checksumValidation: true,
                },
            },
        });

        snapshotManager = new SnapshotManager(config);
        await snapshotManager.initialize();

        // Mock console interface
        mockConsoleInterface = {
            showToolExecution: vi.fn(),
            showToolResult: vi.fn(),
            showToolCancelled: vi.fn(),
            promptForConfirmation: vi.fn().mockResolvedValue(true),
        };
    });

    afterEach(() => {
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }

        // Restore original process.cwd
        process.cwd =
            originalCwd ||
            (() => {
                // For synchronous fallback, use a simpler approach
                try {
                    return tmpdir();
                } catch (_error) {
                    return '/tmp';
                }
            });
    });

    const createTestFile = (filename, content) => {
        const absolutePath = join(testDir, filename);
        writeFileSync(absolutePath, content, 'utf8');

        // Return relative path from current working directory for tool usage
        const relativePath = join(testDirRelative, filename);
        return relativePath;
    };

    it('should create snapshot before write_file tool execution', async () => {
        // Create an existing file that will be overwritten
        const testFileRelative = createTestFile('test.txt', 'Original content');
        const testFileAbsolute = join(testDir, 'test.txt');

        // Verify file exists with original content
        expect(existsSync(testFileAbsolute)).toBe(true);
        expect(readFileSync(testFileAbsolute, 'utf8')).toBe('Original content');

        // Get initial snapshot count
        const initialSnapshots = await snapshotManager.getSnapshots();
        expect(initialSnapshots.success).toBe(true);
        const initialCount = initialSnapshots.snapshots.length;

        // Create mock tool call for write_file
        const toolCall = {
            id: 'test-call-1',
            function: {
                name: 'write_file',
                arguments: JSON.stringify({
                    file_path: testFileRelative,
                    content: 'New content',
                    overwrite: true,
                }),
            },
        };

        // Execute tool call with snapshot manager
        const result = await toolManager.executeToolCall(
            toolCall,
            mockConsoleInterface,
            snapshotManager
        );

        // Verify tool execution was successful
        expect(result.role).toBe('tool');
        expect(result.tool_call_id).toBe('test-call-1');
        const resultContent = JSON.parse(result.content);

        // Debug: Log the actual result if it failed
        if (!resultContent.success) {
            console.log('Tool execution failed:', resultContent);
        }

        expect(resultContent.success).toBe(true);

        // Verify file was modified
        expect(readFileSync(testFileAbsolute, 'utf8')).toBe('New content');

        // Verify snapshot was created
        const finalSnapshots = await snapshotManager.getSnapshots();
        expect(finalSnapshots.success).toBe(true);
        expect(finalSnapshots.snapshots.length).toBe(initialCount + 1);

        // Verify snapshot contains the original file content
        const latestSnapshot = finalSnapshots.snapshots[0]; // Newest first
        expect(latestSnapshot.instruction).toContain('Pre-execution snapshot before write_file');
        expect(latestSnapshot.instruction).toContain(testFileRelative);

        // Get the full snapshot to check file content
        const snapshotDetails = await snapshotManager.getSnapshot(latestSnapshot.id);
        expect(snapshotDetails.success).toBe(true);
        expect(snapshotDetails.snapshot.files.has(testFileRelative)).toBe(true);
        expect(snapshotDetails.snapshot.files.get(testFileRelative)).toBe('Original content');
    });

    it('should create snapshot before edit_file tool execution', async () => {
        // Create an existing file that will be edited
        const testFileRelative = createTestFile('edit-test.txt', 'Line 1\nLine 2\nLine 3');
        const testFileAbsolute = join(testDir, 'edit-test.txt');

        // Get initial snapshot count
        const initialSnapshots = await snapshotManager.getSnapshots();
        expect(initialSnapshots.success).toBe(true);
        const initialCount = initialSnapshots.snapshots.length;

        // Create mock tool call for edit_file
        const toolCall = {
            id: 'test-call-2',
            function: {
                name: 'edit_file',
                arguments: JSON.stringify({
                    file_path: testFileRelative,
                    operation: 'replace',
                    boundary_start: 'Line 2',
                    boundary_end: 'Line 3',
                    new_content: 'Modified Line 2\nModified Line 3',
                }),
            },
        };

        // Execute tool call with snapshot manager
        const result = await toolManager.executeToolCall(
            toolCall,
            mockConsoleInterface,
            snapshotManager
        );

        // Verify tool execution was successful
        expect(result.role).toBe('tool');
        const resultContent = JSON.parse(result.content);

        // Debug: Log the actual result if it failed
        if (!resultContent.success) {
            console.log('Edit file tool execution failed:', resultContent);
        }

        expect(resultContent.success).toBe(true);

        // Verify file was modified
        const modifiedContent = readFileSync(testFileAbsolute, 'utf8');
        expect(modifiedContent).toContain('Modified Line 2');
        expect(modifiedContent).toContain('Modified Line 3');

        // Verify snapshot was created
        const finalSnapshots = await snapshotManager.getSnapshots();
        expect(finalSnapshots.success).toBe(true);
        expect(finalSnapshots.snapshots.length).toBe(initialCount + 1);

        // Verify snapshot contains the original file content
        const latestSnapshot = finalSnapshots.snapshots[0]; // Newest first
        expect(latestSnapshot.instruction).toContain('Pre-execution snapshot before edit_file');

        // Get the full snapshot to check file content
        const snapshotDetails = await snapshotManager.getSnapshot(latestSnapshot.id);
        expect(snapshotDetails.success).toBe(true);
        expect(snapshotDetails.snapshot.files.has(testFileRelative)).toBe(true);
        expect(snapshotDetails.snapshot.files.get(testFileRelative)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should not create snapshot for read-only tools', async () => {
        // Create a test file
        const testFile = createTestFile('read-test.txt', 'Test content');

        // Get initial snapshot count
        const initialSnapshots = await snapshotManager.getSnapshots();
        expect(initialSnapshots.success).toBe(true);
        const initialCount = initialSnapshots.snapshots.length;

        // Create mock tool call for read_file (read-only tool)
        const toolCall = {
            id: 'test-call-3',
            function: {
                name: 'read_file',
                arguments: JSON.stringify({
                    file_path: testFile,
                }),
            },
        };

        // Execute tool call with snapshot manager
        const result = await toolManager.executeToolCall(
            toolCall,
            mockConsoleInterface,
            snapshotManager
        );

        // Verify tool execution was successful
        expect(result.role).toBe('tool');
        const resultContent = JSON.parse(result.content);
        expect(resultContent.success).toBe(true);

        // Verify no snapshot was created (read-only operation)
        const finalSnapshots = await snapshotManager.getSnapshots();
        expect(finalSnapshots.success).toBe(true);
        expect(finalSnapshots.snapshots.length).toBe(initialCount); // No change
    });

    it('should not create snapshot for non-existent files', async () => {
        // Use a non-existent file path (relative)
        const nonExistentFile = join(testDirRelative, 'does-not-exist.txt');
        const absoluteNonExistentFile = join(testDir, 'does-not-exist.txt');
        expect(existsSync(absoluteNonExistentFile)).toBe(false);

        // Get initial snapshot count
        const initialSnapshots = await snapshotManager.getSnapshots();
        expect(initialSnapshots.success).toBe(true);
        const initialCount = initialSnapshots.snapshots.length;

        // Create mock tool call for write_file on non-existent file
        const toolCall = {
            id: 'test-call-4',
            function: {
                name: 'write_file',
                arguments: JSON.stringify({
                    file_path: nonExistentFile,
                    content: 'New file content',
                }),
            },
        };

        // Execute tool call with snapshot manager
        const result = await toolManager.executeToolCall(
            toolCall,
            mockConsoleInterface,
            snapshotManager
        );

        // Verify tool execution was successful
        expect(result.role).toBe('tool');
        const resultContent = JSON.parse(result.content);
        expect(resultContent.success).toBe(true);

        // Verify file was created
        expect(existsSync(absoluteNonExistentFile)).toBe(true);
        expect(readFileSync(absoluteNonExistentFile, 'utf8')).toBe('New file content');

        // Verify no snapshot was created (no existing file to backup)
        const finalSnapshots = await snapshotManager.getSnapshots();
        expect(finalSnapshots.success).toBe(true);
        expect(finalSnapshots.snapshots.length).toBe(initialCount); // No change
    });

    it('should handle tool execution without snapshot manager gracefully', async () => {
        // Create a test file
        const testFileRelative = createTestFile('no-snapshot-test.txt', 'Original content');
        const testFileAbsolute = join(testDir, 'no-snapshot-test.txt');

        // Create mock tool call for write_file
        const toolCall = {
            id: 'test-call-5',
            function: {
                name: 'write_file',
                arguments: JSON.stringify({
                    file_path: testFileRelative,
                    content: 'New content',
                    overwrite: true,
                }),
            },
        };

        // Execute tool call WITHOUT snapshot manager (null)
        const result = await toolManager.executeToolCall(
            toolCall,
            mockConsoleInterface,
            null // No snapshot manager
        );

        // Verify tool execution was still successful
        expect(result.role).toBe('tool');
        const resultContent = JSON.parse(result.content);
        expect(resultContent.success).toBe(true);

        // Verify file was modified
        expect(readFileSync(testFileAbsolute, 'utf8')).toBe('New content');
    });
});
