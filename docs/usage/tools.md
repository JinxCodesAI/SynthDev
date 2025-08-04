# SynthDev Tools Reference

This document provides comprehensive information about SynthDev's available tools, their parameters, and security features for users.

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

---

_For information about developing new tools, see the [Tool Development Guide](../development/tools-development.md)._
