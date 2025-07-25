/**
 * Debug tests to understand current integration issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AutoSnapshotManager } from '../../../src/core/snapshot/AutoSnapshotManager.js';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';
import {
    getSnapshotManager,
    resetSnapshotManager,
} from '../../../src/core/snapshot/SnapshotManagerSingleton.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    initializeLogger: vi.fn(),
}));

describe.sequential('Integration Debug Tests', () => {
    let testDir;
    let originalCwd;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `debug-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );
        mkdirSync(testDir, { recursive: true });
        originalCwd = process.cwd();
        process.chdir(testDir);

        // Reset singleton
        resetSnapshotManager();

        // Create test files
        writeFileSync(join(testDir, 'test.txt'), 'test content');
        writeFileSync(join(testDir, '.gitkeep'), '');
    });

    afterEach(() => {
        try {
            if (originalCwd && existsSync(originalCwd)) {
                process.chdir(originalCwd);
            }
        } catch (error) {
            // Ignore chdir errors during cleanup
        }

        try {
            if (testDir && existsSync(testDir)) {
                rmSync(testDir, { recursive: true, force: true });
            }
        } catch (error) {
            // Ignore cleanup errors
        }

        resetSnapshotManager();
    });

    it('should verify singleton pattern works', async () => {
        const manager1 = getSnapshotManager();
        const manager2 = getSnapshotManager();

        expect(manager1).toBe(manager2);

        // Create snapshot with first instance
        const snapshot1 = await manager1.createSnapshot('Test snapshot 1');

        // List snapshots with second instance
        const snapshots = await manager2.listSnapshots();

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0].id).toBe(snapshot1.id);
    });

    it('should verify AutoSnapshotManager and SnapshotsCommand use same store', async () => {
        const autoManager = new AutoSnapshotManager();
        await autoManager.initialize();

        const snapshotsCommand = new SnapshotsCommand();

        // Create manual snapshot via AutoSnapshotManager's internal manager
        const manualSnapshot =
            await autoManager.snapshotManager.createSnapshot('Manual test snapshot');
        console.log('Manual snapshot created:', manualSnapshot);

        // Check what's in the store directly
        const directSnapshots = await autoManager.snapshotManager.listSnapshots();
        console.log('Direct snapshots from manager:', directSnapshots);

        // List snapshots via SnapshotsCommand
        const mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                promptForInput: vi.fn(),
                showError: vi.fn(),
            },
        };

        try {
            const result = await snapshotsCommand.handleList([], mockContext);
            console.log('Snapshots found via command:', result);

            expect(result).not.toBe('empty');
            expect(result).not.toBe('error');
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            // Should find the manual snapshot
            const foundManual = result.find(s => s.id === manualSnapshot.id);
            expect(foundManual).toBeDefined();
        } catch (error) {
            console.error('Error in handleList:', error);
            console.log('showError calls:', mockContext.consoleInterface.showError.mock.calls);
            throw error;
        }
    });

    it('should debug initial snapshot creation', async () => {
        const autoManager = new AutoSnapshotManager();
        await autoManager.initialize();

        console.log('AutoSnapshotManager config:', autoManager.config);
        console.log('Initial snapshot enabled:', autoManager.config.initialSnapshot.enabled);

        // Force create initial snapshot
        const result = await autoManager.initialSnapshotManager.createInitialSnapshot(testDir);
        console.log('Initial snapshot result:', result);

        // Check if it's in the store
        const snapshots = await autoManager.snapshotManager.listSnapshots();
        console.log('Snapshots in store after initial creation:', snapshots.length);

        if (snapshots.length > 0) {
            console.log(
                'Snapshot details:',
                snapshots.map(s => ({
                    id: s.id,
                    description: s.description,
                    triggerType: s.triggerType,
                }))
            );
        }

        expect(snapshots.length).toBeGreaterThan(0);
    });
});
