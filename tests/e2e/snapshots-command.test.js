/**
 * End-to-End Tests for Snapshots Command
 * Tests the complete integration of the snapshots command with the snapshot system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Snapshots Command E2E Test', () => {
    let testDir;
    let envFile;
    let appProcess;

    beforeEach(() => {
        // Create temporary test directory
        testDir = join(tmpdir(), `snapshots-e2e-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        
        // Create test .env file
        envFile = join(testDir, '.env');
        writeFileSync(envFile, `
SYNTHDEV_API_KEY=test-api-key-12345
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=2
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
        `.trim());
    });

    afterEach(() => {
        // Clean up test directory
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
        
        // Kill app process if still running
        if (appProcess && !appProcess.killed) {
            appProcess.kill('SIGTERM');
        }
    });

    const startApp = () => {
        return new Promise((resolve, reject) => {
            const appPath = join(process.cwd(), 'src', 'core', 'app.js');
            appProcess = spawn('node', [appPath], {
                cwd: process.cwd(), // Use the actual project directory
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, NODE_ENV: 'test', SYNTHDEV_ENV_FILE: envFile }
            });

            let output = '';
            let startupComplete = false;

            const timeout = setTimeout(() => {
                if (!startupComplete) {
                    reject(new Error('App startup timeout'));
                }
            }, 10000);

            appProcess.stdout.on('data', (data) => {
                output += data.toString();
                if (output.includes('💭 You:') && !startupComplete) {
                    startupComplete = true;
                    clearTimeout(timeout);
                    resolve({ process: appProcess, output });
                }
            });

            appProcess.stderr.on('data', (data) => {
                console.error('App stderr:', data.toString());
            });

            appProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    };

    const sendCommand = (process, command) => {
        return new Promise((resolve) => {
            let output = '';
            let responseComplete = false;

            const dataHandler = (data) => {
                output += data.toString();
                // Look for the next prompt to know command is complete
                if (output.includes('💭 You:') && command !== '/exit') {
                    responseComplete = true;
                    process.stdout.removeListener('data', dataHandler);
                    resolve(output);
                }
            };

            process.stdout.on('data', dataHandler);
            process.stdin.write(command + '\n');

            // Handle exit command specially
            if (command === '/exit') {
                setTimeout(() => {
                    if (!responseComplete) {
                        process.stdout.removeListener('data', dataHandler);
                        resolve(output);
                    }
                }, 1000);
            }
        });
    };

    it('should show empty snapshots list initially', async () => {
        const { process } = await startApp();
        
        try {
            const response = await sendCommand(process, '/snapshots');
            
            expect(response).toContain('📭 No snapshots available');
            expect(response).toContain('💡 Snapshots will appear here after you make changes to files');
            
        } finally {
            await sendCommand(process, '/exit');
        }
    }, 30000);

    it('should handle snapshots command navigation', async () => {
        const { process } = await startApp();
        
        try {
            // First check empty state
            let response = await sendCommand(process, '/snapshots');
            expect(response).toContain('📭 No snapshots available');
            
            // Try to quit from snapshots interface (should work even when empty)
            response = await sendCommand(process, 'q');
            expect(response).toContain('💭 You:'); // Back to main prompt
            
        } finally {
            await sendCommand(process, '/exit');
        }
    }, 30000);

    it('should show help information in snapshots interface', async () => {
        const { process } = await startApp();
        
        try {
            const response = await sendCommand(process, '/snapshots');
            
            // Should show basic help/instructions
            expect(response).toContain('📭 No snapshots available');
            expect(response).toContain('💡 Snapshots will appear here');
            
        } finally {
            await sendCommand(process, '/exit');
        }
    }, 30000);

    it('should handle invalid commands gracefully', async () => {
        const { process } = await startApp();
        
        try {
            let response = await sendCommand(process, '/snapshots');
            expect(response).toContain('📭 No snapshots available');
            
            // Try an invalid command in snapshots interface
            response = await sendCommand(process, 'invalid');
            expect(response).toContain('❌ Invalid command') || 
            expect(response).toContain('💭 You:'); // Should either show error or return to main
            
        } finally {
            await sendCommand(process, '/exit');
        }
    }, 30000);

    it('should integrate with snapshot system initialization', async () => {
        const { process, output: startupOutput } = await startApp();
        
        try {
            // Check that the app started successfully with snapshot system
            expect(startupOutput).toContain('🚀 Synth-Dev Console Application Started!');
            
            const response = await sendCommand(process, '/snapshots');
            
            // Should show the snapshots interface without errors
            expect(response).toContain('📭 No snapshots available');
            expect(response).not.toContain('Error');
            expect(response).not.toContain('undefined');
            
        } finally {
            await sendCommand(process, '/exit');
        }
    }, 30000);
});
