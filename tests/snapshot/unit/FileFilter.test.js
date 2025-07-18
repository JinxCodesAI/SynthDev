/**
 * Unit tests for FileFilter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileFilter } from '../../../src/core/snapshot/FileFilter.js';

// Mock the logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    })
}));

// Mock minimatch
vi.mock('minimatch', () => ({
    minimatch: vi.fn()
}));

describe('FileFilter', () => {
    let fileFilter;
    let mockConfig;

    beforeEach(() => {
        mockConfig = {
            maxFileSize: 1024 * 1024, // 1MB
            binaryFileHandling: 'exclude',
            customExclusions: ['*.custom'],
            customInclusions: ['important/**']
        };
        fileFilter = new FileFilter(mockConfig);
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            const defaultFilter = new FileFilter();
            expect(defaultFilter.config.maxFileSize).toBe(10 * 1024 * 1024);
            expect(defaultFilter.config.binaryFileHandling).toBe('exclude');
            expect(defaultFilter.exclusionPatterns).toContain('node_modules/**');
            expect(defaultFilter.exclusionPatterns).toContain('.git/**');
        });

        it('should initialize with custom configuration', () => {
            expect(fileFilter.config.maxFileSize).toBe(1024 * 1024);
            expect(fileFilter.config.customExclusions).toEqual(['*.custom']);
            expect(fileFilter.exclusionPatterns).toContain('*.custom');
            expect(fileFilter.inclusionPatterns).toContain('important/**');
        });

        it('should merge default and custom exclusions', () => {
            expect(fileFilter.exclusionPatterns).toContain('node_modules/**');
            expect(fileFilter.exclusionPatterns).toContain('*.custom');
        });
    });

    describe('shouldIncludeFile', () => {
        beforeEach(async () => {
            // Mock minimatch
            const { minimatch } = await import('minimatch');
            minimatch.mockClear();
        });

        it('should exclude files exceeding size limit', () => {
            const stats = { size: 2 * 1024 * 1024 }; // 2MB
            const result = fileFilter.shouldIncludeFile('test.js', stats);
            expect(result).toBe(false);
        });

        it('should include files within size limit', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockReturnValue(false); // No pattern matches

            const stats = { size: 512 * 1024 }; // 512KB
            const result = fileFilter.shouldIncludeFile('test.js', stats);
            expect(result).toBe(true);
        });

        it('should include files matching inclusion patterns', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockImplementation((path, pattern) => {
                return pattern === 'important/**' && path.startsWith('important/');
            });

            const stats = { size: 1024 };
            const result = fileFilter.shouldIncludeFile('important/file.js', stats);
            expect(result).toBe(true);
        });

        it('should exclude files matching exclusion patterns', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockImplementation((path, pattern) => {
                return pattern === 'node_modules/**' && path.includes('node_modules');
            });

            const stats = { size: 1024 };
            const result = fileFilter.shouldIncludeFile('node_modules/package/file.js', stats);
            expect(result).toBe(false);
        });

        it('should normalize Windows paths', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockReturnValue(false);

            const stats = { size: 1024 };
            const result = fileFilter.shouldIncludeFile('src\\components\\test.js', stats);
            
            expect(minimatch).toHaveBeenCalledWith(
                'src/components/test.js',
                expect.any(String),
                expect.any(Object)
            );
            expect(result).toBe(true);
        });

        it('should handle errors gracefully', () => {
            const stats = null; // This might cause an error
            const result = fileFilter.shouldIncludeFile('test.js', stats);
            expect(result).toBe(true); // Should still work without stats
        });
    });

    describe('shouldIncludeDirectory', () => {
        beforeEach(async () => {
            // Mock minimatch
            const { minimatch } = await import('minimatch');
            minimatch.mockClear();
        });

        it('should include directories matching inclusion patterns', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockImplementation((path, pattern) => {
                return pattern === 'important/**' && path.startsWith('important');
            });

            const stats = { isDirectory: () => true };
            const result = fileFilter.shouldIncludeDirectory('important', stats);
            expect(result).toBe(true);
        });

        it('should exclude directories matching exclusion patterns', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockImplementation((path, pattern) => {
                return pattern === 'node_modules/**' && path === 'node_modules';
            });

            const stats = { isDirectory: () => true };
            const result = fileFilter.shouldIncludeDirectory('node_modules', stats);
            expect(result).toBe(false);
        });

        it('should include directories by default when no patterns match', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockReturnValue(false);

            const stats = { isDirectory: () => true };
            const result = fileFilter.shouldIncludeDirectory('src', stats);
            expect(result).toBe(true);
        });

        it('should normalize Windows paths', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockReturnValue(false);

            const stats = { isDirectory: () => true };
            const result = fileFilter.shouldIncludeDirectory('src\\components', stats);
            
            expect(minimatch).toHaveBeenCalledWith(
                'src/components',
                expect.any(String),
                expect.any(Object)
            );
            expect(result).toBe(true);
        });
    });

    describe('addExclusionPattern', () => {
        it('should add new exclusion pattern', () => {
            const initialCount = fileFilter.exclusionPatterns.length;
            fileFilter.addExclusionPattern('*.unique-temp');

            expect(fileFilter.exclusionPatterns).toHaveLength(initialCount + 1);
            expect(fileFilter.exclusionPatterns).toContain('*.unique-temp');
        });

        it('should not add duplicate patterns', () => {
            fileFilter.addExclusionPattern('*.temp');
            const countAfterFirst = fileFilter.exclusionPatterns.length;
            
            fileFilter.addExclusionPattern('*.temp');
            expect(fileFilter.exclusionPatterns).toHaveLength(countAfterFirst);
        });
    });

    describe('removeExclusionPattern', () => {
        it('should remove existing exclusion pattern', () => {
            fileFilter.addExclusionPattern('*.temp');
            expect(fileFilter.exclusionPatterns).toContain('*.temp');
            
            fileFilter.removeExclusionPattern('*.temp');
            expect(fileFilter.exclusionPatterns).not.toContain('*.temp');
        });

        it('should handle removal of non-existent pattern', () => {
            const initialCount = fileFilter.exclusionPatterns.length;
            fileFilter.removeExclusionPattern('*.nonexistent');
            
            expect(fileFilter.exclusionPatterns).toHaveLength(initialCount);
        });
    });

    describe('getActivePatterns', () => {
        it('should return current patterns', () => {
            const patterns = fileFilter.getActivePatterns();
            
            expect(patterns).toHaveProperty('exclusions');
            expect(patterns).toHaveProperty('inclusions');
            expect(Array.isArray(patterns.exclusions)).toBe(true);
            expect(Array.isArray(patterns.inclusions)).toBe(true);
            expect(patterns.exclusions).toContain('node_modules/**');
            expect(patterns.inclusions).toContain('important/**');
        });

        it('should return copies of pattern arrays', () => {
            const patterns = fileFilter.getActivePatterns();
            
            patterns.exclusions.push('*.test');
            patterns.inclusions.push('*.test');
            
            // Original arrays should be unchanged
            expect(fileFilter.exclusionPatterns).not.toContain('*.test');
            expect(fileFilter.inclusionPatterns).not.toContain('*.test');
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration and rebuild patterns', () => {
            const newConfig = {
                maxFileSize: 5 * 1024 * 1024,
                customExclusions: ['*.new'],
                customInclusions: ['special/**']
            };

            fileFilter.updateConfiguration(newConfig);

            expect(fileFilter.config.maxFileSize).toBe(5 * 1024 * 1024);
            expect(fileFilter.exclusionPatterns).toContain('*.new');
            expect(fileFilter.inclusionPatterns).toContain('special/**');
        });

        it('should merge with existing configuration', () => {
            const newConfig = {
                maxFileSize: 2 * 1024 * 1024
            };

            fileFilter.updateConfiguration(newConfig);

            expect(fileFilter.config.maxFileSize).toBe(2 * 1024 * 1024);
            expect(fileFilter.config.binaryFileHandling).toBe('exclude'); // Should retain original
        });

        it('should reject invalid configuration', () => {
            expect(() => fileFilter.updateConfiguration(null)).toThrow(
                'Filter configuration must be a valid object'
            );

            expect(() => fileFilter.updateConfiguration('invalid')).toThrow(
                'Filter configuration must be a valid object'
            );
        });
    });

    describe('_matchesPatterns', () => {
        beforeEach(async () => {
            // Mock minimatch
            const { minimatch } = await import('minimatch');
            minimatch.mockClear();
        });

        it('should return false for empty patterns', () => {
            const result = fileFilter._matchesPatterns('test.js', []);
            expect(result).toBe(false);
        });

        it('should return false for null patterns', () => {
            const result = fileFilter._matchesPatterns('test.js', null);
            expect(result).toBe(false);
        });

        it('should use minimatch for pattern matching', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockReturnValue(true);

            const result = fileFilter._matchesPatterns('test.js', ['*.js']);
            
            expect(minimatch).toHaveBeenCalledWith('test.js', '*.js', {
                dot: true,
                matchBase: true
            });
            expect(result).toBe(true);
        });

        it('should normalize path separators', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockReturnValue(false);

            fileFilter._matchesPatterns('src\\test.js', ['*.js']);
            
            expect(minimatch).toHaveBeenCalledWith('src/test.js', '*.js', expect.any(Object));
        });

        it('should handle invalid patterns gracefully', async () => {
            const { minimatch } = await import('minimatch');
            minimatch.mockImplementation(() => {
                throw new Error('Invalid pattern');
            });

            const result = fileFilter._matchesPatterns('test.js', ['[invalid']);
            expect(result).toBe(false);
        });
    });

    describe('_isBinaryFile', () => {
        it('should detect binary files by extension', async () => {
            const result = await fileFilter._isBinaryFile('image.jpg');
            expect(result).toBe(true);
        });

        it('should detect text files by extension', async () => {
            const result = await fileFilter._isBinaryFile('script.js');
            expect(result).toBe(false);
        });

        it('should detect more binary file extensions', async () => {
            expect(await fileFilter._isBinaryFile('app.exe')).toBe(true);
            expect(await fileFilter._isBinaryFile('lib.dll')).toBe(true);
            expect(await fileFilter._isBinaryFile('archive.zip')).toBe(true);
            expect(await fileFilter._isBinaryFile('document.pdf')).toBe(true);
        });

        it('should detect text files by extension', async () => {
            expect(await fileFilter._isBinaryFile('script.js')).toBe(false);
            expect(await fileFilter._isBinaryFile('style.css')).toBe(false);
            expect(await fileFilter._isBinaryFile('document.html')).toBe(false);
            expect(await fileFilter._isBinaryFile('data.json')).toBe(false);
            expect(await fileFilter._isBinaryFile('readme.md')).toBe(false);
        });
    });
});
