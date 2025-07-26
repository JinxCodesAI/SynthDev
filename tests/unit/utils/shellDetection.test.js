/**
 * Shell Detection Utility Tests
 * Tests for cross-platform shell detection and command execution
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
    detectOS,
    detectShell,
    isPowerShellCommand,
    getShellForCommand,
    clearShellCache,
    SHELL_TYPES,
    OS_TYPES,
} from '../../../src/utils/shellDetection.js';

// Mock child_process
const mockExec = vi.fn();
vi.mock('child_process', () => ({
    exec: mockExec,
}));

// Mock util
const mockPromisify = vi.fn(fn => fn);
vi.mock('util', () => ({
    promisify: mockPromisify,
}));

describe('Shell Detection Utility', () => {
    let originalPlatform;

    beforeEach(() => {
        // Store original platform
        originalPlatform = process.platform;

        // Clear shell cache before each test
        clearShellCache();

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore original platform
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
            writable: true,
        });
    });

    describe('detectOS', () => {
        test('should return the current platform', () => {
            expect(detectOS()).toBe(process.platform);
        });

        test('should detect Windows', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                writable: true,
            });
            expect(detectOS()).toBe(OS_TYPES.WINDOWS);
        });

        test('should detect macOS', () => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
                writable: true,
            });
            expect(detectOS()).toBe(OS_TYPES.MACOS);
        });

        test('should detect Linux', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux',
                writable: true,
            });
            expect(detectOS()).toBe(OS_TYPES.LINUX);
        });
    });

    describe('isPowerShellCommand', () => {
        test('should detect PowerShell cmdlets', () => {
            expect(isPowerShellCommand('Get-ChildItem')).toBe(true);
            expect(isPowerShellCommand('Get-Content file.txt')).toBe(true);
            expect(isPowerShellCommand('Set-Location C:\\')).toBe(true);
            expect(isPowerShellCommand('New-Item -ItemType Directory')).toBe(true);
        });

        test('should detect PowerShell operators', () => {
            expect(isPowerShellCommand('$var -eq "value"')).toBe(true);
            expect(
                isPowerShellCommand('Get-Process | Where-Object {$_.Name -like "chrome*"}')
            ).toBe(true);
            expect(isPowerShellCommand('Test-Path -Path "C:\\temp"')).toBe(true);
        });

        test('should detect PowerShell variables', () => {
            expect(isPowerShellCommand('$env:PATH')).toBe(true);
            expect(isPowerShellCommand('Write-Host $variable')).toBe(true);
        });

        test('should detect PowerShell pipeline operations', () => {
            expect(isPowerShellCommand('Get-Process | Where-Object Name -eq "notepad"')).toBe(true);
            expect(isPowerShellCommand('Get-ChildItem | ForEach-Object { $_.Name }')).toBe(true);
            expect(isPowerShellCommand('Get-Service | Select-Object Name, Status')).toBe(true);
        });

        test('should not detect non-PowerShell commands', () => {
            expect(isPowerShellCommand('ls -la')).toBe(false);
            expect(isPowerShellCommand('dir /s')).toBe(false);
            expect(isPowerShellCommand('cat file.txt')).toBe(false);
            expect(isPowerShellCommand('echo "hello"')).toBe(false);
        });

        test('should handle invalid input', () => {
            expect(isPowerShellCommand(null)).toBe(false);
            expect(isPowerShellCommand(undefined)).toBe(false);
            expect(isPowerShellCommand('')).toBe(false);
            expect(isPowerShellCommand(123)).toBe(false);
        });
    });

    describe('detectShell on Windows', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                writable: true,
            });
        });

        test('should detect PowerShell when available', async () => {
            // Mock successful PowerShell detection
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('powershell.exe')) {
                    callback(null, 'test', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await detectShell();
            expect(shell.type).toBe(SHELL_TYPES.POWERSHELL);
            expect(shell.executable).toBe('powershell.exe');
            expect(shell.flags).toEqual(['-Command']);
            expect(shell.os).toBe(OS_TYPES.WINDOWS);
        });

        test('should fallback to cmd when PowerShell unavailable', async () => {
            // Mock PowerShell unavailable, cmd available
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('powershell.exe')) {
                    callback(new Error('PowerShell not found'));
                } else if (command.includes('cmd.exe')) {
                    callback(null, 'test', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await detectShell();
            expect(shell.type).toBe(SHELL_TYPES.CMD);
            expect(shell.executable).toBe('cmd.exe');
            expect(shell.flags).toEqual(['/c']);
        });

        test('should throw error when no shells available', async () => {
            // Mock all shells unavailable
            mockExec.mockImplementation((command, options, callback) => {
                callback(new Error('Command not found'));
            });

            await expect(detectShell()).rejects.toThrow('No compatible shell found for win32');
        });
    });

    describe('detectShell on macOS', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
                writable: true,
            });
        });

        test('should detect zsh when available', async () => {
            // Mock successful zsh detection
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('which /bin/zsh')) {
                    callback(null, '/bin/zsh', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await detectShell();
            expect(shell.type).toBe(SHELL_TYPES.ZSH);
            expect(shell.executable).toBe('/bin/zsh');
            expect(shell.flags).toEqual(['-c']);
        });

        test('should fallback to bash when zsh unavailable', async () => {
            // Mock zsh unavailable, bash available
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('which /bin/zsh')) {
                    callback(new Error('zsh not found'));
                } else if (command.includes('which /bin/bash')) {
                    callback(null, '/bin/bash', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await detectShell();
            expect(shell.type).toBe(SHELL_TYPES.BASH);
            expect(shell.executable).toBe('/bin/bash');
            expect(shell.flags).toEqual(['-c']);
        });
    });

    describe('detectShell on Linux', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'linux',
                writable: true,
            });
        });

        test('should detect bash when available', async () => {
            // Mock successful bash detection
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('which /bin/bash')) {
                    callback(null, '/bin/bash', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await detectShell();
            expect(shell.type).toBe(SHELL_TYPES.BASH);
            expect(shell.executable).toBe('/bin/bash');
            expect(shell.flags).toEqual(['-c']);
        });

        test('should fallback to sh when bash unavailable', async () => {
            // Mock bash unavailable, sh available
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('which /bin/bash')) {
                    callback(new Error('bash not found'));
                } else if (command.includes('which /bin/sh')) {
                    callback(null, '/bin/sh', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await detectShell();
            expect(shell.type).toBe(SHELL_TYPES.SH);
            expect(shell.executable).toBe('/bin/sh');
            expect(shell.flags).toEqual(['-c']);
        });
    });

    describe('getShellForCommand', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                writable: true,
            });
        });

        test('should force PowerShell for PowerShell commands on Windows', async () => {
            // Mock PowerShell available
            mockExec.mockImplementation((command, options, callback) => {
                callback(null, 'test', '');
            });

            const shell = await getShellForCommand('Get-ChildItem -Recurse');
            expect(shell.type).toBe(SHELL_TYPES.POWERSHELL);
        });

        test('should use detected shell for non-PowerShell commands', async () => {
            // Mock cmd available, PowerShell not
            mockExec.mockImplementation((command, options, callback) => {
                if (command.includes('powershell.exe')) {
                    callback(new Error('PowerShell not found'));
                } else if (command.includes('cmd.exe')) {
                    callback(null, 'test', '');
                } else {
                    callback(new Error('Command not found'));
                }
            });

            const shell = await getShellForCommand('dir /s');
            expect(shell.type).toBe(SHELL_TYPES.CMD);
        });
    });

    describe('shell caching', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                writable: true,
            });
        });

        test('should cache shell detection results', async () => {
            // Mock PowerShell available
            mockExec.mockImplementation((command, options, callback) => {
                callback(null, 'test', '');
            });

            // First call
            const shell1 = await detectShell();
            expect(shell1.type).toBe(SHELL_TYPES.POWERSHELL);

            // Second call should use cache (exec should not be called again)
            mockExec.mockClear();
            const shell2 = await detectShell();
            expect(shell2.type).toBe(SHELL_TYPES.POWERSHELL);
            expect(mockExec).not.toHaveBeenCalled();
        });

        test('should clear cache when requested', async () => {
            // Mock PowerShell available
            mockExec.mockImplementation((command, options, callback) => {
                callback(null, 'test', '');
            });

            // First call
            await detectShell();
            mockExec.mockClear();

            // Clear cache
            clearShellCache();

            // Next call should detect again
            await detectShell();
            expect(mockExec).toHaveBeenCalled();
        });
    });
});
