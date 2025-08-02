# ADR-002: Adding New Commands

## Status

Accepted

## Context

SynthDev uses a command system that allows users to interact with the application through `/` prefixed commands. New commands need to be added following a consistent pattern to ensure proper integration with the command registry and user interface.

## Decision

We will follow a standardized approach for adding new commands to SynthDev that ensures consistency, maintainability, and proper integration with the existing command system.

## Command Structure

### Directory Organization

Commands are organized by category under `src/commands/`:

```
src/commands/
├── base/                    # Base command classes
│   ├── BaseCommand.js       # Abstract base command
│   ├── CommandRegistry.js   # Command registration system
│   └── InteractiveCommand.js # Base for interactive commands
├── config/                  # Configuration commands
├── conversation/            # Chat management commands
├── indexing/               # Codebase indexing commands
├── info/                   # Information display commands
├── role/                   # Role management commands
├── snapshots/              # Git integration commands
├── system/                 # System commands
├── terminal/               # Terminal integration commands
├── utils/                  # Utility commands
```

### Command Implementation

#### Basic Command Structure

```javascript
import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../core/managers/logger.js';

export class YourCommand extends BaseCommand {
    constructor() {
        super(
            'commandname', // Command name (no spaces, lowercase)
            'Command description', // Brief description for help
            ['alias1', 'alias2'] // Optional aliases
        );
    }

    /**
     * Execute the command
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command result
     */
    async execute(args, context) {
        const logger = getLogger();

        try {
            // Parse arguments
            const parsedArgs = this.parseArguments(args);

            // Validate context dependencies
            this.validateContext(context);

            // Execute command logic
            const result = await this.performCommand(parsedArgs, context);

            logger.debug(`Command executed successfully: ${this.name}`);
            return result;
        } catch (error) {
            logger.error(error, `Command execution failed: ${this.name}`);
            throw error;
        }
    }

    /**
     * Parse command arguments
     * @param {string} args - Raw arguments string
     * @returns {Object} Parsed arguments
     */
    parseArguments(args) {
        // Implement argument parsing logic
        return { args: args.trim() };
    }

    /**
     * Validate execution context
     * @param {Object} context - Execution context
     */
    validateContext(context) {
        const required = ['consoleInterface', 'apiClient'];
        for (const dep of required) {
            if (!context[dep]) {
                throw new Error(`Missing required context: ${dep}`);
            }
        }
    }

    /**
     * Perform the actual command operation
     * @param {Object} args - Parsed arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command result
     */
    async performCommand(args, context) {
        // Implement your command logic here
        const { consoleInterface } = context;
        consoleInterface.showMessage('Command executed successfully');
        return 'success';
    }
}
```

#### Interactive Command Structure

For commands that require user interaction:

```javascript
import { InteractiveCommand } from '../base/BaseCommand.js';

export class YourInteractiveCommand extends InteractiveCommand {
    constructor() {
        super('interactive', 'Interactive command description');
    }

    async execute(args, context) {
        const { consoleInterface } = context;

        // Use built-in prompt methods
        const userInput = await this.promptForInput('Enter value: ', context);
        const choice = await this.promptForChoice(
            'Select option:',
            ['Option 1', 'Option 2', 'Option 3'],
            context
        );

        // Process user input
        return this.processInteraction(userInput, choice, context);
    }

    async processInteraction(input, choice, context) {
        // Handle user interaction
        return 'interaction_complete';
    }
}
```

## Command Categories

### Configuration Commands (`config/`)

Commands for application configuration:

- Setup and configuration management
- Environment variable handling
- Provider configuration

### Conversation Commands (`conversation/`)

Commands for chat management:

- Clear conversation history
- Manage conversation state
- Export/import conversations

### Information Commands (`info/`)

Commands for displaying information:

- Help and usage information
- System status and statistics
- Cost and usage tracking

### System Commands (`system/`)

Core system commands:

- Application exit and shutdown
- System diagnostics
- Debug information

### Utility Commands (`utils/`)

General-purpose commands:

- File operations
- Text processing
- Calculation and conversion

## Command Registration

Commands are automatically discovered and registered:

### Automatic Discovery

The `CommandRegistry` automatically discovers commands:

1. **Directory Scanning**: Scans command category directories
2. **Module Loading**: Imports command classes
3. **Registration**: Registers commands and aliases
4. **Validation**: Validates command structure

### Manual Registration

For special cases, commands can be manually registered:

```javascript
import { CommandRegistry } from './base/CommandRegistry.js';
import { YourCommand } from './category/YourCommand.js';

const registry = new CommandRegistry();
registry.register(new YourCommand());
```

## Context Dependencies

Commands receive an execution context with these dependencies:

```javascript
const context = {
    consoleInterface, // User interface for input/output
    apiClient, // AI API client
    toolManager, // Tool execution manager
    costsManager, // Cost tracking manager
    snapshotManager, // Git snapshot manager
    app, // Main application instance
};
```

### Required Dependencies

Most commands require:

- `consoleInterface`: For user interaction
- `apiClient`: For AI operations (if needed)

### Optional Dependencies

Some commands may use:

- `toolManager`: For tool operations
- `costsManager`: For cost tracking
- `snapshotManager`: For Git operations
- `app`: For application-level operations

## Argument Parsing

### Simple Arguments

For basic string arguments:

```javascript
parseArguments(args) {
    return { input: args.trim() };
}
```

### Complex Arguments

For commands with multiple parameters:

```javascript
parseArguments(args) {
    const parts = args.trim().split(/\s+/);
    return {
        action: parts[0] || '',
        target: parts[1] || '',
        options: parts.slice(2)
    };
}
```

### Flag-based Arguments

For commands with flags:

```javascript
parseArguments(args) {
    const flags = {};
    const positional = [];

    const parts = args.trim().split(/\s+/);
    for (const part of parts) {
        if (part.startsWith('--')) {
            const [key, value] = part.substring(2).split('=');
            flags[key] = value || true;
        } else {
            positional.push(part);
        }
    }

    return { flags, positional };
}
```

## Error Handling

### Standard Error Patterns

```javascript
async execute(args, context) {
    try {
        // Command logic
        return result;
    } catch (error) {
        const logger = getLogger();
        const { consoleInterface } = context;

        // Log error for debugging
        logger.error(error, `Command failed: ${this.name}`);

        // Show user-friendly message
        consoleInterface.showError(`Command failed: ${error.message}`);

        // Return error indicator
        return 'error';
    }
}
```

### Validation Errors

```javascript
validateArguments(args) {
    if (!args.required_param) {
        throw new Error('Required parameter missing: required_param');
    }

    if (args.numeric_param && isNaN(args.numeric_param)) {
        throw new Error('Parameter must be a number: numeric_param');
    }
}
```

## Testing Requirements

### Unit Tests

Create comprehensive unit tests in `tests/unit/commands/yourCommand.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourCommand } from '../../../src/commands/category/YourCommand.js';

describe('YourCommand', () => {
    let command;
    let mockContext;

    beforeEach(() => {
        command = new YourCommand();
        mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                showError: vi.fn(),
            },
            apiClient: vi.fn(),
        };
    });

    describe('constructor', () => {
        it('should initialize with correct name and description', () => {
            expect(command.name).toBe('commandname');
            expect(command.description).toBe('Command description');
        });
    });

    describe('execute', () => {
        it('should execute successfully with valid arguments', async () => {
            const result = await command.execute('test args', mockContext);
            expect(result).toBe('success');
        });

        it('should handle errors gracefully', async () => {
            // Test error scenarios
        });
    });

    describe('argument parsing', () => {
        it('should parse arguments correctly', () => {
            const result = command.parseArguments('test input');
            expect(result.args).toBe('test input');
        });
    });
});
```

### Integration Tests

Test command integration with the command registry and application.

## Help Integration

Commands automatically appear in help output. Enhance help with:

### Command Help Configuration

Add detailed help to `src/config/ui/command-help.json`:

```json
{
    "commands": {
        "yourcommand": {
            "description": "Detailed command description",
            "usage": "/yourcommand <args>",
            "examples": ["/yourcommand example1", "/yourcommand --flag value"],
            "aliases": ["alias1", "alias2"]
        }
    }
}
```

### In-Command Help

Implement help within the command:

```javascript
async execute(args, context) {
    if (args === 'help' || args === '--help') {
        return this.showHelp(context);
    }

    // Normal execution
}

showHelp(context) {
    const { consoleInterface } = context;
    consoleInterface.showMessage(`
Usage: /${this.name} <arguments>

Description: ${this.description}

Examples:
  /${this.name} example1
  /${this.name} --option value
    `);
    return 'help_shown';
}
```

## Command Lifecycle

### Registration Phase

1. **Discovery**: Command files are discovered
2. **Loading**: Command classes are imported
3. **Instantiation**: Command instances are created
4. **Registration**: Commands are registered with aliases

### Execution Phase

1. **Input Parsing**: User input is parsed for command and arguments
2. **Command Lookup**: Command is found in registry
3. **Context Preparation**: Execution context is prepared
4. **Execution**: Command execute method is called
5. **Result Handling**: Command result is processed

## Best Practices

### Command Design

- Keep commands focused on a single responsibility
- Use clear, descriptive command names
- Provide helpful aliases for common commands
- Include comprehensive help information

### User Experience

- Provide immediate feedback for long-running operations
- Use consistent output formatting
- Handle edge cases gracefully
- Validate user input thoroughly

### Error Handling

- Provide clear, actionable error messages
- Log detailed error information for debugging
- Gracefully handle missing dependencies
- Validate arguments before execution

### Testing

- Test all argument parsing scenarios
- Test error conditions and edge cases
- Mock external dependencies appropriately
- Verify integration with command registry

## Real Command Example: RolesCommand

### Implementation (`src/commands/role/RolesCommand.js`)

```javascript
import { BaseCommand } from '../base/BaseCommand.js';

export class RolesCommand extends BaseCommand {
    constructor() {
        super('roles', 'Display available AI roles and their descriptions');
    }

    async execute(args, context) {
        const { consoleInterface, app } = context;
        const configManager = app.configManager;

        try {
            const roles = configManager.getRoles();

            if (!roles || Object.keys(roles).length === 0) {
                consoleInterface.showMessage('No roles configured.');
                return;
            }

            // Display roles in organized format
            this.displayRolesByCategory(roles, consoleInterface);
        } catch (error) {
            consoleInterface.showError(`Failed to load roles: ${error.message}`);
        }
    }

    displayRolesByCategory(roles, consoleInterface) {
        const categories = this.categorizeRoles(roles);

        for (const [category, roleList] of Object.entries(categories)) {
            consoleInterface.showMessage(`\n📂 ${category}:`);

            for (const [roleName, roleConfig] of roleList) {
                const level = roleConfig.level || 'base';
                const description = this.extractDescription(roleConfig.systemMessage);

                consoleInterface.showMessage(`  🎭 ${roleName} (${level}) - ${description}`);
            }
        }
    }
}
```

**Key Features:**

- Extends `BaseCommand` with proper constructor
- Uses context dependencies (`consoleInterface`, `app`)
- Implements error handling
- Organizes output in user-friendly format
- Extracts and displays role information

## Consequences

### Positive

- Consistent command development patterns
- Automatic command discovery and registration
- Standardized error handling and help integration
- Clear separation of concerns
- Comprehensive testing requirements

### Negative

- Additional boilerplate for simple commands
- Strict structure requirements
- Need to maintain help configuration

---

_This ADR establishes the standard pattern for adding new commands to SynthDev. Follow this structure to ensure proper integration and maintainability._
