# SynthDev Architecture

This document provides a comprehensive overview of SynthDev's architecture, based on analysis of the actual codebase structure and implementation patterns.

## System Overview

SynthDev is a sophisticated AI-powered development assistant built with a modular, extensible architecture. The system orchestrates multiple AI agents, manages tool execution, and provides a rich command interface for development workflows.

### Core Principles

- **Modular Design**: Clear separation of concerns with well-defined interfaces
- **Security First**: Path validation, AI safety assessment, and role-based access control
- **Extensibility**: Plugin-like architecture for tools, commands, and workflows
- **Multi-Model Support**: Different AI models for different complexity levels
- **Comprehensive Testing**: Unit, integration, and end-to-end test coverage

## Architecture Layers

### 1. Application Layer (`src/core/app.js`)

The main application orchestrator that:

- Initializes all system components
- Manages application lifecycle
- Handles command-line argument parsing
- Coordinates between different subsystems

### 2. Interface Layer (`src/core/interface/`)

#### ConsoleInterface (`consoleInterface.js`)

- User interaction management
- Input/output handling
- Prompt formatting and display
- Configuration-driven UI messages

#### CommandHandler (`commandHandler.js`)

- Command parsing and routing
- Command registry management
- Context preparation for command execution
- Error handling and response formatting

### 3. AI Layer (`src/core/ai/`)

#### AIAPIClient (`aiAPIClient.js`)

- Centralized API communication
- Cost tracking and token management
- Multi-model support (base/smart/fast)
- Response handling and error management
- Callback system for response processing

#### SystemMessages (`systemMessages.js`)

- AI role management and loading
- Multi-file role configuration support
- Tool filtering and access control
- Few-shot prompting with examples

#### PromptEnhancer (`promptEnhancer.js`)

- AI-powered prompt improvement
- Context-aware enhancement suggestions
- Integration with role system

### 4. Management Layer (`src/core/managers/`)

#### ToolManager (`toolManager.js`)

- Dynamic tool discovery and loading
- Tool execution with validation
- Security enforcement
- Tool schema validation

#### ConfigManager (`configManager.js`)

- Centralized configuration management
- Environment variable processing
- Multi-model configuration
- Validation and error handling

#### CostsManager (`costsManager.js`)

- API usage tracking
- Token counting and cost calculation
- Usage reporting and analytics

#### SnapshotManager (`snapshotManager.js`)

- Conversation state management
- Git integration for versioning
- Backup and restore functionality

#### Logger (`logger.js`)

- Centralized logging system
- Configurable verbosity levels
- Structured logging with metadata

## Component Architecture

### Command System (`src/commands/`)

#### Base Classes (`src/commands/base/`)

**BaseCommand** - Abstract base class providing:

- Standardized execution flow
- Context validation
- Error handling
- Help text generation

**SimpleCommand** - For synchronous operations
**InteractiveCommand** - For user interaction requiring prompts

#### Command Categories

- **Config Commands**: Configuration management and wizards
- **Conversation Commands**: Chat history and context management
- **Info Commands**: System information and help
- **Role Commands**: AI persona switching
- **Snapshot Commands**: State management
- **System Commands**: Application control
- **Terminal Commands**: Command execution and generation
- **Workflow Commands**: Multi-agent workflow execution

### Tool System (`src/tools/`)

#### Base Classes (`src/tools/common/`)

**BaseTool** - Foundation class providing:

- Standardized response format
- Parameter validation
- Path security validation
- Error handling

**FileBaseTool** - Specialized for file operations:

- File size validation
- File system error handling
- Path traversal protection

**CommandBaseTool** - Specialized for command execution:

- Command validation
- Execution response formatting
- Security constraints

#### Tool Categories

- **File Operations**: read_file, write_file, edit_file, list_directory
- **Search & Analysis**: exact_search, explain_codebase
- **Code Execution**: execute_script, execute_terminal
- **Utilities**: calculate, get_time

#### Security Features

- **Path Validation**: All file operations restricted to project directory
- **AI Safety Assessment**: Dynamic code analysis for script execution
- **Tool Filtering**: Role-based access control with pattern matching
- **Backup System**: Automatic backups for destructive operations

### Configuration System (`src/config/`)

#### Multi-Layered Configuration

1. **Built-in defaults** (lowest priority)
2. **Configuration files** (`config/` directory)
3. **Environment variables** (`.env` file)
4. **Command line arguments** (highest priority)

#### Configuration Managers

**ConfigManager** - Main configuration orchestrator
**ToolConfigManager** - Tool-specific configuration
**UIConfigManager** - User interface configuration

#### Multi-File Support

- **Role Definitions**: Organized across multiple JSON files
- **Workflow Configurations**: Separate files with script directories
- **Tool Configurations**: Individual tool settings
- **UI Customization**: Configurable interface messages

### Workflow System (`src/workflow/`)

#### Core Components

**WorkflowStateMachine** - Main orchestrator:

- Agent lifecycle management
- State transitions
- Context synchronization
- Execution tracking

**WorkflowAgent** - Individual AI agents:

- Role-specific configuration
- API client management
- Tool filtering
- Parsing tool responses

**WorkflowContext** - Shared conversation context:

- Role-based message mapping
- Message length management
- Context isolation

**WorkflowConfig** - Configuration validation:

- Script module management
- State validation
- Agent setup

#### Features

- **Multi-Agent Orchestration**: Multiple AI agents with different roles
- **State Machine Execution**: Structured workflow with defined states
- **Shared Context Management**: Role-based message mapping
- **Custom Script Integration**: JavaScript functions for workflow logic
- **Parsing Tools**: Structured output for decision-making
- **Execution Tracking**: Detailed logging and state history

## Data Flow

### 1. User Input Processing

```
User Input → ConsoleInterface → CommandHandler → Command Implementation
```

### 2. AI Interaction Flow

```
Command → AIAPIClient → External API → Response Processing → Tool Execution
```

### 3. Tool Execution Flow

```
Tool Request → ToolManager → Tool Validation → Tool Implementation → Response
```

### 4. Workflow Execution Flow

```
Workflow Request → WorkflowStateMachine → Agent Execution → State Transition → Result
```

## Security Architecture

### Path Security

- All file operations use `validateAndResolvePath()`
- Prevents directory traversal attacks
- Restricts access to project directory only

### AI Safety Assessment

- Dynamic code analysis for script execution
- Pattern-based safety checks as fallback
- Configurable safety patterns and limits

### Role-Based Access Control

- Tool filtering based on AI roles
- Wildcard and regex pattern support
- Parsing-only tools for structured output

### Input Validation

- Parameter type checking
- Required field validation
- Size and format constraints

## Testing Architecture

### Test Structure

```
tests/
├── unit/           # Individual component tests
├── integration/    # Component interaction tests
├── e2e/           # End-to-end workflow tests
├── mocks/         # Mock implementations
└── helpers/       # Test utilities
```

### Testing Strategies

- **Unit Tests**: Component isolation with comprehensive mocking
- **Integration Tests**: Real component interactions
- **E2E Tests**: Complete workflow validation with HTTP mocking
- **Mock System**: Sophisticated mocking for external dependencies

### Coverage Goals

- Overall: 40%+ lines, branches, functions
- Core modules: Higher coverage expected
- Continuous validation through CI/CD

## Performance Considerations

### Token Management

- Cost tracking across all API calls
- Model selection based on task complexity
- Token usage optimization

### Caching

- Configuration caching
- Tool schema caching
- Conversation context management

### Resource Management

- File size limits
- Execution timeouts
- Memory usage monitoring

## Extensibility Points

### Adding New Tools

1. Create tool directory with `definition.json` and `implementation.js`
2. Use base tool classes for standardization
3. Implement security validation
4. Add comprehensive tests

### Adding New Commands

1. Extend BaseCommand or specialized base classes
2. Implement required methods
3. Register in command system
4. Add help documentation

### Adding New Workflows

1. Create workflow configuration JSON
2. Implement custom script functions
3. Define agents and contexts
4. Test with mock HTTP responses

### Adding New Roles

1. Define role in configuration files
2. Specify tool access patterns
3. Add few-shot examples if needed
4. Test role behavior

This architecture enables SynthDev to be both powerful and maintainable, with clear separation of concerns and extensive customization capabilities.
