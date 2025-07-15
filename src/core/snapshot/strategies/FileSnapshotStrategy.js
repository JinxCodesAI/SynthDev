/**
 * File-based Snapshot Strategy
 * Implements snapshot operations using in-memory file storage as fallback
 */

import { SnapshotStrategy } from '../interfaces/SnapshotStrategy.js';
import Snapshot from '../models/Snapshot.js';
import SnapshotLogger from '../utils/SnapshotLogger.js';
import SnapshotConfig from '../SnapshotConfig.js';
import SnapshotEventEmitter from '../events/SnapshotEventEmitter.js';
import { SnapshotEvents } from '../events/SnapshotEvents.js';
import ContentChangeDetector from '../utils/ContentChangeDetector.js';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * File-based implementation of snapshot strategy
 * Used as fallback when Git is not available or fails
 */
export class FileSnapshotStrategy extends SnapshotStrategy {
    constructor(config = null, eventEmitter = null) {
        super();
        this.config = config || new SnapshotConfig();
        this.eventEmitter = eventEmitter || new SnapshotEventEmitter();
        this.logger = new SnapshotLogger('FileSnapshotStrategy');
        this.changeDetector = new ContentChangeDetector(this.config);

        // File strategy state
        this.isInitialized = false;
        this.snapshots = new Map(); // snapshotId -> Snapshot
        this.currentMemoryUsage = 0;
        this.maxMemoryUsage = this.parseMemoryLimit(
            this.config.getSnapshotConfig().file.memoryLimit
        );
        this.maxSnapshots = this.config.getSnapshotConfig().file.maxSnapshots;
        this.compressionEnabled = this.config.getSnapshotConfig().file.compressionEnabled;
        this.checksumValidation = this.config.getSnapshotConfig().file.checksumValidation;

        // Performance tracking
        this.performanceMetrics = {
            snapshotsCreated: 0,
            filesBackedUp: 0,
            memoryEvictions: 0,
            compressionSavings: 0,
        };

        // Project root for path validation
        this.projectRoot = resolve(process.cwd());
    }

    /**
     * Initialize the file snapshot strategy
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        const timer = this.logger.createTimer('initialize');

        try {
            this.logger.info('Initializing file snapshot strategy...');

            // Validate configuration
            const configValidation = this.validateConfiguration();
            if (!configValidation.valid) {
                timer(false, { error: configValidation.error });
                return { success: false, error: configValidation.error };
            }

            // Change detector is ready to use (no initialization needed)

            // Set up cleanup handlers
            this.setupCleanupHandlers();

            this.isInitialized = true;
            timer(true);

            this.eventEmitter.emit(SnapshotEvents.STRATEGY_INITIALIZED, {
                strategy: 'file',
                maxMemoryUsage: this.maxMemoryUsage,
                maxSnapshots: this.maxSnapshots,
                compressionEnabled: this.compressionEnabled,
            });

            this.logger.info('File snapshot strategy initialized successfully');
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to initialize file strategy: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new snapshot using file-based storage
     * @param {string} instruction - User instruction that triggered the snapshot
     * @param {Map<string, string>|Array<string>} files - Files to include or file paths
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, snapshot?: Snapshot, error?: string}>}
     */
    async createSnapshot(instruction, files = null, options = {}) {
        const { includeUntracked = true, validatePaths = true } = options;

        const timer = this.logger.createTimer('create_snapshot');

        try {
            if (!this.isInitialized) {
                const initResult = await this.initialize();
                if (!initResult.success) {
                    timer(false, { error: initResult.error });
                    return { success: false, error: initResult.error };
                }
            }

            this.logger.info(`Creating file snapshot: ${instruction}`);

            // Create snapshot object
            const snapshot = new Snapshot({
                instruction,
                mode: 'file',
                metadata: {
                    strategy: 'file',
                    compressionEnabled: this.compressionEnabled,
                    checksumValidation: this.checksumValidation,
                },
            });

            // Collect files to include in snapshot
            const snapshotFiles = await this.collectSnapshotFiles(files, {
                includeUntracked,
                validatePaths,
            });

            // Check memory capacity before proceeding
            const estimatedSize = this.estimateSnapshotSize(snapshotFiles);
            await this.ensureMemoryCapacity(estimatedSize);

            // Enforce maximum snapshot count
            await this.enforceSnapshotLimit();

            // Add files to snapshot with optional compression
            let totalSize = 0;
            let compressedSize = 0;

            for (const [filePath, content] of snapshotFiles) {
                const originalSize = Buffer.byteLength(content, 'utf8');
                let finalContent = content;
                let checksum = null;

                // Apply compression if enabled and beneficial
                if (this.compressionEnabled && originalSize > 1024) {
                    const compressed = await this.compressContent(content);
                    if (compressed.length < originalSize * 0.8) {
                        finalContent = compressed.toString('base64');
                        compressedSize += compressed.length;
                        snapshot.metadata.compressedFiles =
                            snapshot.metadata.compressedFiles || new Set();
                        snapshot.metadata.compressedFiles.add(filePath);
                    } else {
                        compressedSize += originalSize;
                    }
                } else {
                    compressedSize += originalSize;
                }

                // Calculate checksum if validation is enabled
                if (this.checksumValidation) {
                    checksum = this.calculateChecksum(content);
                }

                snapshot.addFile(filePath, finalContent, checksum);
                totalSize += originalSize;
            }

            // Update memory usage tracking
            this.currentMemoryUsage += compressedSize;
            this.performanceMetrics.compressionSavings += totalSize - compressedSize;

            // Store snapshot
            this.snapshots.set(snapshot.id, snapshot);
            this.performanceMetrics.snapshotsCreated++;
            this.performanceMetrics.filesBackedUp += snapshotFiles.size;

            timer(true, {
                snapshotId: snapshot.id,
                fileCount: snapshotFiles.size,
                originalSize: totalSize,
                compressedSize: compressedSize,
                compressionRatio: totalSize > 0 ? compressedSize / totalSize : 1,
            });

            this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_CREATED, {
                snapshot,
                strategy: 'file',
                fileCount: snapshotFiles.size,
                memoryUsage: this.currentMemoryUsage,
            });

            return { success: true, snapshot };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to create file snapshot: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all available snapshots
     * @param {Object} options - Query options
     * @returns {Promise<{success: boolean, snapshots?: Array, error?: string}>}
     */
    async getSnapshots(options = {}) {
        const { limit = 50, includeMetadata = false, sortBy = 'timestamp' } = options;

        try {
            let snapshots = Array.from(this.snapshots.values());

            // Sort snapshots
            snapshots.sort((a, b) => {
                if (sortBy === 'timestamp') {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                } else if (sortBy === 'instruction') {
                    return a.instruction.localeCompare(b.instruction);
                }
                return 0;
            });

            // Apply limit
            snapshots = snapshots.slice(0, limit);

            // Format response
            const formattedSnapshots = snapshots.map(snapshot => ({
                id: snapshot.id,
                instruction: snapshot.instruction,
                mode: snapshot.mode,
                timestamp: snapshot.timestamp,
                fileCount: snapshot.files.size,
                metadata: includeMetadata ? snapshot.metadata : undefined,
            }));

            return { success: true, snapshots: formattedSnapshots };
        } catch (error) {
            this.logger.error(`Failed to get file snapshots: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a specific snapshot by ID
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, snapshot?: Snapshot, error?: string}>}
     */
    async getSnapshot(id) {
        try {
            const snapshot = this.snapshots.get(id);
            if (!snapshot) {
                return { success: false, error: `Snapshot ${id} not found` };
            }

            return { success: true, snapshot };
        } catch (error) {
            this.logger.error(`Failed to get snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a snapshot
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteSnapshot(id) {
        const timer = this.logger.createTimer('delete_snapshot');

        try {
            const snapshot = this.snapshots.get(id);
            if (!snapshot) {
                timer(false, { error: 'Snapshot not found' });
                return { success: false, error: `Snapshot ${id} not found` };
            }

            // Calculate memory to be freed
            const snapshotSize = snapshot.calculateSize();

            // Remove from storage
            this.snapshots.delete(id);
            this.currentMemoryUsage -= snapshotSize;

            timer(true, { snapshotId: id, freedMemory: snapshotSize });

            this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_DELETED, {
                snapshotId: id,
                strategy: 'file',
                freedMemory: snapshotSize,
            });

            this.logger.info(`Deleted snapshot ${id}, freed ${snapshotSize} bytes`);
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to delete snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Restore files from a snapshot
     * @param {string} id - Snapshot ID
     * @param {Object} options - Restoration options
     * @returns {Promise<{success: boolean, filesRestored?: Array, filesDeleted?: Array, error?: string}>}
     */
    async restoreSnapshot(id, options = {}) {
        const { dryRun = false, validateChecksums = true } = options;
        const timer = this.logger.createTimer('restore_snapshot');

        try {
            const snapshot = this.snapshots.get(id);
            if (!snapshot) {
                timer(false, { error: 'Snapshot not found' });
                return { success: false, error: `Snapshot ${id} not found` };
            }

            this.logger.info(`Restoring snapshot ${id} (${snapshot.files.size} files)`);

            const filesRestored = [];
            const filesDeleted = [];
            const errors = [];

            // Get current files in project
            const currentFiles = await this.getCurrentProjectFiles();

            // Restore files from snapshot
            for (const [filePath, content] of snapshot.files) {
                try {
                    if (content === null) {
                        // File was deleted in snapshot, skip restoration
                        continue;
                    }

                    // Validate path security
                    if (!this.isValidFilePath(filePath)) {
                        errors.push(`Invalid file path: ${filePath}`);
                        continue;
                    }

                    // Decompress content if needed
                    let finalContent = content;
                    if (snapshot.metadata.compressedFiles?.has(filePath)) {
                        finalContent = await this.decompressContent(Buffer.from(content, 'base64'));
                    }

                    // Validate checksum if enabled
                    if (validateChecksums && snapshot.fileChecksums.has(filePath)) {
                        const expectedChecksum = snapshot.fileChecksums.get(filePath);
                        const actualChecksum = this.calculateChecksum(finalContent);
                        if (expectedChecksum !== actualChecksum) {
                            errors.push(`Checksum mismatch for ${filePath}`);
                            continue;
                        }
                    }

                    if (!dryRun) {
                        // Ensure directory exists
                        await this.ensureDirectoryExists(dirname(filePath));

                        // Write file
                        await writeFile(filePath, finalContent, 'utf8');
                    }

                    filesRestored.push(filePath);
                    currentFiles.delete(filePath);
                } catch (error) {
                    errors.push(`Failed to restore ${filePath}: ${error.message}`);
                }
            }

            // Delete files that didn't exist in snapshot
            for (const filePath of currentFiles) {
                try {
                    if (!this.isValidFilePath(filePath)) {
                        continue;
                    }

                    if (!dryRun) {
                        await unlink(filePath);
                    }
                    filesDeleted.push(filePath);
                } catch (error) {
                    errors.push(`Failed to delete ${filePath}: ${error.message}`);
                }
            }

            timer(true, {
                snapshotId: id,
                filesRestored: filesRestored.length,
                filesDeleted: filesDeleted.length,
                errors: errors.length,
            });

            this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_RESTORED, {
                snapshotId: id,
                strategy: 'file',
                filesRestored,
                filesDeleted,
                errors,
            });

            return {
                success: errors.length === 0,
                filesRestored,
                filesDeleted,
                errors: errors.length > 0 ? errors : undefined,
            };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to restore snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear all snapshots
     * @returns {Promise<{success: boolean, cleared?: number, error?: string}>}
     */
    async clearSnapshots() {
        const timer = this.logger.createTimer('clear_snapshots');

        try {
            const count = this.snapshots.size;
            this.snapshots.clear();
            this.currentMemoryUsage = 0;

            timer(true, { cleared: count });

            this.eventEmitter.emit(SnapshotEvents.SNAPSHOTS_CLEARED, {
                strategy: 'file',
                cleared: count,
            });

            this.logger.info(`Cleared ${count} snapshots`);
            return { success: true, cleared: count };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to clear snapshots: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get strategy status and statistics
     * @returns {Object} Strategy status
     */
    getStatus() {
        return {
            mode: 'file',
            available: true,
            initialized: this.isInitialized,
            snapshotCount: this.snapshots.size,
            memoryUsage: {
                current: this.currentMemoryUsage,
                max: this.maxMemoryUsage,
                percentage: (this.currentMemoryUsage / this.maxMemoryUsage) * 100,
            },
            configuration: {
                maxSnapshots: this.maxSnapshots,
                compressionEnabled: this.compressionEnabled,
                checksumValidation: this.checksumValidation,
            },
            performance: this.performanceMetrics,
        };
    }

    /**
     * Check if file strategy is available
     * @returns {Promise<{available: boolean, reason?: string}>}
     */
    async isAvailable() {
        // File strategy is always available as fallback
        return { available: true };
    }

    /**
     * Get strategy mode
     * @returns {string} Strategy mode
     */
    getMode() {
        return 'file';
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Collect files for snapshot
     * @param {Map<string, string>|Array<string>} files - Files to include
     * @param {Object} options - Collection options
     * @returns {Promise<Map<string, string>>} Map of file paths to content
     */
    async collectSnapshotFiles(files, options = {}) {
        const { validatePaths = true } = options;
        const snapshotFiles = new Map();

        try {
            if (files instanceof Map) {
                // Files provided as Map<path, content>
                for (const [filePath, content] of files) {
                    if (validatePaths && !this.isValidFilePath(filePath)) {
                        this.logger.warn(`Skipping invalid file path: ${filePath}`);
                        continue;
                    }
                    snapshotFiles.set(filePath, content);
                }
            } else if (Array.isArray(files)) {
                // Files provided as array of paths
                for (const filePath of files) {
                    if (validatePaths && !this.isValidFilePath(filePath)) {
                        this.logger.warn(`Skipping invalid file path: ${filePath}`);
                        continue;
                    }

                    if (existsSync(filePath)) {
                        const content = await readFile(filePath, 'utf8');
                        snapshotFiles.set(filePath, content);
                    }
                }
            } else {
                // Auto-detect changed files using change detector
                const changedFiles = await this.getChangedFiles(true);
                for (const filePath of changedFiles) {
                    if (validatePaths && !this.isValidFilePath(filePath)) {
                        continue;
                    }

                    if (existsSync(filePath)) {
                        const content = await readFile(filePath, 'utf8');
                        snapshotFiles.set(filePath, content);
                    }
                }
            }

            return snapshotFiles;
        } catch (error) {
            this.logger.error(`Failed to collect snapshot files: ${error.message}`);
            return snapshotFiles;
        }
    }

    /**
     * Get changed files using change detector
     * @param {boolean} includeUntracked - Include untracked files
     * @returns {Promise<Array<string>>} Array of changed file paths
     */
    async getChangedFiles(_includeUntracked = true) {
        try {
            const changedFiles = [];
            const projectFiles = await this.getCurrentProjectFiles();

            for (const filePath of projectFiles) {
                if (await this.changeDetector.hasFileChanged(filePath)) {
                    changedFiles.push(filePath);
                }
            }

            return changedFiles;
        } catch (error) {
            this.logger.error(`Failed to get changed files: ${error.message}`);
            return [];
        }
    }

    /**
     * Get current project files
     * @returns {Promise<Set<string>>} Set of file paths
     */
    async getCurrentProjectFiles() {
        const files = new Set();

        try {
            await this.walkDirectory(this.projectRoot, files);
            return files;
        } catch (error) {
            this.logger.error(`Failed to get project files: ${error.message}`);
            return files;
        }
    }

    /**
     * Recursively walk directory to find files
     * @param {string} dir - Directory to walk
     * @param {Set<string>} files - Set to collect files
     */
    async walkDirectory(dir, files) {
        try {
            const { readdir } = await import('fs/promises');
            const entries = await readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                const relativePath = relative(this.projectRoot, fullPath);

                // Skip hidden files and directories
                if (entry.name.startsWith('.')) {
                    continue;
                }

                // Skip node_modules and other common ignore patterns
                if (this.shouldIgnoreFile(relativePath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, files);
                } else if (entry.isFile()) {
                    files.add(relativePath);
                }
            }
        } catch (error) {
            // Ignore permission errors and continue
            if (error.code !== 'EACCES' && error.code !== 'EPERM') {
                throw error;
            }
        }
    }

    /**
     * Check if file should be ignored
     * @param {string} filePath - File path to check
     * @returns {boolean} True if file should be ignored
     */
    shouldIgnoreFile(filePath) {
        const ignorePatterns = [
            'node_modules',
            '.git',
            '.vscode',
            '.idea',
            'dist',
            'build',
            'coverage',
            '.nyc_output',
            'logs',
            '*.log',
            '.DS_Store',
            'Thumbs.db',
        ];

        return ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(filePath);
            }
            return filePath.includes(pattern);
        });
    }

    /**
     * Validate file path for security
     * @param {string} filePath - File path to validate
     * @returns {boolean} True if path is valid
     */
    isValidFilePath(filePath) {
        try {
            // Prevent directory traversal
            if (filePath.includes('..') || filePath.includes('~')) {
                return false;
            }

            // Check for invalid characters (Windows)
            const invalidChars = /[<>:"|?*]/;
            if (invalidChars.test(filePath)) {
                return false;
            }

            // For absolute paths, ensure they're not accessing system directories
            if (resolve(filePath) === filePath) {
                // It's an absolute path - check it's not accessing dangerous locations
                const dangerousPaths = ['/etc', '/sys', '/proc', 'C:\\Windows', 'C:\\System32'];
                const resolvedPath = resolve(filePath);
                if (dangerousPaths.some(dangerous => resolvedPath.startsWith(dangerous))) {
                    return false;
                }
            } else {
                // It's a relative path - ensure it's within project directory
                const resolvedPath = resolve(this.projectRoot, filePath);
                if (!resolvedPath.startsWith(this.projectRoot)) {
                    return false;
                }
            }

            return true;
        } catch (_error) {
            return false;
        }
    }

    /**
     * Estimate snapshot size
     * @param {Map<string, string>} files - Files to estimate
     * @returns {number} Estimated size in bytes
     */
    estimateSnapshotSize(files) {
        let totalSize = 0;
        for (const [, content] of files) {
            totalSize += Buffer.byteLength(content, 'utf8');
        }
        return totalSize;
    }

    /**
     * Ensure memory capacity for new snapshot
     * @param {number} requiredSize - Required size in bytes
     */
    async ensureMemoryCapacity(requiredSize) {
        while (this.currentMemoryUsage + requiredSize > this.maxMemoryUsage) {
            const evicted = await this.evictOldestSnapshot();
            if (!evicted) {
                throw new Error('Cannot free enough memory for snapshot');
            }
        }
    }

    /**
     * Enforce maximum snapshot count limit
     */
    async enforceSnapshotLimit() {
        while (this.snapshots.size >= this.maxSnapshots) {
            const evicted = await this.evictOldestSnapshot();
            if (!evicted) {
                throw new Error('Cannot evict snapshots to enforce limit');
            }
        }
    }

    /**
     * Evict oldest snapshot to free memory
     * @returns {Promise<boolean>} True if snapshot was evicted
     */
    async evictOldestSnapshot() {
        if (this.snapshots.size === 0) {
            return false;
        }

        // Find oldest snapshot
        let oldestSnapshot = null;
        let oldestTime = Date.now();

        for (const snapshot of this.snapshots.values()) {
            const snapshotTime = new Date(snapshot.timestamp).getTime();
            if (snapshotTime < oldestTime) {
                oldestTime = snapshotTime;
                oldestSnapshot = snapshot;
            }
        }

        if (oldestSnapshot) {
            await this.deleteSnapshot(oldestSnapshot.id);
            this.performanceMetrics.memoryEvictions++;
            this.logger.info(`Evicted oldest snapshot ${oldestSnapshot.id} to free memory`);
            return true;
        }

        return false;
    }

    /**
     * Compress content using gzip
     * @param {string} content - Content to compress
     * @returns {Promise<Buffer>} Compressed content
     */
    async compressContent(content) {
        try {
            return await gzipAsync(Buffer.from(content, 'utf8'));
        } catch (error) {
            this.logger.warn(`Failed to compress content: ${error.message}`);
            return Buffer.from(content, 'utf8');
        }
    }

    /**
     * Decompress content using gunzip
     * @param {Buffer} compressedContent - Compressed content
     * @returns {Promise<string>} Decompressed content
     */
    async decompressContent(compressedContent) {
        try {
            const decompressed = await gunzipAsync(compressedContent);
            return decompressed.toString('utf8');
        } catch (error) {
            this.logger.warn(`Failed to decompress content: ${error.message}`);
            return compressedContent.toString('utf8');
        }
    }

    /**
     * Calculate checksum for content
     * @param {string} content - Content to checksum
     * @returns {string} MD5 checksum
     */
    calculateChecksum(content) {
        return createHash('md5').update(content, 'utf8').digest('hex');
    }

    /**
     * Parse memory limit string to bytes
     * @param {string} limit - Memory limit (e.g., "100MB", "1GB")
     * @returns {number} Limit in bytes
     */
    parseMemoryLimit(limit) {
        const units = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
        };

        const match = limit.match(/^(\d+)([A-Z]+)$/);
        if (!match) {
            return 100 * 1024 * 1024; // Default 100MB
        }

        const [, value, unit] = match;
        return parseInt(value) * (units[unit] || units.MB);
    }

    /**
     * Ensure directory exists
     * @param {string} dirPath - Directory path
     */
    async ensureDirectoryExists(dirPath) {
        try {
            const { mkdir } = await import('fs/promises');
            await mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Validate configuration
     * @returns {{valid: boolean, error?: string}}
     */
    validateConfiguration() {
        const config = this.config.getSnapshotConfig();

        if (!config.file) {
            return { valid: false, error: 'File configuration is missing' };
        }

        if (config.file.maxSnapshots <= 0) {
            return { valid: false, error: 'maxSnapshots must be greater than 0' };
        }

        if (!config.file.memoryLimit) {
            return { valid: false, error: 'memoryLimit is required' };
        }

        return { valid: true };
    }

    /**
     * Setup cleanup handlers
     */
    setupCleanupHandlers() {
        const cleanup = () => {
            if (this.config.getSnapshotConfig().cleanup.cleanupOnExit) {
                this.logger.info('Cleaning up file snapshots on exit...');
                this.clearSnapshots();
            }
        };

        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    }
}
