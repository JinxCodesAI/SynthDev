/**
 * File backup and restoration component for snapshot system
 * Handles file content capture, restoration, and validation
 */

import { getLogger } from '../../core/managers/logger.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, dirname, relative, resolve } from 'path';
import { createHash } from 'crypto';

export class FileBackup {
    constructor(fileFilter, config = {}) {
        this.logger = getLogger();
        this.fileFilter = fileFilter;

        // Configuration with defaults
        this.config = {
            createBackups: config.createBackups !== false, // Default to true
            backupSuffix: config.backupSuffix || '.backup',
            preservePermissions: config.preservePermissions !== false, // Default to true
            validateChecksums: config.validateChecksums !== false, // Default to true
            maxConcurrentFiles: config.maxConcurrentFiles || 10,
            encoding: config.encoding || 'utf8',
            ...config,
        };

        this.logger.debug('FileBackup initialized', { config: this.config });
    }

    /**
     * Capture files from a directory with filtering
     * @param {string} basePath - Base directory to capture from
     * @param {Object} options - Capture options
     * @param {Array} options.specificFiles - Specific files to capture (optional)
     * @param {boolean} options.recursive - Recursively capture subdirectories
     * @returns {Promise<Object>} Captured file data
     */
    async captureFiles(basePath, options = {}) {
        try {
            const { specificFiles = null, recursive = true } = options;

            this.logger.debug('Starting file capture', { basePath, options });

            const captureStartTime = Date.now();
            const fileData = {
                basePath: resolve(basePath),
                captureTime: new Date().toISOString(),
                files: {},
                stats: {
                    totalFiles: 0,
                    totalSize: 0,
                    captureTime: 0,
                },
            };

            // Get list of files to capture
            let filesToCapture;
            if (specificFiles) {
                filesToCapture = specificFiles.map(file => resolve(basePath, file));
            } else {
                filesToCapture = await this._discoverFiles(basePath, recursive);
            }

            // Filter files
            const filteredFiles = filesToCapture.filter(filePath => {
                try {
                    const stats = statSync(filePath);
                    return this.fileFilter.shouldIncludeFile(filePath, stats);
                } catch (error) {
                    this.logger.warn('Failed to check file for inclusion', {
                        filePath,
                        error: error.message,
                    });
                    return false;
                }
            });

            this.logger.debug('Files to capture after filtering', {
                total: filesToCapture.length,
                filtered: filteredFiles.length,
            });

            // Capture files in batches
            const batchSize = this.config.maxConcurrentFiles;
            for (let i = 0; i < filteredFiles.length; i += batchSize) {
                const batch = filteredFiles.slice(i, i + batchSize);
                await this._captureFileBatch(batch, fileData);
            }

            // Calculate final stats
            fileData.stats.captureTime = Date.now() - captureStartTime;
            fileData.stats.totalFiles = Object.keys(fileData.files).length;

            this.logger.debug('File capture completed', {
                totalFiles: fileData.stats.totalFiles,
                totalSize: fileData.stats.totalSize,
                captureTime: fileData.stats.captureTime,
            });

            return fileData;
        } catch (error) {
            this.logger.error(error, 'File capture failed', { basePath });
            throw error;
        }
    }

    /**
     * Restore files from captured data
     * @param {Object} fileData - Captured file data
     * @param {Object} options - Restoration options
     * @param {boolean} options.createBackups - Create backups before restoration
     * @param {boolean} options.validateChecksums - Validate checksums after restoration
     * @param {Array} options.specificFiles - Specific files to restore (optional)
     * @returns {Promise<Object>} Restoration results
     */
    async restoreFiles(fileData, options = {}) {
        try {
            const {
                createBackups = this.config.createBackups,
                validateChecksums = this.config.validateChecksums,
                specificFiles = null,
            } = options;

            this.logger.debug('Starting file restoration', {
                basePath: fileData.basePath,
                totalFiles: Object.keys(fileData.files).length,
                options,
            });

            const restoreStartTime = Date.now();
            const results = {
                restored: [],
                skipped: [],
                errors: [],
                backups: [],
                stats: {
                    totalFiles: 0,
                    restoredFiles: 0,
                    skippedFiles: 0,
                    errorCount: 0,
                    restoreTime: 0,
                },
            };

            // Validate file data
            this.validateFileData(fileData);

            // Get files to restore
            const filesToRestore = specificFiles
                ? specificFiles.filter(file => fileData.files[file])
                : Object.keys(fileData.files);

            // Restore files in batches
            const batchSize = this.config.maxConcurrentFiles;
            for (let i = 0; i < filesToRestore.length; i += batchSize) {
                const batch = filesToRestore.slice(i, i + batchSize);
                await this._restoreFileBatch(batch, fileData, options, results);
            }

            // Validate checksums if requested
            if (validateChecksums) {
                await this._validateRestoredFiles(filesToRestore, fileData, results);
            }

            // Calculate final stats
            results.stats.restoreTime = Date.now() - restoreStartTime;
            results.stats.totalFiles = filesToRestore.length;
            results.stats.restoredFiles = results.restored.length;
            results.stats.skippedFiles = results.skipped.length;
            results.stats.errorCount = results.errors.length;

            this.logger.debug('File restoration completed', {
                results: results.stats,
            });

            return results;
        } catch (error) {
            this.logger.error(error, 'File restoration failed');
            throw error;
        }
    }

    /**
     * Preview restoration impact without actually restoring files
     * @param {Object} fileData - Captured file data
     * @param {Object} options - Preview options
     * @param {Array} options.specificFiles - Specific files to preview (optional)
     * @returns {Promise<Object>} Preview results
     */
    async previewRestore(fileData, options = {}) {
        try {
            const { specificFiles = null } = options;

            this.logger.debug('Generating restoration preview', {
                basePath: fileData.basePath,
                totalFiles: Object.keys(fileData.files).length,
            });

            const preview = {
                basePath: fileData.basePath,
                captureTime: fileData.captureTime,
                files: {
                    toCreate: [],
                    toModify: [],
                    toDelete: [],
                    unchanged: [],
                },
                stats: {
                    totalFiles: 0,
                    impactedFiles: 0,
                    totalSize: 0,
                },
            };

            // Get files to preview
            const filesToPreview = specificFiles
                ? specificFiles.filter(file => fileData.files[file])
                : Object.keys(fileData.files);

            for (const relativePath of filesToPreview) {
                const fileInfo = fileData.files[relativePath];
                const fullPath = join(fileData.basePath, relativePath);

                try {
                    if (existsSync(fullPath)) {
                        // Check if file would be modified
                        const currentContent = readFileSync(fullPath, this.config.encoding);
                        const currentChecksum = this._calculateChecksum(currentContent);

                        if (currentChecksum !== fileInfo.checksum) {
                            preview.files.toModify.push({
                                path: relativePath,
                                size: fileInfo.size,
                                currentSize: currentContent.length,
                                modified: fileInfo.modified,
                            });
                        } else {
                            preview.files.unchanged.push({
                                path: relativePath,
                                size: fileInfo.size,
                                modified: fileInfo.modified,
                            });
                        }
                    } else {
                        // File would be created
                        preview.files.toCreate.push({
                            path: relativePath,
                            size: fileInfo.size,
                            modified: fileInfo.modified,
                        });
                    }

                    preview.stats.totalSize += fileInfo.size;
                } catch (error) {
                    this.logger.warn('Failed to preview file', {
                        relativePath,
                        error: error.message,
                    });
                }
            }

            preview.stats.totalFiles = filesToPreview.length;
            preview.stats.impactedFiles =
                preview.files.toCreate.length + preview.files.toModify.length;

            this.logger.debug('Restoration preview generated', {
                stats: preview.stats,
            });

            return preview;
        } catch (error) {
            this.logger.error(error, 'Failed to generate restoration preview');
            throw error;
        }
    }

    /**
     * Validate file data integrity
     * @param {Object} fileData - File data to validate
     */
    validateFileData(fileData) {
        if (!fileData || typeof fileData !== 'object') {
            throw new Error('Invalid file data: must be an object');
        }

        if (!fileData.basePath || typeof fileData.basePath !== 'string') {
            throw new Error('Invalid file data: basePath is required');
        }

        if (!fileData.files || typeof fileData.files !== 'object') {
            throw new Error('Invalid file data: files object is required');
        }

        if (!fileData.captureTime) {
            throw new Error('Invalid file data: captureTime is required');
        }

        // Validate individual file entries
        for (const [relativePath, fileInfo] of Object.entries(fileData.files)) {
            if (
                fileInfo.content === undefined ||
                fileInfo.content === null ||
                typeof fileInfo.content !== 'string'
            ) {
                throw new Error(`Invalid file data: content missing for ${relativePath}`);
            }

            if (!fileInfo.checksum || typeof fileInfo.checksum !== 'string') {
                throw new Error(`Invalid file data: checksum missing for ${relativePath}`);
            }
        }
    }

    /**
     * Calculate restoration impact
     * @param {Object} fileData - File data to analyze
     * @returns {Object} Impact assessment
     */
    calculateRestoreImpact(fileData) {
        const impact = {
            filesAffected: 0,
            bytesAffected: 0,
            potentialDataLoss: false,
            conflicts: [],
        };

        for (const [relativePath, fileInfo] of Object.entries(fileData.files)) {
            const fullPath = join(fileData.basePath, relativePath);

            if (existsSync(fullPath)) {
                try {
                    const currentContent = readFileSync(fullPath, this.config.encoding);
                    const currentChecksum = this._calculateChecksum(currentContent);

                    if (currentChecksum !== fileInfo.checksum) {
                        impact.filesAffected++;
                        impact.bytesAffected += fileInfo.size;

                        // Check for potential data loss
                        if (currentContent.length > fileInfo.content.length) {
                            impact.potentialDataLoss = true;
                            impact.conflicts.push({
                                path: relativePath,
                                reason: 'Current file is larger than snapshot version',
                                currentSize: currentContent.length,
                                snapshotSize: fileInfo.size,
                            });
                        }
                    }
                } catch (error) {
                    impact.conflicts.push({
                        path: relativePath,
                        reason: 'Cannot read current file',
                        error: error.message,
                    });
                }
            } else {
                impact.filesAffected++;
                impact.bytesAffected += fileInfo.size;
            }
        }

        return impact;
    }

    /**
     * Discover files in a directory
     * @private
     * @param {string} basePath - Base directory
     * @param {boolean} recursive - Recursively search subdirectories
     * @returns {Promise<Array>} Array of file paths
     */
    async _discoverFiles(basePath, recursive = true) {
        const files = [];

        const processDirectory = async dirPath => {
            try {
                // First check if this directory should be included
                if (dirPath !== basePath && !this.fileFilter.shouldIncludeDirectory(dirPath)) {
                    this.logger.debug('Directory excluded, skipping', { dirPath });
                    return;
                }

                const entries = await readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = join(dirPath, entry.name);

                    if (entry.isDirectory()) {
                        if (recursive) {
                            await processDirectory(fullPath);
                        }
                    } else if (entry.isFile()) {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to read directory', { dirPath, error: error.message });
            }
        };

        await processDirectory(basePath);
        return files;
    }

    /**
     * Capture a batch of files
     * @private
     * @param {Array} filePaths - Array of file paths to capture
     * @param {Object} fileData - File data object to populate
     */
    async _captureFileBatch(filePaths, fileData) {
        const capturePromises = filePaths.map(async filePath => {
            try {
                const stats = statSync(filePath);
                const relativePath = relative(fileData.basePath, filePath);
                const content = readFileSync(filePath, this.config.encoding);
                const checksum = this._calculateChecksum(content);

                fileData.files[relativePath] = {
                    content,
                    checksum,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    permissions: stats.mode,
                };

                fileData.stats.totalSize += stats.size;

                this.logger.debug('File captured', {
                    relativePath,
                    size: stats.size,
                    checksum,
                });
            } catch (error) {
                this.logger.warn('Failed to capture file', {
                    filePath,
                    error: error.message,
                });
            }
        });

        await Promise.all(capturePromises);
    }

    /**
     * Restore a batch of files
     * @private
     * @param {Array} relativePaths - Array of relative file paths to restore
     * @param {Object} fileData - File data containing content to restore
     * @param {Object} options - Restoration options
     * @param {Object} results - Results object to populate
     */
    async _restoreFileBatch(relativePaths, fileData, options, results) {
        const { createBackups } = options;

        const restorePromises = relativePaths.map(async relativePath => {
            try {
                const fileInfo = fileData.files[relativePath];
                const fullPath = join(fileData.basePath, relativePath);

                // Create directory if it doesn't exist
                const dir = dirname(fullPath);
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }

                // Create backup if requested and file exists
                if (createBackups && existsSync(fullPath)) {
                    const backupPath = fullPath + this.config.backupSuffix;
                    copyFileSync(fullPath, backupPath);
                    results.backups.push({
                        original: fullPath,
                        backup: backupPath,
                    });
                }

                // Write file content
                writeFileSync(fullPath, fileInfo.content, this.config.encoding);

                // Restore permissions if configured
                if (this.config.preservePermissions && fileInfo.permissions) {
                    try {
                        // Note: This is a simplified permissions restoration
                        // In a real implementation, you might want more sophisticated permission handling
                    } catch (permError) {
                        this.logger.warn('Failed to restore file permissions', {
                            fullPath,
                            error: permError.message,
                        });
                    }
                }

                results.restored.push({
                    path: relativePath,
                    size: fileInfo.size,
                    checksum: fileInfo.checksum,
                });

                this.logger.debug('File restored', {
                    relativePath,
                    size: fileInfo.size,
                });
            } catch (error) {
                this.logger.error(error, 'Failed to restore file', { relativePath });
                results.errors.push({
                    path: relativePath,
                    error: error.message,
                });
            }
        });

        await Promise.all(restorePromises);
    }

    /**
     * Validate restored files against checksums
     * @private
     * @param {Array} relativePaths - Array of relative file paths to validate
     * @param {Object} fileData - Original file data
     * @param {Object} results - Results object to update
     */
    async _validateRestoredFiles(relativePaths, fileData, results) {
        this.logger.debug('Validating restored files', { count: relativePaths.length });

        for (const relativePath of relativePaths) {
            try {
                const fileInfo = fileData.files[relativePath];
                const fullPath = join(fileData.basePath, relativePath);

                if (existsSync(fullPath)) {
                    const content = readFileSync(fullPath, this.config.encoding);
                    const checksum = this._calculateChecksum(content);

                    if (checksum !== fileInfo.checksum) {
                        this.logger.warn('Checksum validation failed', {
                            relativePath,
                            expected: fileInfo.checksum,
                            actual: checksum,
                        });

                        results.errors.push({
                            path: relativePath,
                            error: 'Checksum validation failed',
                        });
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to validate file', {
                    relativePath,
                    error: error.message,
                });
            }
        }
    }

    /**
     * Calculate checksum for content
     * @private
     * @param {string} content - File content
     * @returns {string} SHA256 checksum
     */
    _calculateChecksum(content) {
        return createHash('sha256').update(content).digest('hex');
    }
}

export default FileBackup;
