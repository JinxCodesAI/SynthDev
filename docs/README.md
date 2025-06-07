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

### Option 1: Native Installation

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Configure Environment

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

#### 3. Start the Application

```bash
npm start
```

Or run in development mode with auto-reload:
```bash
npm run dev
```

### Option 2: Docker Installation

Docker provides an isolated environment and is the recommended way to run Synth-Dev, especially when working with different projects.

#### Prerequisites
- Docker Desktop installed and running
- Git (to clone the repository)

#### 1. Setup

```bash
# Clone the repository
git clone https://github.com/JinxCodesAI/SynthDev.git
cd SynthDev

# Initial setup (creates .env file and builds Docker image)
# Windows:
./docker-run.bat setup
# Linux/macOS:
./docker-run.sh setup
```

#### 2. Configure Environment

Edit the `.env` file with your API keys (same format as native installation above).

#### 3. Run Synth-Dev

**From Synth-Dev source directory:**
```bash
# Windows:
./docker-run.bat run
# Linux/macOS:
./docker-run.sh run
```

**From any project directory:**
```bash
# Windows:
./docker-run.bat run --path "C:\path\to\your\project"
# Linux/macOS:
./docker-run.sh run --path "/path/to/your/project"
```

#### Docker Commands

| Command | Description |
|---------|-------------|
| `./docker-run.{bat\|sh} setup` | Initial setup and build |
| `./docker-run.{bat\|sh} run` | Run interactively (recommended) |
| `./docker-run.{bat\|sh} run --path "path"` | Run from custom directory |
| `./docker-run.{bat\|sh} start` | Start in production mode |
| `./docker-run.{bat\|sh} dev` | Start in development mode |
| `./docker-run.{bat\|sh} stop` | Stop the application |
| `./docker-run.{bat\|sh} logs` | View application logs |
| `./docker-run.{bat\|sh} shell` | Open shell in container |
| `./docker-run.{bat\|sh} clean` | Remove containers and volumes |
| `./docker-run.{bat\|sh} status` | Show container status |

> **Note**: Use `docker-run.bat` on Windows and `docker-run.sh` on Linux/macOS

#### How Docker Mode Works

When using `--path`, Synth-Dev:
1. **Installs globally** in the container via `npm install -g .`
2. **Mounts your directory** as the working directory
3. **Loads environment variables** from the `.env` file automatically
4. **Runs as CLI tool** from your project directory

This allows you to use Synth-Dev with any project while keeping it containerized and isolated.

### Option 3: Global Installation

For users who prefer to have the `synth-dev` command available system-wide, you can install it globally using npm.

#### 1. Install Globally

Navigate to the root directory of the Synth-Dev project and run the following command:

```bash
npm install -g .
```

This command installs the current project (indicated by `.`) as a global npm package.

#### 2. Using the Globally Installed Application

Once installed, the `synth-dev` command will be available in your system's PATH. You can then run the application from any directory in your terminal:

```bash
synth-dev
```

#### 3. Operating Context and Configuration

- **Working Directory**: The application will operate in the context of the directory from which it is launched. This means any file operations, codebase indexing, or other path-dependent actions will be relative to your current working directory.
- **Configuration File**: It is recommended to place your `.env` configuration file in the working directory where you intend to run `synth-dev`. The application will look for the `.env` file in the current directory to load API keys and other settings.

This method provides flexibility for developers who want to use Synth-Dev across multiple projects without navigating to the Synth-Dev source directory or using Docker.

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

## Tool System

Synth-Dev features a powerful, extensible tool system that provides AI with comprehensive capabilities for development tasks. The system is built on a modular architecture with standardized interfaces, automatic discovery, and role-based access control.

### Architecture Overview

The tool system follows a standardized structure:
- **Auto-Discovery**: Tools are automatically loaded from the `tools/` directory
- **Standardized Schema**: Each tool has a `definition.json` and `implementation.js`
- **Category Organization**: Tools are organized by functionality (file, search, utility, etc.)
- **Safety Features**: Built-in validation, sandboxing, and AI-powered safety assessment
- **Role-Based Access**: Different AI roles have access to different tool sets

### Tool Categories

#### File Operations (`category: "file"`)
Essential file system operations with safety validation and automatic backups:

- **read_file**: Safely read file contents with encoding detection and error handling
  - Supports Unicode filenames and cross-platform paths
  - Automatic encoding detection (UTF-8, ASCII, etc.)
  - Security validation to prevent directory traversal

- **write_file**: Create or overwrite files with automatic directory creation
  - Atomic write operations with backup creation
  - Automatic parent directory creation
  - Content validation and encoding handling

- **edit_file**: Safely edit files using boundary-based replacement
  - Non-destructive editing with automatic backups
  - Boundary string validation to prevent accidental overwrites
  - Supports complex multi-line replacements

- **list_directory**: Recursively list directory contents with rich metadata
  - Configurable depth control (1-10 levels)
  - Hidden file inclusion options
  - Smart exclusion lists (node_modules, .git, etc.)
  - File type categorization and size information

#### Search & Analysis (`category: "search"`)
Powerful search capabilities for code exploration and analysis:

- **exact_search**: Search for exact text patterns across the entire codebase
  - Multi-file search with context lines (4 before/after matches)
  - Respects exclusion lists to avoid searching irrelevant files
  - Returns structured results with filename and context fragments
  - Optimized for large codebases

#### Code Intelligence (`category: "utility"`)
AI-powered code understanding and explanation capabilities:

- **explain_codebase**: AI-powered codebase explanations using indexed summaries
  - Uses pre-generated AI summaries from the `/index` command
  - Provides contextual answers about codebase structure and functionality
  - Supports natural language queries about code architecture
  - Leverages the complete codebase index for comprehensive understanding

#### Execution & Scripting (`category: "command"`)
Safe code execution with comprehensive safety measures:

- **execute_script**: Run JavaScript code in sandboxed environment
  - AI-powered safety assessment before execution
  - Isolated process execution with timeout protection
  - Comprehensive output capture (stdout, stderr, execution time)
  - Safety confidence scoring and detailed reasoning

- **execute_terminal**: Execute terminal commands with output capture
  - Cross-platform command execution (Windows, Linux, macOS)
  - Real-time output streaming and error handling
  - Working directory and environment variable support
  - Timeout protection and process management

#### Utilities (`category: "calculation"`)
General-purpose computational and utility functions:

- **calculate**: Advanced mathematical calculator with expression parsing
  - Supports complex mathematical expressions
  - Function support (sin, cos, log, sqrt, etc.)
  - Variable assignment and reuse
  - Error handling for invalid expressions

- **get_time**: Comprehensive time/date operations and formatting
  - Multiple timezone support
  - Flexible date formatting options
  - Relative time calculations
  - ISO 8601 standard compliance

### Codebase Indexing & Intelligence System

One of Synth-Dev's most powerful features is its intelligent codebase indexing system, which enables AI-powered code understanding and explanation.

#### The `/index` Command

The `/index` command creates a comprehensive, AI-powered index of your entire codebase:

**What it does:**
1. **Scans** the entire project directory recursively
2. **Analyzes** each file and directory for changes using checksums
3. **Generates** AI-powered summaries for files and directories
4. **Creates** a structured index in `.index/codebase-index.json`
5. **Optimizes** by only processing changed files on subsequent runs

**Usage:**
```bash
/index                    # Index with default settings
/index --max-size 50000   # Set maximum file size (bytes)
/index --include-hidden   # Include hidden files and directories
```

**Smart Features:**
- **Incremental Updates**: Only processes files that have changed since last indexing
- **Size Limits**: Configurable maximum file size to avoid processing huge files
- **Exclusion Lists**: Automatically excludes common directories (node_modules, .git, build, etc.)
- **Cost Tracking**: Monitors API usage and provides detailed cost breakdowns
- **Progress Reporting**: Real-time progress updates during indexing

#### The `explain_codebase` Tool

This tool leverages the generated index to provide intelligent, contextual answers about your codebase:

**How it works:**
1. **Loads** the pre-generated codebase index (`.index/codebase-index.json`)
2. **Extracts** relevant AI summaries for files and directories
3. **Constructs** a comprehensive context prompt with all summaries
4. **Processes** your natural language question using AI
5. **Returns** detailed markdown explanations with contextual understanding

**Example queries:**
- "What tools are available in this codebase?"
- "How is file editing handled?"
- "Explain the architecture of the command system"
- "What are the main components and how do they interact?"
- "How does the AI safety assessment work?"

**Key advantages:**
- **Complete Context**: Uses summaries of the entire codebase, not just individual files
- **Natural Language**: Ask questions in plain English
- **Markdown Output**: Formatted, readable explanations
- **Cost Efficient**: Uses pre-generated summaries instead of processing files repeatedly
- **Always Current**: Index can be updated as code changes

#### Index Structure

The generated index contains:
```json
{
  "metadata": {
    "generated": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "total_files": 45,
    "total_directories": 12
  },
  "files": {
    "path/to/file.js": {
      "type": "file",
      "ai_summary": "AI-generated summary of file purpose and functionality",
      "checksum": "sha256-hash",
      "size": 1024,
      "last_modified": "2024-01-15T10:00:00.000Z"
    }
  },
  "statistics": {
    "processed": 45,
    "summarized": 40,
    "total_tokens_used": 15000,
    "total_summary_size": 25000
  }
}
```

#### Why This System is Powerful

1. **Comprehensive Understanding**: AI has access to summaries of your entire codebase, not just individual files
2. **Efficient Processing**: Pre-generated summaries avoid repeated API calls for the same content
3. **Incremental Updates**: Only changed files are reprocessed, making updates fast and cost-effective
4. **Natural Interaction**: Ask questions about your code in natural language
5. **Contextual Answers**: Responses consider the broader codebase structure and relationships
6. **Cost Optimization**: Smart caching and reuse of summaries minimizes API costs

This system transforms how you interact with and understand large codebases, making it easy to get comprehensive explanations and insights about your project's architecture and functionality.

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




\* - not really, just a figure of speech