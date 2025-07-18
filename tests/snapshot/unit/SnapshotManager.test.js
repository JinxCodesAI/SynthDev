/**
 * Unit tests for SnapshotManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    })
}));

describe('SnapshotManager', () => {
    let snapshotManager;
    let mockStore;
    let mockFileBackup;
    let mockFileFilter;
    let mockConfig;

    beforeEach(() => {
        // Mock store
        mockStore = {
            store: vi.fn(),
            retrieve: vi.fn(),
            list: vi.fn(),
            delete: vi.fn(),
            exists: vi.fn()
        };

        // Mock file backup
        mockFileBackup = {
            captureFiles: vi.fn(),
            restoreFiles: vi.fn(),
            previewRestore: vi.fn(),
            config: {}
        };

        // Mock file filter
        mockFileFilter = {
            shouldIncludeFile: vi.fn(),
            shouldIncludeDirectory: vi.fn(),
            updateConfiguration: vi.fn()
        };

        // Mock config
        mockConfig = {
            preservePermissions: true,
            createBackups: true
        };

        snapshotManager = new SnapshotManager(
            mockStore,
            mockFileBackup,
            mockFileFilter,
            mockConfig
        );
    });

    describe('constructor', () => {
        it('should initialize with all dependencies', () => {
            expect(snapshotManager.store).toBe(mockStore);
            expect(snapshotManager.fileBackup).toBe(mockFileBackup);
            expect(snapshotManager.fileFilter).toBe(mockFileFilter);
            expect(snapshotManager.config).toBe(mockConfig);
        });

        it('should work with null dependencies', () => {
            const manager = new SnapshotManager(null, null, null, {});
            expect(manager.store).toBeNull();
            expect(manager.fileBackup).toBeNull();
            expect(manager.fileFilter).toBeNull();
        });
    });

    describe('createSnapshot', () => {
        it('should create snapshot with description', async () => {
            const mockCaptureResult = {
                basePath: process.cwd(),
                timestamp: '2023-01-01T10:00:00Z',
                files: {
                    'test.js': { content: 'console.log("test");' }
                },
                stats: {
                    totalFiles: 1,
                    totalSize: 20,
                    skippedFiles: 0,
                    errors: []
                }
            };
            mockFileBackup.captureFiles.mockResolvedValue(mockCaptureResult);
            mockStore.store.mockResolvedValue('snapshot-123');

            const result = await snapshotManager.createSnapshot('Test snapshot');

            expect(result).toEqual({
                id: 'snapshot-123',
                description: 'Test snapshot',
                timestamp: expect.any(String),
                fileCount: 1,
                totalSize: 20
            });

            expect(mockFileBackup.captureFiles).toHaveBeenCalledWith(
                process.cwd(),
                expect.objectContaining({
                    includeMetadata: true,
                    preservePermissions: true
                })
            );

            expect(mockStore.store).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: 'Test snapshot',
                    files: mockCaptureResult.files,
                    metadata: expect.objectContaining({
                        basePath: process.cwd(),
                        createdBy: 'manual',
                        version: '1.0.0'
                    })
                })
            );
        });

        it('should create snapshot with custom metadata', async () => {
            const mockFileData = {};
            mockFileBackup.captureFiles.mockResolvedValue(mockFileData);
            mockStore.store.mockResolvedValue('snapshot-456');

            const customMetadata = { author: 'test-user', tags: ['important'] };
            const result = await snapshotManager.createSnapshot('Test snapshot', customMetadata);

            expect(mockStore.store).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        author: 'test-user',
                        tags: ['important']
                    })
                })
            );
        });

        it('should handle file capture failure gracefully', async () => {
            mockFileBackup.captureFiles.mockRejectedValue(new Error('Capture failed'));
            mockStore.store.mockResolvedValue('snapshot-789');

            const result = await snapshotManager.createSnapshot('Test snapshot');

            expect(result.fileCount).toBe(0);
            expect(mockStore.store).toHaveBeenCalledWith(
                expect.objectContaining({
                    files: {}
                })
            );
        });

        it('should work without file backup/filter components', async () => {
            const manager = new SnapshotManager(mockStore, null, null, {});
            mockStore.store.mockResolvedValue('snapshot-no-files');

            const result = await manager.createSnapshot('Test snapshot');

            expect(result.fileCount).toBe(0);
            expect(result.id).toBe('snapshot-no-files');
        });

        it('should reject invalid description', async () => {
            await expect(snapshotManager.createSnapshot('')).rejects.toThrow(
                'Snapshot description is required and must be a string'
            );

            await expect(snapshotManager.createSnapshot(null)).rejects.toThrow(
                'Snapshot description is required and must be a string'
            );

            await expect(snapshotManager.createSnapshot(123)).rejects.toThrow(
                'Snapshot description is required and must be a string'
            );
        });
    });

    describe('listSnapshots', () => {
        it('should list snapshots with default options', async () => {
            const mockSnapshots = [
                {
                    id: 'snap-1',
                    description: 'First snapshot',
                    timestamp: '2023-01-01T10:00:00.000Z',
                    size: 1024
                },
                {
                    id: 'snap-2',
                    description: 'Second snapshot',
                    timestamp: '2023-01-01T11:00:00.000Z',
                    size: 2048
                }
            ];

            mockStore.list.mockResolvedValue(mockSnapshots);

            const result = await snapshotManager.listSnapshots();

            expect(mockStore.list).toHaveBeenCalledWith({
                filter: undefined,
                sortBy: 'timestamp',
                sortOrder: 'desc',
                limit: undefined
            });

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(
                expect.objectContaining({
                    id: 'snap-1',
                    description: 'First snapshot',
                    age: expect.any(String),
                    sizeFormatted: '1.0 KB'
                })
            );
        });

        it('should pass through filtering options', async () => {
            mockStore.list.mockResolvedValue([]);

            const options = {
                filter: { description: 'test' },
                sortBy: 'description',
                sortOrder: 'asc',
                limit: 10
            };

            await snapshotManager.listSnapshots(options);

            expect(mockStore.list).toHaveBeenCalledWith(options);
        });
    });

    describe('restoreSnapshot', () => {
        it('should restore snapshot successfully', async () => {
            const mockSnapshot = {
                id: 'snap-1',
                description: 'Test snapshot',
                timestamp: '2023-01-01T10:00:00.000Z',
                basePath: '/test/path',
                files: { 'test.js': { content: 'console.log("test");' } }
            };

            const mockRestoreResult = {
                snapshotId: 'snap-1',
                filesRestored: 1,
                errors: []
            };

            mockStore.retrieve.mockResolvedValue(mockSnapshot);
            mockFileBackup.restoreFiles.mockResolvedValue(mockRestoreResult);

            const result = await snapshotManager.restoreSnapshot('snap-1');

            expect(mockStore.retrieve).toHaveBeenCalledWith('snap-1');
            expect(mockFileBackup.restoreFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshotId: 'snap-1',
                    description: 'Test snapshot',
                    basePath: '/test/path',
                    files: mockSnapshot.files
                }),
                expect.objectContaining({
                    createBackup: true,
                    overwriteExisting: true,
                    preservePermissions: true,
                    rollbackOnFailure: true
                })
            );

            expect(result).toBe(mockRestoreResult);
        });

        it('should handle non-existent snapshot', async () => {
            mockStore.retrieve.mockResolvedValue(null);

            await expect(snapshotManager.restoreSnapshot('non-existent')).rejects.toThrow(
                'Snapshot with ID non-existent not found'
            );
        });

        it('should handle snapshot without file data', async () => {
            const mockSnapshot = {
                id: 'snap-empty',
                description: 'Empty snapshot',
                fileData: {}
            };

            mockStore.retrieve.mockResolvedValue(mockSnapshot);

            await expect(snapshotManager.restoreSnapshot('snap-empty')).rejects.toThrow(
                'Snapshot contains no file data to restore'
            );
        });

        it('should reject invalid snapshot ID', async () => {
            await expect(snapshotManager.restoreSnapshot('')).rejects.toThrow(
                'Snapshot ID is required and must be a string'
            );

            await expect(snapshotManager.restoreSnapshot(null)).rejects.toThrow(
                'Snapshot ID is required and must be a string'
            );
        });
    });

    describe('deleteSnapshot', () => {
        it('should delete existing snapshot', async () => {
            const mockSnapshot = {
                description: 'Test snapshot',
                timestamp: '2023-01-01T10:00:00.000Z',
                fileData: { 'test.js': 'content' }
            };

            mockStore.exists.mockResolvedValue(true);
            mockStore.retrieve.mockResolvedValue(mockSnapshot);
            mockStore.delete.mockResolvedValue(true);

            const result = await snapshotManager.deleteSnapshot('snap-1');

            expect(result).toBe(true);
            expect(mockStore.exists).toHaveBeenCalledWith('snap-1');
            expect(mockStore.delete).toHaveBeenCalledWith('snap-1');
        });

        it('should return false for non-existent snapshot', async () => {
            mockStore.exists.mockResolvedValue(false);

            const result = await snapshotManager.deleteSnapshot('non-existent');

            expect(result).toBe(false);
            expect(mockStore.delete).not.toHaveBeenCalled();
        });

        it('should reject invalid snapshot ID', async () => {
            await expect(snapshotManager.deleteSnapshot('')).rejects.toThrow(
                'Snapshot ID is required and must be a string'
            );
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration and notify components', () => {
            const newConfig = {
                preservePermissions: false,
                fileFilter: { maxFileSize: 5000000 },
                fileBackup: { createBackups: false }
            };

            snapshotManager.updateConfiguration(newConfig);

            expect(snapshotManager.config).toEqual(
                expect.objectContaining(newConfig)
            );

            expect(mockFileFilter.updateConfiguration).toHaveBeenCalledWith(
                newConfig.fileFilter
            );

            expect(mockFileBackup.config.createBackups).toBe(false);
        });

        it('should handle component update failures gracefully', () => {
            mockFileFilter.updateConfiguration.mockImplementation(() => {
                throw new Error('Filter update failed');
            });

            const newConfig = { fileFilter: { maxFileSize: 1000 } };

            expect(() => snapshotManager.updateConfiguration(newConfig)).not.toThrow();
        });

        it('should reject invalid configuration', () => {
            expect(() => snapshotManager.updateConfiguration(null)).toThrow(
                'Configuration must be a valid object'
            );

            expect(() => snapshotManager.updateConfiguration('invalid')).toThrow(
                'Configuration must be a valid object'
            );
        });
    });

    describe('utility methods', () => {
        it('should calculate data size correctly', () => {
            const data = { test: 'data' };
            const size = snapshotManager._calculateDataSize(data);
            expect(size).toBeGreaterThan(0);
            expect(typeof size).toBe('number');
        });

        it('should format size correctly', () => {
            expect(snapshotManager._formatSize(0)).toBe('0 B');
            expect(snapshotManager._formatSize(1024)).toBe('1.0 KB');
            expect(snapshotManager._formatSize(1048576)).toBe('1.0 MB');
            expect(snapshotManager._formatSize(1073741824)).toBe('1.0 GB');
        });

        it('should calculate age correctly', () => {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            expect(snapshotManager._calculateAge(oneHourAgo.toISOString())).toContain('hour');
            expect(snapshotManager._calculateAge(oneDayAgo.toISOString())).toContain('day');
        });
    });
});
