// tests/e2e/config-reload.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'fs';

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

    beforeEach(() => {
        // Setup test environment file
        const rootDir = join(process.cwd());
        testEnvPath = join(rootDir, '.env.test');
        originalEnvPath = join(rootDir, '.env');

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
        testError = '';
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
    });

    /**
     * Helper function to spawn the application process
     */
    function spawnApp() {
        const appPath = join(process.cwd(), 'src', 'core', 'app.js');

        appProcess = spawn('node', [appPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'test' },
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
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
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
