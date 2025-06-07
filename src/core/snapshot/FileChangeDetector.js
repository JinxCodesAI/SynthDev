/**
 * File Change Detector for Phase 2 - Automatic Snapshot Creation
 * Monitors file system for actual file modifications and warns about unexpected changes
 */

import { statSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { createHash } from 'crypto';
import { getLogger } from '../managers/logger.js';

export class FileChangeDetector {
    constructor(config = {}) {
        this.config = {
            useChecksums: true,
            trackModificationTime: true,
            minimumChangeSize: 1,
            warnOnUnexpectedChanges: true,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            excludePatterns: [
                'node_modules',
                '.git',
                '.synthdev',
                '*.log',
                'tmp',
                'temp',
                '.cache',
                'dist',
                'build',
            ],
            ...config,
        };

        this.logger = getLogger();

        // Cache for file states to improve performance
        this.stateCache = new Map();

        this.logger.debug('FileChangeDetector initialized', { config: this.config });
    }

    /**
     * Capture the current state of files in a directory
     * @param {string} basePath - Base directory path
     * @param {Object} options - Capture options
     * @returns {Object} File state snapshot
     */
    async captureFileStates(basePath, options = {}) {
        try {
            const resolvedPath = resolve(basePath);
            const startTime = Date.now();

            this.logger.debug(`Capturing file states in ${resolvedPath}`);

            const fileStates = {};
            const stats = {
                totalFiles: 0,
                totalSize: 0,
                directories: 0,
                skippedFiles: 0,
                errors: [],
            };

            await this._scanDirectory(resolvedPath, resolvedPath, fileStates, stats, options);

            const result = {
                basePath: resolvedPath,
                timestamp: Date.now(),
                captureTime: Date.now() - startTime,
                files: fileStates,
                stats,
            };

            this.logger.debug('File state capture completed', {
                files: stats.totalFiles,
                directories: stats.directories,
                size: stats.totalSize,
                duration: result.captureTime,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to capture file states', error);
            throw error;
        }
    }

    /**
     * Recursively scan directory and capture file states
     * @private
     */
    async _scanDirectory(dirPath, basePath, fileStates, stats, options) {
        try {
            const items = readdirSync(dirPath, { withFileTypes: true });
            stats.directories++;

            for (const item of items) {
                const itemPath = join(dirPath, item.name);
                const relativePath = relative(basePath, itemPath);

                // Check if item should be excluded
                if (this._shouldExclude(relativePath, item.name)) {
                    stats.skippedFiles++;
                    continue;
                }

                try {
                    if (item.isDirectory()) {
                        await this._scanDirectory(itemPath, basePath, fileStates, stats, options);
                    } else if (item.isFile()) {
                        const fileState = await this._captureFileState(itemPath, relativePath);
                        if (fileState) {
                            fileStates[relativePath] = fileState;
                            stats.totalFiles++;
                            stats.totalSize += fileState.size;
                        } else {
                            stats.skippedFiles++;
                        }
                    }
                } catch (itemError) {
                    stats.errors.push({
                        path: relativePath,
                        error: itemError.message,
                    });
                    this.logger.debug(`Error processing ${relativePath}:`, itemError.message);
                }
            }
        } catch (error) {
            const relativePath = relative(basePath, dirPath);
            stats.errors.push({
                path: relativePath,
                error: error.message,
            });
            this.logger.debug(`Error scanning directory ${relativePath}:`, error.message);
        }
    }

    /**
     * Capture the state of a single file
     * @private
     */
    async _captureFileState(filePath, relativePath) {
        try {
            const stat = statSync(filePath);

            // Skip if file is too large
            if (stat.size > this.config.maxFileSize) {
                this.logger.debug(`Skipping large file ${relativePath} (${stat.size} bytes)`);
                return null;
            }

            const fileState = {
                size: stat.size,
                modified: stat.mtime.getTime(),
                created: stat.birthtime ? stat.birthtime.getTime() : stat.mtime.getTime(),
                permissions: stat.mode,
                isFile: stat.isFile(),
                isDirectory: stat.isDirectory(),
            };

            // Add checksum if enabled and file is not too large
            if (this.config.useChecksums && stat.size < 1024 * 1024) {
                // 1MB limit for checksums
                try {
                    const { readFileSync } = await import('fs');
                    const content = readFileSync(filePath);
                    fileState.checksum = createHash('md5').update(content).digest('hex');
                } catch (checksumError) {
                    this.logger.debug(
                        `Could not generate checksum for ${relativePath}:`,
                        checksumError.message
                    );
                }
            }

            return fileState;
        } catch (error) {
            this.logger.debug(`Could not capture state for ${relativePath}:`, error.message);
            return null;
        }
    }

    /**
     * Check if a file or directory should be excluded
     * @private
     */
    _shouldExclude(relativePath, itemName) {
        // Check against exclude patterns
        for (const pattern of this.config.excludePatterns) {
            if (pattern.startsWith('*')) {
                // Wildcard pattern
                const extension = pattern.slice(1);
                if (itemName.endsWith(extension)) {
                    return true;
                }
            } else {
                // Directory or filename pattern
                if (relativePath.includes(pattern) || itemName === pattern) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Compare two file state snapshots
     * @param {Object} beforeState - State before changes
     * @param {Object} afterState - State after changes
     * @returns {Object} Comparison results
     */
    compareFileStates(beforeState, afterState) {
        try {
            this.logger.debug('Comparing file states', {
                beforeFiles: Object.keys(beforeState.files).length,
                afterFiles: Object.keys(afterState.files).length,
            });

            const changes = {
                modified: [],
                created: [],
                deleted: [],
                moved: [],
                unchanged: [],
            };

            const beforeFiles = new Set(Object.keys(beforeState.files));
            const afterFiles = new Set(Object.keys(afterState.files));

            // Find deleted files
            for (const filePath of beforeFiles) {
                if (!afterFiles.has(filePath)) {
                    changes.deleted.push({
                        path: filePath,
                        beforeState: beforeState.files[filePath],
                    });
                }
            }

            // Find created and modified files
            for (const filePath of afterFiles) {
                if (!beforeFiles.has(filePath)) {
                    changes.created.push({
                        path: filePath,
                        afterState: afterState.files[filePath],
                    });
                } else {
                    // Compare file states
                    const beforeFile = beforeState.files[filePath];
                    const afterFile = afterState.files[filePath];

                    if (this._filesAreDifferent(beforeFile, afterFile)) {
                        changes.modified.push({
                            path: filePath,
                            beforeState: beforeFile,
                            afterState: afterFile,
                            changeType: this._getChangeType(beforeFile, afterFile),
                        });
                    } else {
                        changes.unchanged.push(filePath);
                    }
                }
            }

            const totalChanges =
                changes.modified.length + changes.created.length + changes.deleted.length;

            this.logger.debug('File state comparison completed', {
                modified: changes.modified.length,
                created: changes.created.length,
                deleted: changes.deleted.length,
                unchanged: changes.unchanged.length,
                totalChanges,
            });

            return {
                changes,
                hasChanges: totalChanges > 0,
                changeCount: totalChanges,
                stats: {
                    modifiedFiles: changes.modified.length,
                    createdFiles: changes.created.length,
                    deletedFiles: changes.deleted.length,
                    unchangedFiles: changes.unchanged.length,
                    totalFiles: afterFiles.size,
                },
            };
        } catch (error) {
            this.logger.error('Failed to compare file states', error);
            throw error;
        }
    }

    /**
     * Determine if two file states are different
     * @private
     */
    _filesAreDifferent(beforeFile, afterFile) {
        // Check size difference
        if (beforeFile.size !== afterFile.size) {
            return true;
        }

        // Check modification time if enabled
        if (this.config.trackModificationTime && beforeFile.modified !== afterFile.modified) {
            return true;
        }

        // Check checksum if available
        if (this.config.useChecksums && beforeFile.checksum && afterFile.checksum) {
            return beforeFile.checksum !== afterFile.checksum;
        }

        return false;
    }

    /**
     * Get the type of change between two file states
     * @private
     */
    _getChangeType(beforeFile, afterFile) {
        if (beforeFile.size !== afterFile.size) {
            return beforeFile.size > afterFile.size ? 'size-decreased' : 'size-increased';
        }

        if (
            beforeFile.checksum &&
            afterFile.checksum &&
            beforeFile.checksum !== afterFile.checksum
        ) {
            return 'content-changed';
        }

        if (beforeFile.modified !== afterFile.modified) {
            return 'timestamp-changed';
        }

        return 'unknown';
    }

    /**
     * Detect changes between snapshots
     * @param {Object} beforeSnapshot - Snapshot before changes
     * @param {Object} afterSnapshot - Snapshot after changes
     * @returns {Object} Detected changes
     */
    detectChanges(beforeSnapshot, afterSnapshot) {
        return this.compareFileStates(beforeSnapshot, afterSnapshot);
    }

    /**
     * Get list of modified files
     * @param {Object} beforeState - State before changes
     * @param {Object} afterState - State after changes
     * @returns {Array} List of modified file paths
     */
    getModifiedFiles(beforeState, afterState) {
        const comparison = this.compareFileStates(beforeState, afterState);
        return [
            ...comparison.changes.modified.map(change => change.path),
            ...comparison.changes.created.map(change => change.path),
        ];
    }

    /**
     * Validate actual changes against tool declaration
     * @param {string} toolName - Name of the tool that executed
     * @param {Object} args - Tool arguments
     * @param {Object} detectedChanges - Detected file changes
     * @returns {Object} Validation result
     */
    validateActualChanges(toolName, args, detectedChanges) {
        const validation = {
            expectedModifications: true, // Assume modifications were expected
            unexpectedChanges: [],
            warnings: [],
        };

        // For now, we'll just log the changes for analysis
        // In the future, we could validate against tool declarations
        if (detectedChanges.hasChanges) {
            this.logger.debug(`Tool ${toolName} made changes`, {
                modified: detectedChanges.stats.modifiedFiles,
                created: detectedChanges.stats.createdFiles,
                deleted: detectedChanges.stats.deletedFiles,
            });
        } else {
            this.logger.debug(`Tool ${toolName} made no file changes`);
        }

        return validation;
    }

    /**
     * Warn about unexpected changes
     * @param {string} toolName - Tool name
     * @param {boolean} declaredRequirement - Whether tool declared it would modify files
     * @param {Object} actualChanges - Actual changes detected
     */
    warnAboutUnexpectedChanges(toolName, declaredRequirement, actualChanges) {
        if (!this.config.warnOnUnexpectedChanges) {
            return;
        }

        if (!declaredRequirement && actualChanges.hasChanges) {
            this.logger.warn(`Tool ${toolName} made unexpected file changes`, {
                changeCount: actualChanges.changeCount,
                modifiedFiles: actualChanges.changes.modified.map(c => c.path),
                createdFiles: actualChanges.changes.created.map(c => c.path),
                deletedFiles: actualChanges.changes.deleted.map(c => c.path),
            });
        } else if (declaredRequirement && !actualChanges.hasChanges) {
            this.logger.warn(
                `Tool ${toolName} declared it would modify files but no changes detected`
            );
        }
    }

    /**
     * Determine if a snapshot should be created based on changes
     * @param {Object} detectedChanges - Detected changes
     * @returns {boolean} Whether snapshot should be created
     */
    shouldCreateSnapshot(detectedChanges) {
        if (!detectedChanges.hasChanges) {
            return false;
        }

        // Check if changes meet minimum threshold
        const significantChanges = detectedChanges.changes.modified.filter(change => {
            return (
                Math.abs(change.afterState.size - change.beforeState.size) >=
                this.config.minimumChangeSize
            );
        });

        return (
            significantChanges.length > 0 ||
            detectedChanges.changes.created.length > 0 ||
            detectedChanges.changes.deleted.length > 0
        );
    }

    /**
     * Get file modification time
     * @param {string} filePath - Path to file
     * @returns {number} Modification time timestamp
     */
    getFileModificationTime(filePath) {
        try {
            const stat = statSync(filePath);
            return stat.mtime.getTime();
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get file checksum
     * @param {string} filePath - Path to file
     * @returns {string} File checksum
     */
    getFileChecksum(filePath) {
        try {
            const { readFileSync } = require('fs');
            const content = readFileSync(filePath);
            return createHash('md5').update(content).digest('hex');
        } catch (error) {
            return null;
        }
    }

    /**
     * Create a file state snapshot for a specific directory
     * @param {string} basePath - Base directory path
     * @returns {Object} File state snapshot
     */
    async createFileStateSnapshot(basePath) {
        return this.captureFileStates(basePath);
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('FileChangeDetector configuration updated', { config: this.config });
    }

    /**
     * Get detector statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            cacheSize: this.stateCache.size,
            config: { ...this.config },
            excludePatterns: this.config.excludePatterns.length,
        };
    }
}

export default FileChangeDetector;
