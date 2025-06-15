# Architecture Overview

This document provides a comprehensive overview of SynthDev's architecture, design patterns, and system components.

## System Architecture

SynthDev follows a modular, event-driven architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  consoleInterface.js  │  commandHandler.js  │  app.js       │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  aiAPIClient.js  │  toolManager.js  │  systemMessages.js    │
├─────────────────────────────────────────────────────────────┤
│                   Configuration Layer                       │
├─────────────────────────────────────────────────────────────┤
│  configManager.js  │  configurationLoader.js  │  roles.json │
├─────────────────────────────────────────────────────────────┤
│                     Service Layer                           │
├─────────────────────────────────────────────────────────────┤
│  snapshotManager.js  │  costsManager.js  │  logger.js       │
├─────────────────────────────────────────────────────────────┤
│                    Extension Layer                          │
├─────────────────────────────────────────────────────────────┤
│     Tools System     │    Commands System    │   Workflows  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Application Entry Point

**app.js**

- Main application entry point
- CLI argument parsing
- Application initialization and startup
- Error handling and graceful shutdown

### User Interface Layer

**consoleInterface.js**

- User input/output management
- Prompt display and formatting
- Interactive confirmations
- Message display with verbosity control

**commandHandler.js**

- Command parsing and routing
- Command execution coordination
- Error handling for command failures

### AI Integration Layer

**aiAPIClient.js**

- OpenAI API communication
- Request/response handling
- Tool call processing
- Conversation management
- Cost tracking integration

**systemMessages.js**

- AI role management
- System prompt generation
- Few-shot example loading
- Role-based tool filtering

### Configuration Management

**configManager.js**

- Singleton configuration manager
- Environment variable loading
- Multi-model configuration
- Configuration validation

**configurationLoader.js**

- External configuration file loading
- JSON parsing and validation
- Configuration caching
- Deep merge functionality

### Tool System

**toolManager.js**

- Tool discovery and loading
- Tool execution coordination
- Parameter validation
- Response formatting

**Tool Structure:**

```
tools/
└── tool_name/
    ├── definition.json     # Tool schema and metadata
    └── implementation.js   # Tool execution logic
```

### Command System

**CommandRegistry.js**

- Command discovery and registration
- Command validation
- Dependency injection
- Error handling

**Command Structure:**

```
commands/
├── base/
│   └── BaseCommand.js     # Base command class
├── category/
│   └── SpecificCommand.js # Command implementation
```

### Service Layer

**snapshotManager.js**

- Conversation state management
- Snapshot creation and restoration
- State persistence

**costsManager.js**

- API usage tracking
- Cost calculation
- Usage reporting

**logger.js**

- Centralized logging system
- Verbosity level control
- Structured output formatting

## Design Patterns

### Singleton Pattern

Used for global state management:

```javascript
// ConfigManager - ensures single configuration instance
class ConfigManager {
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
}
```

### Factory Pattern

Used for tool and command creation:

```javascript
// ToolManager - creates tool instances
class ToolManager {
    async createTool(toolName, definition) {
        const implementation = await import(`./tools/${toolName}/implementation.js`);
        return new Tool(toolName, definition, implementation.default);
    }
}
```

### Strategy Pattern

Used for AI role behaviors:

```javascript
// Different AI roles with different behaviors
const roles = {
    coder: { level: 'base', tools: ['file_operations'] },
    architect: { level: 'smart', tools: ['analysis_only'] },
    reviewer: { level: 'base', tools: ['read_only'] },
};
```

### Observer Pattern

Used for event handling:

```javascript
// AIAPIClient - callbacks for processing events
class AIAPIClient {
    constructor(callbacks = {}) {
        this.onThinking = callbacks.onThinking || (() => {});
        this.onToolExecution = callbacks.onToolExecution || (() => {});
        this.onResponse = callbacks.onResponse || (() => {});
    }
}
```

### Dependency Injection

Used throughout for loose coupling:

```javascript
// Commands receive dependencies via context
class HelpCommand extends BaseCommand {
    async implementation(args, context) {
        const { toolManager, commandRegistry } = context;
        // Use injected dependencies
    }
}
```

## Data Flow

### User Input Processing

1. **Input Capture**: `consoleInterface.js` captures user input
2. **Command Detection**: `commandHandler.js` checks for `/` commands
3. **Command Routing**: Commands routed to appropriate handlers
4. **AI Processing**: Non-commands sent to `aiAPIClient.js`
5. **Response Display**: Results displayed via `consoleInterface.js`

### AI Interaction Flow

1. **Message Preparation**: User input formatted with role context
2. **API Request**: `aiAPIClient.js` sends request to AI provider
3. **Tool Call Processing**: AI tool calls executed via `toolManager.js`
4. **Response Integration**: Tool results integrated into conversation
5. **Final Response**: AI response displayed to user

### Tool Execution Flow

1. **Tool Discovery**: `toolManager.js` scans tools directory
2. **Schema Validation**: Tool definitions validated against schema
3. **Implementation Loading**: Tool implementations dynamically imported
4. **Parameter Validation**: Input parameters validated before execution
5. **Execution**: Tool logic executed with safety checks
6. **Response Formatting**: Results formatted according to standards

## Configuration Architecture

### Layered Configuration

```
Priority (High to Low):
1. Command Line Arguments
2. Environment Variables (.env)
3. Configuration Files (config/)
4. Built-in Defaults
```

### Configuration Files Structure

```
config/
├── roles/                  # AI role definitions
│   ├── roles.json
│   └── environment-template.json
├── tools/                  # Tool configuration
│   ├── tool-messages.json
│   └── safety-patterns.json
├── ui/                     # User interface text
│   ├── console-messages.json
│   └── command-help.json
├── validation/             # Validation rules
│   └── config-validation.json
└── defaults/               # Default values
    └── application.json
```

## Extension Points

### Adding New Tools

1. Create tool directory in `tools/`
2. Add `definition.json` with schema
3. Add `implementation.js` with logic
4. Tool automatically discovered on restart

### Adding New Commands

1. Create command class extending `BaseCommand`
2. Place in appropriate category directory
3. Command automatically registered on startup

### Adding New AI Roles

1. Add role definition to `config/roles/roles.json`
2. Define system message and tool access
3. Optionally add few-shot examples
4. Role available immediately

### Adding New Configuration

1. Add configuration schema to validation files
2. Update configuration loaders
3. Add default values
4. Update documentation

## Security Architecture

### Input Validation

- All user inputs validated before processing
- Parameter type checking and sanitization
- Path traversal protection for file operations

### Tool Sandboxing

- Script execution in isolated child processes
- AI-powered safety assessment for dynamic code
- Timeout protection for long-running operations

### Configuration Security

- Environment variable validation
- Configuration file integrity checks
- Secure default values

### API Security

- API key validation and secure storage
- Request/response logging control
- Rate limiting and error handling

## Performance Considerations

### Caching Strategies

- Configuration files cached after first load
- Tool definitions cached for performance
- AI role configurations cached

### Lazy Loading

- Tools loaded on-demand
- Commands registered but not instantiated until needed
- Configuration files loaded only when required

### Memory Management

- Conversation history managed with size limits
- Tool execution results cleaned up after use
- Temporary files removed after processing

## Error Handling

### Layered Error Handling

1. **Tool Level**: Individual tools handle their own errors
2. **Manager Level**: Tool/Command managers handle execution errors
3. **Application Level**: Top-level error handling for system errors
4. **User Level**: User-friendly error messages and recovery options

### Error Recovery

- Graceful degradation when tools fail
- Automatic retry for transient failures
- User notification with actionable information

## Monitoring and Observability

### Logging System

- Centralized logging through `logger.js`
- Configurable verbosity levels
- Structured log output for analysis

### Cost Tracking

- API usage monitoring
- Token consumption tracking
- Cost reporting and alerts

### Performance Metrics

- Tool execution timing
- API response times
- Memory usage monitoring

---

_For implementation details, see specific component documentation_
_For extending the system, see [Tool Development](tool-development.md)_
