// tests/e2e/config-reload.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'fs';

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

/**
 * Get workspace directory with robust fallback handling
 * @returns {string} Workspace directory path
 */
async function getWorkspaceDirectory() {
    // Try GitHub Actions workspace first
    if (process.env.GITHUB_WORKSPACE) {
        return process.env.GITHUB_WORKSPACE;
    }

    // Try current working directory with error handling
    try {
        return process.cwd();
    } catch (error) {
        console.warn('Failed to get current working directory:', error.message);

        // Fallback to common workspace locations
        const fallbacks = [
            '/home/runner/work/SynthDev/SynthDev', // GitHub Actions default
            '/mnt/persist/workspace', // Local development
            '/workspace', // Docker/container
            '/app', // Alternative container path
            process.env.HOME || '/tmp', // User home or temp
        ];

        for (const fallback of fallbacks) {
            try {
                // Check if directory exists and is accessible
                const { existsSync } = await import('fs');
                if (existsSync(fallback)) {
                    console.warn(`Using fallback workspace directory: ${fallback}`);
                    return fallback;
                }
            } catch (_fallbackError) {
                // Continue to next fallback
                continue;
            }
        }

        // Last resort: use temp directory
        const { tmpdir } = await import('os');
        const tempDir = tmpdir();
        console.warn(`All fallbacks failed, using temp directory: ${tempDir}`);
        return tempDir;
    }
}

/**
 * End-to-End Configuration Reload Test
 *
 * This test validates the complete configuration reloading workflow:
 * 1. App starts
 * 2. /help is executed - captures initial verbosity level
 * 3. /config is executed - changes verbosity level through wizard
 * 4. /help is executed again - validates verbosity level changed
 *
 * This is a true end-to-end test that spawns the actual application process
 * and simulates keyboard input without any mocks.
 */
describe('Configuration Reload E2E Test', () => {
    let appProcess;
    let testEnvPath;
    let originalEnvPath;
    let testOutput = '';
    let testError = '';

    beforeEach(async () => {
        // Use environment-agnostic workspace directory with fallback
        const workspaceDir = await getWorkspaceDirectory();

        // Mock process.cwd() to return the detected workspace
        process.cwd = vi.fn(() => workspaceDir);

        // Setup test environment file using dynamic workspace
        testEnvPath = join(workspaceDir, '.env.test');
        originalEnvPath = join(workspaceDir, '.env');

        // Backup original .env if it exists
        if (existsSync(originalEnvPath)) {
            const originalContent = readFileSync(originalEnvPath, 'utf8');
            writeFileSync(`${originalEnvPath}.backup`, originalContent);
        }

        // Create test .env file with initial verbosity level 2
        const testEnvContent = `# Test Configuration
SYNTHDEV_API_KEY=test-api-key-12345
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=2
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
`;
        writeFileSync(testEnvPath, testEnvContent);

        // Copy test env to main .env location for the app to use
        writeFileSync(originalEnvPath, testEnvContent);

        // Reset output collectors
        testOutput = '';
    });

    afterEach(async () => {
        // Kill the process if it's still running
        if (appProcess && !appProcess.killed) {
            appProcess.kill('SIGTERM');

            // Wait for process to exit
            await new Promise(resolve => {
                appProcess.on('exit', resolve);
                setTimeout(resolve, 2000); // Timeout after 2 seconds
            });
        }

        // Cleanup test files
        if (existsSync(testEnvPath)) {
            unlinkSync(testEnvPath);
        }

        // Restore original .env if it existed
        if (existsSync(`${originalEnvPath}.backup`)) {
            const backupContent = readFileSync(`${originalEnvPath}.backup`, 'utf8');
            writeFileSync(originalEnvPath, backupContent);
            unlinkSync(`${originalEnvPath}.backup`);
        } else if (existsSync(originalEnvPath)) {
            unlinkSync(originalEnvPath);
        }

        // Restore original process.cwd
        process.cwd =
            originalCwd ||
            (() => {
                // For synchronous fallback, use a simpler approach
                return process.env.GITHUB_WORKSPACE || '/mnt/persist/workspace';
            });
    });

    /**
     * Helper function to spawn the application process
     */
    async function spawnApp() {
        const workspaceDir = await getWorkspaceDirectory();
        const appPath = join(workspaceDir, 'src', 'core', 'app.js');

        appProcess = spawn('node', [appPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                SYNTHDEV_ENV_FILE: testEnvPath,
                CI: 'true', // Indicate this is a CI environment
                SYNTHDEV_TEST_MODE: 'true', // Add test mode flag
            },
        });

        // Collect stdout
        appProcess.stdout.on('data', data => {
            const output = data.toString();
            testOutput += output;
            console.log('APP OUTPUT:', output); // Debug output
        });

        // Collect stderr
        appProcess.stderr.on('data', data => {
            const error = data.toString();
            console.log('APP ERROR:', error); // Debug output
        });

        // Add process error handling
        appProcess.on('error', error => {
            console.error('PROCESS ERROR:', error);
        });

        appProcess.on('exit', (code, signal) => {
            console.log(`APP EXITED: code=${code}, signal=${signal}`);
        });

        return appProcess;
    }

    /**
     * Helper function to send input to the application
     */
    function sendInput(input) {
        return new Promise(resolve => {
            appProcess.stdin.write(`${input}\n`);
            setTimeout(resolve, 500); // Wait for processing
        });
    }

    /**
     * Helper function to wait for specific output
     */
    function waitForOutput(expectedText, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkOutput = () => {
                if (testOutput.includes(expectedText)) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    console.error('TIMEOUT DEBUG INFO:');
                    console.error('Expected:', expectedText);
                    console.error('Full output length:', testOutput.length);
                    console.error('Last 500 chars:', testOutput.slice(-500));
                    console.error('Process still running:', appProcess && !appProcess.killed);

                    reject(
                        new Error(
                            `Timeout waiting for output: "${expectedText}". Got: "${testOutput}"`
                        )
                    );
                } else {
                    setTimeout(checkOutput, 100);
                }
            };

            checkOutput();
        });
    }

    /**
     * Helper function to extract verbosity level from help output
     */
    function extractVerbosityLevel(output) {
        const match = output.match(/💭 Logging level: (\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    it('should reload configuration and update verbosity level', async () => {
        // Start the application
        await spawnApp();

        // Wait for app to start and show prompt (increased timeout for CI)
        await waitForOutput('💭 You:', 30000);

        // Step 1: Execute /help and capture initial verbosity level
        await sendInput('/help');
        await waitForOutput('💭 Logging level:', 5000);

        const initialOutput = testOutput;
        const initialVerbosity = extractVerbosityLevel(initialOutput);

        expect(initialVerbosity).toBe(2); // Should be initial value from .env
        console.log('Initial verbosity level:', initialVerbosity);

        // Step 2: Execute /config to start configuration wizard
        await sendInput('/config');
        await waitForOutput('SynthDev Configuration Wizard', 5000);

        // Navigate to "Other Settings" option (4)
        await sendInput('4');
        await waitForOutput('Other Settings', 3000);

        // Select "Verbosity Level" option (1)
        await sendInput('1');
        await waitForOutput('Verbosity level (0-5)>', 3000);

        // Set new verbosity level to 4
        const newVerbosityLevel = 4;
        await sendInput(newVerbosityLevel.toString());
        await waitForOutput('Verbosity level set to:', 3000);

        // Go back to main menu
        await sendInput('b');
        await waitForOutput('📋 Current Configuration:', 3000);

        // Save configuration
        await sendInput('s');
        await waitForOutput('Configuration saved successfully', 5000);

        // Wait for configuration reload to complete
        await waitForOutput('Reloading configuration...', 3000);

        // Add a small delay to ensure configuration is fully reloaded
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Quit configuration wizard
        await sendInput('q');
        await waitForOutput('💭 You:', 3000);

        // Step 3: Execute /help again and verify verbosity level changed
        // Clear previous output to get clean help output
        const outputBeforeSecondHelp = testOutput.length;

        await sendInput('/help');
        await waitForOutput('💭 Logging level:', 5000);

        // Get only the new output after second /help
        const secondHelpOutput = testOutput.substring(outputBeforeSecondHelp);
        const updatedVerbosity = extractVerbosityLevel(secondHelpOutput);

        // Debug: Check what's in the .env file
        const envContent = readFileSync(originalEnvPath, 'utf8');
        console.log('Final .env file content:', envContent);
        console.log('Expected verbosity level:', newVerbosityLevel);
        console.log('Actual verbosity level from help:', updatedVerbosity);

        expect(updatedVerbosity).toBe(newVerbosityLevel);

        // Verify the configuration was actually reloaded
        expect(updatedVerbosity).not.toBe(initialVerbosity);
        expect(updatedVerbosity).toBe(4);

        // Exit the application
        await sendInput('/exit');

        // Wait for process to exit
        await new Promise(resolve => {
            appProcess.on('exit', resolve);
            setTimeout(resolve, 2000);
        });

        console.log('Test completed successfully');
    }, 60000); // 60 second timeout for the entire test

    it('should handle configuration wizard navigation correctly', async () => {
        // Start the application
        await spawnApp();

        // Wait for app to start (increased timeout for CI)
        await waitForOutput('💭 You:', 30000);

        // Execute /config
        await sendInput('/config');
        await waitForOutput('SynthDev Configuration Wizard', 5000);

        // Test navigation: go to Other Settings (4)
        await sendInput('4');
        await waitForOutput('Other Settings', 3000);

        // Go back to main menu (b)
        await sendInput('b');
        await waitForOutput('📋 Current Configuration:', 3000);

        // Quit without saving (q)
        await sendInput('q');
        await waitForOutput('💭 You:', 3000);

        // Verify we're back to normal prompt
        expect(testOutput).toContain('💭 You:');

        // Exit the application
        await sendInput('/exit');

        await new Promise(resolve => {
            appProcess.on('exit', resolve);
            setTimeout(resolve, 2000);
        });
    }, 30000);
});
