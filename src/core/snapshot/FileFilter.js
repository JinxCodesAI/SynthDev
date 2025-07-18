/**
 * File filtering component for snapshot system
 * Determines which files should be included in snapshots based on patterns and rules
 */

import { getLogger } from '../../core/managers/logger.js';
import minimatch from 'minimatch';
import { statSync } from 'fs';
import { join } from 'path';

export class FileFilter {
    constructor(config = {}) {
        this.logger = getLogger();

        // Default exclusion patterns
        this.defaultExclusions = [
            // Dependencies
            'node_modules',
            'node_modules/**',
            '**/node_modules',
            '**/node_modules/**',
            '.venv',
            '.venv/**',
            'venv',
            'venv/**',
            'vendor',
            'vendor/**',
            'packages',
            'packages/**',
            'bower_components',
            'bower_components/**',

            // Build artifacts
            'dist',
            'dist/**',
            'build',
            'build/**',
            'target',
            'target/**',
            'bin',
            'bin/**',
            'obj',
            'obj/**',
            'out',
            'out/**',
            '.next',
            '.next/**',
            '.nuxt',
            '.nuxt/**',

            // Version control
            '.git',
            '.git/**',
            '**/.git',
            '**/.git/**',
            '.svn',
            '.svn/**',
            '.hg',
            '.hg/**',
            '.bzr',
            '.bzr/**',

            // IDE files
            '.vscode/**',
            '.idea/**',
            '*.swp',
            '*.swo',
            '*~',
            '.DS_Store',
            'Thumbs.db',

            // Temporary files
            '*.tmp',
            '*.temp',
            '*.log',
            '*.cache',

            // OS files
            '*.pid',
            '*.seed',
            '*.pid.lock',

            // Environment files
            '.env',
            '.env.*',

            // Coverage reports
            'coverage/**',
            '.nyc_output/**',

            // Documentation builds
            'docs/_build/**',
            'site/**',
        ];

        // Configuration with defaults
        this.config = {
            defaultExclusions: config.defaultExclusions || this.defaultExclusions,
            customExclusions: config.customExclusions || [],
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            binaryFileHandling: config.binaryFileHandling || 'exclude', // 'exclude' or 'include'
            followSymlinks: config.followSymlinks || false,
            caseSensitive: config.caseSensitive || false,
            ...config,
        };

        // Combined exclusion patterns
        this.exclusionPatterns = [
            ...this.config.defaultExclusions,
            ...this.config.customExclusions,
        ];

        // Binary file extensions
        this.binaryExtensions = new Set([
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.bmp',
            '.tiff',
            '.webp',
            '.mp3',
            '.wav',
            '.flac',
            '.ogg',
            '.m4a',
            '.mp4',
            '.avi',
            '.mkv',
            '.mov',
            '.wmv',
            '.flv',
            '.exe',
            '.dll',
            '.so',
            '.dylib',
            '.app',
            '.zip',
            '.rar',
            '.7z',
            '.tar',
            '.gz',
            '.bz2',
            '.pdf',
            '.doc',
            '.docx',
            '.xls',
            '.xlsx',
            '.ppt',
            '.pptx',
            '.ico',
            '.icns',
            '.svg',
            '.woff',
            '.woff2',
            '.ttf',
            '.otf',
            '.eot',
        ]);

        this.logger.debug('FileFilter initialized', {
            exclusionPatterns: this.exclusionPatterns.length,
            maxFileSize: this.config.maxFileSize,
            binaryFileHandling: this.config.binaryFileHandling,
        });
    }

    /**
     * Check if a file should be included in snapshots
     * @param {string} filePath - File path to check
     * @param {Object} stats - File stats from fs.stat (optional)
     * @returns {boolean} True if file should be included
     */
    shouldIncludeFile(filePath, stats = null) {
        try {
            // Get file stats if not provided
            if (!stats) {
                try {
                    stats = statSync(filePath);
                } catch (error) {
                    this.logger.warn('Failed to get file stats', {
                        filePath,
                        error: error.message,
                    });
                    return false;
                }
            }

            // Skip directories
            if (stats.isDirectory()) {
                return false;
            }

            // Skip symlinks if not following them
            if (stats.isSymbolicLink() && !this.config.followSymlinks) {
                return false;
            }

            // Check file size
            if (stats.size > this.config.maxFileSize) {
                this.logger.debug('File excluded due to size', {
                    filePath,
                    size: stats.size,
                    maxSize: this.config.maxFileSize,
                });
                return false;
            }

            // Check binary file handling
            if (this.config.binaryFileHandling === 'exclude' && this.isBinaryFile(filePath)) {
                this.logger.debug('Binary file excluded', { filePath });
                return false;
            }

            // Check exclusion patterns
            if (this.isExcluded(filePath)) {
                this.logger.debug('File excluded by pattern', { filePath });
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error(error, 'Error checking file inclusion', { filePath });
            return false;
        }
    }

    /**
     * Check if a directory should be included in snapshots
     * @param {string} dirPath - Directory path to check
     * @param {Object} stats - Directory stats from fs.stat (optional)
     * @returns {boolean} True if directory should be included
     */
    shouldIncludeDirectory(dirPath, stats = null) {
        try {
            // Get directory stats if not provided
            if (!stats) {
                try {
                    stats = statSync(dirPath);
                } catch (error) {
                    this.logger.warn('Failed to get directory stats', {
                        dirPath,
                        error: error.message,
                    });
                    return false;
                }
            }

            // Skip non-directories
            if (!stats.isDirectory()) {
                return false;
            }

            // Skip symlinks if not following them
            if (stats.isSymbolicLink() && !this.config.followSymlinks) {
                return false;
            }

            // Check exclusion patterns
            if (this.isExcluded(dirPath)) {
                this.logger.debug('Directory excluded by pattern', { dirPath });
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error(error, 'Error checking directory inclusion', { dirPath });
            return false;
        }
    }

    /**
     * Check if a path matches any exclusion pattern
     * @param {string} path - Path to check
     * @returns {boolean} True if path should be excluded
     */
    isExcluded(path) {
        // Normalize path separators
        const normalizedPath = path.replace(/\\/g, '/');

        return this.exclusionPatterns.some(pattern => {
            const options = {
                dot: true,
                nocase: !this.config.caseSensitive,
                matchBase: true,
            };

            return minimatch(normalizedPath, pattern, options);
        });
    }

    /**
     * Check if a file is binary based on extension
     * @param {string} filePath - File path to check
     * @returns {boolean} True if file is likely binary
     */
    isBinaryFile(filePath) {
        const extension = this.getFileExtension(filePath);
        return this.binaryExtensions.has(extension);
    }

    /**
     * Get file extension from path
     * @param {string} filePath - File path
     * @returns {string} File extension (with dot)
     */
    getFileExtension(filePath) {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
            return '';
        }
        return filePath.substring(lastDotIndex).toLowerCase();
    }

    /**
     * Add custom exclusion pattern
     * @param {string} pattern - Glob pattern to exclude
     */
    addExclusionPattern(pattern) {
        if (
            !this.config.customExclusions.includes(pattern) &&
            !this.exclusionPatterns.includes(pattern)
        ) {
            this.config.customExclusions.push(pattern);
            this.exclusionPatterns.push(pattern);
            this.logger.debug('Added exclusion pattern', { pattern });
        }
    }

    /**
     * Remove custom exclusion pattern
     * @param {string} pattern - Glob pattern to remove
     */
    removeExclusionPattern(pattern) {
        const customIndex = this.config.customExclusions.indexOf(pattern);
        if (customIndex > -1) {
            this.config.customExclusions.splice(customIndex, 1);

            // Rebuild exclusion patterns
            this.exclusionPatterns = [
                ...this.config.defaultExclusions,
                ...this.config.customExclusions,
            ];

            this.logger.debug('Removed exclusion pattern', { pattern });
        }
    }

    /**
     * Get all active exclusion patterns
     * @returns {Array} Array of active exclusion patterns
     */
    getActivePatterns() {
        return [...this.exclusionPatterns];
    }

    /**
     * Update configuration at runtime
     * @param {Object} newConfig - New configuration to apply
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Rebuild exclusion patterns if they changed
        if (newConfig.defaultExclusions || newConfig.customExclusions) {
            this.exclusionPatterns = [
                ...(newConfig.defaultExclusions || this.config.defaultExclusions),
                ...(newConfig.customExclusions || this.config.customExclusions),
            ];
        }

        this.logger.debug('FileFilter configuration updated', { newConfig });
    }

    /**
     * Get filter statistics
     * @returns {Object} Filter statistics
     */
    getFilterStats() {
        return {
            totalPatterns: this.exclusionPatterns.length,
            defaultPatterns: this.config.defaultExclusions.length,
            customPatterns: this.config.customExclusions.length,
            maxFileSize: this.config.maxFileSize,
            binaryFileHandling: this.config.binaryFileHandling,
            followSymlinks: this.config.followSymlinks,
            caseSensitive: this.config.caseSensitive,
            binaryExtensions: this.binaryExtensions.size,
        };
    }

    /**
     * Test if a set of paths would be included
     * @param {Array} paths - Array of paths to test
     * @returns {Object} Test results with included/excluded counts
     */
    testPaths(paths) {
        const results = {
            included: [],
            excluded: [],
            errors: [],
        };

        for (const path of paths) {
            try {
                // For testing, use a mock stats object
                const mockStats = {
                    isDirectory: () => false,
                    isSymbolicLink: () => false,
                    size: 1024,
                };

                if (this.shouldIncludeFile(path, mockStats)) {
                    results.included.push(path);
                } else {
                    results.excluded.push(path);
                }
            } catch (error) {
                results.errors.push({ path, error: error.message });
            }
        }

        return results;
    }
}

export default FileFilter;
