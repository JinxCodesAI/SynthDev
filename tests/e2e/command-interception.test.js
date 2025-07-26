/**
 * End-to-End Command Interception Tests
 * Tests that commands are properly intercepted and don't trigger AI responses
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { createTestProcessEnv } from '../helpers/envTestHelper.js';

describe.sequential('Command Interception E2E Tests', { retry: 2 }, () => {
    let appProcess;
    let testTimeout;

    beforeEach(() => {
        // Set timeout for tests - increased for CI environments and flaky tests
        testTimeout = process.env.CI ? 35000 : 25000;
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
    });

    it('should intercept /help command without AI response', async () => {
        const chunks = [];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /help command test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
                env: createTestProcessEnv(),
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
                chunks.push(chunk);

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
    });

    it('should intercept /cost command without AI response', async () => {
        const chunks = [];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /cost command test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
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
                        if (appProcess && appProcess.stdin) {
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
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1000);
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
    });

    it('should intercept /snapshot command without AI response', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /snapshot command test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
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
    });

    //something
    it('should intercept /snapshot help subcommand without AI response', async () => {
        const chunks = [];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - /snapshot help test'));
            }, testTimeout);

            appProcess = spawn('node', ['src/core/app.js'], {
                env: createTestProcessEnv(),
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
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
                        if (appProcess && appProcess.stdin) {
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
                        if (appProcess && appProcess.stdin) {
                            appProcess.stdin.write('/exit\n');
                        }
                    }, 1000);
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
    });
});
