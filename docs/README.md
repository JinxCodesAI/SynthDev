# Synth-Dev Documentation

**Synth-Dev** is a powerful Node.js console-based AI coding assistant with an extensible tool system and command interface. It provides comprehensive development tools, multi-model support, and sophisticated conversation management capabilities.

## What is Synth-Dev?

Synth-Dev is an AI-powered development assistant that provides:

- **🛠️ Comprehensive Tool System**: File operations, code execution, terminal access, and analysis tools
- **⚡ Command Interface**: Powerful `/` commands for managing conversations, costs, and application state
- **🤖 Multi-Model Support**: Configure different AI models for different tasks (base, smart, fast)
- **🔧 Extensible Architecture**: Easy to add new tools and commands
- **📊 Advanced Features**: Conversation snapshots, codebase indexing, prompt enhancement, and cost tracking

## System Requirements

- **Node.js**: Version 20.10.0 or higher (ES Modules support required)
- **Operating System**: Tested on Windows, WSL and Linux docker container, never tested on macOS (Sorry *)

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example configuration file:
```bash
cp config.example.env .env
```

Edit `.env` with your API keys and preferences:
```env
# Base Model Configuration (Required)
API_KEY=your_api_key_here
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1

# Smart Model (for Architect role)
SMART_API_KEY=your_smart_api_key
SMART_MODEL=gpt-4.1-mini
SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (for quick tasks)
FAST_API_KEY=your_fast_api_key
FAST_MODEL=gpt-4.1-nano
FAST_BASE_URL=https://api.openai.com/v1

# Application Settings
MAX_TOOL_CALLS=50
ENABLE_PROMPT_ENHANCEMENT=false
VERBOSITY_LEVEL=2
```

### 3. Start the Application

```bash
npm start
```

Or run in development mode with auto-reload:
```bash
npm run dev
```

## Main Functionalities

### Command System

Synth-Dev includes a comprehensive command system accessible via `/` prefix:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands and usage |
| `/tools` | List all available tools |
| `/cost` | Display API usage costs |
| `/review` | Show last API call details |
| `/clear` | Clear conversation history |
| `/snapshots` | Manage conversation snapshots |
| `/index` | Index codebase for analysis |
| `/roles` | Show available AI roles |
| `/role <name>` | Switch to a specific role |
| `/exit`, `/quit` | Exit the application |

### Tool System

Synth-Dev includes a comprehensive set of tools for development tasks:

#### File Operations
- **read_file**: Safely read file contents with error handling
- **write_file**: Create or overwrite files with automatic directory creation
- **edit_file**: Safely edit files by inserting/deleting content between boundaries
- **list_directory**: Recursively list directory contents with metadata

#### Code Analysis & Search
- **exact_search**: Search for exact text patterns in files and directories
- **explain_codebase**: AI-powered codebase explanations using indexed summaries

#### Execution & Scripting
- **execute_script**: Run JavaScript code in sandboxed environment with AI safety assessment
- **execute_terminal**: Execute terminal commands with output capture

#### Utilities
- **calculate**: Mathematical calculator with complex expression support
- **get_time**: Comprehensive time/date operations and formatting

### Verbosity Control System

Control output detail with the `VERBOSITY_LEVEL` environment variable (0-5):

- **Level 0**: Only user messages and errors
- **Level 1**: + Status messages (🔄 Enhancing prompt..., 🧠 AI thinking...)
- **Level 2**: + Compressed tool arguments (default)
- **Level 3**: + Uncompressed tool arguments and debug messages
- **Level 4**: + Tool execution results
- **Level 5**: + Complete HTTP request/response logging

### Safety Features

- **Tool Call Limits**: Maximum tool calls per interaction (default: 50)
- **Automatic Reset**: Tool call counter resets per interaction
- **Script Sandboxing**: JavaScript execution in isolated processes
- **AI Safety Assessment**: Scripts analyzed for security risks before execution
- **Timeout Protection**: Prevents infinite loops and long-running processes

### User Prompt Enhancement

Optional feature that improves user prompts using AI:

**Enable in .env:**
```env
ENABLE_PROMPT_ENHANCEMENT=true
```

**How it works:**
1. Type your prompt and press ENTER
2. System shows "🔄 Enhancing prompt..."
3. Review the enhanced version
4. Choose: Use enhanced, modify, or use original

**Benefits:**
- Makes vague requests more specific
- Improves AI response quality
- Educational tool for better prompting
- Full user control over final prompt

## Configuration

The configuration uses the `.env` file shown in the setup section above. Key settings:

- **Model Configuration**: Base, Smart, and Fast model settings for different tasks
- **Safety Settings**: `MAX_TOOL_CALLS` limits tool usage per interaction
- **Verbosity**: `VERBOSITY_LEVEL` controls output detail (0-5)
- **Features**: `ENABLE_PROMPT_ENHANCEMENT` enables AI prompt improvement



## Architecture

Synth-Dev follows a modular architecture with clear separation of concerns:

### Core Components

```
synth-dev/
├── app.js                 # Main application entry point
├── configManager.js       # Configuration management
├── systemMessages.js      # AI role definitions and prompts
├── aiAPIClient.js         # AI API communication
├── toolManager.js         # Tool loading and execution
├── commandHandler.js      # Command processing
├── consoleInterface.js    # User interface and I/O
├── promptEnhancer.js      # AI prompt improvement
├── snapshotManager.js     # Conversation state management
├── costsManager.js        # API cost tracking
└── logger.js             # Centralized logging system
```

### Modular Systems

#### Commands System (`commands/`)
- **Base Classes**: `BaseCommand`, `InteractiveCommand`, `CommandRegistry`
- **Categories**: Conversation, Info, Role, System, Snapshots, Indexing
- **Auto-Discovery**: Commands are automatically registered and validated

#### Tools System (`tools/`)
- **Structure**: Each tool has `definition.json` + `implementation.js`
- **Auto-Loading**: Tools are discovered and loaded automatically
- **Role-Based Access**: Tools filtered based on current AI role
- **Common Utilities**: Shared functionality in `tools/common/`

#### Configuration System
- **Multi-Model Support**: Base, Smart, and Fast model configurations
- **Environment-Based**: All settings via `.env` file
- **CLI Override**: Command-line arguments override environment variables
- **Validation**: Comprehensive configuration validation and prompting

### Data Flow

1. **User Input** → Console Interface
2. **Command Detection** → Command Handler → Command Registry
3. **AI Processing** → API Client → Model Selection (based on role)
4. **Tool Execution** → Tool Manager → Individual Tools
5. **Response** → Console Interface → User

### Key Design Patterns

- **Dependency Injection**: Components receive dependencies via constructor
- **Observer Pattern**: Callbacks for AI processing events
- **Strategy Pattern**: Different AI roles with different behaviors
- **Factory Pattern**: Tool and command creation
- **Singleton Pattern**: Configuration and cost managers

## Contributing

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/synth-dev.git
   cd synth-dev
   npm install
   ```

2. **Set Up Development Environment**
   ```bash
   cp config.example.env .env
   # Edit .env with your API keys
   ```

3. **Run in Development Mode**
   ```bash
   npm run dev  # Auto-reload on changes
   ```

### Creating New Tools

Tools are automatically discovered from the `tools/` directory. Each tool needs:

#### 1. Tool Structure
```
tools/my_new_tool/
├── definition.json      # Tool schema and metadata
└── implementation.js    # Tool logic
```

#### 2. Definition File (`definition.json`)
```json
{
  "name": "my_new_tool",
  "description": "Brief description",
  "auto_run": false,
  "requires_backup": false,
  "schema": {
    "type": "function",
    "function": {
      "name": "my_new_tool",
      "description": "Detailed description for AI",
      "parameters": {
        "type": "object",
        "properties": {
          "input": {
            "type": "string",
            "description": "Parameter description"
          }
        },
        "required": ["input"]
      }
    }
  }
}
```

#### 3. Implementation File (`implementation.js`)
```javascript
export default async function myNewTool(params) {
    const { input } = params;

    // Validate input
    if (!input) {
        return {
            error: 'Input is required',
            success: false,
            timestamp: new Date().toISOString()
        };
    }

    try {
        // Tool logic here
        const result = processInput(input);

        return {
            success: true,
            timestamp: new Date().toISOString(),
            result: result
        };
    } catch (error) {
        return {
            error: error.message,
            success: false,
            timestamp: new Date().toISOString()
        };
    }
}
```

### Creating New Commands

Commands are located in the `commands/` directory and automatically registered:

#### 1. Simple Command
```javascript
import { BaseCommand } from '../base/BaseCommand.js';

export class MyCommand extends BaseCommand {
    constructor() {
        super('mycommand', 'Description of command');
    }

    getRequiredDependencies() {
        return ['apiClient']; // Required context dependencies
    }

    async implementation(args, context) {
        const { apiClient } = context;
        // Command logic here
        console.log('Command executed!');
        return true;
    }
}
```

#### 2. Interactive Command
```javascript
import { InteractiveCommand } from '../base/BaseCommand.js';

export class MyInteractiveCommand extends InteractiveCommand {
    constructor() {
        super('interactive', 'Interactive command');
    }

    async implementation(args, context) {
        const input = await this.promptForInput('Enter value: ', context);
        const confirmed = await this.promptForConfirmation('Proceed?', context);

        if (confirmed) {
            console.log(`Processing: ${input}`);
        }

        return true;
    }
}
```

### Adding New AI Roles

Roles are defined in `systemMessages.js`:

```javascript
newRole: {
    level: 'base',  // 'base', 'smart', or 'fast'
    systemMessage: `Your role description and instructions...`,
    excludedTools: ['tool1', 'tool2'],  // Tools this role cannot use
    reminder: `Additional behavior reminders...`
}
```

### Code Style Guidelines

- **ES Modules**: Use `import/export` syntax
- **Async/Await**: Prefer over Promises and callbacks
- **Error Handling**: Always handle errors gracefully
- **Documentation**: Include JSDoc comments for functions
- **Validation**: Validate all inputs thoroughly
- **Consistent Naming**: Use camelCase for variables, PascalCase for classes

### Testing

1. **Manual Testing**: Use the application with your changes
2. **Tool Testing**: Test tools with various inputs and edge cases
3. **Command Testing**: Verify commands work in different contexts
4. **Role Testing**: Test AI roles with different scenarios

### Pull Request Guidelines

1. **Clear Description**: Explain what your changes do and why
2. **Test Coverage**: Describe how you tested your changes
3. **Documentation**: Update relevant documentation
4. **Breaking Changes**: Clearly mark any breaking changes
5. **Small Commits**: Keep commits focused and atomic

### Getting Help

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Check existing docs in the `docs/` directory
- **Examples**: Look at existing tools and commands for patterns




* - not really, figure of speech