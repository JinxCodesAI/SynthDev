# Commands System

This directory contains the modular command system that replaced the monolithic `commandHandler.js`. Each command is now implemented as a separate class with proper separation of concerns.

## Architecture

### Base Classes

- **`BaseCommand`** - Abstract base class for all commands
- **`SimpleCommand`** - For simple synchronous commands
- **`InteractiveCommand`** - For commands requiring user interaction
- **`CommandRegistry`** - Manages command registration and routing
- **`CommandRegistrySetup`** - Automatic command registration and validation

### Directory Structure

```
commands/
├── base/                    # Core command infrastructure
│   ├── BaseCommand.js       # Abstract base class
│   ├── CommandRegistry.js   # Command registry and routing
│   └── CommandRegistrySetup.js # Auto-registration system
├── conversation/            # Conversation management
│   └── ClearCommand.js      # /clear command
├── indexing/               # Codebase indexing
│   └── IndexCommand.js      # /index command
├── info/                   # Information display commands
│   ├── CostCommand.js       # /cost command
│   ├── HelpCommand.js       # /help command
│   ├── ReviewCommand.js     # /review command
│   └── ToolsCommand.js      # /tools command
├── role/                   # Role management
│   ├── RoleCommand.js       # /role <name> command
│   └── RolesCommand.js      # /roles command
├── snapshots/              # Snapshot management
│   └── SnapshotsCommand.js  # /snapshots command
├── system/                 # System commands
│   └── ExitCommand.js       # /exit, /quit commands
└── utils/                  # Shared utilities
    └── IndexingUtils.js     # Indexing helper functions
```

## Available Commands

| Command | Description | Type |
|---------|-------------|------|
| `/help` | Show help message | Info |
| `/tools` | List available tools | Info |
| `/review` | Show last API call | Info |
| `/cost` | Show API costs | Info |
| `/clear` | Clear conversation | Conversation |
| `/exit`, `/quit` | Exit application | System |
| `/role <name>` | Switch role | Role |
| `/roles` | Show available roles | Role |
| `/snapshots` | Manage snapshots | Interactive |
| `/index` | Index codebase | Interactive |

## Creating New Commands

### 1. Simple Command Example

```javascript
import { BaseCommand } from '../base/BaseCommand.js';

export class MyCommand extends BaseCommand {
    constructor() {
        super('mycommand', 'Description of my command');
    }

    getRequiredDependencies() {
        return ['apiClient']; // List required dependencies
    }

    async implementation(args, context) {
        const { apiClient } = context;
        // Command implementation here
        console.log('My command executed!');
        return true;
    }
}
```

### 2. Interactive Command Example

```javascript
import { InteractiveCommand } from '../base/BaseCommand.js';

export class MyInteractiveCommand extends InteractiveCommand {
    constructor() {
        super('interactive', 'Interactive command example');
    }

    async implementation(args, context) {
        const input = await this.promptForInput('Enter something: ', context);
        const confirmed = await this.promptForConfirmation('Are you sure?', context);
        
        if (confirmed) {
            console.log(`You entered: ${input}`);
        }
        
        return true;
    }
}
```

### 3. Register New Command

Add your command to `commands/base/CommandRegistrySetup.js`:

```javascript
import MyCommand from '../path/to/MyCommand.js';

export function createCommandRegistry() {
    const registry = new CommandRegistry();
    
    // ... existing registrations
    registry.register(new MyCommand());
    
    return registry;
}
```

## Command Interface

### Required Methods

- `implementation(args, context)` - Main command logic
- `getRequiredDependencies()` - List of required context dependencies

### Optional Methods

- `validateArgs(args)` - Validate command arguments
- `getUsage()` - Return usage string
- `getHelp()` - Return detailed help text

### Context Object

The context object contains all available dependencies:

```javascript
const context = {
    apiClient,          // AI API client
    toolManager,        // Tool manager
    consoleInterface,   // Console I/O
    costsManager,       // Cost tracking
    snapshotManager,    // Snapshot management
    commandRegistry     // Command registry itself
};
```

## Benefits

1. **Separation of Concerns** - Each command has a single responsibility
2. **Testability** - Commands can be unit tested in isolation
3. **Extensibility** - Easy to add new commands
4. **Maintainability** - Smaller, focused files
5. **Type Safety** - Proper dependency injection
6. **Error Handling** - Standardized error handling

## Migration Notes

- The original `commandHandler.js` still exists for backward compatibility
- All existing functionality is preserved
- The new system is used automatically when commands are executed
- Legacy methods remain available but are no longer used

## Testing

Commands can be tested individually by importing them and calling their methods with mock context objects. The command registry includes validation to ensure all commands are properly implemented.
