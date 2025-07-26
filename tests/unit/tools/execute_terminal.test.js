// tests/unit/tools/execute_terminal.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { platform } from 'os';

// Mock logger before importing the tool
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn().mockReturnValue({
        raw: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        user: vi.fn(),
        status: vi.fn(),
    }),
}));

import executeTerminal from '../../../src/tools/execute_terminal/implementation.js';

const isWindows = platform() === 'win32';
const isUnix = platform() === 'linux' || platform() === 'darwin';

describe('Execute Terminal Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Parameter Validation', () => {
        it('should return error for missing command parameter', async () => {
            const result = await executeTerminal({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('command');
        });

        it('should return error for empty command', async () => {
            const result = await executeTerminal({ command: '' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Command');
        });

        it('should return error for non-string command', async () => {
            const result = await executeTerminal({ command: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('string');
        });
    });

    describe('Cross-Platform Basic Commands', () => {
        it('should execute simple echo command', async () => {
            const command = isWindows ? 'echo Hello World' : 'echo "Hello World"';
            const result = await executeTerminal({ command });

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('Hello World');
            expect(result.tool_name).toBe('execute_terminal');
            expect(result.timestamp).toBeDefined();
        });

        it('should handle command with no output', async () => {
            // Use a command that exists but produces minimal output
            const command = isWindows ? '$null' : 'true';
            const result = await executeTerminal({ command });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent command', async () => {
            const result = await executeTerminal({ command: 'nonexistentcommand12345' });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle command with invalid syntax', async () => {
            const command = isWindows ? 'echo "unclosed quote' : 'echo "unclosed quote';
            const result = await executeTerminal({ command });

            // This might succeed or fail depending on shell behavior
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields on success', async () => {
            const command = isWindows ? 'echo test' : 'echo "test"';
            const result = await executeTerminal({ command });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('stdout');
            expect(result).toHaveProperty('stderr');
            expect(result.tool_name).toBe('execute_terminal');
        });

        it('should include error details on failure', async () => {
            const result = await executeTerminal({ command: 'invalidcommand123' });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result.success).toBe(false);
        });
    });

    // Windows-specific tests - only run on Windows platform
    describe.runIf(isWindows)('Windows PowerShell Commands', () => {
        it('should execute PowerShell Get-ChildItem command', async () => {
            const result = await executeTerminal({
                command: 'Get-ChildItem -Path . -Name | Select-Object -First 5',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
            expect(result.stdout.length).toBeGreaterThan(0);
        });

        it('should execute PowerShell Get-Process command', async () => {
            const result = await executeTerminal({
                command: 'Get-Process | Select-Object -First 3 Name',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('Name');
        });

        it('should execute PowerShell arithmetic', async () => {
            const result = await executeTerminal({
                command: '2 + 3',
            });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('5');
        });

        it('should execute PowerShell string operations', async () => {
            const result = await executeTerminal({
                command: '"Hello" + " " + "World"',
            });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('Hello World');
        });

        it('should handle PowerShell cmdlets with filters', async () => {
            const result = await executeTerminal({
                command:
                    'Get-ChildItem -Path . -Recurse -Filter "*.json" | Select-Object -First 3 Name',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
        });
    });

    // Unix-specific tests - only run on Unix-like systems
    describe.runIf(isUnix)('Unix Shell Commands', () => {
        it('should execute ls command', async () => {
            const result = await executeTerminal({ command: 'ls -la | head -5' });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
            expect(result.stdout.length).toBeGreaterThan(0);
        });

        it('should execute ps command', async () => {
            const result = await executeTerminal({ command: 'ps aux | head -3' });

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('PID');
        });

        it('should handle pipe operations', async () => {
            const result = await executeTerminal({ command: 'echo "test" | wc -l' });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('1');
        });
    });
});
