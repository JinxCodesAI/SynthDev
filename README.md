# SynthDev - AI Coding Assistant

Deeply inspired by [Aider](https://github.com/Aider-AI/aider), [Cline](https://github.com/cline/cline), [Roo-Code](https://github.com/RooCodeInc/Roo-Code), [Augument Code](https://www.augmentcode.com/) and [Cursor](https://www.cursor.com/).

Shamelessly vibe-coded with use of Cursor and Augument Code, blissfully in JavaScript, like [Dylan's Beattie's song](https://www.youtube.com/watch?v=jxi0ETwDvws&t=250s) never existed.

Code tested with GPT-4.1-mini and GPT-4.1-nano (fast) and alternatively with Gemini Flash 2.5 with sensible results.

SynthDev is Node.js console-based AI coding assistant designed to explore agentic capabilities of less powerful AI models. It provides comprehensive development tools, multi-model support, and conversation management capabilities.

## What is SynthDev?

SynthDev is an AI-powered development assistant that provides:

- **🛠️ Comprehensive Tool System**: File operations, code execution, terminal access, and analysis tools
- **⚡ Command Interface**: Powerful `/` commands for managing conversations, costs, and application state
- **🤖 Multi-Model Support**: Configure different AI models for different tasks (base, smart, fast)
- **🎭 AI Role System**: Specialized AI personas with role-specific behaviors and few-shot prompting
- **🔧 Extensible Architecture**: Easy to add new tools and commands
- **📊 Advanced Features**: Automatic & manual snapshots, codebase indexing, prompt enhancement, and cost tracking

## Quick Start

### System Requirements

- **Node.js**: Version 20.10.0 or higher (ES Modules support required)
- **Operating System**: Tested on Windows, WSL and Linux docker container
- **AI API**: Tested on less powerful models like google-Flash-2.5 and gpt-4.1-mini/nano

### Installation Options

#### Repository Setup

First, clone the repository from the stable branch:

```bash
# Clone the repository (stable branch recommended)
git clone --branch stable https://github.com/JinxCodesAI/SynthDev.git
cd SynthDev
```

#### Option 1: Native Installation

```bash
# Install dependencies
npm install

# Configure environment
cp config.example.env .env
# Edit .env with your API keys

# Start the application
npm start
```

#### Option 2: Docker Installation (Recommended)

```bash
# Initial setup
./docker-run.sh setup  # Linux/macOS
./docker-run.bat setup # Windows

# Configure .env file with your API keys

# Run from SynthDev directory
./docker-run.sh run

# Run from any project directory
./docker-run.sh run --path "/path/to/your/project"
```

#### Option 3: Global Installation

```bash
# Install globally from the cloned repository
npm install -g .

# Use from any directory
synth-dev
```

### Basic Configuration

Edit your `.env` file with the required settings:

```env
# Base Model Configuration (Required)
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1

# Smart Model (for Architect role)
SYNTHDEV_SMART_API_KEY=your_smart_api_key
SYNTHDEV_SMART_MODEL=gpt-4.1-mini
SYNTHDEV_SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (for quick tasks)
SYNTHDEV_FAST_API_KEY=your_fast_api_key
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
SYNTHDEV_FAST_BASE_URL=https://api.openai.com/v1

# Application Settings
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
SYNTHDEV_VERBOSITY_LEVEL=2
```

### Interactive Configuration

SynthDev includes a comprehensive configuration wizard for easy setup:

#### Automatic Configuration Wizard

If no `.env` file exists, the wizard starts automatically when you run the application:

```bash
# For native or Docker installation
npm start
# Wizard starts automatically if no .env file exists

# For global installation
synth-dev
# Wizard starts automatically if no .env file exists
```

#### Manual Configuration Wizard

You can also start the configuration wizard manually at any time:

```bash
# From within the application
/configure

# Or start the application and use the configure command
npm start
# Then type: /configure
```

#### Configuration Wizard Features

The wizard provides:

- **Provider Selection**: Choose from XAI, OpenAI, Google, OpenRouter, Anthropic, or custom providers
- **Multi-Model Setup**: Configure base, smart, and fast model tiers
- **API Key Management**: Secure input for API credentials
- **Settings Configuration**: Verbosity levels, tool limits, prompt enhancement
- **Real-time Validation**: Immediate feedback on configuration errors
- **Configuration Copy**: Copy base settings to smart/fast models for convenience

## Core Features

### Command System

Access powerful commands via `/` prefix:

| Command          | Description                         |
| ---------------- | ----------------------------------- |
| `/help`          | Show available commands and usage   |
| `/tools`         | List all available tools            |
| `/cost`          | Display API usage costs             |
| `/review`        | Show last API call details          |
| `/clear`         | Clear conversation history          |
| `/snapshot`      | Manage automatic & manual snapshots |
| `/index`         | Index codebase for analysis         |
| `/roles`         | Show available AI roles             |
| `/role <name>`   | Switch to a specific role           |
| `/cmd`           | Execute terminal commands with AI   |
| `/workflows`     | Manage and execute workflows        |
| `/configure`     | Interactive configuration wizard    |
| `/exit`, `/quit` | Exit the application                |

### AI Role System

SynthDev features specialized AI personas with different model tiers and tool access:

#### Development Roles

- **coder** (base): Software development with full tool access except time/calculation utilities
- **reviewer** (base): Code review with read-only access (no file modification)
- **architect** (smart): System design using advanced model, read-only access for analysis
- **test_writer** (base): Specialized test writing, most tools except terminal execution
- **qa_specialist** (base): Quality assurance with read-only tools for code analysis

#### Analysis Roles (Parsing-Only)

- **codebase_explainer** (fast): Explains codebase using indexed summaries, parsing tools only
- **file_summarizer** (fast): Analyzes individual files, highly restricted tool access
- **directory_summarizer** (fast): Analyzes directory structures, limited to analysis tools

#### Utility Roles

- **prompt_enhancer** (fast): Improves prompts with few-shot examples, analysis tools only
- **command_generator** (fast): Converts natural language to terminal commands, no tools
- **file_reader** (fast): Limited to read_files, list_directory, exact_search only
- **dude** (fast): General-purpose assistant with all tools available

#### Role Features

- **Model Tiers**: base (default), smart (complex reasoning), fast (quick tasks)
- **Tool Filtering**: Role-based access control with wildcards and regex patterns
- **Parsing Tools**: Structured output tools for decision-making workflows
- **Few-Shot Learning**: Examples guide AI behavior for consistent responses

Switch roles with: `/role <role_name>`

### Tool System

Comprehensive tool categories with security and validation:

#### File Operations

- **read_files**: Read file contents with encoding support and size limits
- **write_file**: Create/overwrite files with validation
- **edit_file**: Modify files with line-based editing and safety checks
- **list_directory**: Directory listing with filtering and depth control

#### Search & Analysis

- **exact_search**: Fast text search with regex support and context
- **explain_codebase**: AI-powered codebase analysis using indexed summaries

#### Code Execution

- **execute_terminal**: System command execution with safety patterns
- **execute_script**: JavaScript execution in sandboxed environment with AI safety assessment

#### Utilities

- **get_time**: Current time and date information
- **calculate**: Mathematical calculations and expressions

#### Security Features

- **Path Validation**: All file operations restricted to project directory
- **AI Safety Assessment**: Dynamic code analysis for script execution
- **Tool Filtering**: Role-based access control with pattern matching
- **Snapshot System**: Differential snapshots with checksum-based deduplication before file-modifying operations

### Codebase Intelligence

Index your codebase for AI-powered understanding:

```bash
/index                    # Index with default settings
/index --max-size 50000   # Set maximum file size
/index --include-hidden   # Include hidden files
```

### Snapshot System

SynthDev features an advanced differential snapshot system for project state management:

```bash
# Manual snapshots
/snapshot create "Before refactoring"  # Create manual snapshot
/snapshot list                         # List all snapshots
/snapshot restore <snapshot-id>        # Restore to previous state
/snapshot info <snapshot-id>           # Show snapshot details
/snapshot stats                        # Show system statistics
/snapshot auto                         # Show automatic snapshot status

# Automatic snapshots (Phase 2)
# - Created automatically before file-modifying tools
# - Initial snapshots on application startup
# - Smart tool classification (file-modifying vs read-only)
# - Configurable limits and cooldown periods
```

**Key Features:**

- **Differential Snapshots**: Only stores changes between snapshots for efficiency
- **Checksum-based Deduplication**: Files with identical content are linked, not duplicated
- **Smart Restoration**: Only overwrites files that have actually changed
- **Safe Deletion**: When deleting snapshots, references are updated to maintain integrity

## Development Setup

### Prerequisites

1. Node.js 20.10.0 or higher
2. Git (for snapshot management)
3. AI API key (OpenAI, Google, etc.)

### Development Installation

```bash
# Clone and install
git clone https://github.com/your-repo-url.git
cd synth-dev
npm install

# Set up environment
cp config.example.env .env
# Edit .env with your API keys

# Run in development mode
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Project Structure

```
src/
├── core/                    # Core application logic
│   ├── app.js              # Main application orchestrator
│   ├── ai/                 # AI-related components
│   │   ├── aiAPIClient.js  # Centralized API client with cost tracking
│   │   ├── systemMessages.js # AI role management
│   │   └── promptEnhancer.js # Prompt enhancement
│   ├── interface/          # User interface components
│   │   ├── consoleInterface.js # Console interaction
│   │   └── commandHandler.js   # Command routing
│   ├── managers/           # Core managers
│   │   ├── costsManager.js     # API cost tracking
│   │   ├── toolManager.js      # Tool loading and execution
│   │   └── logger.js           # Centralized logging
│   └── snapshot/           # Snapshot system (Phase 2)
│       ├── AutoSnapshotManager.js      # Main automatic snapshot coordinator
│       ├── SnapshotManager.js          # Core snapshot management
│       ├── ToolMonitor.js              # Tool classification system
│       ├── FileChangeDetector.js       # File system monitoring
│       ├── SnapshotTrigger.js          # Automatic snapshot triggering
│       ├── InitialSnapshotManager.js   # Startup snapshots
│       ├── ToolManagerIntegration.js   # Non-intrusive tool hooks
│       ├── FileFilter.js               # File filtering and exclusions
│       ├── FileBackup.js               # File backup operations
│       └── stores/                     # Storage implementations
│           └── MemorySnapshotStore.js  # Memory-based storage
├── config/                 # Configuration system
│   ├── managers/           # Configuration managers
│   │   ├── configManager.js    # Main configuration
│   │   ├── toolConfigManager.js # Tool configuration
│   │   ├── uiConfigManager.js   # UI configuration
│   │   └── snapshotConfigManager.js # Snapshot configuration
│   ├── validation/         # Configuration validation
│   ├── defaults/           # Default configurations
│   ├── roles/              # AI role definitions (multi-file support)
│   ├── tools/              # Tool configurations
│   ├── ui/                 # UI configurations
│   ├── snapshots/          # Snapshot system configuration
├── commands/               # Command system
│   ├── base/               # Base command classes
│   ├── config/             # Configuration commands
│   ├── conversation/       # Conversation management
│   ├── info/               # Information commands
│   ├── role/               # Role switching
│   ├── snapshots/          # Snapshot management
│   ├── system/             # System commands
│   ├── terminal/           # Terminal commands
│   ├── utils/              # Command utilities
├── tools/                  # Tool implementations
│   ├── common/             # Base tool classes and utilities
│   ├── calculate/          # Mathematical calculations
│   ├── edit_file/          # File editing with line-based operations
│   ├── exact_search/       # Text search with regex support
│   ├── execute_script/     # JavaScript execution with AI safety
│   ├── execute_terminal/   # System command execution
│   ├── explain_codebase/   # AI-powered codebase analysis
│   ├── get_time/           # Time and date utilities
│   ├── list_directory/     # Directory listing
│   ├── read_files/         # File reading with encoding support
│   └── write_file/         # File writing with validation
└── utils/                  # Utility functions
    └── GitUtils.js         # Git integration utilities

tests/                      # Comprehensive test suite
├── unit/                   # Unit tests for individual components
├── integration/            # Integration tests for component interactions
├── e2e/                    # End-to-end workflow tests
├── mocks/                  # Mock implementations for testing
└── helpers/                # Test utilities and helpers
```

## 📚 Documentation

This documentation is organized into comprehensive guides:

### Core Guides

- **[Installation Guide](docs/Installation.md)**: Complete setup instructions and requirements
- **[Configuration Guide](docs/Configuration.md)**: Environment variables, AI roles, and system configuration
- **[Architecture Overview](docs/Architecture.md)**: System design, components, and data flow

### Feature Guides

- **[Tools Reference](docs/Tools.md)**: Complete tool documentation with examples and security features
- **[Testing Guide](docs/Testing.md)**: Testing strategies, best practices, and coverage goals

### Development Resources

- **[ADRs/](docs/ADRs/)**: Architecture Decision Records for development patterns

## Getting Help

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Check the guides in this documentation folder
- **Examples**: Look at existing tools and commands for patterns

## Contributing

1. **Fork and Clone** the repository
2. **Set Up Development Environment** with your API keys
3. **Run in Development Mode**: `npm run dev`
4. **Follow Guidelines**: See ADRs for development patterns
5. **Submit Pull Requests**: Clear description and test coverage

## License

MIT

---

_For detailed information on any topic, see the specific guide files in this documentation folder._

Test change for differential snapshot - COMPLETELY FIXED!
