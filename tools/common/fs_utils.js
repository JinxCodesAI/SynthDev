import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';
import { createHash } from 'crypto';

// Default exclusion list used in directory scanning
const defaultExclusionList = [
    'node_modules',
    '.git',
    '.svn',
    'build',
    'dist',
    '.cache',
    '__pycache__',
    '.DS_Store',
    'Thumbs.db',
    '.index',
];

/**
 * Recursively scan a directory with options
 * @param {string} dirPath - directory path to scan
 * @param {Object} options - optional parameters
 * @param {number} options.depth - maximum depth to scan (-1 is unlimited)
 * @param {boolean} options.includeHidden - include hidden files and directories
 * @param {string[]} options.exclusionList - list of file/directory names to exclude
 * @param {number} options.currentDepth - current recursion depth (internal use)
 * @returns {Array} array of entries with { name, type, path, size } (size only for files)
 */
export function scanDirectory(dirPath, options = {}) {
    const {
        depth = -1,
        includeHidden = false,
        exclusionList = defaultExclusionList,
        currentDepth = 0,
    } = options;

    if (depth !== -1 && currentDepth > depth) {
        return [];
    }

    let entries = [];
    let items;
    try {
        items = readdirSync(dirPath);
    } catch (_e) {
        // permission error or other reading issue, skip this directory
        return [];
    }

    for (const item of items) {
        if (!includeHidden && item.startsWith('.')) {
            continue;
        }
        if (exclusionList.includes(item)) {
            continue;
        }

        const itemPath = join(dirPath, item);
        let stats;
        try {
            stats = statSync(itemPath);
        } catch {
            // unable to access this item, skip
            continue;
        }

        if (stats.isDirectory()) {
            entries.push({
                name: item,
                type: 'directory',
                path: relative(process.cwd(), itemPath),
                lvl: currentDepth,
            });
            entries = entries.concat(
                scanDirectory(itemPath, {
                    depth,
                    includeHidden,
                    exclusionList,
                    currentDepth: currentDepth + 1,
                })
            );
        } else if (stats.isFile()) {
            entries.push({
                name: item,
                type: 'file',
                path: relative(process.cwd(), itemPath),
                size: stats.size,
                lvl: currentDepth,
            });
        }
    }

    return entries;
}

/**
 * Safely read file content as UTF-8 string
 * @param {string} filePath - full path to the file
 * @returns {string|null} file content string, or null if read fails
 */
export function safeReadFile(filePath) {
    try {
        return readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}

/**
 * Safely write file content with directory creation
 * @param {string} filePath - full path to the file
 * @param {string} content - content to write
 * @param {Object} options - write options
 * @param {string} options.encoding - file encoding (default: 'utf8')
 * @param {boolean} options.createDirectories - create parent directories if needed (default: true)
 * @returns {Object} result object with success status and metadata
 */
export function safeWriteFile(filePath, content, options = {}) {
    const { encoding = 'utf8', createDirectories = true } = options;

    try {
        // Create directories if needed
        if (createDirectories) {
            const dirPath = dirname(filePath);
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, { recursive: true });
            }
        }

        writeFileSync(filePath, content, encoding);

        const stats = statSync(filePath);
        return {
            success: true,
            size: stats.size,
            path: filePath,
            encoding,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            path: filePath,
        };
    }
}

/**
 * Validate path security (ensure it's within working directory)
 * @param {string} filePath - file path to validate
 * @param {string} cwd - current working directory (default: process.cwd())
 * @returns {Object} validation result
 */
export function validatePathSecurity(filePath, cwd = process.cwd()) {
    try {
        const targetPath = join(cwd, filePath);
        const resolvedPath = resolve(targetPath);
        const relativePath = relative(cwd, resolvedPath);

        if (relativePath.startsWith('..') || resolve(relativePath) !== resolvedPath) {
            return {
                valid: false,
                error: 'Path escapes working directory',
                path: filePath,
            };
        }

        return {
            valid: true,
            targetPath,
            resolvedPath,
            relativePath,
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message,
            path: filePath,
        };
    }
}

/**
 * Get file metadata safely
 * @param {string} filePath - path to the file
 * @returns {Object|null} file metadata or null if not accessible
 */
export function getFileMetadata(filePath) {
    try {
        const stats = statSync(filePath);
        return {
            size: stats.size,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            modified: stats.mtime,
            created: stats.birthtime,
            accessed: stats.atime,
        };
    } catch {
        return null;
    }
}

/**
 * Check if a file exists safely
 * @param {string} filePath - path to check
 * @returns {boolean} true if file exists and is accessible
 */
export function fileExists(filePath) {
    try {
        return existsSync(filePath);
    } catch {
        return false;
    }
}

/**
 * Create directories recursively if they don't exist
 * @param {string} dirPath - directory path to create
 * @returns {Object} result object with success status
 */
export function ensureDirectories(dirPath) {
    try {
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
        }
        return { success: true, path: dirPath };
    } catch (error) {
        return { success: false, error: error.message, path: dirPath };
    }
}

/**
 * Calculate CRC32 checksum for file content
 * @param {string} filePath - path to the file
 * @returns {string|null} CRC32 checksum as hex string or null if file cannot be read
 */
export function calculateFileChecksum(filePath) {
    try {
        const content = readFileSync(filePath);
        return createHash('md5').update(content).digest('hex');
    } catch (_error) {
        return null;
    }
}

/**
 * Calculate checksum for string content
 * @param {string} content - content to checksum
 * @returns {string} checksum as hex string
 */
export function calculateContentChecksum(content) {
    return createHash('md5').update(content, 'utf8').digest('hex');
}

/**
 * Calculate directory checksum from concatenated checksums of its direct contents
 * @param {Array} contentChecksums - array of checksums from direct contents
 * @returns {string} directory checksum as hex string
 */
export function calculateDirectoryChecksum(contentChecksums) {
    if (!contentChecksums || contentChecksums.length === 0) {
        return calculateContentChecksum(''); // Empty directory
    }

    // Sort checksums to ensure consistent ordering
    const sortedChecksums = [...contentChecksums].sort();
    const concatenated = sortedChecksums.join('');
    return calculateContentChecksum(concatenated);
}

/**
 * Get file extension from path
 * @param {string} filePath - file path
 * @returns {string} file extension (including dot) or empty string
 */
export function getFileExtension(filePath) {
    const lastDot = filePath.lastIndexOf('.');
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

    if (lastDot > lastSlash && lastDot !== -1) {
        return filePath.substring(lastDot);
    }
    return '';
}

/**
 * Filter files by extension
 * @param {Array} files - array of file objects with name property
 * @param {string|Array} extensions - extension(s) to filter by (with or without dot)
 * @returns {Array} filtered files
 */
export function filterFilesByExtension(files, extensions) {
    const extArray = Array.isArray(extensions) ? extensions : [extensions];
    const normalizedExts = extArray.map(ext => (ext.startsWith('.') ? ext : `.${ext}`));

    return files.filter(file => {
        const fileExt = getFileExtension(file.name || file.path || '');
        return normalizedExts.includes(fileExt.toLowerCase());
    });
}

/**
 * Common file type categories
 */
export const FILE_CATEGORIES = {
    text: ['.txt', '.md', '.rst', '.log'],
    code: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs'],
    web: ['.html', '.htm', '.css', '.scss', '.sass', '.less'],
    config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
    document: ['.pdf', '.doc', '.docx', '.odt', '.rtf'],
    archive: ['.zip', '.tar', '.gz', '.rar', '.7z'],
};

/**
 * Get file category based on extension
 * @param {string} filePath - file path
 * @returns {string|null} file category or null if unknown
 */
export function getFileCategory(filePath) {
    const ext = getFileExtension(filePath).toLowerCase();

    for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
        if (extensions.includes(ext)) {
            return category;
        }
    }

    return null;
}
