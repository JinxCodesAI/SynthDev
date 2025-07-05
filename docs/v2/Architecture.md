# SynthDev Architecture

This document provides a comprehensive overview of SynthDev's architecture, including core components, data flow, and system design patterns.

## System Overview

SynthDev is built as a modular Node.js application with a clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Console Interface                        │
├─────────────────────────────────────────────────────────────┤
│                    Command System                           │
├─────────────────────────────────────────────────────────────┤
│  AI API Client  │  Tool Manager  │  Workflow System        │
├─────────────────────────────────────────────────────────────┤
│           Configuration & State Management                  │
├─────────────────────────────────────────────────────────────┤
│              Core Services & Utilities                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Application Entry Point (`src/core/app.js`)

The main application class `AICoderConsole` orchestrates all components:

- **Initialization**: Sets up configuration, managers, and services
- **Startup Flow**: Handles configuration wizard if needed
- **Event Coordination**: Manages interactions between components
- **Lifecycle Management**: Handles startup, runtime, and shutdown

**Key Responsibilities:**

- Configuration validation and loading
- Component initialization and dependency injection
- Event handling setup
- Error handling and recovery

### 2. Configuration System (`src/config/`)

A hierarchical configuration system with multiple layers:

```
Configuration Hierarchy (lowest to highest priority):
1. Built-in defaults
2. Configuration files (src/config/)
3. Environment variables (.env)
4. Command line arguments
```

**Configuration Managers:**

- `ConfigManager`: Main configuration orchestrator
- `ConfigurationLoader`: File loading and caching
- `UIConfigManager`: User interface text and messages
- `ToolConfigManager`: Tool-specific configurations

**Configuration Files:**

- `defaults/application.json`: Core application settings
- `roles/`: AI role definitions (supports multiple files)
- `tools/`: Tool configurations and safety patterns
- `ui/`: Console interface messages
- `validation/`: Configuration validation rules
- `workflows/`: Workflow definitions

### 3. Command System (`src/commands/`)

A registry-based command system with automatic discovery:

```
CommandRegistry
├── BaseCommand (abstract)
├── Command Categories:
│   ├── config/         # Configuration commands
│   ├── conversation/   # Chat management
│   ├── indexing/       # Codebase indexing
│   ├── info/          # Information display
│   ├── role/          # Role management
│   ├── snapshots/     # Git integration
│   ├── system/        # System commands
│   ├── terminal/      # Terminal integration
│   ├── utils/         # Utility commands
│   └── workflow/      # Workflow execution
```

**Command Features:**

- Automatic registration and discovery
- Alias support
- Argument parsing
- Context injection
- Error handling

### 4. Tool System (`src/tools/`)

An extensible tool system with automatic loading:

```
ToolManager
├── Tool Discovery & Loading
├── Tool Categories:
│   ├── File Operations: read_file, write_file, edit_file, list_directory
│   ├── Search & Analysis: exact_search, explain_codebase
│   ├── Code Execution: execute_script, execute_terminal
│   └── Utilities: calculate, get_time
├── Safety & Validation
└── Result Standardization
```

**Tool Architecture:**

- Each tool is a separate directory with `definition.json` and `implementation.js`
- Automatic discovery and loading
- Role-based filtering
- Safety validation for dangerous operations
- Standardized result format

### 5. AI Integration (`src/core/ai/`)

Multi-model AI integration with role-based behavior:

```
AIAPIClient
├── Model Management (base/smart/fast)
├── Role System Integration
├── Message Management
├── Tool Call Handling
├── Cost Tracking
└── Response Processing
```

**Key Features:**

- Multiple model support (base, smart, fast)
- Role-specific system messages
- Tool filtering per role
- Conversation management
- Cost tracking and reporting

### 6. Workflow System (`src/workflow/`)

A sophisticated multi-agent workflow system:

```
WorkflowStateMachine
├── WorkflowConfig          # Configuration validation and loading
├── WorkflowContext         # Shared conversation contexts
├── WorkflowAgent          # Individual AI agent instances
└── Script Execution       # Custom JavaScript functions
```

**Workflow Components:**

#### WorkflowStateMachine

- Main orchestrator for workflow execution
- Manages agent lifecycle and state transitions
- Handles context synchronization
- Provides execution tracking and logging

#### WorkflowAgent

- Individual AI agent instances with role-specific configuration
- Manages API client and tool filtering
- Handles parsing tool responses
- Maintains agent-specific state

#### WorkflowContext

- Shared conversation context between agents
- Role-based message mapping (user/assistant)
- Message length management and truncation
- Context isolation between workflows

#### WorkflowConfig

- Configuration validation and loading
- Script function binding
- State machine definition
- Input/output mapping

## Data Flow

### 1. User Input Processing

```
User Input → Console Interface → Command Registry → Command Execution
                                ↓
                            AI API Client → Tool Manager → Tool Execution
                                ↓
                            Response Processing → Console Output
```

### 2. Workflow Execution

```
Workflow Request → WorkflowStateMachine → State Execution
                                        ↓
                    WorkflowAgent → AI API Call → Tool Execution
                                        ↓
                    Context Update → State Transition → Next State
```

### 3. Configuration Loading

```
Startup → ConfigManager → ConfigurationLoader → File Loading
                       ↓
                   Validation → Caching → Component Initialization
```

## State Management

### 1. Application State

- Configuration settings
- Current AI role
- Conversation history
- Tool execution state
- Cost tracking

### 2. Workflow State

- Current workflow execution
- Agent states
- Shared contexts
- Execution history

### 3. Session State

- User preferences
- Command history
- Snapshot management
- Git integration state

## Security Considerations

### 1. Tool Safety

- Safety pattern validation for code execution
- AI-based safety assessment
- Execution limits and timeouts
- Sandboxing for dangerous operations

### 2. Configuration Security

- Environment variable validation
- API key protection
- File system access controls
- Input sanitization

### 3. Workflow Security

- Script execution sandboxing
- Context isolation
- Resource limits
- Error handling

## Extension Points

### 1. Adding New Tools

1. Create tool directory in `src/tools/`
2. Implement `definition.json` and `implementation.js`
3. Follow tool interface contract
4. Add safety patterns if needed

### 2. Adding New Commands

1. Create command class extending `BaseCommand`
2. Implement required methods
3. Place in appropriate category directory
4. Commands are auto-discovered

### 3. Adding New Roles

1. Add role definition to `src/config/roles/`
2. Define system message and tool filtering
3. Optionally add few-shot examples
4. Roles are auto-loaded

### 4. Adding New Workflows

1. Create workflow configuration JSON
2. Implement custom script functions if needed
3. Define states, agents, and transitions
4. Place in `src/config/workflows/`

## Performance Considerations

### 1. Configuration Caching

- Configuration files are cached after first load
- Hot reload available for development
- Validation caching for performance

### 2. Tool Loading

- Lazy loading of tool implementations
- Caching of tool definitions
- Parallel tool discovery

### 3. AI API Optimization

- Request batching where possible
- Response caching for repeated queries
- Cost-aware model selection

### 4. Memory Management

- Conversation history limits
- Context truncation strategies
- Garbage collection optimization

## Error Handling

### 1. Graceful Degradation

- Fallback behaviors for missing components
- Partial functionality when tools fail
- User-friendly error messages

### 2. Recovery Mechanisms

- Automatic retry for transient failures
- State recovery after errors
- Snapshot-based rollback

### 3. Logging and Debugging

- Structured logging with verbosity levels
- Debug information for development
- Error tracking and reporting

## Testing Architecture

### 1. Unit Tests

- Component isolation with mocking
- Comprehensive coverage of core logic
- Fast execution for development feedback

### 2. Integration Tests

- Component interaction testing
- Configuration system validation
- End-to-end command execution

### 3. E2E Tests

- Full application workflow testing
- Real API interaction simulation
- User scenario validation

---

_For specific implementation details, see the ADRs in the ADRs/ directory._
