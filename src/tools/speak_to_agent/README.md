# Speak to Agent Tool

## Overview

The `speak_to_agent` tool enables communication with previously spawned AI agents. It sends messages to specific agents and returns their responses, facilitating delegation of tasks and collaborative work between agents.

## Features

- **Direct Communication**: Send messages to any spawned agent
- **Role-based Responses**: Agents respond according to their specialized roles and capabilities
- **Task Delegation**: Assign specific tasks and get specialized responses
- **Real-time Interaction**: Get immediate responses from agents
- **Context Preservation**: Agents maintain conversation history within their contexts

## Usage

### Basic Communication

```javascript
// Send a simple message to an agent
{
    "agent_id": "agent-1704110400000-abc123def",
    "message": "Please review the code in src/auth/login.js"
}
```

### Task Assignment

```javascript
// Assign a specific task
{
    "agent_id": "agent-coder-123",
    "message": "Write unit tests for the validateEmail function. Include edge cases for invalid formats, empty strings, and special characters."
}
```

### Follow-up Questions

```javascript
// Ask for clarification or additional work
{
    "agent_id": "agent-reviewer-456",
    "message": "What security vulnerabilities did you find? Please provide specific recommendations for each issue."
}
```

## Parameters

### Required Parameters

- **agent_id** (string): The unique identifier of the agent to communicate with

    - Must be a valid agent ID from a previously spawned agent
    - Cannot be empty or whitespace
    - Agent must still be active (not despawned)

- **message** (string): The message to send to the agent
    - Should be clear and specific about what you want the agent to do
    - Cannot be empty or whitespace
    - Agent will respond according to its role and capabilities

## Response Format

### Success Response

```json
{
    "success": true,
    "timestamp": "2024-01-01T12:15:00.000Z",
    "tool_name": "speak_to_agent",
    "agent_id": "agent-1704110400000-abc123def",
    "agent_role": "coder",
    "message_sent": "Please review the code in src/auth/login.js",
    "agent_response": "I've reviewed the login.js file. Here are the issues I found:\n\n1. Missing input validation for email format\n2. Password is logged in plain text on line 45\n3. No rate limiting for failed login attempts\n\nWould you like me to provide specific fixes for these issues?",
    "response_timestamp": "2024-01-01T12:15:00.000Z",
    "message": "Agent agent-1704110400000-abc123def (coder) responded successfully."
}
```

### Error Response

```json
{
    "success": false,
    "timestamp": "2024-01-01T12:15:00.000Z",
    "tool_name": "speak_to_agent",
    "error": "Agent agent-nonexistent-123 not found. Make sure the agent was spawned and hasn't been despawned."
}
```

## Agent Role Behaviors

Different agent roles will respond differently to the same message:

### Coder Agent

- Focuses on implementation details
- Provides code examples and technical solutions
- Considers best practices and performance

### Reviewer Agent

- Analyzes code for issues and improvements
- Identifies security vulnerabilities and bugs
- Suggests refactoring opportunities

### Tester Agent

- Creates test cases and scenarios
- Identifies edge cases and potential failures
- Focuses on quality assurance

### Writer Agent

- Creates documentation and explanations
- Focuses on clarity and completeness
- Structures information logically

## Examples

### Example 1: Code Review Request

```javascript
{
    "agent_id": "agent-reviewer-789",
    "message": "Please review this function for security issues:\n\nfunction authenticateUser(username, password) {\n  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;\n  return database.query(query);\n}"
}
```

**Expected Response**: The reviewer agent would identify SQL injection vulnerabilities and recommend using parameterized queries.

### Example 2: Test Generation

```javascript
{
    "agent_id": "agent-tester-456",
    "message": "Create comprehensive unit tests for a function that validates email addresses. The function should return true for valid emails and false for invalid ones."
}
```

**Expected Response**: The tester agent would create multiple test cases covering valid emails, invalid formats, edge cases, and boundary conditions.

### Example 3: Documentation Request

```javascript
{
    "agent_id": "agent-writer-123",
    "message": "Write API documentation for a REST endpoint that creates new user accounts. Include request/response examples and error codes."
}
```

**Expected Response**: The writer agent would create structured documentation with clear examples, parameter descriptions, and error handling information.

## Best Practices

1. **Clear Instructions**: Be specific about what you want the agent to do
2. **Context Provision**: Provide relevant code, data, or background information
3. **Follow-up Questions**: Ask for clarification or additional details as needed
4. **Role Alignment**: Match your requests to the agent's specialized role
5. **Iterative Communication**: Build on previous responses for complex tasks

## Communication Patterns

### Task Assignment Pattern

```javascript
// 1. Initial task assignment
speak_to_agent({
    agent_id: 'agent-coder-123',
    message: 'Create a user registration function with email validation',
});

// 2. Follow-up with requirements
speak_to_agent({
    agent_id: 'agent-coder-123',
    message: 'Please add password strength validation and duplicate email checking',
});

// 3. Request testing
speak_to_agent({
    agent_id: 'agent-coder-123',
    message: 'Now create unit tests for the registration function',
});
```

### Collaborative Review Pattern

```javascript
// 1. Submit code for review
speak_to_agent({
    agent_id: 'agent-reviewer-456',
    message: 'Please review this implementation: [code here]',
});

// 2. Address feedback
speak_to_agent({
    agent_id: 'agent-reviewer-456',
    message: "I've fixed the issues you mentioned. Please review the updated code: [updated code]",
});

// 3. Final approval
speak_to_agent({
    agent_id: 'agent-reviewer-456',
    message: 'Is this ready for production deployment?',
});
```

## Error Handling

### Common Errors

- **Agent Not Found**: The agent ID doesn't exist or has been despawned
- **Empty Message**: The message parameter is empty or whitespace
- **Communication Failure**: The agent failed to process the message
- **System Unavailable**: The agent management system is not initialized

### Troubleshooting

1. **Verify Agent ID**: Ensure you're using the correct agent ID from the spawn response
2. **Check Agent Status**: Confirm the agent hasn't been despawned
3. **Message Content**: Ensure your message is clear and non-empty
4. **System Status**: Verify the AgentManager is properly initialized

## Related Tools

- **spawn_agent**: Create new AI agents for communication
- **despawn_agent**: Remove agents when communication is complete
- **get_agents**: List active agents and their information

## Integration with Workflows

The `speak_to_agent` tool is central to multi-agent workflows:

1. **Spawn** specialized agents for different tasks
2. **Communicate** with each agent to assign and refine tasks
3. **Coordinate** between agents by sharing information
4. **Monitor** progress through ongoing communication
5. **Despawn** agents when tasks are complete

This enables complex, collaborative AI workflows where different specialized agents work together on larger projects.
