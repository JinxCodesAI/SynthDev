/**
 * Content Change Detection System
 * Efficiently detects file changes using content hashing and caching
 */

import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import SnapshotLogger from './SnapshotLogger.js';

/**
 * Content change detector with hash-based change detection
 */
class ContentChangeDetector {
    constructor(config) {
        this.config = config;
        this.logger = new SnapshotLogger();
        this.fileHashes = new Map(); // filePath -> { hash, timestamp, size }
        this.hashAlgorithm = config.getSnapshotConfig().contentHashing.algorithm || 'md5';
        this.trackChanges = config.getSnapshotConfig().contentHashing.trackChanges;
        this.performanceMetrics = {
            hashCalculations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalProcessingTime: 0,
        };
    }

    /**
     * Check if a file has changed since last check
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} True if file has changed or is new
     */
    async hasFileChanged(filePath) {
        const timer = this.logger.createTimer('file_change_detection');

        try {
            // Normalize path
            const normalizedPath = path.resolve(filePath);

            // Check if file exists
            if (!existsSync(normalizedPath)) {
                // File doesn't exist - check if we had it before
                const hadFile = this.fileHashes.has(normalizedPath);
                if (hadFile) {
                    this.fileHashes.delete(normalizedPath);
                    this.logger.logFileOperation('deleted', normalizedPath, {
                        hadPreviousHash: true,
                    });
                }
                timer(true, { result: 'file_not_found', hadFile });
                return hadFile; // Changed if we had it before
            }

            // Get file stats for quick comparison
            const stats = await stat(normalizedPath);
            const currentSize = stats.size;
            const currentMtime = stats.mtime.getTime();

            // Check cache for existing hash
            const cachedData = this.fileHashes.get(normalizedPath);

            if (cachedData) {
                // Quick check: if size and mtime haven't changed, file is likely unchanged
                if (cachedData.size === currentSize && cachedData.timestamp === currentMtime) {
                    this.performanceMetrics.cacheHits++;
                    this.logger.logPerformanceMetric('cache_hit', 1, { filePath: normalizedPath });
                    timer(true, { result: 'cache_hit' });
                    return false; // No change detected
                }
            }

            // Need to calculate hash
            this.performanceMetrics.cacheMisses++;
            const currentContent = await this.readFileContent(normalizedPath);
            const currentHash = this.calculateHash(currentContent);

            // Compare with cached hash
            const hasChanged = !cachedData || currentHash !== cachedData.hash;

            // Update cache
            this.fileHashes.set(normalizedPath, {
                hash: currentHash,
                timestamp: currentMtime,
                size: currentSize,
                lastChecked: Date.now(),
            });

            this.logger.logFileOperation('hash_calculated', normalizedPath, {
                hasChanged,
                algorithm: this.hashAlgorithm,
                size: currentSize,
                hash: currentHash.substring(0, 8),
            });

            timer(true, { result: hasChanged ? 'changed' : 'unchanged' });
            return hasChanged;
        } catch (error) {
            this.logger.error(`Error checking file changes for ${filePath}: ${error.message}`);
            timer(false, { error: error.message });
            return true; // Assume changed on error to be safe
        }
    }

    /**
     * Calculate hash for content
     * @param {string|Buffer} content - Content to hash
     * @returns {string} Content hash
     */
    calculateHash(content) {
        const startTime = Date.now();
        const hash = createHash(this.hashAlgorithm).update(content, 'utf8').digest('hex');

        this.performanceMetrics.hashCalculations++;
        this.performanceMetrics.totalProcessingTime += Date.now() - startTime;

        return hash;
    }

    /**
     * Read file content with error handling
     * @private
     * @param {string} filePath - Path to the file
     * @returns {Promise<string>} File content
     */
    async readFileContent(filePath) {
        try {
            return await readFile(filePath, 'utf8');
        } catch (error) {
            if (error.code === 'EISDIR') {
                throw new Error(`Cannot read directory as file: ${filePath}`);
            }
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            }
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied: ${filePath}`);
            }
            throw error;
        }
    }

    /**
     * Backup a file if it has changed
     * @param {string} filePath - Path to the file
     * @returns {Promise<{backed_up: boolean, hash?: string, content?: string}>} Backup result
     */
    async backupFileIfChanged(filePath) {
        const timer = this.logger.createTimer('file_backup');

        try {
            const hasChanged = await this.hasFileChanged(filePath);

            if (!hasChanged) {
                timer(true, { result: 'no_backup_needed' });
                return { backed_up: false };
            }

            // File has changed, perform backup
            const normalizedPath = path.resolve(filePath);
            const content = await this.readFileContent(normalizedPath);
            const hash = this.calculateHash(content);

            this.logger.logFileOperation('backed_up', normalizedPath, {
                size: content.length,
                hash: hash.substring(0, 8),
            });

            timer(true, { result: 'backed_up', size: content.length });
            return {
                backed_up: true,
                hash,
                content,
                size: content.length,
                timestamp: Date.now(),
            };
        } catch (error) {
            this.logger.error(`Error backing up file ${filePath}: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Batch process multiple files for change detection
     * @param {string[]} filePaths - Array of file paths
     * @returns {Promise<Map<string, boolean>>} Map of file paths to change status
     */
    async batchCheckChanges(filePaths) {
        const timer = this.logger.createTimer('batch_change_detection');
        const results = new Map();

        try {
            // Process files in parallel with concurrency limit
            const concurrency = 10;
            const batches = [];

            for (let i = 0; i < filePaths.length; i += concurrency) {
                const batch = filePaths.slice(i, i + concurrency);
                batches.push(batch);
            }

            for (const batch of batches) {
                const batchPromises = batch.map(async filePath => {
                    try {
                        const hasChanged = await this.hasFileChanged(filePath);
                        return { filePath, hasChanged, error: null };
                    } catch (error) {
                        return { filePath, hasChanged: true, error: error.message };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                for (const result of batchResults) {
                    results.set(result.filePath, result.hasChanged);
                    if (result.error) {
                        this.logger.warn(`Error processing ${result.filePath}: ${result.error}`);
                    }
                }
            }

            timer(true, {
                filesProcessed: filePaths.length,
                changedFiles: Array.from(results.values()).filter(Boolean).length,
            });
            return results;
        } catch (error) {
            this.logger.error(`Error in batch change detection: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get cached hash for a file
     * @param {string} filePath - Path to the file
     * @returns {string|null} Cached hash or null if not found
     */
    getCachedHash(filePath) {
        const normalizedPath = path.resolve(filePath);
        const cachedData = this.fileHashes.get(normalizedPath);
        return cachedData ? cachedData.hash : null;
    }

    /**
     * Clear cache for specific file or all files
     * @param {string} filePath - Path to specific file (optional)
     */
    clearCache(filePath = null) {
        if (filePath) {
            const normalizedPath = path.resolve(filePath);
            this.fileHashes.delete(normalizedPath);
            this.logger.debug(`Cache cleared for ${normalizedPath}`);
        } else {
            this.fileHashes.clear();
            this.logger.debug('All file hash cache cleared');
        }
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        const cacheHitRate =
            this.performanceMetrics.cacheHits /
                (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) || 0;

        return {
            ...this.performanceMetrics,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            averageHashTime:
                this.performanceMetrics.hashCalculations > 0
                    ? this.performanceMetrics.totalProcessingTime /
                      this.performanceMetrics.hashCalculations
                    : 0,
            cachedFiles: this.fileHashes.size,
        };
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.performanceMetrics = {
            hashCalculations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalProcessingTime: 0,
        };
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const cacheEntries = Array.from(this.fileHashes.entries());

        return {
            totalEntries: cacheEntries.length,
            oldestEntry:
                cacheEntries.length > 0
                    ? Math.min(...cacheEntries.map(([, data]) => data.lastChecked || 0))
                    : null,
            newestEntry:
                cacheEntries.length > 0
                    ? Math.max(...cacheEntries.map(([, data]) => data.lastChecked || 0))
                    : null,
            totalSize: cacheEntries.reduce((sum, [, data]) => sum + (data.size || 0), 0),
            algorithms: [this.hashAlgorithm],
        };
    }
}

export default ContentChangeDetector;
