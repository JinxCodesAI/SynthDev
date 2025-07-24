/**
 * End-to-End Command Interception Tests
 * Tests that commands are properly intercepted and don't trigger AI responses
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe.sequential('Command Interception E2E Tests', () => {
    let appProcess;
    let testEnvFile;
    let testTimeout;
    let originalEnvFile;
    let testOutput = { value: '' };
    let testError = { value: '' };

    beforeEach(() => {
        // Backup original env file if it exists
        testEnvFile = '.env';
        if (existsSync(testEnvFile)) {
            originalEnvFile = readFileSync(testEnvFile, 'utf8');
        }

        // Create test environment file in the expected location
        writeFileSync(
            testEnvFile,
            `SYNTHDEV_API_KEY=test-key-12345
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=2
SYNTHDEV_ROLE=dude
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_PROMPT_ENHANCEMENT=false
`
        );

        // Set timeout for tests - increased for CI environments
        testTimeout = process.env.CI ? 30000 : 20000; // Increased timeout

        // Initialize output collectors as objects to allow pass-by-reference
        testOutput = { value: '' };
        testError = { value: '' };
    });

    afterEach(async () => {
        if (appProcess) {
            try {
                // First try graceful termination
                appProcess.kill('SIGTERM');
                // Give the process a moment to terminate gracefully
                await new Promise(resolve => setTimeout(resolve, process.env.CI ? 500 : 100));

                // If still running, force kill
                if (!appProcess.killed) {
                    appProcess.kill('SIGKILL');
                }
            } catch (error) {
                // Process might already be dead, that's okay
            }
            appProcess = null;
        }

        // Add a delay to ensure processes are completely terminated and system is stable
        await new Promise(resolve => setTimeout(resolve, process.env.CI ? 1000 : 500));

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

        // Restore original env file or clean up test file
        if (originalEnvFile) {
            writeFileSync(testEnvFile, originalEnvFile);
        } else if (testEnvFile && existsSync(testEnvFile)) {
            unlinkSync(testEnvFile);
        }
        originalEnvFile = null;
    });

    /**
     * Helper function to spawn the application process and wait for initial prompt
     */
    function spawnAppAndAwaitPrompt() {
        return new Promise((resolve, reject) => {
            const appPath = join(process.cwd(), 'src', 'core', 'app.js');
            console.log('DEBUG: Spawning app:', appPath);
            console.log('DEBUG: Working directory:', process.cwd());

            const currentAppProcess = spawn('node', [appPath], {
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    SYNTHDEV_API_KEY: 'test-key-12345',
                    SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
                    SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
                    SYNTHDEV_VERBOSITY_LEVEL: '2',
                    SYNTHDEV_ROLE: 'dude',
                    SYNTHDEV_MAX_TOOL_CALLS: '50',
                    SYNTHDEV_PROMPT_ENHANCEMENT: 'false',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
            });

            testOutput.value = ''; // Reset global output for this new process
            testError.value = ''; // Reset global error for this new process

            currentAppProcess.on('error', err => {
                console.error('DEBUG: App process failed to start.', err);
                testError.value += `App process failed to start: ${err.message}\n`;
                reject(err);
            });

            currentAppProcess.on('exit', (code, signal) => {
                console.log(`DEBUG: App process exited with code ${code} and signal ${signal}`);
            });

            const startupTimeout = setTimeout(() => {
                reject(
                    new Error(
                        `App startup timed out after ${testTimeout}ms. Output: ${testOutput.value.slice(-500)}`
                    )
                );
            }, testTimeout);

            currentAppProcess.stdout.on('data', data => {
                const chunk = data.toString();
                testOutput.value += chunk;
                console.log('DEBUG: APP STDOUT:', chunk);

                if (chunk.includes('💭 You:')) {
                    clearTimeout(startupTimeout);
                    resolve(currentAppProcess);
                }
            });

            currentAppProcess.stderr.on('data', data => {
                const chunk = data.toString();
                testError.value += chunk;
                console.error('DEBUG: APP STDERR:', chunk);
            });
        });
    }

    /**
     * Helper function to send input to the application
     */
    async function sendInput(input) {
        console.log(`DEBUG: Sending input: "${input}"`);
        appProcess.stdin.write(`${input}
`);
        // Give the app a moment to process the input
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    /**
     * Helper function to wait for specific output
     */
    async function waitForOutput(expectedText, timeout = 20000, outputRef, errorRef) {
        console.log(`DEBUG: Waiting for output: "${expectedText}" (timeout: ${timeout}ms)`);
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                console.log(
                    `DEBUG: Current outputRef.value: ${outputRef.slice(-100).replace(/\n/g, '\\n')}`
                ); // Log last 100 chars
                if (outputRef.includes(expectedText)) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    console.error(`ERROR: Timeout waiting for: "${expectedText}"`);
                    console.error(`Current output length: ${outputRef.length}`);
                    console.error(`Current error length: ${errorRef.length}`);
                    console.error(`Full output: "${outputRef}"`); // Log full output
                    console.error(`Last 500 chars of error: "${errorRef.slice(-500)}"`);
                    console.error(`Process killed: ${appProcess?.killed}`);
                    console.error(`Process pid: ${appProcess?.pid}`);
                    reject(
                        new Error(
                            `Timeout waiting for output: "${expectedText}". Got: "${outputRef.slice(-200)}"`
                        )
                    );
                }
            }, 100);
        });
    }

    it('should intercept /help command without AI response', async () => {
        appProcess = await spawnAppAndAwaitPrompt();

        await sendInput('/help');
        await waitForOutput('Available Commands', testTimeout);

        const aiResponseReceived =
            testOutput.value.includes('🤖 dude:') ||
            testOutput.value.includes('🧠 Synth-Dev is thinking');
        expect(aiResponseReceived).toBe(false);

        expect(testOutput.value).toContain('Available Commands');
        expect(testOutput.value).toContain('/help - Show this help message');
        expect(testOutput.value).toContain('/snapshot - Create and manage file snapshots');

        await sendInput('/exit');
        await new Promise(resolve => appProcess.on('close', resolve));
    });

    it('should intercept /cost command without AI response', async () => {
        appProcess = await spawnAppAndAwaitPrompt();

        await sendInput('/cost');
        await waitForOutput('Accumulated API Costs', testTimeout);

        const aiResponseReceived =
            testOutput.value.includes('🤖 dude:') ||
            testOutput.value.includes('🧠 Synth-Dev is thinking');
        expect(aiResponseReceived).toBe(false);

        expect(testOutput.value).toMatch(/💰 Accumulated API Costs|No API usage data available/);

        await sendInput('/exit');
        await new Promise(resolve => appProcess.on('close', resolve));
    });

    it('should intercept /snapshot command without AI response', async () => {
        appProcess = await spawnAppAndAwaitPrompt();

        await sendInput('/snapshot');
        await waitForOutput('📸 Snapshot Management Commands', testTimeout);

        const aiResponseReceived =
            testOutput.value.includes('🤖 dude:') ||
            testOutput.value.includes('🧠 Synth-Dev is thinking');
        expect(aiResponseReceived).toBe(false);

        expect(testOutput.value).toContain('📸 Snapshot Management Commands');
        expect(testOutput.value).toContain('/snapshot create');
        expect(testOutput.value).toContain('/snapshot list');

        await sendInput('/exit');
        await new Promise(resolve => appProcess.on('close', resolve));
    });

    it('should intercept /snapshot help subcommand without AI response', async () => {
        appProcess = await spawnAppAndAwaitPrompt();

        await sendInput('/snapshot help');
        await waitForOutput('📸 Snapshot Management Commands', testTimeout);

        const aiResponseReceived =
            testOutput.value.includes('🤖 dude:') ||
            testOutput.value.includes('🧠 Synth-Dev is thinking');
        expect(aiResponseReceived).toBe(false);

        expect(testOutput.value).toContain('📸 Snapshot Management Commands');
        expect(testOutput.value).toContain('💡 Examples:');
        expect(testOutput.value).toContain('📝 Notes:');

        await sendInput('/exit');
        await new Promise(resolve => appProcess.on('close', resolve));
    });
});
