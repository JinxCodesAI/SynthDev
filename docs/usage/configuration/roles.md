# AI Roles Configuration

AI roles define how SynthDev behaves in different contexts. They control system messages, tool access, personality traits, and specialized capabilities. SynthDev supports both **non-agentic** (traditional) and **agentic** (agent-spawning) roles with a flexible multi-file system.

## Role Types

### Non-Agentic Roles
Traditional AI roles that operate in a single conversation context:
- Execute tools directly in the main conversation
- Cannot spawn other agents
- Suitable for direct user interaction
- Examples: `developer`, `tester`, `reviewer`

### Agentic Roles
Advanced roles that can spawn and manage other AI agents:
- Can create specialized worker agents for subtasks
- Manage agent hierarchies and communication
- Coordinate complex multi-agent workflows
- Must have `enabled_agents` property configured
- Examples: `pm` (project manager), `architect`

**Key Difference**: Agentic roles use the AgentManager system to spawn isolated AgentProcess instances, each with their own conversation history and tool execution context.

## Role System Structure

### File Organization
```
src/config/roles/
├── core.json                    # Core non-agentic roles
├── agentic/                     # Agentic workflow roles
│   ├── team-roles.agentic.json  # Team coordination roles
│   └── team-roles.simpleflow.json # Simple workflow roles
├── specialized/                 # Specialized domain roles
│   └── testing-roles.testing.json # Testing-focused roles
├── internal/                    # Internal system roles
│   └── core.internal.json       # Core internal roles
└── test/                        # Test and example roles
    └── grocery-workflow.testing.json # Example workflow
```

### Role Loading System
- **Multi-file support**: Organize roles across multiple JSON files
- **Automatic discovery**: All `.json` files in roles directory are loaded
- **Group organization**: Use filename patterns like `name.group.json`
- **Hierarchical structure**: Support for subdirectories
- **Backward compatibility**: Legacy `roles.json` still supported
- **Agentic detection**: Roles with `enabled_agents` array are automatically classified as agentic

## Role Definition

### Complete Role Structure
```json
{
  "role_name": {
    "level": "base",
    "systemMessage": "You are a helpful assistant specialized in...",
    "excludedTools": ["dangerous_tool"],
    "includedTools": null,
    "parsingTools": [],
    "reminder": "Remember to follow best practices",
    "examples": [
      {
        "role": "user",
        "content": "Example user input"
      },
      {
        "role": "assistant",
        "content": "Example AI response"
      }
    ],
    "enabled_agents": [],
    "can_create_tasks_for": [],
    "return_results": false,
    "metadata": {
      "description": "Role description",
      "version": "1.0",
      "author": "Author name",
      "tags": ["category1", "category2"]
    }
  }
}
```

### Role Properties

#### Core Properties
- **`level`**: Model tier to use (string: "base", "smart", "fast")
- **`systemMessage`**: Primary instructions for the AI (string, required)
- **`reminder`**: Additional context shown during tool execution (string, optional)
- **`examples`**: Few-shot prompting examples (array of message objects, optional)

#### Tool Control Properties
- **`excludedTools`**: Tools this role cannot access (array of strings, optional)
- **`includedTools`**: Tools this role can access - mutually exclusive with excludedTools (array of strings or null, optional)
- **`parsingTools`**: Special tools for structured output parsing only (array of strings, optional)

#### Agentic Properties (for agentic roles only)
- **`enabled_agents`**: List of agent role names this role can spawn (array of strings, required for agentic roles)
- **`can_create_tasks_for`**: Roles this role can create tasks for (array of strings, optional)
- **`return_results`**: Whether role should return structured results when completing tasks (boolean, default: false)
- **`agent_description`**: Brief description of the agent's purpose for coordination (string, optional)

#### Metadata Properties
- **`metadata.description`**: Human-readable role description (string, optional)
- **`metadata.version`**: Role configuration version (string, optional)
- **`metadata.author`**: Role author information (string, optional)
- **`metadata.tags`**: Role categorization tags (array of strings, optional)

#### Example Message Structure
Each example in the `examples` array must have:
- **`role`**: Message sender (string: "user", "assistant", "system")
- **`content`**: Message text content (string)

## Available Tools

SynthDev provides a comprehensive set of tools that can be controlled per role. Tools are organized by category:

### File System Tools
- **`read_files`**: Read contents of one or multiple files
- **`write_file`**: Write content to a file (creates or overwrites)
- **`edit_file`**: Edit existing files with find/replace operations
- **`list_directory`**: List files and directories with filtering options

### Code Analysis Tools
- **`exact_search`**: Search for exact text patterns across files
- **`explain_codebase`**: Analyze and explain code structure and functionality
- **`calculate`**: Perform mathematical calculations and data analysis

### Execution Tools
- **`execute_script`**: Execute scripts with safety validation
- **`execute_terminal`**: Execute terminal commands with safety checks

### Agentic Tools (for agentic roles only)
- **`spawn_agent`**: Create new specialized worker agents
- **`speak_to_agent`**: Send messages to existing agents
- **`get_agents`**: List all agents and their status
- **`despawn_agent`**: Terminate specific agents
- **`return_results`**: Return structured results to supervisor (worker agents)

### Coordination Tools
- **`update_knowledgebase`**: Share information in shared knowledge base
- **`read_knowledgebase`**: Read shared knowledge base content
- **`get_tasks`**: List current tasks
- **`list_tasks`**: List tasks with filtering
- **`edit_tasks`**: Modify task information

### Utility Tools
- **`get_time`**: Get current date and time
- **`multicall`**: Execute multiple tool calls in a single operation

### Tool Access Control

#### Exclusion Patterns
```json
{
  "excludedTools": [
    "exact_tool_name",           // Exact match
    "*file",                     // Wildcard: ends with "file"
    "execute_*",                 // Wildcard: starts with "execute_"
    "/^dangerous_/i"             // Regex: case-insensitive match
  ]
}
```

#### Inclusion Patterns
```json
{
  "includedTools": [
    "read_files",
    "write_file",
    "list_*",                    // All list tools
    "/^safe_/"                   // All tools starting with "safe_"
  ]
}
```

#### Agentic Tool Restrictions
- **Agentic tools** (`spawn_agent`, `speak_to_agent`, `get_agents`, `despawn_agent`) are automatically available only to agentic roles
- **`return_results`** is automatically available only to worker agents (spawned agents)
- Non-agentic roles cannot access agentic tools even if explicitly included

## Role Examples

### Non-Agentic Role Example: Development Assistant
```json
{
  "developer": {
    "level": "base",
    "systemMessage": "You are an expert software developer assistant. Help with coding, debugging, and development best practices.",
    "excludedTools": ["execute_terminal", "spawn_agent"],
    "reminder": "Always consider security and performance implications",
    "examples": [
      {
        "role": "user",
        "content": "Help me debug this Python function"
      },
      {
        "role": "assistant",
        "content": "I'll help you debug that function. Let me examine the code and identify potential issues."
      }
    ]
  }
}
```

### Non-Agentic Role Example: Security Auditor
```json
{
  "security_auditor": {
    "level": "smart",
    "systemMessage": "You are a security expert focused on identifying vulnerabilities and security best practices.",
    "excludedTools": ["execute_*", "write_file", "spawn_agent"],
    "reminder": "Always prioritize security and never execute potentially dangerous code",
    "examples": [
      {
        "role": "user",
        "content": "Review this code for security issues"
      },
      {
        "role": "assistant",
        "content": "I'll perform a thorough security review, checking for common vulnerabilities and security anti-patterns."
      }
    ]
  }
}
```

### Agentic Role Example: Project Manager
```json
{
  "pm": {
    "level": "base",
    "agent_description": "responsible for coordinating projects, creates tasks and validates their completion",
    "systemMessage": "You are a Project Manager responsible for coordinating software development projects. You excel at pointing out what is missing and what is not done correctly, managing timelines, and ensuring quality deliverables. Use update_knowledgebase to share what you have learned about the project.",
    "enabled_agents": ["architect", "developer", "tester"],
    "can_create_tasks_for": ["architect", "developer"],
    "includedTools": ["read_files", "list_directory", "exact_search", "multicall", "update_knowledgebase"],
    "reminder": "Coordinate effectively and ensure clear communication between team members"
  }
}
```

### Agentic Role Example: Architect
```json
{
  "architect": {
    "level": "smart",
    "agent_description": "designs system architecture and coordinates implementation",
    "systemMessage": "You are a Software Architect responsible for designing system architecture, making technical decisions, and coordinating implementation across development teams.",
    "enabled_agents": ["developer", "tester"],
    "can_create_tasks_for": ["developer"],
    "includedTools": ["read_files", "write_file", "list_directory", "explain_codebase", "update_knowledgebase"],
    "reminder": "Focus on scalable, maintainable architecture and clear technical specifications"
  }
}
```

## Agentic Workflow System

### How Agentic Roles Work

1. **Agent Spawning**: Agentic roles use `spawn_agent` to create specialized worker agents
2. **Isolated Execution**: Each spawned agent runs in its own AgentProcess with separate conversation history
3. **Task Delegation**: Supervisor agents delegate specific subtasks to appropriate worker agents
4. **Result Collection**: Worker agents use `return_results` to pass structured results back to supervisors
5. **Communication**: Supervisors can send follow-up messages using `speak_to_agent`
6. **Monitoring**: Use `get_agents` to monitor agent status and progress

### Agent Lifecycle

#### Agent States
- **`running`**: Agent is actively processing (cannot receive messages)
- **`inactive`**: Agent is waiting for instructions (can receive messages)
- **`completed`**: Agent finished successfully with results (can receive follow-up messages)
- **`failed`**: Agent encountered an error (cannot receive messages)

#### Workflow Example
```
1. User interacts with agentic role (e.g., "pm")
2. PM spawns architect: spawn_agent("architect", "Design user authentication system")
3. Architect analyzes requirements and spawns developer: spawn_agent("developer", "Implement JWT authentication")
4. Developer completes work and calls: return_results({status: "success", summary: "...", artifacts: [...]})
5. Architect reviews results and may spawn tester or return own results
6. PM coordinates overall project completion
```

### Permission System

#### Spawn Permissions
- Roles can only spawn agents listed in their `enabled_agents` array
- User can spawn any agentic role (roles with `enabled_agents` configured)
- Permission validation occurs at spawn time

#### Tool Access
- Agentic tools are automatically available to agentic roles
- `return_results` is automatically available to spawned worker agents
- Standard tool filtering still applies via `includedTools`/`excludedTools`

## Role Groups

### Group Organization
Use filename patterns to organize roles:
- `core.json` → Global roles
- `testing.testing.json` → Testing group
- `agentic.workflow.json` → Workflow group

### Group Access
```javascript
// Access by full name
const role = roles['testing.unit_tester'];

// Access by simple name (if no conflicts)
const role = roles['unit_tester'];

// List roles in group
const testingRoles = roleGroups['testing'];
```

## Multi-File Organization

### File Structure Example
```
roles/
├── core.json                   # Global roles
├── development/
│   ├── backend.dev.json        # Backend development roles
│   ├── frontend.dev.json       # Frontend development roles
│   └── devops.dev.json         # DevOps roles
├── testing/
│   ├── unit.testing.json       # Unit testing roles
│   ├── integration.testing.json # Integration testing roles
│   └── e2e.testing.json        # End-to-end testing roles
└── specialized/
    ├── security.security.json  # Security roles
    ├── data.data.json          # Data science roles
    └── ml.ml.json              # Machine learning roles
```

### Loading Behavior
1. **Legacy support**: `roles.json` loaded first if present
2. **Automatic discovery**: All `.json` files recursively scanned
3. **Group assignment**: Based on filename pattern
4. **Conflict resolution**: Group-prefixed names for conflicts
5. **Caching**: Configurations cached for performance

## Advanced Features

### Few-Shot Prompting
```json
{
  "examples": [
    {
      "role": "user",
      "content": "Implement a binary search algorithm"
    },
    {
      "role": "assistant",
      "content": "I'll implement an efficient binary search with proper error handling:\n\n```python\ndef binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    \n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    \n    return -1\n```"
    }
  ]
}
```

### Dynamic Tool Assignment
```json
{
  "conditional_tools": {
    "level": "base",
    "systemMessage": "You adapt your tool usage based on the task context.",
    "excludedTools": ["execute_*"],
    "conditionalIncludes": {
      "when_testing": ["execute_script"],
      "when_safe": ["execute_terminal"]
    }
  }
}
```

## Best Practices

### Role Design
1. **Clear purpose**: Each role should have a specific, well-defined purpose
2. **Appropriate tools**: Only include necessary tools for the role
3. **Security first**: Exclude dangerous tools unless absolutely necessary
4. **Good examples**: Provide relevant few-shot examples

### Organization
1. **Logical grouping**: Group related roles together
2. **Consistent naming**: Use clear, descriptive role names
3. **Documentation**: Comment complex role configurations
4. **Version control**: Track role changes over time

### Performance
1. **Minimal examples**: Keep few-shot examples concise but effective
2. **Tool efficiency**: Only include tools the role actually needs
3. **Caching**: Leverage the built-in configuration caching

## Troubleshooting

### Common Issues
- **Role not found**: Check filename and JSON syntax
- **Tool conflicts**: Verify excludedTools vs includedTools
- **Group conflicts**: Use full role names when conflicts exist
- **Loading errors**: Check JSON validation and file permissions

### Debug Tips
```bash
# Enable detailed logging
SYNTHDEV_VERBOSITY_LEVEL=3

# Check role loading
grep "Loaded roles from" logs/synthdev.log

# Validate JSON syntax
jq . src/config/roles/your-role.json
```

## Next Steps

- [Tools and Safety](./tools.md) - Configure tool behavior and security
- [Snapshots](./snapshots.md) - Configure snapshot system for role-specific workflows
- [Advanced Configuration](./advanced.md) - Programmatic role management
