/**
 * Internal Data Manager
 * Centralized manager for all internal SynthDev data storage
 * Handles .synthdev directory structure and provides clean API for internal operations
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { getLogger } from './logger.js';

export class InternalDataManager {
    constructor(basePath = process.cwd()) {
        this.logger = getLogger();
        this.basePath = resolve(basePath);
        this.synthdevDir = join(this.basePath, '.synthdev');

        // Internal directory structure
        this.directories = {
            root: this.synthdevDir,
            index: join(this.synthdevDir, 'index'),
            snapshots: join(this.synthdevDir, 'snapshots'),
            cache: join(this.synthdevDir, 'cache'),
            temp: join(this.synthdevDir, 'temp'),
        };

        if (this.logger && typeof this.logger.debug === 'function') {
            this.logger.debug('InternalDataManager initialized', {
                basePath: this.basePath,
                synthdevDir: this.synthdevDir,
            });
        }
    }

    /**
     * Initialize the .synthdev directory structure
     * @returns {Object} Result object with success status
     */
    initialize() {
        try {
            // Create all internal directories
            for (const [name, path] of Object.entries(this.directories)) {
                if (!existsSync(path)) {
                    mkdirSync(path, { recursive: true });
                    if (this.logger && typeof this.logger.debug === 'function') {
                        this.logger.debug(`Created internal directory: ${name}`, { path });
                    }
                }
            }

            return { success: true, directories: this.directories };
        } catch (error) {
            if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(error, 'Failed to initialize internal directories');
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Get path for internal file or directory
     * @param {string} type - Type of internal storage (index, snapshots, cache, temp)
     * @param {string} filename - Optional filename to append
     * @returns {string} Full path to internal file/directory
     */
    getInternalPath(type, filename = null) {
        if (!this.directories[type]) {
            throw new Error(`Unknown internal directory type: ${type}`);
        }

        const basePath = this.directories[type];
        return filename ? join(basePath, filename) : basePath;
    }

    /**
     * Read internal file safely
     * @param {string} type - Internal directory type
     * @param {string} filename - Filename to read
     * @param {Object} options - Read options
     * @returns {Object} Result with content or error
     */
    readInternalFile(type, filename, options = {}) {
        const { encoding = 'utf8', parseJson = false } = options;

        try {
            const filePath = this.getInternalPath(type, filename);

            if (!existsSync(filePath)) {
                return { success: false, error: 'File not found', path: filePath };
            }

            const content = readFileSync(filePath, encoding);
            const result = { success: true, content, path: filePath };

            if (parseJson) {
                try {
                    result.data = JSON.parse(content);
                } catch (parseError) {
                    return {
                        success: false,
                        error: 'JSON parse error',
                        parseError: parseError.message,
                        path: filePath,
                    };
                }
            }

            return result;
        } catch (error) {
            if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(error, 'Failed to read internal file', { type, filename });
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Write internal file safely
     * @param {string} type - Internal directory type
     * @param {string} filename - Filename to write
     * @param {string|Object} content - Content to write
     * @param {Object} options - Write options
     * @returns {Object} Result with success status
     */
    writeInternalFile(type, filename, content, options = {}) {
        const { encoding = 'utf8', stringifyJson = false, createDirectories = true } = options;

        try {
            // Ensure internal directories exist
            if (createDirectories) {
                this.initialize();
            }

            const filePath = this.getInternalPath(type, filename);

            // Handle JSON stringification
            let finalContent = content;
            if (stringifyJson && typeof content === 'object') {
                finalContent = JSON.stringify(content, null, 2);
            }

            // Create subdirectories if needed
            const dir = dirname(filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            writeFileSync(filePath, finalContent, encoding);

            const stats = statSync(filePath);
            return {
                success: true,
                path: filePath,
                size: stats.size,
                encoding,
            };
        } catch (error) {
            if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(error, 'Failed to write internal file', { type, filename });
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if internal file exists
     * @param {string} type - Internal directory type
     * @param {string} filename - Filename to check
     * @returns {boolean} True if file exists
     */
    internalFileExists(type, filename) {
        try {
            const filePath = this.getInternalPath(type, filename);
            return existsSync(filePath);
        } catch {
            return false;
        }
    }

    /**
     * List files in internal directory
     * @param {string} type - Internal directory type
     * @param {Object} options - List options
     * @returns {Object} Result with file list or error
     */
    listInternalFiles(type, options = {}) {
        const { includeStats = false, recursive = false } = options;

        try {
            const dirPath = this.getInternalPath(type);

            if (!existsSync(dirPath)) {
                return { success: true, files: [] };
            }

            const files = [];
            const items = readdirSync(dirPath);

            for (const item of items) {
                const itemPath = join(dirPath, item);
                const stats = statSync(itemPath);

                const fileInfo = { name: item, path: itemPath };

                if (includeStats) {
                    fileInfo.stats = {
                        size: stats.size,
                        isFile: stats.isFile(),
                        isDirectory: stats.isDirectory(),
                        modified: stats.mtime,
                        created: stats.birthtime,
                    };
                }

                files.push(fileInfo);

                // Handle recursive listing for directories
                if (recursive && stats.isDirectory()) {
                    const subResult = this.listInternalFiles(join(type, item), options);
                    if (subResult.success) {
                        files.push(...subResult.files);
                    }
                }
            }

            return { success: true, files };
        } catch (error) {
            if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(error, 'Failed to list internal files', { type });
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean up temporary files and old data
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} Result with cleanup statistics
     */
    async cleanup(options = {}) {
        const { maxAge = 7 * 24 * 60 * 60 * 1000, dryRun = false } = options; // 7 days default

        try {
            const stats = {
                filesRemoved: 0,
                bytesFreed: 0,
                errors: [],
            };

            // Clean temp directory
            const tempResult = this.listInternalFiles('temp', { includeStats: true });
            if (tempResult.success) {
                const now = Date.now();

                for (const file of tempResult.files) {
                    if (file.stats && file.stats.isFile) {
                        const age = now - file.stats.modified.getTime();

                        if (age > maxAge) {
                            if (!dryRun) {
                                try {
                                    const fs = await import('fs/promises');
                                    await fs.unlink(file.path);
                                    stats.filesRemoved++;
                                    stats.bytesFreed += file.stats.size;
                                } catch (error) {
                                    stats.errors.push({ file: file.name, error: error.message });
                                }
                            } else {
                                stats.filesRemoved++;
                                stats.bytesFreed += file.stats.size;
                            }
                        }
                    }
                }
            }

            return { success: true, stats, dryRun };
        } catch (error) {
            if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(error, 'Failed to cleanup internal files');
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Get internal directory statistics
     * @returns {Object} Statistics about internal storage usage
     */
    getStats() {
        try {
            const stats = {
                directories: {},
                totalSize: 0,
                totalFiles: 0,
            };

            for (const [type, path] of Object.entries(this.directories)) {
                if (existsSync(path)) {
                    const dirStats = this._calculateDirectoryStats(path);
                    stats.directories[type] = dirStats;
                    stats.totalSize += dirStats.size;
                    stats.totalFiles += dirStats.fileCount;
                }
            }

            return { success: true, stats };
        } catch (error) {
            if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(error, 'Failed to get internal storage stats');
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate directory statistics recursively
     * @private
     * @param {string} dirPath - Directory path to analyze
     * @returns {Object} Directory statistics
     */
    _calculateDirectoryStats(dirPath) {
        let size = 0;
        let fileCount = 0;

        try {
            const items = readdirSync(dirPath);

            for (const item of items) {
                const itemPath = join(dirPath, item);
                const stats = statSync(itemPath);

                if (stats.isFile()) {
                    size += stats.size;
                    fileCount++;
                } else if (stats.isDirectory()) {
                    const subStats = this._calculateDirectoryStats(itemPath);
                    size += subStats.size;
                    fileCount += subStats.fileCount;
                }
            }
        } catch (error) {
            if (this.logger && typeof this.logger.debug === 'function') {
                this.logger.debug('Error calculating directory stats', {
                    dirPath,
                    error: error.message,
                });
            }
        }

        return { size, fileCount };
    }
}

// Singleton instance
let internalDataManagerInstance = null;

/**
 * Get singleton instance of InternalDataManager
 * @param {string} basePath - Base path for internal data (optional)
 * @returns {InternalDataManager} Singleton instance
 */
export function getInternalDataManager(basePath = null) {
    if (
        !internalDataManagerInstance ||
        (basePath && basePath !== internalDataManagerInstance.basePath)
    ) {
        internalDataManagerInstance = new InternalDataManager(basePath || undefined);
    }
    return internalDataManagerInstance;
}

export default InternalDataManager;
