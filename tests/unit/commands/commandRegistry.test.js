// tests/unit/commands/commandRegistry.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandRegistry } from '../../../commands/base/CommandRegistry.js';
import { BaseCommand } from '../../../commands/base/BaseCommand.js';

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn().mockReturnValue({
        raw: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    }),
}));

// Create test command classes
class TestCommand extends BaseCommand {
    constructor(name = 'test', description = 'Test command', aliases = []) {
        super(name, description, aliases);
    }

    getRequiredDependencies() {
        return [];
    }

    async implementation(args, context) {
        return `Test command executed with args: ${args}`;
    }
}

describe('CommandRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = new CommandRegistry();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with empty maps', () => {
            expect(registry.commands).toBeInstanceOf(Map);
            expect(registry.aliases).toBeInstanceOf(Map);
            expect(registry.commands.size).toBe(0);
            expect(registry.aliases.size).toBe(0);
        });
    });

    describe('register', () => {
        it('should register a valid command', () => {
            const command = new TestCommand();
            registry.register(command);

            expect(registry.commands.has('test')).toBe(true);
            expect(registry.commands.get('test')).toBe(command);
        });

        it('should throw error for invalid command', () => {
            const invalidCommand = { name: 'invalid' };

            expect(() => registry.register(invalidCommand)).toThrow(
                'Invalid command: must have an execute method'
            );
        });
    });

    describe('getCommand', () => {
        beforeEach(() => {
            const command1 = new TestCommand('cmd1', 'Command 1');
            registry.register(command1);
        });

        it('should get command by name', () => {
            const command = registry.getCommand('cmd1');
            expect(command).toBeDefined();
            expect(command.name).toBe('cmd1');
        });

        it('should return null for non-existent command', () => {
            const command = registry.getCommand('nonexistent');
            expect(command).toBeNull();
        });
    });

    describe('hasCommand', () => {
        beforeEach(() => {
            const command = new TestCommand('testcmd', 'Test command');
            registry.register(command);
        });

        it('should return true for existing command', () => {
            expect(registry.hasCommand('testcmd')).toBe(true);
        });

        it('should return false for non-existent command', () => {
            expect(registry.hasCommand('nonexistent')).toBe(false);
        });
    });

    describe('executeCommand', () => {
        let mockLogger;

        beforeEach(async () => {
            const command = new TestCommand();
            registry.register(command);

            const { getLogger } = await import('../../../logger.js');
            mockLogger = getLogger();
        });

        it('should execute existing command', async () => {
            const context = {};
            const result = await registry.executeCommand('test', 'arg1 arg2', context);

            expect(result).toBe('Test command executed with args: arg1 arg2');
        });

        it('should handle non-existent command', async () => {
            const context = {};
            const result = await registry.executeCommand('nonexistent', '', context);

            expect(result).toBe('invalid');
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Unknown command: /nonexistent');
        });
    });

    describe('handleCommand', () => {
        beforeEach(() => {
            const command = new TestCommand();
            registry.register(command);
        });

        it('should handle valid command input', async () => {
            const context = {};
            const result = await registry.handleCommand('/test arg1 arg2', context);

            expect(result).toBe('Test command executed with args: arg1 arg2');
        });

        it('should return false for non-command input', async () => {
            const context = {};
            const result = await registry.handleCommand('not a command', context);

            expect(result).toBe(false);
        });
    });

    describe('getAllCommands', () => {
        it('should return all registered commands', () => {
            const command1 = new TestCommand('cmd1', 'Command 1');
            const command2 = new TestCommand('cmd2', 'Command 2');

            registry.register(command1);
            registry.register(command2);

            const commands = registry.getAllCommands();
            expect(commands).toHaveLength(2);
            expect(commands).toContain(command1);
            expect(commands).toContain(command2);
        });
    });
});
