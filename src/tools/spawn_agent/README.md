# Spawn Agent Tool

## Overview

The `spawn_agent` tool creates new AI agent instances with specific roles that can work independently on tasks. This enables delegation of work to specialized agents and parallel processing of different tasks.

## Features

- **Role-based Agent Creation**: Spawn agents with specific roles (coder, reviewer, tester, etc.)
- **Independent Operation**: Each agent has its own conversation context and capabilities
- **Parent-Child Relationships**: Tracks which agent spawned which, enabling proper cleanup
- **Task Assignment**: Assign specific tasks and descriptions to agents
- **Custom Contexts**: Optionally specify custom context names for agent communication

## Usage

### Basic Usage

```javascript
// Spawn a coder agent for writing tests
{
    "agent_role": "coder",
    "task_description": "Write unit tests for the user authentication module"
}
```

### Advanced Usage

```javascript
// Spawn an agent with custom context
{
    "agent_role": "reviewer",
    "task_description": "Review code for security vulnerabilities",
    "context_name": "security-review-context"
}
```

## Parameters

### Required Parameters

- **agent_role** (string): The role/type of agent to spawn

    - Must exist in the system's role configuration
    - Examples: 'coder', 'reviewer', 'tester', 'analyst', 'writer'
    - Use `/roles` command to see available roles

- **task_description** (string): Clear description of the task or purpose
    - Helps track why the agent was created
    - Used for logging and management
    - Examples: 'Review code for security issues', 'Write unit tests'

### Optional Parameters

- **context_name** (string): Custom name for the agent's conversation context
    - If not provided, a unique context is automatically created
    - Use when multiple agents should share the same conversation context

## Response Format

### Success Response

```json
{
    "success": true,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "tool_name": "spawn_agent",
    "agent_id": "agent-1704110400000-abc123def",
    "agent_role": "coder",
    "context_name": "agent-1704110400000-abc123def-context",
    "created_at": "2024-01-01T12:00:00.000Z",
    "task_description": "Write unit tests for the user authentication module",
    "parent_agent_id": "main-session",
    "message": "Successfully spawned coder agent with ID agent-1704110400000-abc123def. Use speak_to_agent tool to communicate with it, or despawn_agent tool to remove it when the task is complete."
}
```

### Error Response

```json
{
    "success": false,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "tool_name": "spawn_agent",
    "error": "Unknown agent role: invalid-role. Available roles can be checked with /roles command."
}
```

## Related Tools

- **speak_to_agent**: Send messages to spawned agents
- **despawn_agent**: Remove agents when tasks are complete
- **get_agents**: List active agents (if available)

## Examples

### Example 1: Code Review Agent

```javascript
{
    "agent_role": "reviewer",
    "task_description": "Review the authentication module for security vulnerabilities and code quality issues"
}
```

### Example 2: Testing Agent

```javascript
{
    "agent_role": "tester",
    "task_description": "Create comprehensive unit tests for the payment processing system"
}
```

### Example 3: Documentation Agent

```javascript
{
    "agent_role": "writer",
    "task_description": "Write API documentation for the new user management endpoints"
}
```

## Best Practices

1. **Clear Task Descriptions**: Always provide specific, actionable task descriptions
2. **Appropriate Roles**: Choose roles that match the task requirements
3. **Resource Management**: Use `despawn_agent` to clean up agents when tasks are complete
4. **Communication**: Use `speak_to_agent` to provide additional context or instructions
5. **Context Sharing**: Use custom context names when agents need to collaborate

## Security

- **Parent Validation**: Only the agent that spawned another agent can despawn it
- **Role Restrictions**: Agents are limited by their role's tool access and capabilities
- **Resource Limits**: System may limit the number of concurrent agents

## Troubleshooting

### Common Errors

- **"Unknown agent role"**: The specified role doesn't exist. Use `/roles` to see available roles
- **"Agent management system not available"**: The AgentManager is not initialized
- **"Agent role cannot be empty"**: Provide a valid, non-empty agent role
- **"Task description cannot be empty"**: Provide a meaningful task description

### Tips

- Check available roles with `/roles` command before spawning
- Keep track of spawned agent IDs for later communication
- Use descriptive task descriptions for better agent performance
- Clean up agents promptly to free system resources
