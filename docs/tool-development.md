# Tool Development Guide

This guide provides comprehensive instructions for creating custom tools and commands for SynthDev. Tools extend the AI's capabilities through function calling, enabling file operations, calculations, command execution, and data processing.

## Tool Architecture

### Core Components

Each tool consists of two mandatory files within its own directory:

```
tools/
└── tool_name/
    ├── definition.json     # Tool schema, metadata, and API specification
    └── implementation.js   # Tool logic and execution code
```

### Optional Components

```
tools/
└── tool_name/
    ├── definition.json
    ├── implementation.js
    ├── README.md          # Tool-specific documentation
    └── examples.js        # Usage examples and test cases
```

## Tool Definition Schema

### Required Fields

```json
{
    "name": "tool_name",
    "description": "Brief tool description for system use",
    "auto_run": false,
    "requires_backup": true,
    "backup_resource_path_property_name": "file_path",
    "schema": {
        "type": "function",
        "function": {
            "name": "tool_name",
            "description": "Detailed AI-facing description",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            },
            "response_format": {
                "description": "Expected response structure"
            }
        }
    }
}
```

### Optional Metadata Fields

```json
{
    "category": "file|command|utility|search|calculation",
    "version": "1.0.0",
    "author": "Tool Developer",
    "tags": ["keyword1", "keyword2"]
}
```

### Field Descriptions

- **auto_run**: Controls execution approval
    - `true`: Executes automatically without user confirmation
    - `false`: Requires user approval before execution
- **requires_backup**: Indicates if tool modifies resources requiring backup
- **backup_resource_path_property_name**: Parameter name containing the resource path to backup
- **description (function level)**: Critical AI-facing documentation - be extremely detailed
- **category**: Tool classification for organization and discovery

## Implementation Standards

### Base Structure

```javascript
/**
 * Tool Name Implementation
 * Detailed description of tool functionality
 */

import { BaseTool, FileBaseTool, CommandBaseTool } from '../common/base-tool.js';

export default async function toolName(params) {
    const tool = new BaseTool('tool_name', 'Tool description');

    // Parameter validation
    const validationError = tool.validateRequiredParams(params, ['required_param']);
    if (validationError) return validationError;

    const typeError = tool.validateParameterTypes(params, {
        param_name: 'string',
        numeric_param: 'number',
    });
    if (typeError) return typeError;

    try {
        // Tool implementation logic
        const result = await performOperation(params);

        return tool.createSuccessResponse({
            result: result,
            // Additional response data
        });
    } catch (error) {
        return tool.createErrorResponse(`Operation failed: ${error.message}`);
    }
}
```

### Base Tool Classes

#### BaseTool

General-purpose base class providing:

- Standardized response creation
- Parameter validation
- Error handling
- Path security validation

#### FileBaseTool

Specialized for file operations:

- File size validation
- File system error handling
- Path traversal protection

#### CommandBaseTool

Specialized for command execution:

- Command validation
- Execution response formatting
- Security constraints

### Response Format Standards

#### Success Response

```json
{
    "success": true,
    "timestamp": "2025-01-01T12:00:00.000Z",
    "tool_name": "tool_name",
    "result": "operation_result"
    // Tool-specific data
}
```

#### Error Response

```json
{
    "success": false,
    "timestamp": "2025-01-01T12:00:00.000Z",
    "tool_name": "tool_name",
    "error": "Descriptive error message"
    // Error metadata
}
```

## Security Guidelines

### Path Security

- **Mandatory**: Use `tool.validateAndResolvePath()` for all file operations
- **Prohibited**: Direct path manipulation without validation
- **Constraint**: All file access must remain within project directory

### Input Validation

- **Required**: Validate all parameters before processing
- **Type Safety**: Enforce parameter types and ranges
- **Sanitization**: Clean user inputs to prevent injection attacks

### Resource Limits

- **Memory**: Monitor memory usage for large operations
- **Execution Time**: Implement timeouts for long-running processes
- **File Size**: Validate file sizes before processing

### Command Execution

- **Sandboxing**: Use child processes for script execution
- **Validation**: Implement safety checks for command execution
- **Isolation**: Prevent access to sensitive system resources

## Parameter Design Patterns

### Standard Parameters

Use predefined parameter types from `tools/common/tool-schema.js`:

```javascript
import { STANDARD_PARAMETERS } from '../common/tool-schema.js';

// In definition.json
"file_path": STANDARD_PARAMETERS.file_path,
"content": STANDARD_PARAMETERS.content,
"encoding": STANDARD_PARAMETERS.encoding
```

### Custom Parameters

```json
{
    "custom_param": {
        "type": "string",
        "description": "Extremely detailed description including format, constraints, examples, and edge cases. The AI model relies entirely on this description to understand parameter usage.",
        "enum": ["option1", "option2"],
        "default": "default_value",
        "minimum": 1,
        "maximum": 100
    }
}
```

### Parameter Naming Conventions

- Use `snake_case` for consistency
- Choose descriptive, unambiguous names
- Avoid abbreviations unless universally understood
- Match names exactly between definition.json and implementation.js

## AI-Facing Documentation

### Critical Guidelines

The `description` field in the function schema is the AI's primary interface documentation. It must be:

1. **Comprehensive**: Cover all functionality, parameters, and constraints
2. **Specific**: Include exact formats, valid ranges, and examples
3. **Unambiguous**: Avoid vague language or assumptions
4. **Complete**: Document edge cases and error conditions

### Example: Excellent AI Description

```json
{
    "description": "Execute a self-contained JavaScript script for performing calculations, text transformations, search aggregation, and other data processing tasks. The script runs in a sandboxed environment with read-only access to the current directory. Cannot modify files or execute terminal commands. Uses AI-powered safety assessment to prevent malicious code execution. Use Stdout for returning results. Script must be complete and not require external parameters. Can use built-in Node.js modules like 'fs' for file reading, 'path' for path operations, and standard JavaScript for data processing. Timeout range: 1000-30000ms."
}
```

## Tool Categories and Examples

### File Operations (`category: "file"`)

- **Purpose**: File system interactions
- **Examples**: read_file, write_file, edit_file
- **Base Class**: FileBaseTool
- **Common Parameters**: file_path, content, encoding

### Command Execution (`category: "command"`)

- **Purpose**: System command execution
- **Examples**: execute_terminal, execute_script
- **Base Class**: CommandBaseTool
- **Common Parameters**: command, timeout, working_directory
- **Note**: execute_terminal requires `requires_backup: false` for validation

### Utilities (`category: "utility"`)

- **Purpose**: General-purpose operations
- **Examples**: get_time, calculate
- **Base Class**: BaseTool
- **Common Parameters**: Varies by functionality

### Search Operations (`category: "search"`)

- **Purpose**: Data discovery and retrieval
- **Examples**: exact_search, list_directory
- **Base Class**: BaseTool
- **Common Parameters**: query, path, filters

### Calculations (`category: "calculation"`)

- **Purpose**: Mathematical and data processing
- **Examples**: calculate, statistical analysis
- **Base Class**: BaseTool
- **Common Parameters**: expression, precision, format

## Advanced Features

### AI-Powered Safety Assessment

For tools executing user-provided code or commands:

```javascript
import { assessScriptSafety } from '../common/safety-assessment.js';

// In implementation
const safetyResult = await assessScriptSafety(userScript);
if (!safetyResult.safe) {
    return tool.createErrorResponse(`Safety assessment failed: ${safetyResult.reason}`, {
        safety_check: safetyResult,
    });
}
```

### Child Process Execution

For isolated script execution:

```javascript
import { spawn } from 'child_process';

const childProcess = spawn('node', ['-e', script], {
    cwd: process.cwd(),
    timeout: timeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
});
```

### Progress Reporting

For long-running operations:

```javascript
// Return intermediate progress
return tool.createSuccessResponse({
    status: 'in_progress',
    progress: 0.5,
    message: 'Processing...',
});
```

## Testing and Validation

### Tool Definition Validation

```javascript
import { validateToolDefinition } from '../common/tool-schema.js';

const validation = validateToolDefinition(definition, toolName);
if (!validation.success) {
    console.error('Validation errors:', validation.errors);
}
```

### Implementation Testing

1. **Parameter Validation**: Test with invalid/missing parameters
2. **Edge Cases**: Test boundary conditions and unusual inputs
3. **Error Scenarios**: Verify error handling works correctly
4. **Success Paths**: Ensure normal operation works as expected
5. **Security**: Test path traversal and injection attempts

### Test Structure

```javascript
// In examples.js or separate test file
export const testCases = [
    {
        name: 'Valid input test',
        params: { param1: 'value1' },
        expectedSuccess: true,
    },
    {
        name: 'Invalid input test',
        params: { param1: null },
        expectedSuccess: false,
        expectedError: 'param1 is required',
    },
];
```

## Best Practices Summary

### Development

1. **Start with definition.json**: Define the interface before implementation
2. **Use base classes**: Leverage existing validation and error handling
3. **Validate everything**: Never trust input parameters
4. **Handle errors gracefully**: Provide actionable error messages
5. **Document thoroughly**: The AI relies on your descriptions

### Security

1. **Validate paths**: Always use security-checked path resolution
2. **Limit scope**: Restrict file access to project directory
3. **Sanitize inputs**: Clean all user-provided data
4. **Use timeouts**: Prevent infinite execution
5. **Assess safety**: Implement safety checks for dynamic code

### Maintenance

1. **Version your tools**: Use semantic versioning
2. **Add metadata**: Include category, tags, and author information
3. **Write examples**: Provide usage examples and test cases
4. **Update documentation**: Keep descriptions current with functionality
5. **Monitor performance**: Track execution times and resource usage

## Tool Discovery and Loading

Tools are automatically discovered and loaded by the application at startup. The system:

1. Scans the `tools/` directory for subdirectories
2. Loads `definition.json` and validates the schema
3. Imports `implementation.js` and registers the tool
4. Makes the tool available for AI function calling

No manual registration is required - simply create the tool files and restart the application.

---

_For role-based tool access control, see [AI Roles & Few-Shot Prompting](roles-and-prompting.md)_
_For testing your tools, see [Testing Guide](testing.md)_
