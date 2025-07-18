/**
 * Unit tests for ConfigLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigLoader } from '../../../src/core/config/ConfigLoader.js';
import { promises as fs } from 'fs';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    })
}));

// Mock fs module
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn()
    }
}));

describe('ConfigLoader', () => {
    let configLoader;
    let mockFs;

    beforeEach(async () => {
        configLoader = new ConfigLoader();
        mockFs = await import('fs');
        
        // Clear cache before each test
        configLoader.clearCache();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('loadSnapshotDefaults', () => {
        it('should load valid snapshot defaults configuration', async () => {
            const mockConfig = {
                version: '1.0.0',
                storage: {
                    maxSnapshots: 50,
                    maxMemoryMB: 100,
                    cleanupStrategy: 'oldest_first',
                    cleanupThreshold: 0.8
                },
                fileHandling: {
                    maxFileSize: 10485760,
                    preservePermissions: true,
                    createBackups: true,
                    binaryFileHandling: 'exclude',
                    encoding: 'utf8'
                }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const result = await configLoader.loadSnapshotDefaults();

            expect(result).toEqual(mockConfig);
            expect(mockFs.promises.readFile).toHaveBeenCalledWith(
                expect.stringContaining('snapshot-defaults.json'),
                'utf8'
            );
        });

        it('should merge configuration overrides', async () => {
            const mockConfig = {
                version: '1.0.0',
                storage: {
                    maxSnapshots: 50,
                    maxMemoryMB: 100
                },
                fileHandling: {
                    maxFileSize: 10485760,
                    preservePermissions: true,
                    createBackups: true
                }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const overrides = {
                storage: {
                    maxSnapshots: 100
                },
                fileHandling: {
                    maxFileSize: 20971520
                }
            };

            const result = await configLoader.loadSnapshotDefaults(overrides);

            expect(result.storage.maxSnapshots).toBe(100);
            expect(result.storage.maxMemoryMB).toBe(100); // Should keep original
            expect(result.fileHandling.maxFileSize).toBe(20971520);
            expect(result.fileHandling.preservePermissions).toBe(true); // Should keep original
        });

        it('should return default configuration when file not found', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            mockFs.promises.readFile.mockRejectedValue(error);

            const result = await configLoader.loadSnapshotDefaults();

            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('storage');
            expect(result).toHaveProperty('fileHandling');
            expect(result.storage.maxSnapshots).toBe(50);
        });

        it('should return default configuration when JSON is invalid', async () => {
            mockFs.promises.readFile.mockResolvedValue('invalid json');

            const result = await configLoader.loadSnapshotDefaults();

            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('storage');
            expect(result).toHaveProperty('fileHandling');
        });

        it('should validate required configuration fields', async () => {
            const invalidConfig = {
                version: '1.0.0'
                // Missing storage and fileHandling
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            const result = await configLoader.loadSnapshotDefaults();

            // Should fall back to defaults
            expect(result).toHaveProperty('storage');
            expect(result).toHaveProperty('fileHandling');
        });

        it('should cache configuration after first load', async () => {
            const mockConfig = {
                version: '1.0.0',
                storage: { maxSnapshots: 50, maxMemoryMB: 100 },
                fileHandling: { maxFileSize: 10485760, preservePermissions: true, createBackups: true }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            // First load
            await configLoader.loadSnapshotDefaults();
            
            // Second load
            await configLoader.loadSnapshotDefaults();

            // Should only read file once
            expect(mockFs.promises.readFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadFileFilters', () => {
        it('should load valid file filters configuration', async () => {
            const mockConfig = {
                version: '1.0.0',
                defaultExclusions: ['node_modules/**', '.git/**'],
                defaultInclusions: ['src/**', '*.js'],
                binaryExtensions: ['.exe', '.jpg']
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const result = await configLoader.loadFileFilters();

            expect(result).toEqual(mockConfig);
            expect(mockFs.promises.readFile).toHaveBeenCalledWith(
                expect.stringContaining('file-filters.json'),
                'utf8'
            );
        });

        it('should return default filters when file not found', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            mockFs.promises.readFile.mockRejectedValue(error);

            const result = await configLoader.loadFileFilters();

            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('defaultExclusions');
            expect(result).toHaveProperty('defaultInclusions');
            expect(result).toHaveProperty('binaryExtensions');
            expect(Array.isArray(result.defaultExclusions)).toBe(true);
        });

        it('should merge filter overrides', async () => {
            const mockConfig = {
                version: '1.0.0',
                defaultExclusions: ['node_modules/**'],
                defaultInclusions: ['src/**'],
                binaryExtensions: ['.exe']
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const overrides = {
                defaultExclusions: ['node_modules/**', '*.tmp']
            };

            const result = await configLoader.loadFileFilters(overrides);

            expect(result.defaultExclusions).toEqual(['node_modules/**', '*.tmp']);
            expect(result.defaultInclusions).toEqual(['src/**']); // Should keep original
        });
    });

    describe('loadSnapshotMessages', () => {
        it('should load snapshot messages configuration', async () => {
            const mockMessages = {
                version: '1.0.0',
                commands: {
                    create: {
                        prompts: {
                            description: 'Enter snapshot description: '
                        }
                    }
                }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockMessages));

            const result = await configLoader.loadSnapshotMessages();

            expect(result).toEqual(mockMessages);
            expect(mockFs.promises.readFile).toHaveBeenCalledWith(
                expect.stringContaining('snapshot-messages.json'),
                'utf8'
            );
        });

        it('should return default messages when file not found', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            mockFs.promises.readFile.mockRejectedValue(error);

            const result = await configLoader.loadSnapshotMessages();

            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('commands');
        });

        it('should cache messages by locale', async () => {
            const mockMessages = {
                version: '1.0.0',
                commands: {}
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockMessages));

            // Load for default locale
            await configLoader.loadSnapshotMessages();
            
            // Load again for same locale
            await configLoader.loadSnapshotMessages('en');

            // Should only read file once
            expect(mockFs.promises.readFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadUserConfig', () => {
        it('should load user configuration file', async () => {
            const mockUserConfig = {
                storage: {
                    maxSnapshots: 25
                }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockUserConfig));

            const result = await configLoader.loadUserConfig('/path/to/user/config.json');

            expect(result).toEqual(mockUserConfig);
        });

        it('should return empty object when user config not found', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            mockFs.promises.readFile.mockRejectedValue(error);

            const result = await configLoader.loadUserConfig('/path/to/nonexistent.json');

            expect(result).toEqual({});
        });

        it('should return empty object when no path provided', async () => {
            const result = await configLoader.loadUserConfig();

            expect(result).toEqual({});
            expect(mockFs.promises.readFile).not.toHaveBeenCalled();
        });
    });

    describe('clearCache', () => {
        it('should clear configuration cache', async () => {
            const mockConfig = {
                version: '1.0.0',
                storage: { maxSnapshots: 50, maxMemoryMB: 100 },
                fileHandling: { maxFileSize: 10485760, preservePermissions: true, createBackups: true }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            // Load configuration to populate cache
            await configLoader.loadSnapshotDefaults();
            
            // Clear cache
            configLoader.clearCache();
            
            // Load again - should read file again
            await configLoader.loadSnapshotDefaults();

            expect(mockFs.promises.readFile).toHaveBeenCalledTimes(2);
        });
    });

    describe('configuration merging', () => {
        it('should handle deep merging of nested objects', async () => {
            const mockConfig = {
                version: '1.0.0',
                storage: {
                    maxSnapshots: 50,
                    maxMemoryMB: 100,
                    cleanupStrategy: 'oldest_first'
                },
                fileHandling: {
                    maxFileSize: 10485760,
                    preservePermissions: true
                }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const overrides = {
                storage: {
                    maxSnapshots: 75
                    // Should keep maxMemoryMB and cleanupStrategy
                },
                newSection: {
                    newProperty: 'value'
                }
            };

            const result = await configLoader.loadSnapshotDefaults(overrides);

            expect(result.storage.maxSnapshots).toBe(75);
            expect(result.storage.maxMemoryMB).toBe(100);
            expect(result.storage.cleanupStrategy).toBe('oldest_first');
            expect(result.fileHandling.maxFileSize).toBe(10485760);
            expect(result.newSection.newProperty).toBe('value');
        });

        it('should handle array overrides correctly', async () => {
            const mockConfig = {
                version: '1.0.0',
                defaultExclusions: ['node_modules/**', '.git/**'],
                defaultInclusions: ['src/**']
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const overrides = {
                defaultExclusions: ['node_modules/**', '.git/**', '*.tmp']
            };

            const result = await configLoader.loadFileFilters(overrides);

            expect(result.defaultExclusions).toEqual(['node_modules/**', '.git/**', '*.tmp']);
            expect(result.defaultInclusions).toContain('src/**');
        });
    });
});
