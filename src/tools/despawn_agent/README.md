# Despawn Agent Tool

## Overview

The `despawn_agent` tool removes previously spawned AI agents when their tasks are completed. This tool provides secure cleanup of agent resources with parent validation to ensure only the agent that spawned another agent can remove it.

## Features

- **Secure Removal**: Only the parent agent can despawn its child agents
- **Resource Cleanup**: Properly cleans up agent contexts and associated resources
- **Audit Trail**: Logs despawn actions with reasons for tracking
- **Validation**: Ensures agent exists before attempting removal
- **Parent-Child Security**: Prevents unauthorized agent termination

## Usage

### Basic Usage

```javascript
// Despawn an agent when task is complete
{
    "agent_id": "agent-1704110400000-abc123def"
}
```

### With Custom Reason

```javascript
// Despawn with specific reason for audit trail
{
    "agent_id": "agent-1704110400000-abc123def",
    "reason": "Code review completed successfully"
}
```

## Parameters

### Required Parameters

- **agent_id** (string): The unique identifier of the agent to despawn
    - This is the `agent_id` returned when the agent was spawned
    - Must be a valid, existing agent ID
    - Cannot be empty or whitespace

### Optional Parameters

- **reason** (string): Reason for despawning the agent
    - Default: "Task completed"
    - Used for logging and audit trails
    - Examples: "Task completed successfully", "Agent no longer needed", "Switching to different approach"

## Response Format

### Success Response

```json
{
    "success": true,
    "timestamp": "2024-01-01T12:30:00.000Z",
    "tool_name": "despawn_agent",
    "agent_id": "agent-1704110400000-abc123def",
    "agent_role": "coder",
    "despawned_at": "2024-01-01T12:30:00.000Z",
    "reason": "Task completed successfully",
    "parent_agent_id": "main-session",
    "message": "Successfully despawned coder agent agent-1704110400000-abc123def. All associated resources have been cleaned up."
}
```

### Error Response

```json
{
    "success": false,
    "timestamp": "2024-01-01T12:30:00.000Z",
    "tool_name": "despawn_agent",
    "error": "Access denied: Agent agent-123 can only be despawned by its parent parent-agent-456, not requesting-agent-789"
}
```

## Security Model

### Parent Validation

The tool enforces strict parent-child relationships:

1. **Spawn Tracking**: When an agent is spawned, the parent-child relationship is recorded
2. **Despawn Authorization**: Only the parent agent can despawn its child agents
3. **Access Denial**: Attempts to despawn agents by non-parents are rejected
4. **Audit Logging**: All despawn attempts are logged for security monitoring

### Example Security Scenarios

```javascript
// ✅ ALLOWED: Parent despawning its child
Parent Agent A spawns Agent B
Parent Agent A calls despawn_agent with Agent B's ID → SUCCESS

// ❌ DENIED: Non-parent attempting despawn
Parent Agent A spawns Agent B
Different Agent C calls despawn_agent with Agent B's ID → ACCESS DENIED

// ❌ DENIED: Agent attempting to despawn itself
Agent B calls despawn_agent with its own ID → ACCESS DENIED (unless it's the parent)
```

## Related Tools

- **spawn_agent**: Create new AI agents
- **speak_to_agent**: Communicate with spawned agents
- **get_agents**: List active agents (if available)

## Examples

### Example 1: Task Completion

```javascript
// After a code review is completed
{
    "agent_id": "agent-reviewer-123",
    "reason": "Code review completed - no issues found"
}
```

### Example 2: Strategy Change

```javascript
// When switching approaches
{
    "agent_id": "agent-tester-456",
    "reason": "Switching from unit tests to integration tests"
}
```

### Example 3: Resource Management

```javascript
// When cleaning up unused agents
{
    "agent_id": "agent-analyst-789",
    "reason": "Analysis no longer needed for current sprint"
}
```

## Best Practices

1. **Timely Cleanup**: Despawn agents promptly when tasks are complete
2. **Meaningful Reasons**: Provide clear reasons for audit trails
3. **Verify Completion**: Ensure agent tasks are actually finished before despawning
4. **Resource Management**: Don't leave agents running unnecessarily
5. **Communication**: Inform agents of completion before despawning if needed

## Common Errors

### Agent Not Found

```json
{
    "error": "Agent agent-nonexistent-123 not found"
}
```

**Solution**: Verify the agent ID is correct and the agent hasn't already been despawned.

### Access Denied

```json
{
    "error": "Access denied: Agent agent-123 can only be despawned by its parent parent-456, not requesting-789"
}
```

**Solution**: Only the agent that spawned another agent can despawn it. Check which agent originally created the target agent.

### Empty Agent ID

```json
{
    "error": "Agent ID cannot be empty"
}
```

**Solution**: Provide a valid, non-empty agent ID.

### System Not Available

```json
{
    "error": "Agent management system not available. This feature requires the AgentManager to be initialized."
}
```

**Solution**: Ensure the AgentManager is properly initialized in the system.

## Workflow Integration

### Typical Agent Lifecycle

1. **Spawn**: Use `spawn_agent` to create an agent for a specific task
2. **Communicate**: Use `speak_to_agent` to provide instructions and get updates
3. **Monitor**: Track agent progress and completion
4. **Despawn**: Use `despawn_agent` when the task is complete

### Example Workflow

```javascript
// 1. Spawn agent for code review
spawn_agent({
    agent_role: 'reviewer',
    task_description: 'Review authentication module',
});
// Returns: { agent_id: "agent-reviewer-123", ... }

// 2. Provide code to review
speak_to_agent({
    agent_id: 'agent-reviewer-123',
    message: 'Please review the code in src/auth/login.js',
});

// 3. Get review results
speak_to_agent({
    agent_id: 'agent-reviewer-123',
    message: 'What issues did you find?',
});

// 4. Clean up when done
despawn_agent({
    agent_id: 'agent-reviewer-123',
    reason: 'Code review completed successfully',
});
```

## Troubleshooting

- **Double-check agent IDs**: Ensure you're using the correct agent ID from the spawn response
- **Verify parentage**: Only the spawning agent can despawn child agents
- **Check agent status**: Agents may have already been despawned
- **System initialization**: Ensure AgentManager is properly set up
