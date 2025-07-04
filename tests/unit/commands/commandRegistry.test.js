// tests/unit/commands/commandRegistry.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandRegistry } from '../../../src/commands/base/CommandRegistry.js';
import { BaseCommand } from '../../../src/commands/base/BaseCommand.js';
import json from '../../../src/config/ui/console-messages.json';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn().mockReturnValue({
        raw: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        user: vi.fn(),
    }),
}));

// Mock UI config manager with static config values
vi.mock('../../../src/config/managers/uiConfigManager.js', () => ({
    getUIConfigManager: vi.fn().mockReturnValue({
        getMessage: vi.fn((path, params = {}) => {
            // Mock config messages to avoid ES module loading issues
            const mockConfigMessages = {
                errors: {
                    command_error: json.errors.command_error,
                },
            };

            // Helper function to get nested value from config
            const getNestedValue = (obj, path) => {
                return path.split('.').reduce((current, key) => current?.[key], obj);
            };

            // Helper function to format message with parameters
            const formatMessage = (message, params) => {
                if (typeof message !== 'string') {
                    return message;
                }
                return message.replace(/\{(\w+)\}/g, (match, key) => {
                    return params[key] !== undefined ? params[key] : match;
                });
            };

            // Get value from mock config
            const message = getNestedValue(mockConfigMessages, path);

            if (message === undefined) {
                // Return a default message for missing paths
                return `Mock message for ${path}`;
            }

            return formatMessage(message, params);
        }),
    }),
}));

// Mock configuration loader
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(),
}));

// Create test command classes
class TestCommand extends BaseCommand {
    constructor(name = 'test', description = 'Test command', aliases = []) {
        super(name, description, aliases);
    }

    getRequiredDependencies() {
        return [];
    }

    async implementation(args, _context) {
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

            const { getLogger } = await import('../../../src/core/managers/logger.js');
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
            expect(mockLogger.user).toHaveBeenCalledWith(
                '❌ Unknown command: /nonexistent\n📖 Type /help to see available commands'
            );
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

        it('should return empty array when no commands registered', () => {
            const commands = registry.getAllCommands();
            expect(commands).toHaveLength(0);
            expect(commands).toEqual([]);
        });
    });

    describe('aliases', () => {
        it('should register command aliases', () => {
            const command = new TestCommand('main', 'Main command', ['alias1', 'alias2']);
            registry.register(command);

            expect(registry.hasCommand('main')).toBe(true);
            expect(registry.hasCommand('alias1')).toBe(true);
            expect(registry.hasCommand('alias2')).toBe(true);
        });

        it('should get command by alias', () => {
            const command = new TestCommand('main', 'Main command', ['alias1']);
            registry.register(command);

            const foundCommand = registry.getCommand('alias1');
            expect(foundCommand).toBe(command);
        });

        it('should execute command by alias', async () => {
            const command = new TestCommand('main', 'Main command', ['alias1']);
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand('alias1', 'test args', context);

            expect(result).toBe('Test command executed with args: test args');
        });

        it('should allow duplicate command names (overwrites)', () => {
            const command1 = new TestCommand('duplicate', 'First command');
            const command2 = new TestCommand('duplicate', 'Second command');

            registry.register(command1);
            registry.register(command2); // Should overwrite

            const retrievedCommand = registry.getCommand('duplicate');
            expect(retrievedCommand.description).toBe('Second command');
        });

        it('should throw error for duplicate aliases', () => {
            const command1 = new TestCommand('cmd1', 'First command', ['shared']);
            const command2 = new TestCommand('cmd2', 'Second command', ['shared']);

            registry.register(command1);

            expect(() => registry.register(command2)).toThrow(
                "Alias 'shared' is already registered"
            );
        });

        it('should allow alias that matches existing command name', () => {
            const command1 = new TestCommand('existing', 'Existing command');
            const command2 = new TestCommand('new', 'New command', ['existing']);

            registry.register(command1);

            // This should work - alias can match existing command name
            expect(() => registry.register(command2)).not.toThrow();
        });
    });

    describe('command validation', () => {
        it('should throw error for command without execute method', () => {
            const invalidCommand = { name: 'test' };

            expect(() => registry.register(invalidCommand)).toThrow(
                'Invalid command: must have an execute method'
            );
        });

        it('should throw error for null command', () => {
            expect(() => registry.register(null)).toThrow(
                'Invalid command: must have an execute method'
            );
        });

        it('should throw error for undefined command', () => {
            expect(() => registry.register(undefined)).toThrow(
                'Invalid command: must have an execute method'
            );
        });
    });

    describe('command parsing', () => {
        it('should parse command with arguments', async () => {
            const command = new TestCommand();
            registry.register(command);

            const context = {};
            const result = await registry.handleCommand('/test arg1 arg2 arg3', context);

            expect(result).toBe('Test command executed with args: arg1 arg2 arg3');
        });

        it('should parse command without arguments', async () => {
            const command = new TestCommand();
            registry.register(command);

            const context = {};
            const result = await registry.handleCommand('/test', context);

            expect(result).toBe('Test command executed with args: ');
        });

        it('should handle command with extra spaces', async () => {
            const command = new TestCommand();
            registry.register(command);

            const context = {};
            const result = await registry.handleCommand('/test arg1   arg2', context);

            expect(result).toBe('Test command executed with args: arg1   arg2');
        });

        it('should return false for input without slash prefix', async () => {
            const context = {};
            const result = await registry.handleCommand('not a command', context);

            expect(result).toBe(false);
        });

        it('should return false for empty input', async () => {
            const context = {};
            const result = await registry.handleCommand('', context);

            expect(result).toBe(false);
        });

        it('should return false for whitespace-only input', async () => {
            const context = {};
            const result = await registry.handleCommand('   ', context);

            expect(result).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should handle command execution errors gracefully', async () => {
            class ErrorCommand extends TestCommand {
                async implementation() {
                    throw new Error('Command error');
                }
            }

            const command = new ErrorCommand('error', 'Error command');
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand('error', '', context);

            expect(result).toBe('error');
        });

        it('should handle command with no aliases gracefully', () => {
            const command = new TestCommand('noaliases', 'No aliases command');
            delete command.aliases;
            registry.register(command);

            expect(registry.hasCommand('noaliases')).toBe(true);
            expect(registry.getCommand('noaliases')).toBe(command);
        });

        it('should handle command with null aliases gracefully', () => {
            const command = new TestCommand('null', 'Null aliases', null);
            registry.register(command);

            expect(registry.hasCommand('null')).toBe(true);
            expect(registry.getCommand('null')).toBe(command);
        });

        it('should handle command input with only slash', async () => {
            const context = {};
            const result = await registry.handleCommand('/', context);

            expect(result).toBe('invalid');
            // Logger call is expected but we don't need to verify the exact message
        });

        it('should handle command input with trailing spaces', async () => {
            const command = new TestCommand();
            registry.register(command);

            const context = {};
            const result = await registry.handleCommand('/test args   ', context);

            expect(result).toBe('Test command executed with args: args');
        });

        it('should handle case-sensitive command names', () => {
            const command1 = new TestCommand('Test', 'Uppercase test');
            const command2 = new TestCommand('test', 'Lowercase test');

            registry.register(command1);
            registry.register(command2);

            expect(registry.getCommand('Test')).toBe(command1);
            expect(registry.getCommand('test')).toBe(command2);
        });

        it('should handle very long command names', () => {
            const longName = 'a'.repeat(1000);
            const command = new TestCommand(longName, 'Long name command');
            registry.register(command);

            expect(registry.hasCommand(longName)).toBe(true);
            expect(registry.getCommand(longName)).toBe(command);
        });

        it('should handle command with many aliases', () => {
            const manyAliases = Array.from({ length: 50 }, (_, i) => `alias${i}`);
            const command = new TestCommand('test', 'Test command', manyAliases);
            registry.register(command);

            manyAliases.forEach(alias => {
                expect(registry.hasCommand(alias)).toBe(true);
                expect(registry.getCommand(alias)).toBe(command);
            });
        });

        it('should handle command execution with complex arguments', async () => {
            const command = new TestCommand();
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand(
                'test',
                '--flag value "quoted string"',
                context
            );

            expect(result).toBe('Test command executed with args: --flag value "quoted string"');
        });

        it('should handle command execution with unicode characters', async () => {
            const command = new TestCommand();
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand('test', 'héllo wörld 🌍', context);

            expect(result).toBe('Test command executed with args: héllo wörld 🌍');
        });

        it('should handle command with special characters in alias', () => {
            const command = new TestCommand('test', 'Test command', ['test-alias_123']);
            registry.register(command);

            expect(registry.hasCommand('test-alias_123')).toBe(true);
            expect(registry.getCommand('test-alias_123')).toBe(command);
        });

        it('should handle command execution with empty context', async () => {
            const command = new TestCommand();
            registry.register(command);

            const result = await registry.executeCommand('test', 'args', {});

            expect(result).toBe('Test command executed with args: args');
        });

        it('should handle command execution with null context', async () => {
            const command = new TestCommand();
            registry.register(command);

            const result = await registry.executeCommand('test', 'args', null);

            expect(result).toBe('Test command executed with args: args');
        });

        it('should handle command execution with undefined context', async () => {
            const command = new TestCommand();
            registry.register(command);

            const result = await registry.executeCommand('test', 'args', undefined);

            expect(result).toBe('Test command executed with args: args');
        });

        it('should handle command that returns non-string result', async () => {
            class ObjectCommand extends TestCommand {
                async implementation() {
                    return { result: 'success', data: [1, 2, 3] };
                }
            }

            const command = new ObjectCommand('object', 'Object command');
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand('object', '', context);

            expect(result).toEqual({ result: 'success', data: [1, 2, 3] });
        });

        it('should handle command that returns null', async () => {
            class NullCommand extends TestCommand {
                async implementation() {
                    return null;
                }
            }

            const command = new NullCommand('null', 'Null command');
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand('null', '', context);

            expect(result).toBeNull();
        });

        it('should handle command that returns undefined', async () => {
            class UndefinedCommand extends TestCommand {
                async implementation() {
                    return undefined;
                }
            }

            const command = new UndefinedCommand('undefined', 'Undefined command');
            registry.register(command);

            const context = {};
            const result = await registry.executeCommand('undefined', '', context);

            expect(result).toBeUndefined();
        });
    });
});
