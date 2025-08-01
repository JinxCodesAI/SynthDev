/**
 * End-to-End Command Interception Tests
 * Tests that commands are properly intercepted and don't trigger AI responses
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { unlinkSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createTestProcessEnv } from '../helpers/envTestHelper.js';

/**
 * Get the Node.js executable path for cross-platform compatibility
 * @returns {string} Node.js executable path
 */
function getNodeExecutable() {
    // On Windows, we might need to use 'node.exe' or the full path
    // process.execPath gives us the current Node.js executable path
    return process.execPath;
}

describe.sequential('Command Interception E2E Tests', { retry: 3 }, () => {
    let appProcess;
    let testTimeout;
    let tempEnvFile;

    beforeEach(() => {
        // Set timeout for tests - significantly increased for CI environments and flaky tests
        testTimeout = process.env.CI ? 60000 : 45000;

        // Reset appProcess to ensure clean state
        appProcess = undefined;

        // Create temporary .env file to prevent configuration wizard from starting
        tempEnvFile = join(process.cwd(), '.env.test-temp');
        const envContent = `# Temporary test environment file
SYNTHDEV_API_KEY=sk-test-key-12345-valid-format
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=2
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
`;
        writeFileSync(tempEnvFile, envContent);

        // Also create a temporary .env file in the main directory if it doesn't exist
        const mainEnvFile = join(process.cwd(), '.env');
        if (!existsSync(mainEnvFile)) {
            writeFileSync(mainEnvFile, envContent);
        }
    });

    afterEach(async () => {
        if (appProcess && !appProcess.killed) {
            try {
                // First try graceful termination
                appProcess.kill('SIGTERM');
                // Give the process more time to terminate gracefully
                await new Promise(resolve => setTimeout(resolve, process.env.CI ? 1000 : 500));

                // If still running, force kill
                if (!appProcess.killed) {
                    appProcess.kill('SIGKILL');
                    // Wait for force kill to complete
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                // Process might already be dead, that's okay
                console.warn('Process cleanup warning:', error.message);
            }
            appProcess = null;
        }

        // Add a longer delay to ensure processes are completely terminated and system is stable
        await new Promise(resolve => setTimeout(resolve, process.env.CI ? 2000 : 1000));

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
                    console.warn('State file cleanup warning:', error.message);
                }
            }
        }

        // Clean up temporary .env files
        if (tempEnvFile && existsSync(tempEnvFile)) {
            try {
                unlinkSync(tempEnvFile);
            } catch (error) {
                console.warn('Temp env file cleanup warning:', error.message);
            }
        }

        // Clean up main .env file if it was created by test
        const mainEnvFile = join(process.cwd(), '.env');
        if (existsSync(mainEnvFile)) {
            try {
                const content = require('fs').readFileSync(mainEnvFile, 'utf8');
                if (content.includes('# Temporary test environment file')) {
                    unlinkSync(mainEnvFile);
                }
            } catch (error) {
                console.warn('Main env file cleanup warning:', error.message);
            }
        }
    });

    it('should intercept /help command without AI response', async () => {
        const chunks = [];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /help command test'));
            }, testTimeout);

            // Use the actual project directory for spawning the app
            const projectRoot = process.cwd();

            appProcess = spawn(getNodeExecutable(), ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: projectRoot,
            });

            let output = '';
            let stderr = '';
            let helpCommandSent = false;
            let helpResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;
                chunks.push(chunk);

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !helpCommandSent) {
                    helpCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/help\n');
                        }
                    }, 500); // Increased delay for more reliable startup
                }

                // Check for help response
                if (chunk.includes('Available Commands') && helpCommandSent) {
                    helpResponseReceived = true;
                }

                // Check for AI response after help (this should NOT happen)
                if (
                    helpResponseReceived &&
                    (chunk.includes('🤖 dude:') || chunk.includes('🧠 Synth-Dev is thinking'))
                ) {
                    aiResponseReceived = true;
                }

                // Exit after help response and brief wait
                if (helpResponseReceived && !aiResponseReceived) {
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1500); // Increased delay for more reliable exit
                }
            });

            appProcess.stderr.on('data', data => {
                stderr += data.toString();
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    // Verify help command was intercepted
                    expect(helpCommandSent).toBe(true);
                    expect(helpResponseReceived).toBe(true);
                    expect(aiResponseReceived).toBe(false);

                    // Verify help content
                    expect(output).toContain('Available Commands');
                    expect(output).toContain('/help - Show this help message');
                    expect(output).toContain('/snapshot - Create and manage file snapshots');

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            appProcess.on('error', error => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }, 75000); // Individual test timeout - longer than testTimeout

    it('should intercept /cost command without AI response', async () => {
        const chunks = [];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /cost command test'));
            }, testTimeout);

            // Use the actual project directory for spawning the app
            const projectRoot = process.cwd();
            appProcess = spawn(getNodeExecutable(), ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: projectRoot,
            });

            let output = '';
            let stderr = '';
            let costCommandSent = false;
            let costResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;
                chunks.push(chunk);

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !costCommandSent) {
                    costCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/cost\n');
                        }
                    }, 500); // Increased timeout for more reliable execution
                }

                // Check for cost response
                if (
                    (chunk.includes('💰 Accumulated API Costs') ||
                        chunk.includes('No API usage data available')) &&
                    costCommandSent
                ) {
                    costResponseReceived = true;
                }

                // Check for AI response after cost (this should NOT happen)
                if (
                    costResponseReceived &&
                    (chunk.includes('🤖 dude:') || chunk.includes('🧠 Synth-Dev is thinking'))
                ) {
                    aiResponseReceived = true;
                }

                // Exit after cost response and brief wait
                if (costResponseReceived && !aiResponseReceived) {
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1500); // Increased delay for more reliable exit
                }
            });

            appProcess.stderr.on('data', data => {
                stderr += data.toString();
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    // Debug: Log final state
                    console.log(
                        'DEBUG: Final state - costCommandSent:',
                        costCommandSent,
                        'costResponseReceived:',
                        costResponseReceived
                    );

                    // Verify cost command was intercepted
                    expect(costCommandSent).toBe(true);
                    expect(costResponseReceived).toBe(true);
                    expect(aiResponseReceived).toBe(false);

                    // Verify cost content
                    expect(output).toMatch(/💰 Accumulated API Costs|No API usage data available/);

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            appProcess.on('error', error => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }, 75000); // Individual test timeout - longer than testTimeout

    it('should intercept /snapshot command without AI response', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /snapshot command test'));
            }, testTimeout);

            // Use the actual project directory for spawning the app
            const projectRoot = process.cwd();
            appProcess = spawn(getNodeExecutable(), ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: projectRoot,
            });

            let output = '';
            let stderr = '';
            let snapshotCommandSent = false;
            let snapshotResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !snapshotCommandSent) {
                    snapshotCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/snapshot\n');
                        }
                    }, 500); // Increased delay for more reliable startup
                }

                // Check for snapshot response
                if (chunk.includes('📸 Snapshot Management Commands') && snapshotCommandSent) {
                    snapshotResponseReceived = true;
                }

                // Check for AI response after snapshot (this should NOT happen)
                if (
                    snapshotResponseReceived &&
                    (chunk.includes('🤖 dude:') || chunk.includes('🧠 Synth-Dev is thinking'))
                ) {
                    aiResponseReceived = true;
                }

                // Exit after snapshot response and brief wait
                if (snapshotResponseReceived && !aiResponseReceived) {
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1500); // Increased delay for more reliable exit
                }
            });

            appProcess.stderr.on('data', data => {
                stderr += data.toString();
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    // Verify snapshot command was intercepted
                    expect(snapshotCommandSent).toBe(true);
                    expect(snapshotResponseReceived).toBe(true);
                    expect(aiResponseReceived).toBe(false); // This is the key assertion that should pass

                    // Verify snapshot content
                    expect(output).toContain('📸 Snapshot Management Commands');
                    expect(output).toContain('/snapshot create');
                    expect(output).toContain('/snapshot list');

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            appProcess.on('error', error => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }, 75000); // Individual test timeout - longer than testTimeout

    it('should intercept /snapshot help subcommand without AI response', async () => {
        const chunks = [];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /snapshot help test'));
            }, testTimeout);

            // Use the actual project directory for spawning the app
            const projectRoot = process.cwd();
            appProcess = spawn(getNodeExecutable(), ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: projectRoot,
            });

            let output = '';
            let stderr = '';
            let snapshotHelpCommandSent = false;
            let snapshotHelpResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;
                chunks.push(chunk);

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !snapshotHelpCommandSent) {
                    snapshotHelpCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/snapshot help\n');
                        }
                    }, 500); // Increased timeout for more reliable execution
                }

                // Check for snapshot help response
                if (chunk.includes('📸 Snapshot Management Commands') && snapshotHelpCommandSent) {
                    snapshotHelpResponseReceived = true;
                }

                // Check for AI response after snapshot help (this should NOT happen)
                if (
                    snapshotHelpResponseReceived &&
                    (chunk.includes('🤖 dude:') || chunk.includes('🧠 Synth-Dev is thinking'))
                ) {
                    aiResponseReceived = true;
                }

                // Exit after snapshot help response and brief wait
                if (snapshotHelpResponseReceived && !aiResponseReceived) {
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin && !appProcess.killed) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1500); // Increased delay for more reliable exit
                }
            });

            appProcess.stderr.on('data', data => {
                stderr += data.toString();
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    // Verify snapshot help command was intercepted
                    expect(snapshotHelpCommandSent).toBe(true);
                    expect(snapshotHelpResponseReceived).toBe(true);
                    expect(aiResponseReceived).toBe(false);

                    // Verify snapshot help content
                    expect(output).toContain('📸 Snapshot Management Commands');
                    expect(output).toContain('💡 Examples:');
                    expect(output).toContain('📝 Notes:');

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            appProcess.on('error', error => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }, 75000); // Individual test timeout - longer than testTimeout
});
