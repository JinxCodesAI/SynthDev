// tests/integration/cross-platform-shell.test.js
import { describe, test, expect, vi } from 'vitest';
import { platform } from 'os';
import executeTerminal from '../../src/tools/execute_terminal/implementation.js';

const isWindows = platform() === 'win32';
const isUnix = platform() === 'linux' || platform() === 'darwin';

// Mock logger
vi.mock('../../src/core/managers/logger.js', () => ({
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

describe('Cross-Platform Shell Integration', () => {
    describe.runIf(isWindows)('Windows PowerShell Integration', () => {
        test('should execute PowerShell Get-ChildItem command', async () => {
            const result = await executeTerminal({
                command: 'Get-ChildItem -Path . -Name | Select-Object -First 3',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
            expect(result.tool_name).toBe('execute_terminal');
        });

        test('should execute PowerShell with filters', async () => {
            const result = await executeTerminal({
                command: 'Get-ChildItem -Path . -Filter "*.json" | Select-Object -First 2 Name',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
        });

        test('should execute PowerShell arithmetic', async () => {
            const result = await executeTerminal({
                command: '2 + 3',
            });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('5');
        });

        test('should handle PowerShell string operations', async () => {
            const result = await executeTerminal({
                command: '"Hello" + " " + "PowerShell"',
            });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('Hello PowerShell');
        });

        test('should execute Get-Process command', async () => {
            const result = await executeTerminal({
                command: 'Get-Process | Select-Object -First 2 Name',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('Name');
        });

        test('should handle the original failing command', async () => {
            const result = await executeTerminal({
                command: 'Get-ChildItem -Path . -Recurse -Filter *docker*',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
            // Should not fail with "not recognized as internal or external command"
            expect(result.error || '').not.toContain(
                'not recognized as an internal or external command'
            );
        });
    });

    describe.runIf(isUnix)('Unix Shell Integration', () => {
        test('should execute ls command', async () => {
            const result = await executeTerminal({
                command: 'ls -la | head -3',
            });

            expect(result.success).toBe(true);
            expect(result.stdout).toBeDefined();
        });

        test('should execute echo command', async () => {
            const result = await executeTerminal({
                command: 'echo "Hello Unix"',
            });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('Hello Unix');
        });

        test('should handle pipe operations', async () => {
            const result = await executeTerminal({
                command: 'echo "test" | wc -l',
            });

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('1');
        });
    });

    describe('Cross-Platform Basic Commands', () => {
        test('should handle simple echo on any platform', async () => {
            const command = isWindows ? 'echo Hello' : 'echo "Hello"';
            const result = await executeTerminal({ command });

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('Hello');
        });

        test('should handle invalid commands gracefully', async () => {
            const result = await executeTerminal({
                command: 'nonexistentcommand12345',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should include proper response format', async () => {
            const command = isWindows ? 'echo test' : 'echo "test"';
            const result = await executeTerminal({ command });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('stdout');
            expect(result).toHaveProperty('stderr');
            expect(result.tool_name).toBe('execute_terminal');
        });
    });

    describe('Error Handling', () => {
        test('should handle parameter validation errors', async () => {
            const result = await executeTerminal({});

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle empty command', async () => {
            const result = await executeTerminal({ command: '' });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle non-string command', async () => {
            const result = await executeTerminal({ command: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
