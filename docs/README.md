# SynthDev Documentation v2

**SynthDev** is a powerful Node.js console-based AI coding assistant with an extensible tool system and command interface. It provides comprehensive development tools, multi-model support, and sophisticated conversation management capabilities. Its main intention is to **explore agentic capabilities** of **less powerful AI models**.

## What is SynthDev?

SynthDev is an AI-powered development assistant that provides:

- **🛠️ Comprehensive Tool System**: File operations, code execution, terminal access, and analysis tools
- **⚡ Command Interface**: Powerful `/` commands for managing conversations, costs, and application state
- **🤖 Multi-Model Support**: Configure different AI models for different tasks (base, smart, fast)
- **🎭 AI Role System**: Specialized AI personas with role-specific behaviors and few-shot prompting
- **🔧 Extensible Architecture**: Easy to add new tools and commands
- **📊 Advanced Features**: Conversation snapshots, codebase indexing, prompt enhancement, and cost tracking

## Quick Start

### System Requirements

- **Node.js**: Version 20.10.0 or higher (ES Modules support required)
- **Operating System**: Tested on Windows, WSL and Linux docker container
- **AI API**: Tested on less powerful models like google-Flash-2.5 and gpt-4.1-mini/nano

### Installation Options

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
# Install globally
npm install -g .

# Use from any directory
synth-dev
```

### Basic Configuration

Edit your `.env` file:

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

## Core Features

### Command System

Access powerful commands via `/` prefix:

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `/help`          | Show available commands and usage |
| `/tools`         | List all available tools          |
| `/cost`          | Display API usage costs           |
| `/review`        | Show last API call details        |
| `/clear`         | Clear conversation history        |
| `/snapshots`     | Manage conversation snapshots     |
| `/index`         | Index codebase for analysis       |
| `/roles`         | Show available AI roles           |
| `/role <name>`   | Switch to a specific role         |
| `/cmd`           | Execute terminal commands with AI |
| `/workflows`     | Manage and execute workflows      |
| `/exit`, `/quit` | Exit the application              |

### AI Role System

SynthDev features specialized AI personas for different tasks:

#### **Development Roles**

- **coder**: Software development and implementation
- **reviewer**: Code review and quality assurance
- **architect**: System design and architecture planning
- **test_writer**: Specialized test writing assistant
- **qa_specialist**: Quality assurance and bug detection

#### **Analysis Roles**

- **codebase_explainer**: Explaining codebase functionality
- **file_summarizer**: Analyzing and summarizing individual files
- **directory_summarizer**: Analyzing directory structures
- **research_assistant**: Information gathering and analysis

#### **Utility Roles**

- **prompt_enhancer**: Improving user prompts with AI assistance
- **command_generator**: Converting natural language to terminal commands
- **file_reader**: File reading and analysis only
- **dude**: Helpful assistant for wide range of tasks

Switch roles with: `/role <role_name>`

### Multi-Agent Workflows

SynthDev supports complex multi-agent workflows where different AI personas collaborate:

- **🔄 State Machine Execution**: Structured workflow with defined states and transitions
- **💬 Shared Context**: Agents share conversation context with role-based message mapping
- **📝 Custom Scripts**: JavaScript functions for complex workflow logic
- **🎯 Parsing Tools**: Structured output handling for decision-making

Execute workflows with: `/workflow <workflow_name>`

### Tool System

Comprehensive tool categories:

- **File Operations**: read_file, write_file, edit_file, list_directory
- **Search & Analysis**: exact_search, explain_codebase
- **Code Execution**: execute_script, execute_terminal
- **Utilities**: calculate, get_time

### Codebase Intelligence

Index your codebase for AI-powered understanding:

```bash
/index                    # Index with default settings
/index --max-size 50000   # Set maximum file size
/index --include-hidden   # Include hidden files
```

Ask questions about your codebase:

- "What tools are available in this codebase?"
- "How is file editing handled?"
- "Explain the architecture of the command system"

## Documentation Structure

This documentation is organized into focused guides:

- **[Installation & Setup](installation.md)** - Detailed installation instructions for all platforms
- **[Configuration Guide](configuration.md)** - Complete configuration reference
- **[AI Roles & Few-Shot Prompting](roles-and-prompting.md)** - Role system and examples
- **[Workflow System Guide](workflows.md)** - Multi-agent workflows and state machines
- **[Tool Development](tool-development.md)** - Creating custom tools and commands
- **[Testing Guide](testing.md)** - Comprehensive testing documentation
- **[Architecture Overview](architecture.md)** - System design and components

## Getting Help

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Check the guides in this v2 documentation folder
- **Examples**: Look at existing tools and commands for patterns

## Contributing

1. **Fork and Clone** the repository
2. **Set Up Development Environment** with your API keys
3. **Run in Development Mode**: `npm run dev`
4. **Follow Guidelines**: See tool-development.md for creating new tools
5. **Submit Pull Requests**: Clear description and test coverage

---

_For detailed information on any topic, see the specific guide files in this documentation folder._
