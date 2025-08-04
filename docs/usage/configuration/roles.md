# AI Roles Configuration

AI roles define how SynthDev behaves in different contexts. They control system messages, tool access, personality traits, and specialized capabilities. SynthDev supports a flexible multi-file role system for easy organization and customization.

## Role System Overview

### Role Structure
```
src/config/roles/
├── core.json                    # Core system roles
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

### Role Loading
- **Multi-file support**: Organize roles across multiple JSON files
- **Automatic discovery**: All `.json` files in roles directory are loaded
- **Group organization**: Use filename patterns like `name.group.json`
- **Hierarchical structure**: Support for subdirectories
- **Backward compatibility**: Legacy `roles.json` still supported

## Role Definition

### Basic Role Structure
```json
{
  "role_name": {
    "level": "base",
    "systemMessage": "You are a helpful assistant specialized in...",
    "excludedTools": ["dangerous_tool"],
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
    ]
  }
}
```

### Role Properties

#### Core Properties
- **`level`**: Model tier (`base`, `smart`, `fast`)
- **`systemMessage`**: Primary instructions for the AI
- **`reminder`**: Additional context during tool execution
- **`examples`**: Few-shot prompting examples

#### Tool Control
- **`excludedTools`**: Tools this role cannot access
- **`includedTools`**: Tools this role can access (mutually exclusive)
- **`parsingTools`**: Special tools for structured output

#### Advanced Properties
- **`enabled_agents`**: List of agents this role can spawn
- **`can_create_tasks_for`**: Roles this role can create tasks for
- **`return_results`**: Whether role should return structured results

## Tool Filtering

### Exclusion Patterns
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

### Inclusion Patterns
```json
{
  "includedTools": [
    "read_file",
    "write_file",
    "list_*",                    // All list tools
    "/^safe_/"                   // All tools starting with "safe_"
  ]
}
```

## Role Examples

### Development Assistant
```json
{
  "developer": {
    "level": "base",
    "systemMessage": "You are an expert software developer assistant. Help with coding, debugging, and development best practices.",
    "excludedTools": ["execute_terminal"],
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

### Testing Specialist
```json
{
  "tester": {
    "level": "smart",
    "systemMessage": "You are a testing specialist focused on quality assurance, test automation, and bug detection.",
    "includedTools": ["read_file", "write_file", "execute_script"],
    "reminder": "Focus on comprehensive test coverage and edge cases",
    "examples": [
      {
        "role": "user",
        "content": "Create unit tests for this module"
      },
      {
        "role": "assistant",
        "content": "I'll create comprehensive unit tests covering all functions and edge cases."
      }
    ]
  }
}
```

### Security Auditor
```json
{
  "security_auditor": {
    "level": "smart",
    "systemMessage": "You are a security expert focused on identifying vulnerabilities and security best practices.",
    "excludedTools": ["execute_*", "write_file"],
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

## Agentic Roles

### Team Coordination
```json
{
  "project_manager": {
    "level": "smart",
    "systemMessage": "You are a project manager coordinating development tasks across team members.",
    "enabled_agents": ["developer", "tester", "reviewer"],
    "can_create_tasks_for": ["developer", "tester"],
    "includedTools": ["spawn_agent", "speak_to_agent", "create_task"],
    "reminder": "Coordinate effectively and ensure clear communication"
  }
}
```

### Workflow Orchestration
```json
{
  "workflow_orchestrator": {
    "level": "base",
    "systemMessage": "You orchestrate complex workflows by coordinating multiple specialized agents.",
    "enabled_agents": ["*"],
    "can_create_tasks_for": ["*"],
    "return_results": true,
    "reminder": "Break down complex tasks into manageable subtasks"
  }
}
```

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
