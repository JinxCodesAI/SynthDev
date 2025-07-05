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
    "parameters": {
        "type": "object",
        "properties": {
            "parameter_name": {
                "type": "string",
                "description": "Parameter description"
            },
            "optional_parameter": {
                "type": "string",
                "description": "Optional parameter description"
            }
        },
        "required": ["parameter_name"]
    }
}
```

**Key Fields:**

- `name`: Unique tool identifier (snake_case)
- `description`: Clear, concise tool description for AI understanding
- `parameters`: JSON Schema for input validation and AI tool calling

### Tool Implementation (`implementation.js`)

The implementation file must export a default function:

```javascript
import { getLogger } from '../../core/managers/logger.js';
import { getToolConfigManager } from '../../config/managers/toolConfigManager.js';

/**
 * Tool implementation
 * @param {Object} params - Tool parameters
 * @param {Object} params.costsManager - Cost tracking manager
 * @returns {Object} Tool execution result
 */
export default async function yourToolName(params) {
    const logger = getLogger();
    const toolConfig = getToolConfigManager();

    try {
        // Validate parameters
        const { parameter_name } = params;
        if (!parameter_name) {
            return {
                success: false,
                error: toolConfig.getMessage('errors.missing_parameter', {
                    param: 'parameter_name',
                }),
            };
        }

        // Tool logic here
        const result = await performToolOperation(parameter_name);

        logger.debug(`Tool executed successfully: ${result}`);

        return {
            success: true,
            result: result,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        logger.error(error, `Tool execution failed: ${params}`);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        };
    }
}

async function performToolOperation(parameter) {
    // Implement your tool logic here
    return 'Tool operation result';
}
```

## Implementation Guidelines

### 1. Error Handling

- Always wrap tool logic in try-catch blocks
- Return standardized error responses
- Use tool configuration messages for user-facing errors
- Log errors with appropriate detail level

### 2. Parameter Validation

- Validate all required parameters
- Use descriptive error messages for validation failures
- Consider parameter type conversion when needed
- Validate file paths and permissions for file operations

### 3. Return Values

- Always include `success` boolean field
- Include `timestamp` for tracking
- Provide meaningful `result` or `error` fields
- Follow consistent naming conventions

### 4. Logging

- Use appropriate log levels (debug, info, warn, error)
- Include relevant context in log messages
- Avoid logging sensitive information (API keys, passwords)

### 5. Configuration Integration

- Use `getToolConfigManager()` for tool-specific messages
- Support tool-specific configuration options
- Follow existing configuration patterns

### 6. Safety Considerations

- Implement safety checks for dangerous operations
- Use `requires_backup: true` for file-modifying tools
- Validate user input to prevent security issues
- Consider rate limiting for resource-intensive operations

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
    });

    describe('successful execution', () => {
        it('should execute successfully with valid parameters', async () => {
            const result = await yourToolName({
                parameter_name: 'test_value',
            });
            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle errors gracefully', async () => {
            // Test error scenarios
        });
    });
});
```

### Integration Tests

Test tool integration with the tool manager and AI system.

## Tool Discovery

Tools are automatically discovered by the `ToolManager`:

1. **Directory Scanning**: Scans `src/tools/` for subdirectories
2. **Definition Loading**: Loads and validates `definition.json`
3. **Implementation Loading**: Imports the implementation module
4. **Registration**: Registers tool with the system
5. **Categorization**: Organizes tools by category

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

Add tool-specific messages to `src/config/tools/tool-messages.json`:

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
2. **Implement Definition**: Create `definition.json` with proper schema
3. **Implement Logic**: Create `implementation.js` with default export
4. **Add Configuration**: Update `tool-messages.json` if needed
5. **Write Tests**: Create comprehensive unit tests
6. **Test Integration**: Verify tool works with AI system
7. **Update Documentation**: Add tool to relevant documentation

## Validation Checklist

Before submitting a new tool:

- [ ] Tool directory follows naming convention (snake_case)
- [ ] `definition.json` includes all required fields
- [ ] Implementation follows error handling patterns
- [ ] Parameters are properly validated
- [ ] Return values follow standard format
- [ ] Unit tests cover all scenarios
- [ ] Tool integrates properly with role system
- [ ] Safety considerations are addressed
- [ ] Documentation is complete

## Real Tool Examples

### File Operation Tool: `write_file`

**Definition (`src/tools/write_file/definition.json`):**

```json
{
    "name": "write_file",
    "description": "Create or overwrite a file with new content",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "The file path where content should be written"
            },
            "content": {
                "type": "string",
                "description": "The content to write to the file"
            },
            "encoding": {
                "type": "string",
                "description": "File encoding (default: utf8)"
            }
        },
        "required": ["path", "content"]
    }
}
```

**Implementation Pattern:**

- Validates file path and content
- Handles encoding (defaults to utf8)
- Creates directories if needed
- Returns success/error with detailed messages
- Integrates with backup system for file modifications

### Other Examples

See existing tools for reference:

- `src/tools/read_file/` - Simple file reading operation
- `src/tools/execute_script/` - Complex tool with safety checks
- `src/tools/exact_search/` - Search and analysis tool
- `src/tools/calculate/` - Simple utility tool

---

_This ADR establishes the standard pattern for adding new tools to SynthDev. Follow this structure to ensure proper integration and maintainability._
