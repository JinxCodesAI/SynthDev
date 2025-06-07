# ADR-001: Adding New Tools

## Status

Accepted

## Context

SynthDev uses an extensible tool system that allows AI agents to perform various operations like file manipulation, code execution, and analysis. New tools need to be added following a consistent pattern to ensure proper integration with the system.

## Decision

We will follow a standardized approach for adding new tools to SynthDev that ensures consistency, maintainability, and proper integration with the existing architecture.

## Tool Structure

### Directory Organization

Each tool must be implemented as a separate directory under `src/tools/`:

```
src/tools/
└── your_tool_name/
    ├── definition.json      # Tool metadata and schema
    ├── implementation.js    # Tool logic
    └── README.md           # Tool documentation (optional)
```

### Tool Definition (`definition.json`)

Every tool must include a `definition.json` file with the following structure:

```json
{
    "name": "your_tool_name",
    "description": "Brief description of what the tool does",
    "auto_run": true,
    "version": "1.0.0",
    "tags": ["category", "keywords"],
    "schema": {
        "type": "function",
        "function": {
            "name": "your_tool_name",
            "description": "Detailed description for AI understanding",
            "parameters": {
                "type": "object",
                "properties": {
                    "parameter_name": {
                        "type": "string",
                        "description": "Parameter description"
                    },
                    "optional_parameter": {
                        "type": "string",
                        "description": "Optional parameter description",
                        "default": "default_value"
                    }
                },
                "required": ["parameter_name"]
            },
            "response_format": {
                "description": "Description of the expected response format"
            }
        }
    }
}
```

**Key Fields:**

- `name`: Unique tool identifier (snake_case)
- `description`: Brief tool description
- `auto_run`: Whether tool runs automatically (true) or requires confirmation (false)
- `version`: Tool version for tracking changes
- `tags`: Array of keywords for categorization
- `schema`: OpenAI function calling schema with detailed parameters and response format

### Tool Implementation (`implementation.js`)

The implementation file must use the BaseTool class and export a default function:

```javascript
import { BaseTool } from '../common/base-tool.js';

class YourToolNameTool extends BaseTool {
    constructor() {
        super('your_tool_name', 'Brief description of what the tool does');

        // Define parameter validation
        this.requiredParams = ['parameter_name'];
        this.parameterTypes = {
            parameter_name: 'string',
            optional_parameter: 'string',
        };
    }

    async implementation(params) {
        const { parameter_name, optional_parameter = 'default_value' } = params;

        try {
            // Tool logic here
            const result = await this.performToolOperation(parameter_name, optional_parameter);

            return this.createSuccessResponse({
                result: result,
                parameter_name,
                optional_parameter,
            });
        } catch (error) {
            return this.createErrorResponse(`Tool operation failed: ${error.message}`, {
                parameter_name,
                stack: error.stack,
            });
        }
    }

    async performToolOperation(parameter, optionalParam) {
        // Implement your tool logic here
        return 'Tool operation result';
    }
}

// Create and export the tool instance
const yourToolNameTool = new YourToolNameTool();

export default async function yourToolName(params) {
    return await yourToolNameTool.execute(params);
}
```

## Implementation Guidelines

### 1. Error Handling

- Use `BaseTool.createErrorResponse()` for standardized error responses
- Include relevant context in error responses (parameters, stack traces)
- Handle specific error types appropriately (file not found, permission denied, etc.)
- Use try-catch blocks in the implementation method

### 2. Parameter Validation

- Define `requiredParams` array for automatic validation
- Define `parameterTypes` object for type checking
- Use descriptive error messages for validation failures
- The BaseTool class handles basic validation automatically

### 3. Return Values

- Use `BaseTool.createSuccessResponse()` for standardized success responses
- Always include `success` boolean field
- Include `timestamp` and `tool_name` automatically
- Provide meaningful data in the response object

### 4. Logging

- Access logger via `this.logger` in BaseTool classes
- Use appropriate log levels (debug, info, warn, error)
- Include relevant context in log messages
- Avoid logging sensitive information (API keys, passwords)

### 5. Base Tool Classes

- Extend `BaseTool` for general tools
- Extend `FileBaseTool` for file operations (includes path validation)
- Extend `CommandBaseTool` for command execution tools
- Use the appropriate base class for your tool's functionality

### 6. Safety Considerations

- Implement safety checks for dangerous operations
- Set `auto_run: false` in definition.json for tools requiring confirmation
- Validate user input to prevent security issues
- Use base tool classes for built-in safety features

## Tool Categories

### File Operations

Tools that read, write, or manipulate files:

- Must validate file paths and permissions
- Should handle encoding properly (default: utf8)
- Should respect file size limits
- Examples: `read_file`, `write_file`, `edit_file`

### Search & Analysis

Tools that search or analyze code/content:

- Should handle large codebases efficiently
- Must provide relevant, filtered results
- Should support various search patterns
- Must handle encoding and special characters
- Examples: `exact_search`, `explain_codebase`

### Code Execution

Tools that execute code or commands:

- Must implement comprehensive safety checks
- Should use sandboxing when possible
- Must validate code before execution
- Should have configurable timeouts
- Examples: `execute_script`, `execute_terminal`

### Utility

General-purpose tools:

- Should be stateless when possible
- Must handle edge cases gracefully
- Should provide clear, actionable results
- Examples: `calculate`, `get_time`

### Parsing Tools

Special tools for structured data extraction and analysis:

- Used by roles with `parsingOnly: true`
- Focus on information extraction without system modification
- Return structured data for AI processing
- Cannot perform file operations or code execution
- Examples: `parse_code_structure`, `analyze_dependencies`

**Parsing vs Regular Tools:**

- **Regular Tools**: Full system access, can modify files and execute code
- **Parsing Tools**: Read-only analysis, structured output, safe for restricted roles

## Testing Requirements

### Unit Tests

Create comprehensive unit tests in `tests/unit/tools/yourToolName.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import yourToolName from '../../../src/tools/your_tool_name/implementation.js';

describe('Your Tool Name', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('parameter validation', () => {
        it('should return error for missing required parameter', async () => {
            const result = await yourToolName({});
            expect(result.success).toBe(false);
            expect(result.error).toContain('parameter_name');
        });

        it('should validate parameter types', async () => {
            const result = await yourToolName({
                parameter_name: 123, // Wrong type
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('type');
        });
    });

    describe('successful execution', () => {
        it('should execute successfully with valid parameters', async () => {
            const result = await yourToolName({
                parameter_name: 'test_value',
            });
            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('your_tool_name');
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle errors gracefully', async () => {
            // Test error scenarios specific to your tool
        });
    });
});
```

### Integration Tests

Test tool integration with the tool manager and AI system.

## Tool Discovery and Usage

Tools are automatically discovered by the `ToolManager`:

1. **Directory Scanning**: Scans `src/tools/` for subdirectories
2. **Definition Loading**: Loads and validates `definition.json`
3. **Implementation Loading**: Imports the implementation module
4. **Registration**: Registers tool with the system
5. **Categorization**: Organizes tools by category

### Tool Usage Patterns

**AI Tool Calls**: Tools are called by AI through `toolManager.executeToolCall()` with OpenAI function calling format.

**Command Integration**: Commands can call tools directly by importing and calling the exported function:

```javascript
import editTasks from '../../tools/edit_tasks/implementation.js';

// In command implementation
const result = await editTasks({ tasks: [...] });
```

This pattern allows commands to use tool functionality without going through the AI tool calling system.

## Role-Based Tool Filtering

Tools can be excluded from specific AI roles:

```json
{
    "role_name": {
        "excludedTools": ["dangerous_tool", "admin_tool"],
        "systemMessage": "You are a restricted assistant..."
    }
}
```

## Configuration Messages

Tool-specific messages can be added to `src/config/tools/tool-messages.json` if needed:

```json
{
    "descriptions": {
        "your_tool_name": "Description for help display"
    },
    "errors": {
        "your_tool_specific_error": "Error message template with {placeholders}"
    },
    "validation": {
        "your_tool_validation": "Validation message template"
    }
}
```

**Note:** Most tools use the BaseTool class methods for standardized responses and don't require custom configuration messages.

## Consequences

### Positive

- Consistent tool development patterns
- Automatic tool discovery and registration
- Standardized error handling and logging
- Role-based tool filtering
- Comprehensive testing requirements

### Negative

- Additional boilerplate for simple tools
- Strict structure requirements
- Need to maintain configuration files

## Tool Registration Process

1. **Create Tool Directory**: `src/tools/your_tool_name/`
2. **Implement Definition**: Create `definition.json` with proper schema structure
3. **Implement Logic**: Create `implementation.js` extending BaseTool with default export function
4. **Write Tests**: Create comprehensive unit tests
5. **Test Integration**: Verify tool works with AI system and commands
6. **Update Documentation**: Add tool to relevant documentation

## Validation Checklist

Before submitting a new tool:

- [ ] Tool directory follows naming convention (snake_case)
- [ ] `definition.json` includes all required fields (name, description, auto_run, version, tags, schema)
- [ ] Implementation extends appropriate BaseTool class
- [ ] Default export function calls tool.execute(params)
- [ ] Parameters are properly validated using requiredParams and parameterTypes
- [ ] Return values use createSuccessResponse() and createErrorResponse()
- [ ] Unit tests cover parameter validation, success cases, and error handling
- [ ] Tool integrates properly with role system
- [ ] Safety considerations are addressed (auto_run setting, input validation)
- [ ] Documentation is complete

## Real Tool Examples

### Task Management Tool: `edit_tasks`

**Definition (`src/tools/edit_tasks/definition.json`):**

```json
{
    "name": "edit_tasks",
    "description": "Create or edit tasks in the in-memory task management system",
    "auto_run": true,
    "version": "1.0.0",
    "tags": ["tasks", "management", "productivity"],
    "schema": {
        "type": "function",
        "function": {
            "name": "edit_tasks",
            "description": "Create or edit tasks in the task management system",
            "parameters": {
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "description": "Array of task objects to create or edit",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string" },
                                "description": { "type": "string" },
                                "status": {
                                    "type": "string",
                                    "enum": ["not_started", "in_progress", "completed", "cancelled"]
                                },
                                "parent": { "type": "string" }
                            }
                        }
                    }
                },
                "required": ["tasks"]
            }
        }
    }
}
```

**Implementation Pattern:**

- Extends BaseTool with proper parameter validation
- Validates task data structure and relationships
- Prevents circular dependencies in parent-child relationships
- Returns detailed success/error responses with processed task information
- Integrates with shared task manager for data persistence

### Other Examples

See existing tools for reference:

- `src/tools/read_files/` - File reading with FileBaseTool base class
- `src/tools/calculate/` - Simple utility tool with BaseTool
- `src/tools/list_tasks/` - Task management tool with parameter validation
- `src/tools/get_tasks/` - Single entity retrieval with detailed responses
- `src/tools/execute_script/` - Complex tool with safety checks and CommandBaseTool

---

_This ADR establishes the standard pattern for adding new tools to SynthDev. Follow this structure to ensure proper integration and maintainability._
