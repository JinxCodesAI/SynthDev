# SynthDev Tools Reference

This document provides comprehensive information about SynthDev's tool system, including all available tools, their parameters, security features, and development guidelines.

## Tool System Overview

SynthDev's tool system provides AI agents with controlled access to system functionality through a secure, validated interface. Each tool is implemented as a separate module with standardized interfaces and comprehensive security measures.

### Core Features

- **Security First**: Path validation, AI safety assessment, and role-based access control
- **Standardized Interface**: Consistent parameter validation and response formatting
- **Extensible Architecture**: Plugin-like system for adding new tools
- **Comprehensive Validation**: Type checking, required field validation, and size constraints
- **Automatic Backups**: Safety measures for destructive operations

## Available Tools

### File Operations

#### read_files

Read file contents with encoding support and size limits.

**Parameters:**

- `file_path` (required): Path to the file to read
- `encoding` (optional): File encoding (default: 'utf8')

**Security Features:**

- Path validation prevents directory traversal
- File size limits prevent memory issues
- Encoding validation ensures proper text handling

**Example:**

```javascript
{
    "tool_name": "read_files",
    "parameters": {
        "file_path": "src/app.js",
        "encoding": "utf8"
    }
}
```

#### write_file

Create or overwrite files with backup and validation.

**Parameters:**

- `file_path` (required): Path where to write the file
- `content` (required): Content to write to the file
- `encoding` (optional): File encoding (default: 'utf8')

**Security Features:**

- Automatic backup of existing files
- Path validation and sanitization
- Content size validation
- Atomic write operations

**Example:**

```javascript
{
    "tool_name": "write_file",
    "parameters": {
        "file_path": "output.txt",
        "content": "Hello, World!",
        "encoding": "utf8"
    }
}
```

#### edit_file

Modify files with line-based editing and safety checks.

**Parameters:**

- `file_path` (required): Path to the file to edit
- `line_number` (required): Line number to edit (1-based)
- `new_content` (required): New content for the line
- `operation` (optional): 'replace', 'insert', or 'delete' (default: 'replace')

**Security Features:**

- Backup before modification
- Line number validation
- Content validation
- Rollback capability

**Example:**

```javascript
{
    "tool_name": "edit_file",
    "parameters": {
        "file_path": "src/config.js",
        "line_number": 5,
        "new_content": "const API_URL = 'https://api.example.com';",
        "operation": "replace"
    }
}
```

#### list_directory

Directory listing with filtering and depth control.

**Parameters:**

- `directory_path` (required): Path to the directory to list
- `recursive` (optional): Whether to list recursively (default: false)
- `max_depth` (optional): Maximum recursion depth (default: 2)
- `include_hidden` (optional): Include hidden files (default: false)

**Security Features:**

- Path validation
- Depth limits prevent infinite recursion
- Hidden file filtering
- Size limits for large directories

**Example:**

```javascript
{
    "tool_name": "list_directory",
    "parameters": {
        "directory_path": "src",
        "recursive": true,
        "max_depth": 3,
        "include_hidden": false
    }
}
```

### Search & Analysis

#### exact_search

Fast text search with regex support and context.

**Parameters:**

- `search_term` (required): Text or regex pattern to search for
- `file_path` (optional): Specific file to search in
- `directory_path` (optional): Directory to search in
- `case_sensitive` (optional): Case-sensitive search (default: false)
- `regex` (optional): Treat search_term as regex (default: false)
- `context_lines` (optional): Lines of context around matches (default: 2)

**Security Features:**

- Path validation
- Regex validation and safety checks
- Result size limits
- File type filtering

**Example:**

```javascript
{
    "tool_name": "exact_search",
    "parameters": {
        "search_term": "function.*export",
        "directory_path": "src",
        "regex": true,
        "context_lines": 3
    }
}
```

#### explain_codebase

AI-powered codebase analysis using indexed summaries.

**Parameters:**

- `query` (required): Question or topic to explain about the codebase
- `focus_area` (optional): Specific area to focus on (e.g., "authentication", "database")

**Features:**

- Uses pre-indexed codebase summaries
- AI-powered analysis and explanation
- Context-aware responses
- Supports complex queries

**Example:**

```javascript
{
    "tool_name": "explain_codebase",
    "parameters": {
        "query": "How does the authentication system work?",
        "focus_area": "security"
    }
}
```

### Code Execution

#### execute_terminal

System command execution with safety patterns.

**Parameters:**

- `command` (required): Command to execute
- `working_directory` (optional): Directory to run command in
- `timeout` (optional): Execution timeout in seconds (default: 30)

**Security Features:**

- Command validation against dangerous patterns
- Working directory validation
- Execution timeout limits
- Output size limits
- Environment isolation

**Example:**

```javascript
{
    "tool_name": "execute_terminal",
    "parameters": {
        "command": "npm test",
        "working_directory": ".",
        "timeout": 60
    }
}
```

#### execute_script

JavaScript execution in sandboxed environment with AI safety assessment.

**Parameters:**

- `script` (required): JavaScript code to execute
- `timeout` (optional): Execution timeout in seconds (default: 10)

**Security Features:**

- AI-powered safety assessment
- Sandboxed execution environment
- Pattern-based safety checks as fallback
- Resource limits and timeouts
- Access control to system resources

**Example:**

```javascript
{
    "tool_name": "execute_script",
    "parameters": {
        "script": "console.log('Hello from script!'); return 42;",
        "timeout": 5
    }
}
```

### Utilities

#### get_time

Current time and date information.

**Parameters:**

- `format` (optional): Time format ('iso', 'local', 'unix') (default: 'iso')
- `timezone` (optional): Timezone for formatting (default: system timezone)

**Example:**

```javascript
{
    "tool_name": "get_time",
    "parameters": {
        "format": "iso",
        "timezone": "UTC"
    }
}
```

#### calculate

Mathematical calculations and expressions.

**Parameters:**

- `expression` (required): Mathematical expression to evaluate
- `precision` (optional): Decimal precision (default: 10)

**Security Features:**

- Expression validation
- Safe evaluation (no code execution)
- Result validation
- Precision limits

**Example:**

```javascript
{
    "tool_name": "calculate",
    "parameters": {
        "expression": "2 * pi * 5",
        "precision": 4
    }
}
```

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

## Security Features

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

_For role-based tool access control, see the Configuration guide. For workflow-specific tool usage, see the Workflows guide._
