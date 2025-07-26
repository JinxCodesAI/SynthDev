/**
 * Execute Terminal PowerShell Tests
 * Tests for PowerShell command execution functionality
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import executeTerminal from '../../../src/tools/execute_terminal/implementation.js';

// Mock child_process
const mockSpawn = vi.fn();
const mockExec = vi.fn();
vi.mock('child_process', () => ({
    spawn: mockSpawn,
    exec: mockExec,
}));

// Mock shell detection
const mockGetShellForCommand = vi.fn();
vi.mock('../../../src/utils/shellDetection.js', () => ({
    getShellForCommand: mockGetShellForCommand,
    SHELL_TYPES: {
        POWERSHELL: 'powershell',
        CMD: 'cmd',
        BASH: 'bash',
    },
    OS_TYPES: {
        WINDOWS: 'win32',
        MACOS: 'darwin',
        LINUX: 'linux',
    },
}));

// Mock EventEmitter for child process
class MockChildProcess {
    constructor() {
        this.stdout = { on: vi.fn() };
        this.stderr = { on: vi.fn() };
        this.on = vi.fn();
        this.kill = vi.fn();
    }
}

describe('Execute Terminal PowerShell Integration', () => {
    let mockChildProcess;

    beforeEach(() => {
        vi.clearAllMocks();
        mockChildProcess = new MockChildProcess();
        mockSpawn.mockReturnValue(mockChildProcess);
    });

    describe('PowerShell command execution', () => {
        test('should execute PowerShell commands with correct shell configuration', async () => {
            // Mock shell detection to return PowerShell
            mockGetShellForCommand.mockResolvedValue({
                type: 'powershell',
                executable: 'powershell.exe',
                flags: ['-Command'],
                os: 'win32',
            });

            // Mock successful command execution
            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(
                        () =>
                            callback(
                                'Directory: C:\\test\n\nMode  Name\n----  ----\nd----  folder1\n-a---  file1.txt'
                            ),
                        0
                    );
                }
            });

            mockChildProcess.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    // No stderr output for successful command
                }
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            const result = await executeTerminal({ command: 'Get-ChildItem -Path C:\\test' });

            expect(mockGetShellForCommand).toHaveBeenCalledWith('Get-ChildItem -Path C:\\test');
            expect(mockSpawn).toHaveBeenCalledWith(
                'powershell.exe',
                ['-Command', 'Get-ChildItem -Path C:\\test'],
                { stdio: ['pipe', 'pipe', 'pipe'], shell: false }
            );
            expect(result.success).toBe(true);
            expect(result.stdout).toContain('Directory: C:\\test');
        });

        test('should handle PowerShell command with parameters', async () => {
            mockGetShellForCommand.mockResolvedValue({
                type: 'powershell',
                executable: 'powershell.exe',
                flags: ['-Command'],
                os: 'win32',
            });

            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('docker-compose.yml\ndockerfile'), 0);
                }
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            const result = await executeTerminal({
                command: 'Get-ChildItem -Path . -Recurse -Filter *docker*',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('docker-compose.yml');
        });

        test('should handle PowerShell command errors', async () => {
            mockGetShellForCommand.mockResolvedValue({
                type: 'powershell',
                executable: 'powershell.exe',
                flags: ['-Command'],
                os: 'win32',
            });

            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                // No stdout for error case
            });

            mockChildProcess.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(
                        () =>
                            callback(
                                "Get-ChildItem : Cannot find path 'C:\\nonexistent' because it does not exist."
                            ),
                        0
                    );
                }
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(1), 0);
                }
            });

            const result = await executeTerminal({
                command: 'Get-ChildItem -Path C:\\nonexistent',
            });

            expect(result.success).toBe(false);
            expect(result.stderr).toContain('Cannot find path');
            expect(result.error).toContain('Command exited with code 1');
        });

        test('should handle command timeout', async () => {
            mockGetShellForCommand.mockResolvedValue({
                type: 'powershell',
                executable: 'powershell.exe',
                flags: ['-Command'],
                os: 'win32',
            });

            // Mock a command that never completes
            mockChildProcess.on.mockImplementation((event, callback) => {
                // Don't call the close callback to simulate hanging
            });

            // Mock setTimeout to immediately trigger timeout
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = vi.fn((callback, delay) => {
                if (delay === 30000) {
                    // Immediately trigger timeout
                    callback();
                }
                return 123; // Mock timer ID
            });

            const originalClearTimeout = global.clearTimeout;
            global.clearTimeout = vi.fn();

            const result = await executeTerminal({
                command: 'Start-Sleep -Seconds 60',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Command timed out after 30 seconds');
            expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

            // Restore original functions
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
        });

        test('should handle spawn errors', async () => {
            mockGetShellForCommand.mockResolvedValue({
                type: 'powershell',
                executable: 'powershell.exe',
                flags: ['-Command'],
                os: 'win32',
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(new Error('spawn powershell.exe ENOENT')), 0);
                }
            });

            const result = await executeTerminal({
                command: 'Get-Process',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('spawn powershell.exe ENOENT');
        });
    });

    describe('Fallback to default shell', () => {
        test('should fallback to default exec when shell detection fails', async () => {
            // Mock shell detection failure
            mockGetShellForCommand.mockRejectedValue(new Error('Shell detection failed'));

            // Mock successful exec fallback
            mockExec.mockImplementation((command, callback) => {
                callback(null, 'fallback output', '');
            });

            const result = await executeTerminal({ command: 'echo test' });

            expect(result.success).toBe(true);
            expect(result.stdout).toBe('fallback output');
            expect(mockExec).toHaveBeenCalledWith('echo test', expect.any(Function));
        });

        test('should handle fallback exec errors', async () => {
            mockGetShellForCommand.mockRejectedValue(new Error('Shell detection failed'));

            mockExec.mockImplementation((command, callback) => {
                callback(new Error('Command failed'), '', 'error output');
            });

            const result = await executeTerminal({ command: 'invalid-command' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Command failed');
        });
    });

    describe('Command validation', () => {
        test('should validate command input', async () => {
            const result = await executeTerminal({ command: '' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Command cannot be empty');
        });

        test('should validate command type', async () => {
            const result = await executeTerminal({ command: null });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Command is required and must be a string');
        });

        test('should validate whitespace-only commands', async () => {
            const result = await executeTerminal({ command: '   ' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Command cannot be empty');
        });
    });

    describe('Cross-platform compatibility', () => {
        test('should work with bash on Unix systems', async () => {
            mockGetShellForCommand.mockResolvedValue({
                type: 'bash',
                executable: '/bin/bash',
                flags: ['-c'],
                os: 'linux',
            });

            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('file1.txt\nfile2.txt'), 0);
                }
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            const result = await executeTerminal({ command: 'ls *.txt' });

            expect(mockSpawn).toHaveBeenCalledWith('/bin/bash', ['-c', 'ls *.txt'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false,
            });
            expect(result.success).toBe(true);
        });

        test('should work with cmd on Windows', async () => {
            mockGetShellForCommand.mockResolvedValue({
                type: 'cmd',
                executable: 'cmd.exe',
                flags: ['/c'],
                os: 'win32',
            });

            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(
                        () => callback('Volume in drive C has no label.\nDirectory of C:\\'),
                        0
                    );
                }
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            const result = await executeTerminal({ command: 'dir' });

            expect(mockSpawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'dir'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false,
            });
            expect(result.success).toBe(true);
        });
    });
});
