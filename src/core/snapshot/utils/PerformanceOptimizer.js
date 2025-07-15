/**
 * Performance Optimization Utilities
 * Provides optimizations for large file handling and memory management
 */

import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import { stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import SnapshotLogger from './SnapshotLogger.js';

/**
 * Performance optimizer for snapshot operations
 */
class PerformanceOptimizer {
    constructor(config) {
        this.config = config;
        this.logger = new SnapshotLogger();
        this.largeFileThreshold = 10 * 1024 * 1024; // 10MB
        this.streamChunkSize = 64 * 1024; // 64KB chunks
        this.maxConcurrentOperations = 5;
    }

    /**
     * Calculate hash for large files using streaming
     * @param {string} filePath - Path to the file
     * @param {string} algorithm - Hash algorithm
     * @returns {Promise<string>} File hash
     */
    async calculateLargeFileHash(filePath, algorithm = 'md5') {
        const timer = this.logger.createTimer('large_file_hash');

        try {
            const stats = await stat(filePath);
            const fileSize = stats.size;

            if (fileSize < this.largeFileThreshold) {
                // Use regular hashing for smaller files
                const fs = await import('fs/promises');
                const content = await fs.readFile(filePath);
                const hash = createHash(algorithm).update(content).digest('hex');
                timer(true, { fileSize, method: 'direct' });
                return hash;
            }

            // Use streaming for large files
            const hash = createHash(algorithm);
            const readStream = createReadStream(filePath, {
                highWaterMark: this.streamChunkSize,
            });

            let processedBytes = 0;
            const progressTransform = new Transform({
                transform(chunk, encoding, callback) {
                    processedBytes += chunk.length;
                    hash.update(chunk);
                    callback(null, chunk);
                },
            });

            await pipeline(readStream, progressTransform);

            const result = hash.digest('hex');

            this.logger.logPerformanceMetric('large_file_hash_completed', fileSize, {
                algorithm,
                processedBytes,
                filePath,
            });

            timer(true, { fileSize, method: 'streaming', processedBytes });
            return result;
        } catch (error) {
            this.logger.error(
                `Error calculating hash for large file ${filePath}: ${error.message}`
            );
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Batch process files with concurrency control
     * @param {string[]} filePaths - Array of file paths
     * @param {Function} processor - Processing function for each file
     * @param {number} concurrency - Maximum concurrent operations
     * @returns {Promise<Array>} Processing results
     */
    async batchProcess(filePaths, processor, concurrency = this.maxConcurrentOperations) {
        const timer = this.logger.createTimer('batch_process');
        const results = [];
        const errors = [];

        try {
            // Process files in batches
            for (let i = 0; i < filePaths.length; i += concurrency) {
                const batch = filePaths.slice(i, i + concurrency);

                const batchPromises = batch.map(async (filePath, index) => {
                    try {
                        const result = await processor(filePath);
                        return { index: i + index, filePath, result, error: null };
                    } catch (error) {
                        return { index: i + index, filePath, result: null, error: error.message };
                    }
                });

                const batchResults = await Promise.all(batchPromises);

                for (const batchResult of batchResults) {
                    if (batchResult.error) {
                        errors.push(batchResult);
                    } else {
                        results.push(batchResult);
                    }
                }

                // Log progress for large batches
                if (filePaths.length > 50) {
                    const progress = Math.round(((i + batch.length) / filePaths.length) * 100);
                    this.logger.status(`Processing files: ${progress}% complete`);
                }
            }

            timer(true, {
                totalFiles: filePaths.length,
                successful: results.length,
                errors: errors.length,
            });

            return { results, errors };
        } catch (error) {
            this.logger.error(`Error in batch processing: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Memory-efficient file content comparison
     * @param {string} filePath1 - First file path
     * @param {string} filePath2 - Second file path
     * @returns {Promise<boolean>} True if files are identical
     */
    async compareFilesEfficiently(filePath1, filePath2) {
        const timer = this.logger.createTimer('file_comparison');

        try {
            // Quick size comparison first
            const [stats1, stats2] = await Promise.all([stat(filePath1), stat(filePath2)]);

            if (stats1.size !== stats2.size) {
                timer(true, { result: 'different_sizes' });
                return false;
            }

            // For small files, read and compare directly
            if (stats1.size < this.largeFileThreshold) {
                const fs = await import('fs/promises');
                const [content1, content2] = await Promise.all([
                    fs.readFile(filePath1),
                    fs.readFile(filePath2),
                ]);
                const identical = content1.equals(content2);
                timer(true, { result: identical ? 'identical' : 'different', method: 'direct' });
                return identical;
            }

            // For large files, compare hashes
            const [hash1, hash2] = await Promise.all([
                this.calculateLargeFileHash(filePath1),
                this.calculateLargeFileHash(filePath2),
            ]);

            const identical = hash1 === hash2;
            timer(true, { result: identical ? 'identical' : 'different', method: 'hash' });
            return identical;
        } catch (error) {
            this.logger.error(`Error comparing files: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Optimize memory usage by implementing LRU cache for file hashes
     * @param {number} maxSize - Maximum cache size
     * @returns {Object} LRU cache implementation
     */
    createLRUCache(maxSize = 100) {
        const cache = new Map();
        const accessOrder = [];

        return {
            get(key) {
                if (cache.has(key)) {
                    // Move to end (most recently used)
                    const index = accessOrder.indexOf(key);
                    if (index > -1) {
                        accessOrder.splice(index, 1);
                    }
                    accessOrder.push(key);
                    return cache.get(key);
                }
                return null;
            },

            set(key, value) {
                if (cache.has(key)) {
                    // Update existing
                    cache.set(key, value);
                    this.get(key); // Update access order
                } else {
                    // Add new
                    if (cache.size >= maxSize) {
                        // Remove least recently used
                        const lru = accessOrder.shift();
                        cache.delete(lru);
                    }
                    cache.set(key, value);
                    accessOrder.push(key);
                }
            },

            has(key) {
                return cache.has(key);
            },

            delete(key) {
                if (cache.has(key)) {
                    cache.delete(key);
                    const index = accessOrder.indexOf(key);
                    if (index > -1) {
                        accessOrder.splice(index, 1);
                    }
                    return true;
                }
                return false;
            },

            clear() {
                cache.clear();
                accessOrder.length = 0;
            },

            size() {
                return cache.size;
            },

            keys() {
                return Array.from(cache.keys());
            },

            getStats() {
                return {
                    size: cache.size,
                    maxSize,
                    accessOrder: [...accessOrder],
                };
            },
        };
    }

    /**
     * Debounce function for reducing frequent operations
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, delay = 300) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Throttle function for limiting operation frequency
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, limit = 1000) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    /**
     * Memory usage monitoring
     * @returns {Object} Memory usage information
     */
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
        };
    }

    /**
     * Check if memory usage is approaching limits
     * @returns {boolean} True if memory usage is high
     */
    isMemoryUsageHigh() {
        const usage = this.getMemoryUsage();
        const memoryLimit = this.config.getMemoryLimitBytes() / 1024 / 1024; // Convert to MB
        return usage.heapUsed > memoryLimit * 0.8; // 80% threshold
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection() {
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
            this.logger.debug('Forced garbage collection');
        } else {
            this.logger.debug('Garbage collection not available (run with --expose-gc)');
        }
    }

    /**
     * Get performance recommendations based on current state
     * @returns {string[]} Array of recommendations
     */
    getPerformanceRecommendations() {
        const recommendations = [];
        const memoryUsage = this.getMemoryUsage();
        const memoryLimit = this.config.getMemoryLimitBytes() / 1024 / 1024;

        if (memoryUsage.heapUsed > memoryLimit * 0.7) {
            recommendations.push('Consider reducing memory limit or clearing cache');
        }

        if (memoryUsage.heapUsed > 500) {
            recommendations.push(
                'High memory usage detected, consider using streaming for large files'
            );
        }

        if (this.largeFileThreshold < 5 * 1024 * 1024) {
            recommendations.push('Consider increasing large file threshold for better performance');
        }

        return recommendations;
    }
}

export default PerformanceOptimizer;
