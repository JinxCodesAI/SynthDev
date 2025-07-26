// tests/e2e/config-reload.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { setupTestEnv } from '../helpers/envTestHelper.js';

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
describe.sequential('Configuration Reload E2E Test', () => {
    let appProcess;
    let testOutput = '';
    let testError = '';
    let cleanupTestEnv;

    beforeEach(() => {
        // Setup test environment with initial verbosity level 2
        const testEnvConfig = {
            SYNTHDEV_API_KEY: 'test-api-key-12345',
            SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            SYNTHDEV_VERBOSITY_LEVEL: '2',
            SYNTHDEV_MAX_TOOL_CALLS: '50',
            SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT: 'false',
        };

        cleanupTestEnv = setupTestEnv(testEnvConfig);

        // Reset output collectors
        testOutput = '';
        testError = '';
    });

    afterEach(async () => {
        // Kill the process if it's still running
        if (appProcess && !appProcess.killed) {
            try {
                // First try graceful termination
                appProcess.kill('SIGTERM');
                // Give the process a moment to terminate gracefully
                await new Promise(resolve => setTimeout(resolve, 500));

                // If still running, force kill
                if (!appProcess.killed) {
                    appProcess.kill('SIGKILL');
                }
            } catch (error) {
                // Process might already be dead, that's okay
            }
            appProcess = null;
        }

        // Add a delay to ensure processes are completely terminated
        await new Promise(resolve => setTimeout(resolve, 500));

        // Clean up any state files to ensure each test starts fresh
        const stateFiles = [
            '.synthdev-initial-snapshot',
            '.synthdev-config-cache',
            '.synthdev-session',
        ];

        for (const stateFile of stateFiles) {
            if (existsSync(stateFile)) {
                try {
                    unlinkSync(stateFile);
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        }

        // Cleanup test environment
        if (cleanupTestEnv) {
            cleanupTestEnv();
            cleanupTestEnv = null;
        }
    });

    /**
     * Helper function to spawn the application process
     */
    function spawnApp() {
        const appPath = join(process.cwd(), 'src', 'core', 'app.js');

        console.log('Spawning app:', appPath);
        console.log('Working directory:', process.cwd());

        appProcess = spawn('node', [appPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'test' },
            cwd: process.cwd(),
        });

        // Handle process errors
        appProcess.on('error', error => {
            console.error('Process spawn error:', error);
            testError += `Process spawn error: ${error.message}\n`;
        });

        appProcess.on('exit', (code, signal) => {
            console.log(`Process exited with code ${code} and signal ${signal}`);
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
            testError += error;
            console.log('APP ERROR:', error); // Debug output
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
                    console.log(`✓ Found expected output: "${expectedText}"`);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    console.error(`✗ Timeout waiting for: "${expectedText}"`);
                    console.error(`Current output length: ${testOutput.length}`);
                    console.error(`Current error length: ${testError.length}`);
                    console.error(`Last 500 chars of output: "${testOutput.slice(-500)}"`);
                    console.error(`Last 500 chars of error: "${testError.slice(-500)}"`);
                    console.error(`Process killed: ${appProcess?.killed}`);
                    console.error(`Process pid: ${appProcess?.pid}`);

                    reject(
                        new Error(
                            `Timeout waiting for output: "${expectedText}". Got: "${testOutput.slice(-200)}"`
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
        spawnApp();

        // Wait for app to start and show prompt
        await waitForOutput('💭 You:', 15000);

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
        const envPath = join(process.cwd(), '.env');
        const envContent = readFileSync(envPath, 'utf8');
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
        spawnApp();

        // Wait for app to start
        await waitForOutput('💭 You:', 15000);

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
