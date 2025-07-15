// tests/unit/commands/baseCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    BaseCommand,
    SimpleCommand,
    InteractiveCommand,
} from '../../../src/commands/base/BaseCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

// Create test command classes
class TestCommand extends BaseCommand {
    constructor(name = 'test', description = 'Test command', aliases = []) {
        super(name, description, aliases);
    }

    getRequiredDependencies() {
        return ['testDep'];
    }

    async implementation(args, context) {
        return `Test command executed with args: ${args}`;
    }
}

class TestCommandWithValidation extends BaseCommand {
    constructor() {
        super('testvalidation', 'Test command with validation');
    }

    getRequiredDependencies() {
        return ['requiredDep'];
    }

    validateArgs(args) {
        if (!args || args.trim() === '') {
            return 'Arguments are required';
        }
        return null;
    }

    async implementation(args, context) {
        return `Validated command executed with args: ${args}`;
    }
}

class TestCommandWithError extends BaseCommand {
    constructor() {
        super('testerror', 'Test command that throws error');
    }

    getRequiredDependencies() {
        return [];
    }

    async implementation(args, context) {
        throw new Error('Test error');
    }
}

describe('BaseCommand', () => {
    let mockLogger;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create command with correct properties', () => {
            const command = new TestCommand('mycommand', 'My description', ['alias1', 'alias2']);

            expect(command.name).toBe('mycommand');
            expect(command.description).toBe('My description');
            expect(command.aliases).toEqual(['alias1', 'alias2']);
            expect(command.timestamp).toBeDefined();
            expect(typeof command.timestamp).toBe('string');
            expect(new Date(command.timestamp)).toBeInstanceOf(Date);
        });

        it('should create command with default aliases', () => {
            const command = new TestCommand('mycommand', 'My description');

            expect(command.aliases).toEqual([]);
        });

        it('should throw error when instantiated directly', () => {
            expect(() => new BaseCommand('test', 'test')).toThrow(
                'BaseCommand is abstract and cannot be instantiated directly'
            );
        });
    });

    describe('execute', () => {
        it('should execute command successfully', async () => {
            const command = new TestCommand();
            const context = { testDep: 'value' };

            const result = await command.execute('test args', context);

            expect(result).toBe('Test command executed with args: test args');
        });

        it('should validate context dependencies', async () => {
            const command = new TestCommand();
            const context = {}; // Missing required dependency

            const result = await command.execute('test args', context);

            expect(result).toBe('error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'Error executing command \'test\''
            );
        });

        it('should validate arguments when validateArgs is implemented', async () => {
            const command = new TestCommandWithValidation();
            const context = { requiredDep: 'value' };

            const result = await command.execute('', context);

            expect(result).toBe('error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'Error executing command \'testvalidation\''
            );
        });

        it('should handle implementation errors', async () => {
            const command = new TestCommandWithError();
            const context = {};

            const result = await command.execute('test args', context);

            expect(result).toBe('error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'Error executing command \'testerror\''
            );
        });

        it('should pass validation and execute successfully', async () => {
            const command = new TestCommandWithValidation();
            const context = { requiredDep: 'value' };

            const result = await command.execute('valid args', context);

            expect(result).toBe('Validated command executed with args: valid args');
        });
    });

    describe('validateContext', () => {
        it('should return null for valid context', () => {
            const command = new TestCommand();
            const context = { testDep: 'value' };

            const error = command.validateContext(context);

            expect(error).toBeNull();
        });

        it('should return error for missing dependencies', () => {
            const command = new TestCommand();
            const context = {};

            const error = command.validateContext(context);

            expect(error).toBe('Missing required dependency: testDep');
        });

        it('should handle null context gracefully', () => {
            const command = new TestCommand();

            expect(() => command.validateContext(null)).toThrow();
        });

        it('should handle undefined context gracefully', () => {
            const command = new TestCommand();

            expect(() => command.validateContext(undefined)).toThrow();
        });

        it('should handle multiple missing dependencies', () => {
            class MultiDepCommand extends BaseCommand {
                getRequiredDependencies() {
                    return ['dep1', 'dep2', 'dep3'];
                }
                async implementation() {
                    return true;
                }
            }

            const command = new MultiDepCommand('multi', 'Multi dep command');
            const context = { dep2: 'value' }; // Missing dep1 and dep3

            const error = command.validateContext(context);

            expect(error).toBe('Missing required dependency: dep1');
        });
    });

    describe('validateArgs', () => {
        it('should return null by default', () => {
            const command = new TestCommand();

            const error = command.validateArgs('any args');

            expect(error).toBeNull();
        });
    });

    describe('handleError', () => {
        it('should log error and return "error"', () => {
            const command = new TestCommand();
            const error = new Error('Test error');

            const result = command.handleError(error, 'test args', {});

            expect(result).toBe('error');
            expect(mockLogger.error).toHaveBeenCalledWith(error, 'Error executing command \'test\'');
        });
    });

    describe('implementation', () => {
        it('should throw error when not overridden', async () => {
            class IncompleteCommand extends BaseCommand {
                getRequiredDependencies() {
                    return [];
                }
            }

            const command = new IncompleteCommand('incomplete', 'Incomplete command');

            await expect(command.implementation('', {})).rejects.toThrow(
                'implementation method must be overridden by IncompleteCommand'
            );
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return empty array by default', () => {
            class IncompleteCommand extends BaseCommand {
                async implementation() {
                    return true;
                }
            }

            const command = new IncompleteCommand('incomplete', 'Incomplete command');

            const deps = command.getRequiredDependencies();
            expect(deps).toEqual([]);
        });
    });

    describe('getUsage', () => {
        it('should return default usage', () => {
            const command = new TestCommand('mycommand', 'My description');

            const usage = command.getUsage();

            expect(usage).toBe('/mycommand');
        });
    });

    describe('getHelp', () => {
        it('should return formatted help text', () => {
            const command = new TestCommand('mycommand', 'My description');

            const help = command.getHelp();

            expect(help).toBe('/mycommand - My description\n   Usage: /mycommand');
        });
    });
});

describe('SimpleCommand', () => {
    class TestSimpleCommand extends SimpleCommand {
        getRequiredDependencies() {
            return [];
        }

        execute(args, _context) {
            return `Simple command: ${args}`;
        }
    }

    it('should extend BaseCommand', () => {
        const command = new TestSimpleCommand('simple', 'Simple command');

        expect(command).toBeInstanceOf(BaseCommand);
        expect(command.name).toBe('simple');
        expect(command.description).toBe('Simple command');
    });

    it('should execute synchronously', async () => {
        const command = new TestSimpleCommand('simple', 'Simple command');
        const context = {};

        const result = await command.execute('test', context);

        expect(result).toBe('Simple command: test');
    });
});

describe('InteractiveCommand', () => {
    class TestInteractiveCommand extends InteractiveCommand {
        getRequiredDependencies() {
            return ['consoleInterface'];
        }

        async implementation(args, context) {
            const input = await this.promptForInput('Enter something: ', context);
            return `Interactive result: ${input}`;
        }
    }

    let mockContext;

    beforeEach(() => {
        mockContext = {
            consoleInterface: {
                promptForInput: vi.fn().mockResolvedValue('user input'),
                promptForConfirmation: vi.fn().mockResolvedValue(true),
            },
        };
    });

    it('should extend BaseCommand', () => {
        const command = new TestInteractiveCommand('interactive', 'Interactive command');

        expect(command).toBeInstanceOf(BaseCommand);
        expect(command.name).toBe('interactive');
        expect(command.description).toBe('Interactive command');
    });

    it('should include consoleInterface in required dependencies', () => {
        const command = new TestInteractiveCommand('interactive', 'Interactive command');

        const deps = command.getRequiredDependencies();

        expect(deps).toContain('consoleInterface');
    });

    it('should provide promptForInput method', async () => {
        const command = new TestInteractiveCommand('interactive', 'Interactive command');

        const result = await command.execute('test', mockContext);

        expect(result).toBe('Interactive result: user input');
        expect(mockContext.consoleInterface.promptForInput).toHaveBeenCalledWith(
            'Enter something: '
        );
    });

    it('should provide promptForConfirmation method', async () => {
        const command = new TestInteractiveCommand('interactive', 'Interactive command');

        const confirmed = await command.promptForConfirmation('Are you sure?', mockContext);

        expect(confirmed).toBe(true);
        expect(mockContext.consoleInterface.promptForConfirmation).toHaveBeenCalledWith(
            'Are you sure?'
        );
    });
});
