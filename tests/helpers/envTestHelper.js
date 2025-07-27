/**
 * Environment Test Helper
 *
 * Provides safe, temporary environment file management for tests.
 * Ensures .env file is never permanently overwritten during testing.
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

// Global registry for cleanup handlers to prevent memory leaks
const globalCleanupRegistry = new Set();
let cleanupHandlersRegistered = false;

class EnvTestHelper {
    constructor(workingDir = null) {
        // Use provided working directory or detect appropriate one
        this.workingDir = workingDir || this.detectWorkingDirectory();

        this.originalEnvPath = join(this.workingDir, '.env');
        this.backupEnvPath = join(this.workingDir, '.env.backup');
        this.testEnvPath = join(this.workingDir, '.env.test');
        this.isBackupCreated = false;
        this.isTestActive = false;

        // Ensure working directory exists
        this.ensureWorkingDirectory();

        // Register this instance for cleanup
        globalCleanupRegistry.add(this);

        // Register global cleanup handlers only once
        this.registerGlobalCleanupHandlers();
    }

    /**
     * Detect appropriate working directory for tests
     * @returns {string} Working directory path
     */
    detectWorkingDirectory() {
        // ALWAYS use temporary directory for tests to prevent modifying real .env files
        // This ensures complete isolation and safety
        const testId = process.env.VITEST_WORKER_ID || process.pid || Date.now();
        const tempDir = join(tmpdir(), `synthdev-test-${testId}`);
        return tempDir;
    }

    /**
     * Ensure working directory exists
     */
    ensureWorkingDirectory() {
        try {
            if (!existsSync(this.workingDir)) {
                mkdirSync(this.workingDir, { recursive: true });
            }
        } catch (error) {
            console.warn(
                `Warning: Could not create working directory ${this.workingDir}:`,
                error.message
            );
            // Fall back to current working directory
            this.workingDir = process.cwd();
            this.originalEnvPath = join(this.workingDir, '.env');
            this.backupEnvPath = join(this.workingDir, '.env.backup');
            this.testEnvPath = join(this.workingDir, '.env.test');
        }
    }

    /**
     * Register global cleanup handlers (only once) to ensure cleanup
     */
    registerGlobalCleanupHandlers() {
        if (cleanupHandlersRegistered) {
            return;
        }

        const globalCleanup = () => {
            // Clean up all active instances
            for (const instance of globalCleanupRegistry) {
                if (instance.isTestActive) {
                    console.warn('⚠️  Emergency cleanup: Restoring .env file for instance');
                    instance.forceRestore();
                }
            }
        };

        // Handle various exit scenarios
        process.on('exit', globalCleanup);
        process.on('SIGINT', globalCleanup);
        process.on('SIGTERM', globalCleanup);
        process.on('uncaughtException', globalCleanup);
        process.on('unhandledRejection', globalCleanup);

        cleanupHandlersRegistered = true;
    }

    /**
     * Setup test environment with temporary .env override
     * @param {Object} envConfig - Environment variables to set
     * @returns {Function} Cleanup function
     */
    setupTestEnv(envConfig) {
        try {
            // Ensure working directory exists
            this.ensureWorkingDirectory();

            // Create backup of original .env if it exists
            if (existsSync(this.originalEnvPath) && !this.isBackupCreated) {
                const originalContent = readFileSync(this.originalEnvPath, 'utf8');
                writeFileSync(this.backupEnvPath, originalContent);
                this.isBackupCreated = true;
            }

            // Create test environment content
            const testEnvContent = this.createEnvContent(envConfig);

            // Write to test file first (for debugging and verification)
            try {
                // Ensure directory exists for test file
                const testFileDir = dirname(this.testEnvPath);
                if (!existsSync(testFileDir)) {
                    mkdirSync(testFileDir, { recursive: true });
                }
                writeFileSync(this.testEnvPath, testEnvContent);
            } catch (testFileError) {
                console.warn('Warning: Could not create .env.test file:', testFileError.message);
                // Continue anyway - the test file is optional for debugging
            }

            // Only then overwrite the main .env (ensure directory exists)
            try {
                const envFileDir = dirname(this.originalEnvPath);
                if (!existsSync(envFileDir)) {
                    mkdirSync(envFileDir, { recursive: true });
                }
                writeFileSync(this.originalEnvPath, testEnvContent);
            } catch (envFileError) {
                console.error('Failed to write .env file:', envFileError.message);
                throw envFileError;
            }

            this.isTestActive = true;

            // Return cleanup function
            return () => this.cleanup();
        } catch (error) {
            console.error('Failed to setup test environment:', error);
            this.forceRestore();
            throw error;
        }
    }

    /**
     * Create environment file content from config object
     * @param {Object} envConfig - Environment configuration
     * @returns {string} Environment file content
     */
    createEnvContent(envConfig) {
        const defaultConfig = {
            SYNTHDEV_API_KEY: 'test-key-12345',
            SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            SYNTHDEV_VERBOSITY_LEVEL: '2',
            SYNTHDEV_ROLE: 'dude',
            SYNTHDEV_MAX_TOOL_CALLS: '50',
            SYNTHDEV_PROMPT_ENHANCEMENT: 'false',
        };

        const config = { ...defaultConfig, ...envConfig };

        let content = '# Test Environment Configuration\n';
        content += '# This file is automatically generated for testing\n';
        content += '# DO NOT EDIT MANUALLY\n\n';

        for (const [key, value] of Object.entries(config)) {
            content += `${key}=${value}\n`;
        }

        return content;
    }

    /**
     * Clean up test environment and restore original .env
     */
    cleanup() {
        try {
            // Remove test env file if it exists
            if (existsSync(this.testEnvPath)) {
                try {
                    unlinkSync(this.testEnvPath);
                } catch (error) {
                    console.warn('Warning: Could not remove .env.test file:', error.message);
                }
            }

            // Restore original .env if backup exists
            if (existsSync(this.backupEnvPath)) {
                try {
                    const backupContent = readFileSync(this.backupEnvPath, 'utf8');
                    writeFileSync(this.originalEnvPath, backupContent);
                    unlinkSync(this.backupEnvPath);
                    this.isBackupCreated = false;
                } catch (error) {
                    console.error('Error restoring .env from backup:', error.message);
                    throw error;
                }
            } else if (existsSync(this.originalEnvPath) && this.isTestActive) {
                // If no backup exists but we created a test .env, remove it
                try {
                    unlinkSync(this.originalEnvPath);
                } catch (error) {
                    console.warn('Warning: Could not remove test .env file:', error.message);
                }
            }

            this.isTestActive = false;

            // Remove this instance from global cleanup registry
            globalCleanupRegistry.delete(this);
        } catch (error) {
            console.error('Failed to cleanup test environment:', error);
            // Try force restore as last resort
            this.forceRestore();
        }
    }

    /**
     * Force restore original environment (emergency cleanup)
     */
    forceRestore() {
        try {
            if (existsSync(this.backupEnvPath)) {
                const backupContent = readFileSync(this.backupEnvPath, 'utf8');
                writeFileSync(this.originalEnvPath, backupContent);
                unlinkSync(this.backupEnvPath);
            }

            if (existsSync(this.testEnvPath)) {
                unlinkSync(this.testEnvPath);
            }

            this.isBackupCreated = false;
            this.isTestActive = false;

            // Remove this instance from global cleanup registry
            globalCleanupRegistry.delete(this);
        } catch (error) {
            console.error('Force restore failed:', error);
        }
    }

    /**
     * Create a test environment that uses environment variables instead of file override
     * This is safer as it doesn't touch the .env file at all
     * @param {Object} envConfig - Environment variables to set
     * @returns {Object} Process environment for spawning
     */
    createTestProcessEnv(envConfig) {
        const defaultConfig = {
            NODE_ENV: 'test',
            // Required configuration to prevent wizard from starting
            SYNTHDEV_API_KEY: 'sk-test-key-12345-valid-format',
            SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            SYNTHDEV_VERBOSITY_LEVEL: '2',
            SYNTHDEV_MAX_TOOL_CALLS: '50',
            SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT: 'false',
            // Additional configuration to ensure complete setup
            SYNTHDEV_ROLE: 'dude',
            // Smart model configuration (optional but helps avoid issues)
            SYNTHDEV_SMART_API_KEY: 'sk-test-key-12345-valid-format',
            SYNTHDEV_SMART_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_SMART_BASE_URL: 'https://api.openai.com/v1',
            // Fast model configuration (optional but helps avoid issues)
            SYNTHDEV_FAST_API_KEY: 'sk-test-key-12345-valid-format',
            SYNTHDEV_FAST_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_FAST_BASE_URL: 'https://api.openai.com/v1',
        };

        return {
            ...process.env,
            ...defaultConfig,
            ...envConfig,
        };
    }

    /**
     * Check if .env file contains test content (for debugging)
     * @returns {boolean} True if .env contains test content
     */
    isEnvFileInTestState() {
        try {
            if (!existsSync(this.originalEnvPath)) {
                return false;
            }

            const content = readFileSync(this.originalEnvPath, 'utf8');
            return (
                content.includes('test-key-12345') ||
                content.includes('test-api-key-12345') ||
                content.includes('# Test Environment Configuration')
            );
        } catch (error) {
            console.warn('Warning: Could not read .env file for state check:', error.message);
            return false;
        }
    }

    /**
     * Get current .env file status for debugging
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            workingDir: this.workingDir,
            originalEnvPath: this.originalEnvPath,
            originalEnvExists: existsSync(this.originalEnvPath),
            backupExists: existsSync(this.backupEnvPath),
            testEnvExists: existsSync(this.testEnvPath),
            isBackupCreated: this.isBackupCreated,
            isTestActive: this.isTestActive,
            isInTestState: this.isEnvFileInTestState(),
        };
    }
}

// Export singleton instance that always uses temporary directory for safety
export const envTestHelper = new EnvTestHelper();

// Export class for custom instances if needed
export { EnvTestHelper };

/**
 * Create an EnvTestHelper instance that works with the real project directory
 * WARNING: This should only be used for E2E tests that need to test actual .env file behavior
 * @returns {EnvTestHelper} Helper instance using project directory
 */
export function createProjectEnvHelper() {
    return new EnvTestHelper(process.cwd());
}

/**
 * Convenience function for setting up test environment (uses temp directory)
 * @param {Object} envConfig - Environment configuration
 * @returns {Function} Cleanup function
 */
export function setupTestEnv(envConfig = {}) {
    return envTestHelper.setupTestEnv(envConfig);
}

/**
 * Convenience function for creating test process environment
 * @param {Object} envConfig - Environment configuration
 * @returns {Object} Process environment
 */
export function createTestProcessEnv(envConfig = {}) {
    return envTestHelper.createTestProcessEnv(envConfig);
}
