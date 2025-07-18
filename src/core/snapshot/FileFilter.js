/**
 * FileFilter - File inclusion/exclusion logic
 *
 * This class provides configurable file filtering with pattern matching,
 * file size filtering, and performance-optimized directory traversal.
 */

import { getLogger } from '../managers/logger.js';
import { minimatch } from 'minimatch';
import { promises as fs } from 'fs';
import { join } from 'path';

export class FileFilter {
    /**
     * Create a new FileFilter instance
     * @param {Object} config - Configuration object
     */
    constructor(config = {}) {
        this.config = {
            defaultExclusions: [
                'node_modules/**',
                '.git/**',
                'dist/**',
                'build/**',
                '.vscode/**',
                '.idea/**',
                '*.tmp',
                '*.temp',
                '*.log',
                '.DS_Store',
                'Thumbs.db',
            ],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            binaryFileHandling: 'exclude', // 'exclude', 'include', 'warn'
            customExclusions: [],
            customInclusions: [],
            ...config,
        };

        this.logger = getLogger();
        this.exclusionPatterns = [
            ...this.config.defaultExclusions,
            ...this.config.customExclusions,
        ];
        this.inclusionPatterns = this.config.customInclusions;

        this.logger.debug('FileFilter initialized', {
            exclusionCount: this.exclusionPatterns.length,
            inclusionCount: this.inclusionPatterns.length,
        });
    }

    /**
     * Determine if a file should be included in snapshots
     * @param {string} filePath - File path to check
     * @param {Object} stats - File stats object
     * @returns {boolean} Whether file should be included
     */
    shouldIncludeFile(filePath, stats) {
        try {
            this.logger.debug('Checking file inclusion', { filePath });

            // Normalize path for consistent matching
            const normalizedPath = filePath.replace(/\\/g, '/');

            // Check file size limits
            if (stats && stats.size > this.config.maxFileSize) {
                this.logger.debug('File excluded due to size limit', {
                    filePath,
                    size: stats.size,
                    limit: this.config.maxFileSize
                });
                return false;
            }

            // Check if file matches inclusion patterns (overrides exclusions)
            if (this.inclusionPatterns.length > 0) {
                const matchesInclusion = this._matchesPatterns(normalizedPath, this.inclusionPatterns);
                if (matchesInclusion) {
                    this.logger.debug('File included by inclusion pattern', { filePath });
                    return true;
                }
            }

            // Check if file matches exclusion patterns
            const matchesExclusion = this._matchesPatterns(normalizedPath, this.exclusionPatterns);
            if (matchesExclusion) {
                this.logger.debug('File excluded by exclusion pattern', { filePath });
                return false;
            }

            // If no patterns match, include the file by default
            this.logger.debug('File included by default', { filePath });
            return true;
        } catch (error) {
            this.logger.error(error, 'Failed to check file inclusion');
            return false; // Default to exclude on error
        }
    }

    /**
     * Determine if a directory should be traversed
     * @param {string} dirPath - Directory path to check
     * @param {Object} stats - Directory stats object
     * @returns {boolean} Whether directory should be traversed
     */
    shouldIncludeDirectory(dirPath, stats) {
        try {
            this.logger.debug('Checking directory inclusion', { dirPath });

            // Normalize path for consistent matching
            const normalizedPath = dirPath.replace(/\\/g, '/');

            // Check if directory matches inclusion patterns (overrides exclusions)
            if (this.inclusionPatterns.length > 0) {
                const matchesInclusion = this._matchesPatterns(normalizedPath, this.inclusionPatterns);
                if (matchesInclusion) {
                    this.logger.debug('Directory included by inclusion pattern', { dirPath });
                    return true;
                }
            }

            // Check if directory matches exclusion patterns
            const matchesExclusion = this._matchesPatterns(normalizedPath, this.exclusionPatterns);
            if (matchesExclusion) {
                this.logger.debug('Directory excluded by exclusion pattern', { dirPath });
                return false;
            }

            // If no patterns match, include the directory by default
            this.logger.debug('Directory included by default', { dirPath });
            return true;
        } catch (error) {
            this.logger.error(error, 'Failed to check directory inclusion');
            return false; // Default to exclude on error
        }
    }

    /**
     * Add a new exclusion pattern
     * @param {string} pattern - Glob pattern to exclude
     */
    addExclusionPattern(pattern) {
        try {
            if (!this.exclusionPatterns.includes(pattern)) {
                this.exclusionPatterns.push(pattern);
                this.logger.debug('Added exclusion pattern', { pattern });
            }
        } catch (error) {
            this.logger.error(error, 'Failed to add exclusion pattern');
            throw error;
        }
    }

    /**
     * Remove an exclusion pattern
     * @param {string} pattern - Glob pattern to remove
     */
    removeExclusionPattern(pattern) {
        try {
            const index = this.exclusionPatterns.indexOf(pattern);
            if (index > -1) {
                this.exclusionPatterns.splice(index, 1);
                this.logger.debug('Removed exclusion pattern', { pattern });
            }
        } catch (error) {
            this.logger.error(error, 'Failed to remove exclusion pattern');
            throw error;
        }
    }

    /**
     * Get all active patterns
     * @returns {Object} Active patterns
     */
    getActivePatterns() {
        return {
            exclusions: [...this.exclusionPatterns],
            inclusions: [...this.inclusionPatterns],
        };
    }

    /**
     * Update configuration at runtime
     * @param {Object} filterConfig - New filter configuration
     */
    updateConfiguration(filterConfig) {
        try {
            this.logger.debug('Updating filter configuration', { filterConfig });

            // Validate new configuration
            if (!filterConfig || typeof filterConfig !== 'object') {
                throw new Error('Filter configuration must be a valid object');
            }

            // Update internal config
            this.config = {
                ...this.config,
                ...filterConfig
            };

            // Rebuild pattern arrays
            this.exclusionPatterns = [
                ...this.config.defaultExclusions,
                ...(this.config.customExclusions || [])
            ];
            this.inclusionPatterns = this.config.customInclusions || [];

            this.logger.info('Filter configuration updated successfully', {
                exclusionCount: this.exclusionPatterns.length,
                inclusionCount: this.inclusionPatterns.length
            });
        } catch (error) {
            this.logger.error(error, 'Failed to update filter configuration');
            throw error;
        }
    }

    /**
     * Check if a file is binary
     * @param {string} filePath - File path to check
     * @returns {Promise<boolean>} Whether file is binary
     */
    async _isBinaryFile(filePath) {
        try {
            // Check file extension first (fast check)
            const binaryExtensions = [
                '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
                '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico',
                '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
                '.class', '.jar', '.war', '.ear'
            ];

            const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
            if (binaryExtensions.includes(ext)) {
                return true;
            }

            // For unknown extensions, sample file content
            try {
                const fs = await import('fs');
                const buffer = Buffer.alloc(512);
                const fd = await fs.promises.open(filePath, 'r');
                const { bytesRead } = await fd.read(buffer, 0, 512, 0);
                await fd.close();

                // Check for null bytes (common in binary files)
                for (let i = 0; i < bytesRead; i++) {
                    if (buffer[i] === 0) {
                        return true;
                    }
                }

                return false;
            } catch (readError) {
                this.logger.warn('Could not read file for binary detection', {
                    filePath,
                    error: readError.message
                });
                return false; // Default to text file if can't read
            }
        } catch (error) {
            this.logger.error(error, 'Failed to check if file is binary');
            return false; // Default to text file on error
        }
    }

    /**
     * Match a path against patterns
     * @param {string} path - Path to match
     * @param {Array} patterns - Patterns to match against
     * @returns {boolean} Whether path matches any pattern
     */
    _matchesPatterns(path, patterns) {
        try {
            if (!patterns || patterns.length === 0) {
                return false;
            }

            // Normalize path separators to forward slashes
            const normalizedPath = path.replace(/\\/g, '/');

            // Test against each pattern
            for (const pattern of patterns) {
                try {
                    // Use minimatch for glob pattern matching
                    if (minimatch(normalizedPath, pattern, {
                        dot: true,  // Match dotfiles
                        matchBase: true  // Match basename
                    })) {
                        this.logger.debug('Path matched pattern', { path, pattern });
                        return true;
                    }
                } catch (patternError) {
                    this.logger.warn('Invalid pattern', { pattern, error: patternError.message });
                    continue;
                }
            }

            return false;
        } catch (error) {
            this.logger.error(error, 'Failed to match patterns');
            return false;
        }
    }
}

export default FileFilter;
