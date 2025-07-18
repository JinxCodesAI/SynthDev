/**
 * FileBackup - File state capture and restoration
 *
 * This class handles efficient file content capture with filtering,
 * safe file restoration, and preview functionality.
 */

import { getLogger } from '../managers/logger.js';
import { promises as fs } from 'fs';
import { join, dirname, relative } from 'path';
import * as path from 'path';

export class FileBackup {
    /**
     * Create a new FileBackup instance
     * @param {Object} fileFilter - File filtering implementation
     * @param {Object} config - Configuration object
     */
    constructor(fileFilter, config = {}) {
        this.fileFilter = fileFilter;
        this.config = {
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            preservePermissions: config.preservePermissions !== false,
            createBackups: config.createBackups !== false,
            ...config,
        };

        this.logger = getLogger();
        this.logger.debug('FileBackup initialized', { config: this.config });
    }

    /**
     * Capture files from a base path with filtering
     * @param {string} basePath - Base directory path
     * @param {Object} options - Capture options
     * @returns {Promise<Object>} Captured file data
     */
    async captureFiles(basePath, options = {}) {
        try {
            this.logger.debug('Capturing files', { basePath, options });

            const capturedFiles = {};
            const stats = {
                totalFiles: 0,
                totalSize: 0,
                skippedFiles: 0,
                errors: []
            };

            // Traverse directory structure recursively
            await this._traverseDirectory(basePath, basePath, capturedFiles, stats, options);

            this.logger.info('File capture completed', {
                basePath,
                totalFiles: stats.totalFiles,
                totalSize: stats.totalSize,
                skippedFiles: stats.skippedFiles,
                errorCount: stats.errors.length
            });

            return {
                basePath,
                timestamp: new Date().toISOString(),
                files: capturedFiles,
                stats
            };
        } catch (error) {
            this.logger.error(error, 'Failed to capture files');
            throw error;
        }
    }

    /**
     * Restore files from captured data
     * @param {Object} fileData - Captured file data
     * @param {Object} options - Restoration options
     * @returns {Promise<Object>} Restoration result
     */
    async restoreFiles(fileData, options = {}) {
        try {
            this.logger.debug('Restoring files', { options });

            // Validate file data
            if (!this.validateFileData(fileData)) {
                throw new Error('Invalid file data provided for restoration');
            }

            const result = {
                snapshotId: fileData.snapshotId || 'unknown',
                description: fileData.description || 'Unknown snapshot',
                timestamp: fileData.timestamp || new Date().toISOString(),
                filesRestored: 0,
                filesSkipped: 0,
                errors: []
            };

            let backupLocation = null;

            try {
                // Create backup of current files if enabled
                if (options.createBackup !== false && this.config.createBackups) {
                    const filesToBackup = Object.keys(fileData.files || {});
                    if (filesToBackup.length > 0) {
                        backupLocation = await this._createBackup(filesToBackup);
                        this.logger.debug('Backup created', { backupLocation });
                    }
                }

                // Restore file contents
                const files = fileData.files || {};
                for (const [relativePath, fileInfo] of Object.entries(files)) {
                    try {
                        await this._restoreFile(relativePath, fileInfo, fileData.basePath, options);
                        result.filesRestored++;
                    } catch (fileError) {
                        this.logger.warn('Failed to restore file', {
                            relativePath,
                            error: fileError.message
                        });
                        result.errors.push(`${relativePath}: ${fileError.message}`);
                        result.filesSkipped++;
                    }
                }

                this.logger.info('File restoration completed', {
                    filesRestored: result.filesRestored,
                    filesSkipped: result.filesSkipped,
                    errorCount: result.errors.length
                });

                return result;
            } catch (restoreError) {
                // Rollback on failure if backup was created
                if (backupLocation && options.rollbackOnFailure !== false) {
                    try {
                        await this._rollbackRestore(backupLocation);
                        this.logger.info('Restoration rolled back successfully');
                    } catch (rollbackError) {
                        this.logger.error(rollbackError, 'Failed to rollback restoration');
                        result.errors.push(`Rollback failed: ${rollbackError.message}`);
                    }
                }
                throw restoreError;
            }
        } catch (error) {
            this.logger.error(error, 'Failed to restore files');
            throw error;
        }
    }

    /**
     * Preview what would be restored without actually restoring
     * @param {Object} fileData - Captured file data
     * @returns {Promise<Object>} Preview information
     */
    async previewRestore(fileData) {
        try {
            this.logger.debug('Previewing restore operation');

            // Validate file data
            if (!this.validateFileData(fileData)) {
                throw new Error('Invalid file data provided for preview');
            }

            const preview = {
                snapshotInfo: {
                    timestamp: fileData.timestamp,
                    basePath: fileData.basePath,
                    totalFiles: Object.keys(fileData.files || {}).length
                },
                changes: {
                    toCreate: [],
                    toModify: [],
                    toOverwrite: [],
                    conflicts: []
                },
                impact: {
                    totalSize: 0,
                    riskLevel: 'low'
                }
            };

            // Analyze each file
            const files = fileData.files || {};
            for (const [relativePath, fileInfo] of Object.entries(files)) {
                const fullPath = join(fileData.basePath || process.cwd(), relativePath);

                try {
                    const currentStats = await fs.stat(fullPath);

                    if (currentStats.isFile()) {
                        // File exists - check if it would be modified
                        const currentContent = await fs.readFile(fullPath, 'utf8');
                        if (currentContent !== fileInfo.content) {
                            preview.changes.toModify.push({
                                path: relativePath,
                                currentSize: currentStats.size,
                                newSize: Buffer.byteLength(fileInfo.content, 'utf8'),
                                lastModified: currentStats.mtime
                            });
                        }
                    }
                } catch (statError) {
                    if (statError.code === 'ENOENT') {
                        // File doesn't exist - would be created
                        preview.changes.toCreate.push({
                            path: relativePath,
                            size: Buffer.byteLength(fileInfo.content, 'utf8')
                        });
                    } else {
                        // Other error - potential conflict
                        preview.changes.conflicts.push({
                            path: relativePath,
                            error: statError.message
                        });
                    }
                }

                preview.impact.totalSize += Buffer.byteLength(fileInfo.content, 'utf8');
            }

            // Assess risk level
            const totalChanges = preview.changes.toCreate.length +
                               preview.changes.toModify.length +
                               preview.changes.conflicts.length;

            if (totalChanges > 50 || preview.changes.conflicts.length > 0) {
                preview.impact.riskLevel = 'high';
            } else if (totalChanges > 10) {
                preview.impact.riskLevel = 'medium';
            }

            this.logger.debug('Restore preview completed', {
                toCreate: preview.changes.toCreate.length,
                toModify: preview.changes.toModify.length,
                conflicts: preview.changes.conflicts.length,
                riskLevel: preview.impact.riskLevel
            });

            return preview;
        } catch (error) {
            this.logger.error(error, 'Failed to preview restore');
            throw error;
        }
    }

    /**
     * Validate file data integrity
     * @param {Object} fileData - File data to validate
     * @returns {boolean} Whether file data is valid
     */
    validateFileData(fileData) {
        try {
            // Check required fields
            if (!fileData || typeof fileData !== 'object') {
                this.logger.warn('File data is not a valid object');
                return false;
            }

            if (!fileData.files || typeof fileData.files !== 'object') {
                this.logger.warn('File data missing files object');
                return false;
            }

            // Validate each file entry
            for (const [relativePath, fileInfo] of Object.entries(fileData.files)) {
                if (!relativePath || typeof relativePath !== 'string') {
                    this.logger.warn('Invalid file path', { relativePath });
                    return false;
                }

                if (!fileInfo || typeof fileInfo !== 'object') {
                    this.logger.warn('Invalid file info', { relativePath });
                    return false;
                }

                if (typeof fileInfo.content !== 'string') {
                    this.logger.warn('File content must be string', { relativePath });
                    return false;
                }

                // Validate file paths don't contain dangerous patterns
                if (relativePath.includes('..') || relativePath.startsWith('/')) {
                    this.logger.warn('Potentially dangerous file path', { relativePath });
                    return false;
                }
            }

            return true;
        } catch (error) {
            this.logger.error(error, 'Failed to validate file data');
            return false;
        }
    }

    /**
     * Calculate the impact of restoring file data
     * @param {Object} fileData - File data to analyze
     * @returns {Promise<Object>} Impact assessment
     */
    async calculateRestoreImpact(fileData) {
        try {
            this.logger.debug('Calculating restore impact');

            // TODO: Implement impact calculation
            // 1. Count files to be affected
            // 2. Calculate size changes
            // 3. Identify potential conflicts
            // 4. Assess risk level
            // 5. Return impact summary

            throw new Error('calculateRestoreImpact method not yet implemented');
        } catch (error) {
            this.logger.error(error, 'Failed to calculate restore impact');
            throw error;
        }
    }

    /**
     * Create a backup of current files before restoration
     * @param {Array} filePaths - Paths of files to backup
     * @returns {Promise<string>} Backup location
     */
    async _createBackup(filePaths) {
        try {
            const backupDir = join(process.cwd(), '.synth-backup', Date.now().toString());
            await fs.mkdir(backupDir, { recursive: true });

            for (const filePath of filePaths) {
                try {
                    const fullPath = join(process.cwd(), filePath);
                    const backupPath = join(backupDir, filePath);

                    // Ensure backup directory exists
                    await fs.mkdir(dirname(backupPath), { recursive: true });

                    // Copy file if it exists
                    try {
                        await fs.copyFile(fullPath, backupPath);
                    } catch (copyError) {
                        if (copyError.code !== 'ENOENT') {
                            throw copyError;
                        }
                        // File doesn't exist, skip backup
                    }
                } catch (fileError) {
                    this.logger.warn('Failed to backup file', {
                        filePath,
                        error: fileError.message
                    });
                }
            }

            return backupDir;
        } catch (error) {
            this.logger.error(error, 'Failed to create backup');
            throw error;
        }
    }

    /**
     * Rollback a failed restoration
     * @param {string} backupLocation - Location of backup files
     * @returns {Promise<void>}
     */
    async _rollbackRestore(backupLocation) {
        try {
            if (!backupLocation) {
                throw new Error('No backup location provided for rollback');
            }

            // Restore files from backup
            await this._traverseDirectory(backupLocation, backupLocation, {}, {}, {
                restoreMode: true,
                targetBasePath: process.cwd()
            });

            // Clean up backup directory
            await fs.rm(backupLocation, { recursive: true, force: true });
        } catch (error) {
            this.logger.error(error, 'Failed to rollback restore');
            throw error;
        }
    }

    /**
     * Traverse directory recursively for file operations
     * @param {string} currentPath - Current directory path
     * @param {string} basePath - Base directory path
     * @param {Object} capturedFiles - Object to store captured files
     * @param {Object} stats - Statistics object
     * @param {Object} options - Operation options
     * @returns {Promise<void>}
     */
    async _traverseDirectory(currentPath, basePath, capturedFiles, stats, options = {}) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(currentPath, entry.name);
                const relativePath = path.relative(basePath, fullPath);

                if (entry.isDirectory()) {
                    // Check if directory should be included
                    if (this.fileFilter && !this.fileFilter.shouldIncludeDirectory(relativePath, entry)) {
                        continue;
                    }

                    // Recursively traverse subdirectory
                    await this._traverseDirectory(fullPath, basePath, capturedFiles, stats, options);
                } else if (entry.isFile()) {
                    // Check if file should be included
                    const fileStats = await fs.stat(fullPath);
                    if (this.fileFilter && !this.fileFilter.shouldIncludeFile(relativePath, fileStats)) {
                        if (stats) stats.skippedFiles++;
                        continue;
                    }

                    if (options.restoreMode) {
                        // Restore mode - copy file to target location
                        const targetPath = join(options.targetBasePath, relativePath);
                        await fs.mkdir(dirname(targetPath), { recursive: true });
                        await fs.copyFile(fullPath, targetPath);
                    } else {
                        // Capture mode - read and store file content
                        await this._captureFile(fullPath, relativePath, capturedFiles, stats, options);
                    }
                }
            }
        } catch (error) {
            this.logger.error(error, 'Failed to traverse directory', { currentPath });
            if (stats) {
                stats.errors.push(`Directory traversal failed: ${currentPath} - ${error.message}`);
            }
        }
    }

    /**
     * Capture a single file
     * @param {string} fullPath - Full file path
     * @param {string} relativePath - Relative file path
     * @param {Object} capturedFiles - Object to store captured files
     * @param {Object} stats - Statistics object
     * @param {Object} options - Capture options
     * @returns {Promise<void>}
     */
    async _captureFile(fullPath, relativePath, capturedFiles, stats, options) {
        try {
            const fileStats = await fs.stat(fullPath);

            // Check file size limit
            if (fileStats.size > this.config.maxFileSize) {
                this.logger.warn('File exceeds size limit', {
                    relativePath,
                    size: fileStats.size,
                    limit: this.config.maxFileSize
                });
                if (stats) stats.skippedFiles++;
                return;
            }

            // Read file content
            const content = await fs.readFile(fullPath, 'utf8');

            // Store file information
            capturedFiles[relativePath] = {
                content,
                size: fileStats.size,
                mtime: fileStats.mtime.toISOString(),
                mode: fileStats.mode
            };

            if (options.includeMetadata) {
                capturedFiles[relativePath].metadata = {
                    uid: fileStats.uid,
                    gid: fileStats.gid,
                    atime: fileStats.atime.toISOString(),
                    ctime: fileStats.ctime.toISOString()
                };
            }

            if (stats) {
                stats.totalFiles++;
                stats.totalSize += fileStats.size;
            }

            this.logger.debug('File captured', { relativePath, size: fileStats.size });
        } catch (error) {
            this.logger.warn('Failed to capture file', {
                relativePath,
                error: error.message
            });
            if (stats) {
                stats.skippedFiles++;
                stats.errors.push(`${relativePath}: ${error.message}`);
            }
        }
    }

    /**
     * Restore a single file
     * @param {string} relativePath - Relative file path
     * @param {Object} fileInfo - File information
     * @param {string} basePath - Base path for restoration
     * @param {Object} options - Restoration options
     * @returns {Promise<void>}
     */
    async _restoreFile(relativePath, fileInfo, basePath, options) {
        try {
            const fullPath = join(basePath || process.cwd(), relativePath);

            // Ensure directory exists
            await fs.mkdir(dirname(fullPath), { recursive: true });

            // Write file content
            await fs.writeFile(fullPath, fileInfo.content, 'utf8');

            // Restore file permissions if enabled and available
            if (options.preservePermissions !== false && fileInfo.mode) {
                try {
                    await fs.chmod(fullPath, fileInfo.mode);
                } catch (chmodError) {
                    this.logger.warn('Failed to restore file permissions', {
                        relativePath,
                        error: chmodError.message
                    });
                }
            }

            // Restore timestamps if available
            if (fileInfo.mtime) {
                try {
                    const mtime = new Date(fileInfo.mtime);
                    const atime = fileInfo.metadata?.atime ? new Date(fileInfo.metadata.atime) : mtime;
                    await fs.utimes(fullPath, atime, mtime);
                } catch (utimesError) {
                    this.logger.warn('Failed to restore file timestamps', {
                        relativePath,
                        error: utimesError.message
                    });
                }
            }

            this.logger.debug('File restored', { relativePath });
        } catch (error) {
            this.logger.error(error, 'Failed to restore file', { relativePath });
            throw error;
        }
    }
}

export default FileBackup;
