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

Read file contents with encoding support and size limits. Supports batch reading of multiple files.

**Parameters:**

- `file_paths` (required): Array of relative paths to files to read
- `encoding` (optional): File encoding (default: 'utf8')

**Security Features:**

- Path validation prevents directory traversal
- File size limits prevent memory issues
- Encoding validation ensures proper text handling
- Batch processing with individual error handling

**Example:**

```javascript
{
    "tool_name": "read_files",
    "parameters": {
        "file_paths": ["src/app.js", "config.json"],
        "encoding": "utf8"
    }
}
```

#### write_file

Create or overwrite files with backup and validation. **Requires confirmation** before execution.

**Parameters:**

- `file_path` (required): Relative path where to write the file
- `content` (required): Content to write to the file
- `encoding` (optional): File encoding (default: 'utf8')
- `create_directories` (optional): Auto-create parent directories (default: true)
- `overwrite` (optional): Allow overwriting existing files (default: true)

**Security Features:**

- Requires user confirmation before execution
- Path validation and sanitization
- Content size validation
- Atomic write operations
- Auto-directory creation

**Example:**

```javascript
{
    "tool_name": "write_file",
    "parameters": {
        "file_path": "output.txt",
        "content": "Hello, World!",
        "encoding": "utf8",
        "create_directories": true,
        "overwrite": true
    }
}
```

#### edit_file

Modify files using boundary-based editing with safety checks.

**Parameters:**

- `file_path` (required): Relative path to the file to edit
- `operation` (required): 'replace' or 'delete'
- `boundary_start` (required): Unique string marking start of section to edit
- `boundary_end` (required): Unique string marking end of section to edit
- `new_content` (optional): New content to replace between boundaries (required for 'replace')

**Security Features:**

- Backup before modification
- Boundary validation to prevent accidental edits
- Content validation
- Recovery mechanisms for boundary issues

**Example:**

```javascript
{
    "tool_name": "edit_file",
    "parameters": {
        "file_path": "src/config.js",
        "operation": "replace",
        "boundary_start": "// START CONFIG",
        "boundary_end": "// END CONFIG",
        "new_content": "const API_URL = 'https://api.example.com';"
    }
}
```

#### list_directory

Directory listing with filtering and depth control.

**Parameters:**

- `directory_path` (required): Relative path to the directory to list
- `recursive` (optional): Whether to list recursively (default: false)
- `include_hidden` (optional): Include hidden files (default: false)
- `max_depth` (optional): Maximum recursion depth (default: 5, max: 10)
- `exclusion_list` (optional): Array of names to exclude (default includes node_modules, .git, etc.)
- `include_summaries` (optional): Include AI-generated summaries from codebase index (default: false)

**Security Features:**

- Path validation
- Depth limits prevent infinite recursion
- Hidden file filtering
- Size limits for large directories
- Default exclusion of sensitive directories

**Example:**

```javascript
{
    "tool_name": "list_directory",
    "parameters": {
        "directory_path": "src",
        "recursive": true,
        "max_depth": 3,
        "include_hidden": false,
        "include_summaries": true
    }
}
```

### Search & Analysis

#### exact_search

Fast exact text search across all project files with context.

**Parameters:**

- `search_string` (required): Exact string to search for in files

**Security Features:**

- Path validation
- Result size limits
- File type filtering
- Automatic context (4 lines before/after matches)

**Example:**

```javascript
{
    "tool_name": "exact_search",
    "parameters": {
        "search_string": "function exportData"
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

System command execution with safety patterns. **Requires confirmation** before execution.

**Parameters:**

- `command` (required): Terminal command to execute with arguments

**Security Features:**

- Requires user confirmation before execution
- Command validation against dangerous patterns
- Execution timeout limits
- Output size limits
- Environment isolation

**Example:**

```javascript
{
    "tool_name": "execute_terminal",
    "parameters": {
        "command": "npm test"
    }
}
```

#### execute_script

JavaScript execution in sandboxed environment with AI safety assessment. **Requires confirmation** before execution.

**Parameters:**

- `script` (required): JavaScript code to execute
- `timeout` (optional): Execution timeout in milliseconds (default: 10000, range: 1000-30000)

**Security Features:**

- Requires user confirmation before execution
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
        "timeout": 5000
    }
}
```

### Utilities

#### get_time

Current time and date information with flexible formatting.

**Parameters:**

- `format` (optional): Time format ('iso', 'unix', 'readable', 'custom') (default: 'iso')
- `timezone` (optional): Timezone for formatting (default: 'local')
- `custom_format` (optional): Custom date format string when format is 'custom'

**Example:**

```javascript
{
    "tool_name": "get_time",
    "parameters": {
        "format": "custom",
        "timezone": "UTC",
        "custom_format": "YYYY-MM-DD HH:mm:ss"
    }
}
```

#### calculate

Mathematical calculations and expressions with advanced functions.

**Parameters:**

- `expression` (required): Mathematical expression to evaluate
- `precision` (optional): Decimal precision (default: 6, range: 0-15)

**Security Features:**

- Expression validation
- Safe evaluation (no code execution)
- Result validation
- Precision limits

**Supported Functions:**
- Basic arithmetic: +, -, *, /, %
- Trigonometry: sin, cos, tan, asin, acos, atan
- Logarithms: log, log10, log2
- Powers: pow, sqrt, cbrt
- Constants: pi, e

**Example:**

```javascript
{
    "tool_name": "calculate",
    "parameters": {
        "expression": "sin(pi/2) + sqrt(16)",
        "precision": 4
    }
}
```

### Agent Management

#### spawn_agent

Creates and starts a new specialized AI agent for delegating sub-tasks.

**Parameters:**

- `role_name` (required): Role of the new agent (must be in current role's enabled_agents)
- `task_prompt` (required): Detailed task description for the new agent

**Features:**

- Independent conversation history and cost tracking
- Automatic result handoff via return_results
- Hierarchical agent relationships

**Example:**

```javascript
{
    "tool_name": "spawn_agent",
    "parameters": {
        "role_name": "test_writer",
        "task_prompt": "Write comprehensive unit tests for the user authentication module"
    }
}
```

#### despawn_agent

Removes completed, failed, or inactive agents to free up system resources.

**Parameters:**

- `agent_id` (required): ID of agent to despawn (must be direct child)

**Security Features:**

- Only parent can despawn child agents
- Target must be completed/failed/inactive
- Cannot despawn agents with children

**Example:**

```javascript
{
    "tool_name": "despawn_agent",
    "parameters": {
        "agent_id": "agent-123"
    }
}
```

#### speak_to_agent

Sends follow-up messages to previously spawned agents.

**Parameters:**

- `agent_id` (required): ID of target agent
- `message` (required): Message to send to the agent

**Usage Notes:**

- Check agent status first with get_agents
- Only inactive/completed agents can receive messages
- Don't disturb running agents

**Example:**

```javascript
{
    "tool_name": "speak_to_agent",
    "parameters": {
        "agent_id": "agent-123",
        "message": "Please also add integration tests for the API endpoints"
    }
}
```

#### get_agents

Lists all agents in the system with their current status.

**Parameters:**

- `include_completed` (optional): Include completed agents (default: true)

**Response includes:**

- Agent ID, role name, and status
- Creation time and task summary
- Parent-child relationships
- Result availability

**Example:**

```javascript
{
    "tool_name": "get_agents",
    "parameters": {
        "include_completed": false
    }
}
```

### Task Management

#### list_tasks

Lists all tasks in hierarchical format showing structure and status.

**Parameters:**

- `format` (optional): 'short' or 'detailed' (default: 'short')
- `status_filter` (optional): Filter by status ('not_started', 'in_progress', 'completed', 'cancelled')

**Features:**

- Hierarchical display with indentation
- Status and target role information
- Task count summaries

**Example:**

```javascript
{
    "tool_name": "list_tasks",
    "parameters": {
        "format": "detailed",
        "status_filter": "in_progress"
    }
}
```

#### edit_tasks

Creates new tasks or updates existing ones in the task management system.

**Parameters:**

- `task_id` (optional): ID of existing task to update
- `title` (required): Task title
- `description` (required): Detailed task description
- `parent` (optional): Parent task ID for hierarchy
- `status` (optional): Task status
- `target_role` (optional): Role that should handle this task

**Features:**

- Validates parent relationships
- Outputs updated task list
- Does not spawn agents automatically

**Example:**

```javascript
{
    "tool_name": "edit_tasks",
    "parameters": {
        "title": "Implement user authentication",
        "description": "Create login/logout functionality with JWT tokens",
        "parent": "task-1",
        "status": "not_started",
        "target_role": "backend_developer"
    }
}
```

#### get_tasks

Retrieves detailed information about specific tasks by their IDs.

**Parameters:**

- `task_ids` (required): Array of task IDs to retrieve
- `include_children` (optional): Include child task information (default: false)
- `include_parent_chain` (optional): Include parent hierarchy (default: false)

**Features:**

- Batch retrieval of multiple tasks
- Hierarchical relationship data
- Comprehensive task metadata

**Example:**

```javascript
{
    "tool_name": "get_tasks",
    "parameters": {
        "task_ids": ["task-1", "task-2"],
        "include_children": true,
        "include_parent_chain": true
    }
}
```

### Knowledge Management

#### read_knowledgebase

Reads the current content of the shared knowledgebase for agent coordination.

**Parameters:**

- None required

**Features:**

- Access to shared information between agents
- Multiline string content
- Real-time coordination data

**Example:**

```javascript
{
    "tool_name": "read_knowledgebase",
    "parameters": {}
}
```

#### update_knowledgebase

Updates the shared knowledgebase with new information for agent coordination.

**Parameters:**

- `operation` (required): 'override', 'append', or 'remove'
- `content` (required): Content to add, replace, or remove
- `description` (optional): Description of the update

**Features:**

- Shared state between all agents
- Multiple update operations
- Automatic whitespace cleanup

**Example:**

```javascript
{
    "tool_name": "update_knowledgebase",
    "parameters": {
        "operation": "append",
        "content": "Database schema updated with new user_preferences table",
        "description": "Schema change notification"
    }
}
```

### Coordination Tools

#### return_results

Used by worker agents to formally complete tasks and return results to supervisor.

**Parameters:**

- `result` (required): Structured result object with:
  - `status` (required): 'success', 'failure', or 'partial'
  - `summary` (required): Detailed work summary
  - `artifacts` (required): Array of file changes with descriptions
  - `known_issues` (required): Array of remaining issues

**Features:**

- Formal task completion mechanism
- Structured result handoff
- File artifact tracking

**Example:**

```javascript
{
    "tool_name": "return_results",
    "parameters": {
        "result": {
            "status": "success",
            "summary": "Successfully implemented user authentication with JWT tokens",
            "artifacts": [
                {
                    "file_path": "src/auth.js",
                    "description": "New authentication module",
                    "change_type": "created"
                }
            ],
            "known_issues": []
        }
    }
}
```

#### multicall

Executes multiple tool calls in a single operation for efficiency.

**Parameters:**

- `tool_calls` (required): Array of tool call objects with:
  - `function_name` (required): Name of tool to call
  - `arguments` (required): JSON string of parameters

**Features:**

- Sequential execution of multiple tools
- Aggregated results
- Efficient for read-only operations

**Example:**

```javascript
{
    "tool_name": "multicall",
    "parameters": {
        "tool_calls": [
            {
                "function_name": "list_tasks",
                "arguments": "{\"format\": \"short\"}"
            },
            {
                "function_name": "get_agents",
                "arguments": "{\"include_completed\": false}"
            }
        ]
    }
}
```

---

_For information about developing new tools, see the [Tool Development Guide](../development/tools-development.md)._
