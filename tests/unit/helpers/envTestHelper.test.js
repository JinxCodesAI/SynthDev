/**
 * Tests for Environment Test Helper
 * Verifies that the helper properly manages .env files during testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { EnvTestHelper, setupTestEnv, createTestProcessEnv } from '../../helpers/envTestHelper.js';

describe.sequential('EnvTestHelper', () => {
    let helper;
    let testWorkingDir;
    let originalEnvPath;
    let backupEnvPath;
    let testEnvPath;
    let originalEnvContent;

    beforeEach(() => {
        // Create a unique temporary directory for each test
        testWorkingDir = mkdtempSync(join(tmpdir(), 'envtest-'));

        // Create helper with specific working directory
        helper = new EnvTestHelper(testWorkingDir);

        originalEnvPath = join(testWorkingDir, '.env');
        backupEnvPath = join(testWorkingDir, '.env.backup');
        testEnvPath = join(testWorkingDir, '.env.test');

        // Create a test .env file to work with
        originalEnvContent = `SYNTHDEV_API_KEY=sk-original-key
SYNTHDEV_BASE_MODEL=original-model
SYNTHDEV_BASE_URL=https://original.api.com/v1
SYNTHDEV_VERBOSITY_LEVEL=1
`;
        writeFileSync(originalEnvPath, originalEnvContent);
    });

    afterEach(() => {
        // Clean up the entire test working directory
        if (testWorkingDir && existsSync(testWorkingDir)) {
            try {
                // Use rmSync with recursive option to clean up entire directory
                rmSync(testWorkingDir, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors, but log them for debugging
                console.warn('Warning: Could not clean up test directory:', error.message);
            }
        }
    });

    describe('setupTestEnv', () => {
        it('should create backup of original .env file', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(existsSync(backupEnvPath)).toBe(true);
            const backupContent = readFileSync(backupEnvPath, 'utf8');
            expect(backupContent).toBe(originalEnvContent);

            cleanup();
        });

        it('should override .env with test configuration', () => {
            const testConfig = {
                SYNTHDEV_API_KEY: 'test-key-12345',
                SYNTHDEV_BASE_MODEL: 'test-model',
            };

            const cleanup = helper.setupTestEnv(testConfig);

            const envContent = readFileSync(originalEnvPath, 'utf8');
            expect(envContent).toContain('test-key-12345');
            expect(envContent).toContain('test-model');
            expect(envContent).toContain('# Test Environment Configuration');

            cleanup();
        });

        it('should create test .env file', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(existsSync(testEnvPath)).toBe(true);
            const testContent = readFileSync(testEnvPath, 'utf8');
            expect(testContent).toContain('test-key-12345');

            cleanup();
        });

        it('should return cleanup function', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(typeof cleanup).toBe('function');
            cleanup();
        });
    });

    describe('cleanup', () => {
        it('should restore original .env file', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            // Verify test env is active
            const testContent = readFileSync(originalEnvPath, 'utf8');
            expect(testContent).toContain('test-key-12345');

            // Cleanup
            cleanup();

            // Verify original is restored
            const restoredContent = readFileSync(originalEnvPath, 'utf8');
            expect(restoredContent).toBe(originalEnvContent);
            expect(restoredContent).not.toContain('test-key-12345');
        });

        it('should remove backup file after cleanup', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(existsSync(backupEnvPath)).toBe(true);
            cleanup();
            expect(existsSync(backupEnvPath)).toBe(false);
        });

        it('should remove test .env file after cleanup', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(existsSync(testEnvPath)).toBe(true);
            cleanup();
            expect(existsSync(testEnvPath)).toBe(false);
        });
    });

    describe('createTestProcessEnv', () => {
        it('should return process environment with test values', () => {
            const testConfig = {
                SYNTHDEV_API_KEY: 'test-key-12345',
                SYNTHDEV_BASE_MODEL: 'test-model',
            };

            const processEnv = helper.createTestProcessEnv(testConfig);

            expect(processEnv.SYNTHDEV_API_KEY).toBe('test-key-12345');
            expect(processEnv.SYNTHDEV_BASE_MODEL).toBe('test-model');
            expect(processEnv.NODE_ENV).toBe('test');
        });

        it('should include default test values', () => {
            const processEnv = helper.createTestProcessEnv();

            expect(processEnv.SYNTHDEV_API_KEY).toBe('sk-test-key-12345-valid-format');
            expect(processEnv.SYNTHDEV_BASE_MODEL).toBe('gpt-4.1-mini');
            expect(processEnv.SYNTHDEV_BASE_URL).toBe('https://api.openai.com/v1');
        });

        it('should preserve existing process environment', () => {
            const originalPath = process.env.PATH;
            const processEnv = helper.createTestProcessEnv();

            expect(processEnv.PATH).toBe(originalPath);
        });
    });

    describe('isEnvFileInTestState', () => {
        it('should detect test state when .env contains test content', () => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(helper.isEnvFileInTestState()).toBe(true);
            cleanup();
        });

        it('should return false when .env contains original content', () => {
            expect(helper.isEnvFileInTestState()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return correct status information', () => {
            const status = helper.getStatus();

            expect(status).toHaveProperty('originalEnvExists');
            expect(status).toHaveProperty('backupExists');
            expect(status).toHaveProperty('testEnvExists');
            expect(status).toHaveProperty('isBackupCreated');
            expect(status).toHaveProperty('isTestActive');
            expect(status).toHaveProperty('isInTestState');
        });
    });
});

describe.sequential('Convenience functions', () => {
    let testWorkingDir;
    let originalEnvPath;

    beforeEach(() => {
        // Create a unique temporary directory for each test
        testWorkingDir = mkdtempSync(join(tmpdir(), 'envtest-convenience-'));
        originalEnvPath = join(testWorkingDir, '.env');
        writeFileSync(originalEnvPath, 'SYNTHDEV_API_KEY=original-key\n');
    });

    afterEach(() => {
        // Clean up the entire test working directory
        if (testWorkingDir && existsSync(testWorkingDir)) {
            try {
                rmSync(testWorkingDir, { recursive: true, force: true });
            } catch (error) {
                console.warn('Warning: Could not clean up test directory:', error.message);
            }
        }
    });

    describe('setupTestEnv', () => {
        it('should work as convenience function', () => {
            // Note: The convenience function uses the default singleton instance
            // which will use its own working directory detection
            const cleanup = setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            // The convenience function may use a different working directory
            // so we just verify it doesn't throw and cleanup works
            expect(typeof cleanup).toBe('function');

            // Cleanup should not throw
            expect(() => cleanup()).not.toThrow();
        });
    });

    describe('createTestProcessEnv', () => {
        it('should work as convenience function', () => {
            const processEnv = createTestProcessEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });

            expect(processEnv.SYNTHDEV_API_KEY).toBe('test-key-12345');
            expect(processEnv.NODE_ENV).toBe('test');
        });
    });
});

describe.sequential('Error handling', () => {
    let helper;
    let testWorkingDir;

    beforeEach(() => {
        // Create a unique temporary directory for error handling tests
        testWorkingDir = mkdtempSync(join(tmpdir(), 'envtest-error-'));
        helper = new EnvTestHelper(testWorkingDir);
    });

    afterEach(() => {
        // Clean up the test working directory
        if (testWorkingDir && existsSync(testWorkingDir)) {
            try {
                rmSync(testWorkingDir, { recursive: true, force: true });
            } catch (error) {
                console.warn('Warning: Could not clean up test directory:', error.message);
            }
        }
    });

    it('should handle missing original .env file gracefully', () => {
        // The .env file doesn't exist in the fresh temp directory
        // This should not throw an error
        expect(() => {
            const cleanup = helper.setupTestEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
            });
            cleanup();
        }).not.toThrow();
    });
});
