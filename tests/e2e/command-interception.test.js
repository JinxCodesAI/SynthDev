/**
 * End-to-End Command Interception Tests
 * Tests that commands are properly intercepted and don't trigger AI responses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe.sequential('Command Interception E2E Tests', () => {
    let appProcess;
    let testEnvFile;
    let testTimeout;
    let originalEnvFile;

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
        testTimeout = process.env.CI ? 25000 : 15000;
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

        // Add a small delay to ensure processes are completely terminated
        await new Promise(resolve => setTimeout(resolve, 100));

        // Restore original env file or clean up test file
        if (originalEnvFile) {
            writeFileSync(testEnvFile, originalEnvFile);
        } else if (testEnvFile && existsSync(testEnvFile)) {
            unlinkSync(testEnvFile);
        }
        originalEnvFile = null;
    });

    it('should intercept /help command without AI response', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log('Test timeout reached. State:', {
                    helpCommandSent,
                    helpResponseReceived,
                    aiResponseReceived,
                    outputLength: output.length,
                    lastOutput: output.slice(-200),
                });
                reject(new Error('Test timeout - /help command test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
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

            let output = '';
            let stderr = '';
            let helpCommandSent = false;
            let helpResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;
                if (process.env.CI) {
                    console.log('STDOUT:', chunk.replace(/\n/g, '\\n'));
                } else {
                    console.log('STDOUT:', chunk);
                }

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !helpCommandSent) {
                    helpCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/help\n');
                        }
                    }, 100);
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
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1000);
                }
            });

            appProcess.stderr.on('data', data => {
                stderr += data.toString();
                console.log('STDERR:', data.toString());
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    console.log('Process exited with code:', code);
                    console.log('Help command sent:', helpCommandSent);
                    console.log('Help response received:', helpResponseReceived);
                    console.log('AI response received:', aiResponseReceived);

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
    });

    it('should intercept /cost command without AI response', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log('Test timeout reached. State:', {
                    costCommandSent,
                    costResponseReceived,
                    aiResponseReceived,
                    outputLength: output.length,
                    lastOutput: output.slice(-200),
                });
                reject(new Error('Test timeout - /cost command test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
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

            let output = '';
            let costCommandSent = false;
            let costResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !costCommandSent) {
                    costCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/cost\n');
                        }
                    }, 100);
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
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1000);
                }
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
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
    });

    it('should intercept /snapshot command without AI response', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log('Test timeout reached. State:', {
                    snapshotCommandSent,
                    snapshotResponseReceived,
                    aiResponseReceived,
                    outputLength: output.length,
                    lastOutput: output.slice(-200),
                });
                reject(new Error('Test timeout - /snapshot command test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
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

            let output = '';
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
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/snapshot\n');
                        }
                    }, 100);
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
                    console.log('AI RESPONSE DETECTED - THIS IS THE BUG!');
                }

                // Exit after snapshot response and brief wait
                if (snapshotResponseReceived && !aiResponseReceived) {
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1000);
                }
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    console.log('Snapshot command sent:', snapshotCommandSent);
                    console.log('Snapshot response received:', snapshotResponseReceived);
                    console.log('AI response received:', aiResponseReceived);

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
    });

    it('should intercept /snapshot help subcommand without AI response', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log('Test timeout reached. State:', {
                    snapshotHelpCommandSent,
                    snapshotHelpResponseReceived,
                    aiResponseReceived,
                    outputLength: output.length,
                    lastOutput: output.slice(-200),
                });
                reject(new Error('Test timeout - /snapshot help test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
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

            let output = '';
            let snapshotHelpCommandSent = false;
            let snapshotHelpResponseReceived = false;
            let aiResponseReceived = false;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;

                // Wait for startup to complete
                if (chunk.includes('💭 You:') && !snapshotHelpCommandSent) {
                    snapshotHelpCommandSent = true;
                    setTimeout(() => {
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/snapshot help\n');
                        }
                    }, 100);
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
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1000);
                }
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
    });
});
