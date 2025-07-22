/**
 * Unit tests for InitialSnapshotManager component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InitialSnapshotManager } from '../../../src/core/snapshot/InitialSnapshotManager.js';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';

// Mock fs operations
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
}));

// Mock path operations
vi.mock('path', () => ({
    resolve: vi.fn(),
    basename: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('InitialSnapshotManager', () => {
    let manager;
    let mockSnapshotManager;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSnapshotManager = {
            createSnapshot: vi.fn().mockResolvedValue({
                id: 'initial-snapshot-123',
                description: 'Initial project state - TestProject',
                timestamp: Date.now(),
            }),
            listSnapshots: vi.fn().mockResolvedValue([]),
        };

        resolve.mockImplementation((...paths) => {
            if (paths.length === 1) {
                return `/resolved${paths[0]}`;
            }
            // Handle resolve(basePath, filename) case
            return `/resolved${paths[0]}/${paths[1]}`;
        });
        basename.mockReturnValue('TestProject');

        manager = new InitialSnapshotManager(mockSnapshotManager);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            expect(manager.config.enabled).toBe(true);
            expect(manager.config.createOnStartup).toBe(true);
            expect(manager.config.skipIfSnapshotsExist).toBe(true);
            expect(manager.config.timeout).toBe(30000);
            expect(manager.config.description).toBe('Initial project state');
            expect(manager.config.stateFile).toBe('.synthdev-initial-snapshot');
        });

        it('should accept custom configuration', () => {
            const customConfig = {
                enabled: false,
                timeout: 10000,
                description: 'Custom initial state',
                stateFile: '.custom-state',
            };

            const customManager = new InitialSnapshotManager(mockSnapshotManager, customConfig);
            expect(customManager.config.enabled).toBe(false);
            expect(customManager.config.timeout).toBe(10000);
            expect(customManager.config.description).toBe('Custom initial state');
            expect(customManager.config.stateFile).toBe('.custom-state');
        });

        it('should initialize with initial state as false', () => {
            expect(manager.initialSnapshotCreated).toBe(false);
        });
    });

    describe('createInitialSnapshot', () => {
        beforeEach(() => {
            existsSync.mockReturnValue(false);
        });

        it('should create initial snapshot when conditions are met', async () => {
            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeDefined();
            expect(result.id).toBe('initial-snapshot-123');
            expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith(
                'Initial project state - TestProject',
                expect.objectContaining({
                    triggerType: 'initial',
                    isInitialSnapshot: true,
                    applicationStartup: true,
                })
            );
            expect(manager.initialSnapshotCreated).toBe(true);
        });

        it('should return null when disabled', async () => {
            manager.config.enabled = false;

            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeNull();
            expect(mockSnapshotManager.createSnapshot).not.toHaveBeenCalled();
        });

        it('should return null when createOnStartup is disabled', async () => {
            manager.config.createOnStartup = false;

            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeNull();
            expect(mockSnapshotManager.createSnapshot).not.toHaveBeenCalled();
        });

        it('should return null when not a first run', async () => {
            existsSync.mockReturnValue(true); // State file exists

            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeNull();
            expect(mockSnapshotManager.createSnapshot).not.toHaveBeenCalled();
        });

        it('should handle snapshot creation timeout', async () => {
            manager.config.timeout = 100; // Very short timeout
            mockSnapshotManager.createSnapshot.mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 200)) // Longer than timeout
            );

            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeNull();
        }, 10000);

        it('should handle snapshot creation errors gracefully', async () => {
            mockSnapshotManager.createSnapshot.mockRejectedValue(new Error('Creation failed'));

            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeNull();
            expect(manager.initialSnapshotCreated).toBe(false);
        });

        it('should mark initial snapshot as created after successful creation', async () => {
            const mockWriteFile = vi.fn();
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(false),
                writeFileSync: mockWriteFile,
            }));

            const result = await manager.createInitialSnapshot('/test/project');

            expect(result).toBeDefined();
            expect(manager.initialSnapshotCreated).toBe(true);
        });
    });

    describe('checkForInitialSnapshot', () => {
        it('should return true when state file exists', async () => {
            existsSync.mockReturnValue(true);

            const result = await manager.checkForInitialSnapshot('/test/project');

            expect(result).toBe(true);
        });

        it('should return true when existing snapshots exist and skipIfSnapshotsExist is enabled', async () => {
            existsSync.mockReturnValue(false);
            mockSnapshotManager.listSnapshots.mockResolvedValue([{ id: 'existing-snapshot' }]);

            const result = await manager.checkForInitialSnapshot('/test/project');

            expect(result).toBe(true);
        });

        it('should return false when no state file and no snapshots', async () => {
            existsSync.mockReturnValue(false);
            mockSnapshotManager.listSnapshots.mockResolvedValue([]);

            const result = await manager.checkForInitialSnapshot('/test/project');

            expect(result).toBe(false);
        });

        it('should return false when skipIfSnapshotsExist is disabled', async () => {
            manager.config.skipIfSnapshotsExist = false;
            existsSync.mockReturnValue(false);
            mockSnapshotManager.listSnapshots.mockResolvedValue([{ id: 'existing-snapshot' }]);

            const result = await manager.checkForInitialSnapshot('/test/project');

            expect(result).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });

            const result = await manager.checkForInitialSnapshot('/test/project');

            expect(result).toBe(false);
        });
    });

    describe('shouldCreateInitialSnapshot', () => {
        it('should return true for first run', async () => {
            vi.spyOn(manager, 'isFirstRun').mockResolvedValue(true);

            const result = await manager.shouldCreateInitialSnapshot('/test/project');

            expect(result).toBe(true);
        });

        it('should return false for non-first run', async () => {
            vi.spyOn(manager, 'isFirstRun').mockResolvedValue(false);

            const result = await manager.shouldCreateInitialSnapshot('/test/project');

            expect(result).toBe(false);
        });
    });

    describe('isFirstRun', () => {
        it('should return true when no initial snapshot exists', async () => {
            vi.spyOn(manager, 'checkForInitialSnapshot').mockResolvedValue(false);

            const result = await manager.isFirstRun('/test/project');

            expect(result).toBe(true);
        });

        it('should return false when initial snapshot exists', async () => {
            vi.spyOn(manager, 'checkForInitialSnapshot').mockResolvedValue(true);

            const result = await manager.isFirstRun('/test/project');

            expect(result).toBe(false);
        });
    });

    describe('getInitialSnapshotId', () => {
        it('should return snapshot ID from state file', async () => {
            existsSync.mockReturnValue(true);
            const mockReadFileSync = vi
                .fn()
                .mockReturnValue(JSON.stringify({ initialSnapshotId: 'snapshot-123' }));

            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                readFileSync: mockReadFileSync,
            }));

            const result = await manager.getInitialSnapshotId('/test/project');

            expect(result).toBe('snapshot-123');
        });

        it('should return null when state file does not exist', async () => {
            existsSync.mockReturnValue(false);

            const result = await manager.getInitialSnapshotId('/test/project');

            expect(result).toBeNull();
        });

        it('should return null when state file is corrupted', async () => {
            existsSync.mockReturnValue(true);
            const mockReadFileSync = vi.fn().mockReturnValue('invalid json');

            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                readFileSync: mockReadFileSync,
            }));

            const result = await manager.getInitialSnapshotId('/test/project');

            expect(result).toBeNull();
        });

        it('should return null when initialSnapshotId is missing from state', async () => {
            existsSync.mockReturnValue(true);
            const mockReadFileSync = vi
                .fn()
                .mockReturnValue(JSON.stringify({ otherProperty: 'value' }));

            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                readFileSync: mockReadFileSync,
            }));

            const result = await manager.getInitialSnapshotId('/test/project');

            expect(result).toBeNull();
        });
    });

    describe('markInitialSnapshotCreated', () => {
        it('should save initial snapshot state', async () => {
            const mockWriteFileSync = vi.fn();
            vi.doMock('fs', () => ({
                writeFileSync: mockWriteFileSync,
            }));

            await manager.markInitialSnapshotCreated('/test/project', 'snapshot-123');

            expect(mockWriteFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('snapshot-123')
            );
        });

        it('should handle save errors gracefully', async () => {
            const mockWriteFileSync = vi.fn().mockImplementation(() => {
                throw new Error('Write error');
            });
            vi.doMock('fs', () => ({
                writeFileSync: mockWriteFileSync,
            }));

            // Should not throw
            await expect(
                manager.markInitialSnapshotCreated('/test/project', 'snapshot-123')
            ).resolves.toBeUndefined();
        });

        it('should save state without snapshot ID when not provided', async () => {
            const mockWriteFileSync = vi.fn();
            vi.doMock('fs', () => ({
                writeFileSync: mockWriteFileSync,
            }));

            await manager.markInitialSnapshotCreated('/test/project');

            expect(mockWriteFileSync).toHaveBeenCalled();
            const savedContent = mockWriteFileSync.mock.calls[0][1];
            const parsedContent = JSON.parse(savedContent);
            expect(parsedContent.initialSnapshotId).toBeNull();
        });
    });

    describe('getInitialSnapshotDescription', () => {
        it('should generate description with project name', () => {
            basename.mockReturnValue('MyProject');

            const description = manager.getInitialSnapshotDescription('/path/to/MyProject');

            expect(description).toBe('Initial project state - MyProject');
        });
    });

    describe('getInitialSnapshotMetadata', () => {
        it('should generate comprehensive metadata', () => {
            const metadata = manager.getInitialSnapshotMetadata('/test/project');

            expect(metadata).toMatchObject({
                triggerType: 'initial',
                basePath: expect.any(String),
                isInitialSnapshot: true,
                applicationStartup: true,
                timestamp: expect.any(Number),
                creator: 'system',
                description: 'Initial project state snapshot created on application startup',
            });
        });
    });

    describe('cleanupInitialState', () => {
        it('should remove state file when it exists', async () => {
            existsSync.mockReturnValue(true);
            const mockUnlinkSync = vi.fn();
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                unlinkSync: mockUnlinkSync,
            }));

            await manager.cleanupInitialState('/test/project');

            expect(mockUnlinkSync).toHaveBeenCalled();
        });

        it('should not attempt removal when state file does not exist', async () => {
            existsSync.mockReturnValue(false);
            const mockUnlinkSync = vi.fn();
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(false),
                unlinkSync: mockUnlinkSync,
            }));

            await manager.cleanupInitialState('/test/project');

            expect(mockUnlinkSync).not.toHaveBeenCalled();
        });

        it('should handle removal errors gracefully', async () => {
            existsSync.mockReturnValue(true);
            const mockUnlinkSync = vi.fn().mockImplementation(() => {
                throw new Error('Permission denied');
            });
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                unlinkSync: mockUnlinkSync,
            }));

            // Should not throw
            await expect(manager.cleanupInitialState('/test/project')).resolves.toBeUndefined();
        });
    });

    describe('resetInitialState', () => {
        it('should reset initial snapshot created flag', () => {
            manager.initialSnapshotCreated = true;

            manager.resetInitialState();

            expect(manager.initialSnapshotCreated).toBe(false);
        });
    });

    describe('wasInitialSnapshotCreated', () => {
        it('should return current state of initial snapshot creation', () => {
            expect(manager.wasInitialSnapshotCreated()).toBe(false);

            manager.initialSnapshotCreated = true;
            expect(manager.wasInitialSnapshotCreated()).toBe(true);
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration', () => {
            const newConfig = {
                enabled: false,
                timeout: 60000,
                description: 'Updated initial state',
            };

            manager.updateConfiguration(newConfig);

            expect(manager.config.enabled).toBe(false);
            expect(manager.config.timeout).toBe(60000);
            expect(manager.config.description).toBe('Updated initial state');
            expect(manager.config.createOnStartup).toBe(true); // Should preserve existing values
        });
    });

    describe('getStats', () => {
        it('should return comprehensive statistics', () => {
            manager.initialSnapshotCreated = true;

            const stats = manager.getStats();

            expect(stats).toMatchObject({
                enabled: true,
                createOnStartup: true,
                skipIfSnapshotsExist: true,
                initialSnapshotCreated: true,
                timeout: 30000,
                stateFile: '.synthdev-initial-snapshot',
            });
        });
    });

    describe('validateRequirements', () => {
        beforeEach(() => {
            existsSync.mockReturnValue(true);
        });

        it('should return valid for good conditions', async () => {
            const mockWriteFileSync = vi.fn();
            const mockUnlinkSync = vi.fn();
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                writeFileSync: mockWriteFileSync,
                unlinkSync: mockUnlinkSync,
            }));

            const result = await manager.validateRequirements('/test/project');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should return invalid when base path does not exist', async () => {
            existsSync.mockReturnValue(false);

            const result = await manager.validateRequirements('/nonexistent/project');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain(
                'Base path does not exist: /resolved/nonexistent/project'
            );
        });

        it('should return invalid when snapshot manager is not available', async () => {
            const managerWithoutSnapshots = new InitialSnapshotManager(null);

            const result = await managerWithoutSnapshots.validateRequirements('/test/project');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Snapshot manager not available');
        });

        it('should add warning when write permissions are not available', async () => {
            const mockWriteFileSync = vi.fn().mockImplementation(() => {
                throw new Error('Permission denied');
            });
            vi.doMock('fs', () => ({
                existsSync: vi.fn().mockReturnValue(true),
                writeFileSync: mockWriteFileSync,
                unlinkSync: vi.fn(),
            }));

            const result = await manager.validateRequirements('/test/project');

            expect(result.valid).toBe(true);
            expect(result.warnings).toContain(
                'May not have write permissions in project directory'
            );
        });

        it('should handle validation errors gracefully', async () => {
            resolve.mockImplementation(() => {
                throw new Error('Path resolution failed');
            });

            const result = await manager.validateRequirements('/test/project');

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toMatch(/Validation error: Path resolution failed/);
        });
    });

    describe('_createWithTimeout', () => {
        it('should resolve with snapshot result when creation succeeds within timeout', async () => {
            const mockResult = { id: 'test-snapshot' };
            mockSnapshotManager.createSnapshot.mockResolvedValue(mockResult);

            const result = await manager._createWithTimeout('test description', {});

            expect(result).toBe(mockResult);
        });

        it('should resolve with null when creation times out', async () => {
            manager.config.timeout = 100;
            mockSnapshotManager.createSnapshot.mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 200))
            );

            const result = await manager._createWithTimeout('test description', {});

            expect(result).toBeNull();
        }, 10000);

        it('should reject when creation fails within timeout', async () => {
            const error = new Error('Creation failed');
            mockSnapshotManager.createSnapshot.mockRejectedValue(error);

            await expect(manager._createWithTimeout('test description', {})).rejects.toThrow(
                'Creation failed'
            );
        });
    });

    describe('edge cases', () => {
        it('should handle missing snapshot manager gracefully', () => {
            const managerWithoutSnapshots = new InitialSnapshotManager(null);
            expect(managerWithoutSnapshots.snapshotManager).toBeNull();
        });

        it('should handle empty base path', async () => {
            resolve.mockImplementation(path => path || '/');

            const result = await manager.createInitialSnapshot('');
            // Should still attempt to process, resolved path will be used
            expect(resolve).toHaveBeenCalled();
        });

        it('should handle concurrent initial snapshot creation', async () => {
            // This tests that multiple calls don't interfere with each other
            const promise1 = manager.createInitialSnapshot('/test/project1');
            const promise2 = manager.createInitialSnapshot('/test/project2');

            const results = await Promise.all([promise1, promise2]);

            // Both should resolve (though they might be null based on conditions)
            expect(results).toHaveLength(2);
        });
    });
});
