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
