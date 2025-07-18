import { describe, it, expect, beforeEach } from 'vitest';
import { FileFilter } from '../../../src/core/snapshot/FileFilter.js';

describe('FileFilter', () => {
    let filter;

    beforeEach(() => {
        filter = new FileFilter({
            maxFileSize: 1024 * 1024, // 1MB
            binaryFileHandling: 'exclude',
        });
    });

    describe('constructor', () => {
        it('should initialize with default exclusion patterns', () => {
            const defaultFilter = new FileFilter();
            const patterns = defaultFilter.getActivePatterns();
            expect(patterns).toContain('node_modules/**');
            expect(patterns).toContain('.git/**');
            expect(patterns).toContain('dist/**');
        });

        it('should accept custom configuration', () => {
            expect(filter.config.maxFileSize).toBe(1024 * 1024);
            expect(filter.config.binaryFileHandling).toBe('exclude');
        });
    });

    describe('shouldIncludeFile', () => {
        it('should include regular files', () => {
            const mockStats = {
                isDirectory: () => false,
                isSymbolicLink: () => false,
                size: 1024,
            };

            const result = filter.shouldIncludeFile('/test/file.txt', mockStats);
            expect(result).toBe(true);
        });

        it('should exclude directories', () => {
            const mockStats = {
                isDirectory: () => true,
                isSymbolicLink: () => false,
                size: 0,
            };

            const result = filter.shouldIncludeFile('/test/dir', mockStats);
            expect(result).toBe(false);
        });

        it('should exclude files that are too large', () => {
            const mockStats = {
                isDirectory: () => false,
                isSymbolicLink: () => false,
                size: 2 * 1024 * 1024, // 2MB
            };

            const result = filter.shouldIncludeFile('/test/large-file.txt', mockStats);
            expect(result).toBe(false);
        });

        it('should exclude symlinks when followSymlinks is false', () => {
            const mockStats = {
                isDirectory: () => false,
                isSymbolicLink: () => true,
                size: 1024,
            };

            const result = filter.shouldIncludeFile('/test/symlink', mockStats);
            expect(result).toBe(false);
        });
    });

    describe('shouldIncludeDirectory', () => {
        it('should include regular directories', () => {
            const mockStats = {
                isDirectory: () => true,
                isSymbolicLink: () => false,
            };

            const result = filter.shouldIncludeDirectory('/test/src', mockStats);
            expect(result).toBe(true);
        });

        it('should exclude non-directories', () => {
            const mockStats = {
                isDirectory: () => false,
                isSymbolicLink: () => false,
            };

            const result = filter.shouldIncludeDirectory('/test/file.txt', mockStats);
            expect(result).toBe(false);
        });
    });

    describe('isExcluded', () => {
        it('should exclude node_modules', () => {
            expect(filter.isExcluded('/some/funny/path/node_modules/package/file.js')).toBe(true);
            expect(filter.isExcluded('node_modules/package/file.js')).toBe(true);
            expect(filter.isExcluded('project/node_modules/package/file.js')).toBe(true);
        });

        it('should exclude .git directories', () => {
            expect(filter.isExcluded('.git/config')).toBe(true);
            expect(filter.isExcluded('project/.git/hooks/pre-commit')).toBe(true);
        });

        it('should exclude build artifacts', () => {
            expect(filter.isExcluded('dist/bundle.js')).toBe(true);
            expect(filter.isExcluded('build/Release/app.exe')).toBe(true);
        });

        it('should exclude temporary files', () => {
            expect(filter.isExcluded('temp.tmp')).toBe(true);
            expect(filter.isExcluded('debug.log')).toBe(true);
        });

        it('should not exclude source files', () => {
            expect(filter.isExcluded('src/main.js')).toBe(false);
            expect(filter.isExcluded('lib/utils.js')).toBe(false);
            expect(filter.isExcluded('README.md')).toBe(false);
        });
    });

    describe('isBinaryFile', () => {
        it('should identify binary files by extension', () => {
            expect(filter.isBinaryFile('image.jpg')).toBe(true);
            expect(filter.isBinaryFile('document.pdf')).toBe(true);
            expect(filter.isBinaryFile('archive.zip')).toBe(true);
            expect(filter.isBinaryFile('executable.exe')).toBe(true);
        });

        it('should not identify text files as binary', () => {
            expect(filter.isBinaryFile('script.js')).toBe(false);
            expect(filter.isBinaryFile('style.css')).toBe(false);
            expect(filter.isBinaryFile('README.md')).toBe(false);
            expect(filter.isBinaryFile('config.json')).toBe(false);
        });

        it('should handle files without extensions', () => {
            expect(filter.isBinaryFile('Makefile')).toBe(false);
            expect(filter.isBinaryFile('dockerfile')).toBe(false);
        });
    });

    describe('getFileExtension', () => {
        it('should extract file extensions correctly', () => {
            expect(filter.getFileExtension('file.txt')).toBe('.txt');
            expect(filter.getFileExtension('image.PNG')).toBe('.png');
            expect(filter.getFileExtension('archive.tar.gz')).toBe('.gz');
        });

        it('should handle files without extensions', () => {
            expect(filter.getFileExtension('Makefile')).toBe('');
            expect(filter.getFileExtension('file.')).toBe('');
        });
    });

    describe('pattern management', () => {
        it('should add custom exclusion patterns', () => {
            const initialCount = filter.exclusionPatterns.length;
            filter.addExclusionPattern('custom/**');
            expect(filter.exclusionPatterns).toHaveLength(initialCount + 1);
            expect(filter.exclusionPatterns).toContain('custom/**');
        });

        it('should not add duplicate patterns', () => {
            const initialCount = filter.exclusionPatterns.length;
            filter.addExclusionPattern('node_modules/**'); // Already exists
            expect(filter.exclusionPatterns).toHaveLength(initialCount);
        });

        it('should remove custom exclusion patterns', () => {
            filter.addExclusionPattern('custom/**');
            const countAfterAdd = filter.exclusionPatterns.length;

            filter.removeExclusionPattern('custom/**');
            expect(filter.exclusionPatterns).toHaveLength(countAfterAdd - 1);
            expect(filter.exclusionPatterns).not.toContain('custom/**');
        });

        it('should get active patterns', () => {
            const patterns = filter.getActivePatterns();
            expect(Array.isArray(patterns)).toBe(true);
            expect(patterns.length).toBeGreaterThan(0);
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration at runtime', () => {
            const newConfig = {
                maxFileSize: 2 * 1024 * 1024,
                binaryFileHandling: 'include',
            };

            filter.updateConfiguration(newConfig);

            expect(filter.config.maxFileSize).toBe(2 * 1024 * 1024);
            expect(filter.config.binaryFileHandling).toBe('include');
        });
    });

    describe('getFilterStats', () => {
        it('should return filter statistics', () => {
            const stats = filter.getFilterStats();
            expect(stats).toMatchObject({
                totalPatterns: expect.any(Number),
                defaultPatterns: expect.any(Number),
                customPatterns: expect.any(Number),
                maxFileSize: expect.any(Number),
                binaryFileHandling: expect.any(String),
                followSymlinks: expect.any(Boolean),
                caseSensitive: expect.any(Boolean),
                binaryExtensions: expect.any(Number),
            });
        });
    });

    describe('testPaths', () => {
        it('should test multiple paths', () => {
            const paths = [
                'src/main.js',
                'node_modules/package/index.js',
                'dist/bundle.js',
                'README.md',
            ];

            const results = filter.testPaths(paths);

            expect(results.included).toContain('src/main.js');
            expect(results.included).toContain('README.md');
            expect(results.excluded).toContain('node_modules/package/index.js');
            expect(results.excluded).toContain('dist/bundle.js');
        });
    });
});
