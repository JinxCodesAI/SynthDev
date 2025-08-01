import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    InternalDataManager,
    getInternalDataManager,
} from '../../../../src/core/managers/InternalDataManager.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// Mock fs module
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

describe('InternalDataManager', () => {
    let internalDataManager;
    const testBasePath = resolve('/test/workspace');

    beforeEach(() => {
        vi.clearAllMocks();
        internalDataManager = new InternalDataManager(testBasePath);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct paths', () => {
            expect(internalDataManager.basePath).toBe(testBasePath);
            expect(internalDataManager.synthdevDir).toBe(join(testBasePath, '.synthdev'));
            expect(internalDataManager.directories.root).toBe(join(testBasePath, '.synthdev'));
            expect(internalDataManager.directories.index).toBe(
                join(testBasePath, '.synthdev', 'index')
            );
            expect(internalDataManager.directories.snapshots).toBe(
                join(testBasePath, '.synthdev', 'snapshots')
            );
        });
    });

    describe('initialize', () => {
        it('should create all internal directories', () => {
            existsSync.mockReturnValue(false);
            mkdirSync.mockReturnValue(undefined);

            const result = internalDataManager.initialize();

            expect(result.success).toBe(true);
            expect(mkdirSync).toHaveBeenCalledWith(join(testBasePath, '.synthdev'), {
                recursive: true,
            });
            expect(mkdirSync).toHaveBeenCalledWith(join(testBasePath, '.synthdev', 'index'), {
                recursive: true,
            });
            expect(mkdirSync).toHaveBeenCalledWith(join(testBasePath, '.synthdev', 'snapshots'), {
                recursive: true,
            });
        });

        it('should skip creating existing directories', () => {
            existsSync.mockReturnValue(true);

            const result = internalDataManager.initialize();

            expect(result.success).toBe(true);
            expect(mkdirSync).not.toHaveBeenCalled();
        });

        it('should handle initialization errors', () => {
            existsSync.mockReturnValue(false);
            mkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = internalDataManager.initialize();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });
    });

    describe('getInternalPath', () => {
        it('should return correct path for directory type', () => {
            const path = internalDataManager.getInternalPath('index');
            expect(path).toBe(join(testBasePath, '.synthdev', 'index'));
        });

        it('should return correct path for file', () => {
            const path = internalDataManager.getInternalPath('index', 'codebase-index.json');
            expect(path).toBe(join(testBasePath, '.synthdev', 'index', 'codebase-index.json'));
        });

        it('should throw error for unknown directory type', () => {
            expect(() => {
                internalDataManager.getInternalPath('unknown');
            }).toThrow('Unknown internal directory type: unknown');
        });
    });

    describe('readInternalFile', () => {
        it('should read file successfully', () => {
            const testContent = 'test content';
            existsSync.mockReturnValue(true);
            readFileSync.mockReturnValue(testContent);

            const result = internalDataManager.readInternalFile('index', 'test.txt');

            expect(result.success).toBe(true);
            expect(result.content).toBe(testContent);
            expect(readFileSync).toHaveBeenCalledWith(
                join(testBasePath, '.synthdev', 'index', 'test.txt'),
                'utf8'
            );
        });

        it('should parse JSON when requested', () => {
            const testData = { key: 'value' };
            const testContent = JSON.stringify(testData);
            existsSync.mockReturnValue(true);
            readFileSync.mockReturnValue(testContent);

            const result = internalDataManager.readInternalFile('index', 'test.json', {
                parseJson: true,
            });

            expect(result.success).toBe(true);
            expect(result.data).toEqual(testData);
        });

        it('should handle file not found', () => {
            existsSync.mockReturnValue(false);

            const result = internalDataManager.readInternalFile('index', 'missing.txt');

            expect(result.success).toBe(false);
            expect(result.error).toBe('File not found');
        });

        it('should handle JSON parse errors', () => {
            existsSync.mockReturnValue(true);
            readFileSync.mockReturnValue('invalid json');

            const result = internalDataManager.readInternalFile('index', 'test.json', {
                parseJson: true,
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('JSON parse error');
        });
    });

    describe('writeInternalFile', () => {
        it('should write file successfully', () => {
            const testContent = 'test content';
            existsSync.mockReturnValue(true);
            writeFileSync.mockReturnValue(undefined);
            statSync.mockReturnValue({ size: testContent.length });

            const result = internalDataManager.writeInternalFile('index', 'test.txt', testContent);

            expect(result.success).toBe(true);
            expect(result.size).toBe(testContent.length);
            expect(writeFileSync).toHaveBeenCalledWith(
                join(testBasePath, '.synthdev', 'index', 'test.txt'),
                testContent,
                'utf8'
            );
        });

        it('should stringify JSON when requested', () => {
            const testData = { key: 'value' };
            const expectedContent = JSON.stringify(testData, null, 2);
            existsSync.mockReturnValue(true);
            writeFileSync.mockReturnValue(undefined);
            statSync.mockReturnValue({ size: expectedContent.length });

            const result = internalDataManager.writeInternalFile('index', 'test.json', testData, {
                stringifyJson: true,
            });

            expect(result.success).toBe(true);
            expect(writeFileSync).toHaveBeenCalledWith(
                join(testBasePath, '.synthdev', 'index', 'test.json'),
                expectedContent,
                'utf8'
            );
        });

        it('should handle write errors', () => {
            writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const result = internalDataManager.writeInternalFile('index', 'test.txt', 'content');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Write failed');
        });
    });

    describe('internalFileExists', () => {
        it('should return true for existing file', () => {
            existsSync.mockReturnValue(true);

            const exists = internalDataManager.internalFileExists('index', 'test.txt');

            expect(exists).toBe(true);
            expect(existsSync).toHaveBeenCalledWith(
                join(testBasePath, '.synthdev', 'index', 'test.txt')
            );
        });

        it('should return false for non-existing file', () => {
            existsSync.mockReturnValue(false);

            const exists = internalDataManager.internalFileExists('index', 'missing.txt');

            expect(exists).toBe(false);
        });

        it('should handle errors gracefully', () => {
            existsSync.mockImplementation(() => {
                throw new Error('Access denied');
            });

            const exists = internalDataManager.internalFileExists('index', 'test.txt');

            expect(exists).toBe(false);
        });
    });

    describe('singleton function', () => {
        it('should return same instance', () => {
            const instance1 = getInternalDataManager();
            const instance2 = getInternalDataManager();

            expect(instance1).toBe(instance2);
        });

        it('should create new instance with different base path', () => {
            const instance1 = getInternalDataManager('/path1');
            const instance2 = getInternalDataManager('/path2');

            expect(instance1).not.toBe(instance2);
            expect(instance1.basePath).not.toBe(instance2.basePath);
        });
    });
});
