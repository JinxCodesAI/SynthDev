// tests/helpers/testUtils.js
// vi is imported for future use in test utilities
// eslint-disable-next-line no-unused-vars
import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Create a mock tool call for testing
 * @param {string} toolName - Name of the tool
 * @param {Object} args - Tool arguments
 * @returns {Object} Mock tool call object
 */
export function createMockToolCall(toolName, args) {
    return {
        id: `test-call-${Date.now()}`,
        function: {
            name: toolName,
            arguments: JSON.stringify(args),
        },
    };
}

/**
 * Create a temporary test file
 * @param {string} content - File content
 * @param {string} extension - File extension (default: .txt)
 * @returns {string} Temporary file path
 */
export function createTempFile(content = 'test content', extension = '.txt') {
    const tempDir = os.tmpdir();
    const fileName = `test-${Date.now()}${extension}`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, content);
    return filePath;
}

/**
 * Clean up temporary test files
 * @param {string[]} filePaths - Array of file paths to clean up
 */
export function cleanupTempFiles(filePaths) {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (_error) {
            // Ignore cleanup errors
        }
    });
}

/**
 * Mock environment variables for testing
 * @param {Object} envVars - Environment variables to mock
 * @returns {Function} Cleanup function to restore original env vars
 */
export function mockEnvVars(envVars) {
    const originalEnv = { ...process.env };

    Object.assign(process.env, envVars);

    return () => {
        process.env = originalEnv;
    };
}

/**
 * Create a temporary test directory with sample files
 * @param {string} testDir - Directory path to create
 */
export function createTestDirectory(testDir) {
    // Create main test directory
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Create subdirectories
    const subdir1 = path.join(testDir, 'subdir1');
    const subdir2 = path.join(testDir, 'subdir2');
    fs.mkdirSync(subdir1, { recursive: true });
    fs.mkdirSync(subdir2, { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'Content of file 1');
    fs.writeFileSync(path.join(testDir, 'file2.js'), 'console.log("Hello World");');
    fs.writeFileSync(path.join(subdir1, 'nested1.txt'), 'Nested file content');
    fs.writeFileSync(path.join(subdir2, 'nested2.md'), '# Markdown content');

    // Create hidden file (starts with dot)
    fs.writeFileSync(path.join(testDir, '.hidden'), 'Hidden file content');
}

/**
 * Clean up test directory with retry logic for Windows
 * @param {string} testDir - Directory path to remove
 */
export async function cleanupTestDirectory(testDir) {
    if (!fs.existsSync(testDir)) {
        return;
    }

    // Try cleanup with retries for Windows file locking issues
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
            break;
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                console.warn(
                    `Failed to cleanup test directory after ${maxAttempts} attempts:`,
                    error.message
                );
                break;
            }
            // Wait before retry (Windows file handle release)
            await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        }
    }
}

/**
 * Normalize path separators for cross-platform testing
 * @param {string} path - Path to normalize
 * @returns {string} Path with forward slashes
 */
export function normalizePath(pathStr) {
    return pathStr.replace(/\\/g, '/');
}

/**
 * Normalize array of paths for cross-platform testing
 * @param {string[]} paths - Array of paths to normalize
 * @returns {string[]} Array of paths with forward slashes
 */
export function normalizePaths(paths) {
    return paths.map(pathStr => normalizePath(pathStr));
}

/**
 * Generate a unique test directory name to avoid test interference
 * @param {string} baseName - Base name for the directory (default: 'test-temp')
 * @returns {string} Unique directory name
 */
export function generateUniqueTestDir(baseName = 'test-temp') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${baseName}-${timestamp}-${random}`;
}
