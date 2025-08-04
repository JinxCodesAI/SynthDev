# SynthDev Tool Development Guide

This document provides comprehensive information for developers who want to create, modify, and contribute new tools to SynthDev.

## Tool Architecture

### Base Classes

#### BaseTool

Foundation class providing:

- Standardized response format
- Parameter validation
- Path security validation
- Error handling

```javascript
class BaseTool {
    validateRequiredParams(params, requiredFields) {
        // Parameter validation logic
    }

    validateAndResolvePath(filePath, cwd) {
        // Security validation for file operations
    }

    createSuccessResponse(data) {
        // Standardized response format
    }

    createErrorResponse(message, details = null) {
        // Standardized error format
    }
}
```

#### FileBaseTool

Specialized for file operations:

- File size validation
- File system error handling
- Path traversal protection
- Backup functionality

#### CommandBaseTool

Specialized for command execution:

- Command validation
- Execution response formatting
- Security constraints
- Timeout handling

### Tool Structure

Each tool is organized as a directory with:

```
src/tools/tool_name/
├── definition.json      # Tool metadata and schema
├── implementation.js    # Tool implementation
└── README.md           # Tool documentation
```

#### definition.json

```json
{
    "name": "tool_name",
    "description": "Tool description",
    "parameters": {
        "type": "object",
        "properties": {
            "param_name": {
                "type": "string",
                "description": "Parameter description"
            }
        },
        "required": ["param_name"]
    }
}
```

#### implementation.js

```javascript
import BaseTool from '../common/base-tool.js';

class ToolName extends BaseTool {
    async execute(params) {
        try {
            // Validate parameters
            this.validateRequiredParams(params, ['param_name']);

            // Tool implementation
            const result = await this.performOperation(params);

            return this.createSuccessResponse(result);
        } catch (error) {
            return this.createErrorResponse(error.message);
        }
    }

    async performOperation(params) {
        // Tool-specific logic
    }
}

export default ToolName;
```

## Security Implementation

### Path Validation

All file operations use `validateAndResolvePath()`:

```javascript
validateAndResolvePath(filePath, cwd) {
    // Resolve absolute path
    const resolvedPath = path.resolve(cwd, filePath);

    // Ensure path is within project directory
    if (!resolvedPath.startsWith(cwd)) {
        throw new Error('Path traversal detected');
    }

    return resolvedPath;
}
```

### AI Safety Assessment

For script execution, AI analyzes code safety:

```javascript
async assessScriptSafety(script) {
    const prompt = `Analyze this JavaScript code for safety...`;
    const response = await this.aiClient.sendMessage(prompt);

    // Parse AI response for safety assessment
    return this.parseAssessment(response);
}
```

### Role-Based Access Control

Tools can be filtered based on AI roles:

```json
{
    "role_name": {
        "excludedTools": ["execute_terminal", "write_file"],
        "includedTools": ["read_files", "exact_search"]
    }
}
```

### Pattern-Based Safety

Dangerous patterns are blocked:

```json
{
    "dangerous_patterns": [
        {
            "pattern": "rm -rf",
            "reason": "Dangerous file deletion command"
        }
    ]
}
```

## Tool Development

### Creating a New Tool

1. **Create Tool Directory**

    ```bash
    mkdir src/tools/my_tool
    ```

2. **Define Tool Schema** (`definition.json`)

    ```json
    {
        "name": "my_tool",
        "description": "My custom tool",
        "parameters": {
            "type": "object",
            "properties": {
                "input": {
                    "type": "string",
                    "description": "Input parameter"
                }
            },
            "required": ["input"]
        }
    }
    ```

3. **Implement Tool Logic** (`implementation.js`)

    ```javascript
    import BaseTool from '../common/base-tool.js';

    class MyTool extends BaseTool {
        async execute(params) {
            this.validateRequiredParams(params, ['input']);

            // Tool implementation
            const result = this.processInput(params.input);

            return this.createSuccessResponse(result);
        }
    }

    export default MyTool;
    ```

4. **Add Tests**

    ```javascript
    // tests/unit/tools/my_tool.test.js
    import MyTool from '../../../src/tools/my_tool/implementation.js';

    describe('MyTool', () => {
        test('should process input correctly', async () => {
            const tool = new MyTool();
            const result = await tool.execute({ input: 'test' });
            expect(result.success).toBe(true);
        });
    });
    ```

### Best Practices

1. **Use Base Classes**: Extend appropriate base classes for consistency
2. **Validate Parameters**: Always validate required and optional parameters
3. **Handle Errors**: Provide meaningful error messages
4. **Security First**: Implement appropriate security measures
5. **Test Thoroughly**: Write comprehensive unit and integration tests
6. **Document Well**: Provide clear documentation and examples

### Testing Tools

```javascript
// Example test structure
describe('ToolName', () => {
    let tool;

    beforeEach(() => {
        tool = new ToolName();
    });

    test('should validate required parameters', async () => {
        await expect(tool.execute({})).rejects.toThrow('Missing required parameter');
    });

    test('should execute successfully with valid parameters', async () => {
        const result = await tool.execute({ param: 'value' });
        expect(result.success).toBe(true);
    });

    test('should handle errors gracefully', async () => {
        const result = await tool.execute({ param: 'invalid' });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

## Tool Configuration

### Tool Messages

Customize tool messages in `src/config/tools/tool-messages.json`:

```json
{
    "read_files": {
        "success": "File read successfully",
        "error": "Failed to read file"
    }
}
```

### Safety Patterns

Configure safety patterns in `src/config/tools/safety-patterns.json`:

```json
{
    "dangerous_patterns": [
        {
            "pattern": "dangerous_command",
            "reason": "This command is dangerous"
        }
    ]
}
```

---

_For information about using existing tools, see the [Tools Reference](../usage/tools.md)._
