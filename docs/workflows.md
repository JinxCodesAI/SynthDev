# SynthDev Multi-Agent Workflows

This guide covers SynthDev's multi-agent workflow system, including configuration, development, and execution of complex AI-powered workflows.

## Overview

SynthDev's workflow system enables complex multi-agent interactions where different AI personas collaborate to accomplish sophisticated tasks. The system provides state machine execution, shared context management, and custom script integration.

### Key Features

- **🤖 Multi-Agent Orchestration**: Multiple AI agents with different roles working together
- **🔄 State Machine Execution**: Structured workflow with defined states and transitions
- **💬 Shared Context Management**: Agents share conversation context with role-based message mapping
- **📝 Custom Script Integration**: JavaScript functions for complex workflow logic
- **🎯 Parsing Tools**: Structured output handling for decision-making
- **📊 Execution Tracking**: Detailed logging and state history

## Workflow Architecture

### Core Components

#### WorkflowStateMachine (`src/workflow/WorkflowStateMachine.js`)

Main orchestrator that manages:

- Agent lifecycle and execution
- State transitions and flow control
- Context synchronization between agents
- Execution tracking and logging
- Error handling and recovery

#### WorkflowAgent (`src/workflow/WorkflowAgent.js`)

Individual AI agent instances that handle:

- Role-specific configuration and behavior
- API client management and communication
- Tool filtering and access control
- Parsing tool responses for structured output

#### WorkflowContext (`src/workflow/WorkflowContext.js`)

Shared conversation context that provides:

- Role-based message mapping and filtering
- Message length management and truncation
- Context isolation between different conversation threads

#### WorkflowConfig (`src/workflow/WorkflowConfig.js`)

Configuration validation and management:

- Script module loading and validation
- State and transition validation
- Agent setup and configuration

## Workflow Configuration

### Directory Structure

```
src/config/workflows/
├── grocery_store_test.json          # Workflow configuration
├── grocery_store_test/              # Workflow scripts directory
│   └── script.js                    # Custom JavaScript functions
├── my_workflow.json                 # Another workflow
└── my_workflow/
    └── script.js
```

### Basic Workflow Configuration

Create a workflow configuration file in `src/config/workflows/`:

```json
{
    "workflow_name": "example_workflow",
    "description": "Example multi-agent workflow demonstrating basic concepts",
    "input": {
        "name": "user_request",
        "type": "string",
        "description": "User's initial request or question"
    },
    "output": {
        "name": "final_result",
        "type": "string",
        "description": "Final workflow result or answer"
    },
    "variables": {
        "max_iterations": 5,
        "confidence_threshold": 0.8
    },
    "contexts": [
        {
            "name": "shared_context",
            "starting_messages": [],
            "max_length": 30000
        }
    ],
    "agents": [
        {
            "agent_role": "coder",
            "context": "shared_context",
            "role": "assistant"
        },
        {
            "agent_role": "reviewer",
            "context": "shared_context",
            "role": "user"
        }
    ],
    "states": [
        {
            "name": "start",
            "agent": "coder",
            "pre_handler": "setupInitialRequest",
            "post_handler": "captureCoderResponse",
            "transition_handler": "decideNextStep"
        },
        {
            "name": "review",
            "agent": "reviewer",
            "pre_handler": "setupReviewRequest",
            "post_handler": "captureReviewResponse",
            "transition_handler": "checkIfComplete"
        },
        {
            "name": "stop",
            "input": "common_data.final_result"
        }
    ]
}
```

### Configuration Properties

#### Workflow Metadata

- **workflow_name**: Unique identifier for the workflow
- **description**: Human-readable description of the workflow purpose
- **input**: Definition of workflow input parameters
- **output**: Definition of expected workflow output

#### Variables

- **variables**: Global variables accessible throughout the workflow
- Used for configuration, thresholds, and shared state

#### Contexts

- **contexts**: Shared conversation contexts between agents
- **name**: Unique identifier for the context
- **starting_messages**: Initial messages to seed the context
- **max_length**: Maximum context length before truncation

#### Agents

- **agents**: AI agents participating in the workflow
- **agent_role**: Role name from the AI roles configuration
- **context**: Which context this agent uses
- **role**: Agent's role in conversations ('assistant' or 'user')

#### States

- **states**: Workflow states and transitions
- **name**: Unique state identifier
- **agent**: Which agent executes this state
- **pre_handler**: Function to call before API request
- **post_handler**: Function to call after API response
- **transition_handler**: Function to determine next state

## Custom Script Functions

Create custom JavaScript functions in the workflow's script directory:

### Script Structure

```javascript
// src/config/workflows/example_workflow/script.js
export default {
    // Pre-handler: Setup before API call
    setupInitialRequest() {
        const context = this.workflow_contexts.get('shared_context');
        context.addMessage({
            role: 'user',
            content: this.input,
        });

        // Set initial variables
        this.common_data.iteration_count = 0;
    },

    // Post-handler: Process API response
    captureCoderResponse() {
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (responseContent) {
            this.common_data.coder_response = responseContent;
            this.common_data.iteration_count++;
        }
    },

    // Transition-handler: Decide next state
    decideNextStep() {
        if (this.common_data.iteration_count >= this.variables.max_iterations) {
            return 'stop';
        }

        // Check if response indicates completion
        const response = this.common_data.coder_response || '';
        if (
            response.toLowerCase().includes('complete') ||
            response.toLowerCase().includes('finished')
        ) {
            return 'review';
        }

        return 'start'; // Continue iterating
    },

    setupReviewRequest() {
        const context = this.workflow_contexts.get('shared_context');
        context.addMessage({
            role: 'user',
            content: `Please review this response: ${this.common_data.coder_response}`,
        });
    },

    captureReviewResponse() {
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (responseContent) {
            this.common_data.review_response = responseContent;
        }
    },

    checkIfComplete() {
        const review = this.common_data.review_response || '';
        if (
            review.toLowerCase().includes('approved') ||
            review.toLowerCase().includes('looks good')
        ) {
            this.common_data.final_result = this.common_data.coder_response;
            return 'stop';
        }

        return 'start'; // Need more work
    },
};
```

### Available Context

Script functions have access to:

#### Workflow State

- `this.input`: Workflow input parameters
- `this.variables`: Workflow variables
- `this.common_data`: Shared data between states
- `this.current_state`: Current state information

#### API Responses

- `this.last_response`: Last API response from the agent
- `this.last_request`: Last API request sent to the agent

#### Context Management

- `this.workflow_contexts`: Map of all workflow contexts
- Context methods: `addMessage()`, `getMessages()`, `clear()`

#### Utilities

- `this.logger`: Logging functionality
- `this.config`: Workflow configuration access

## Parsing Tools

Workflows can use parsing tools for structured output and decision-making:

### Configuration

```json
{
    "agents": [
        {
            "agent_role": "decision_maker",
            "context": "shared_context",
            "role": "assistant",
            "parsing_tools": [
                {
                    "name": "make_decision",
                    "description": "Make a structured decision",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "decision": {
                                "type": "string",
                                "enum": ["continue", "stop", "retry"]
                            },
                            "confidence": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 1
                            },
                            "reasoning": {
                                "type": "string"
                            }
                        },
                        "required": ["decision", "confidence"]
                    }
                }
            ]
        }
    ]
}
```

### Using Parsing Tools

```javascript
// In script functions
captureDecision() {
    const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
        const decision = JSON.parse(toolCalls[0].function.arguments);
        this.common_data.decision = decision.decision;
        this.common_data.confidence = decision.confidence;
        this.common_data.reasoning = decision.reasoning;
    }
},

checkDecision() {
    const decision = this.common_data.decision;
    const confidence = this.common_data.confidence || 0;

    if (confidence < this.variables.confidence_threshold) {
        return 'retry';
    }

    return decision === 'continue' ? 'next_state' : 'stop';
}
```

## Execution

### Running Workflows

```bash
# List available workflows
/workflows

# Execute a specific workflow
/workflow grocery_store_test

# Execute with custom input
/workflow example_workflow "Analyze the authentication system"
```

### Execution Flow

1. **Initialization**: Load workflow configuration and validate
2. **Context Setup**: Initialize shared contexts and agents
3. **State Execution**: Execute states in sequence
4. **Agent Interaction**: Agents process requests and generate responses
5. **Script Execution**: Custom functions handle pre/post processing
6. **State Transitions**: Determine next state based on logic
7. **Completion**: Return final result when reaching stop state

### Monitoring Execution

The workflow system provides detailed logging:

```
🔄 Starting workflow: grocery_store_test
📝 Initializing context: customer_worker_interaction
🤖 Setting up agent: customer (role: user)
🤖 Setting up agent: worker (role: assistant)
⚡ Executing state: start
🧠 Agent customer thinking...
✅ State start completed
⚡ Executing state: worker_response
🧠 Agent worker thinking...
✅ State worker_response completed
🎯 Workflow completed successfully
```

## Example: Grocery Store Workflow

The grocery store workflow demonstrates a complete multi-agent interaction:

### Scenario

A customer interacts with a grocery store worker, with decision-making based on customer satisfaction.

### Configuration Highlights

```json
{
    "workflow_name": "grocery_store_test",
    "description": "Multi-agent grocery store customer-worker interaction",
    "contexts": [
        {
            "name": "customer_worker_interaction",
            "starting_messages": [
                {
                    "role": "system",
                    "content": "You are in a grocery store. A customer is approaching a worker for help."
                }
            ],
            "max_length": 30000
        }
    ],
    "agents": [
        {
            "agent_role": "customer",
            "context": "customer_worker_interaction",
            "role": "user",
            "parsing_tools": [
                {
                    "name": "customer_satisfaction",
                    "description": "Rate customer satisfaction",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "satisfied": { "type": "boolean" },
                            "rating": { "type": "integer", "minimum": 1, "maximum": 5 }
                        }
                    }
                }
            ]
        },
        {
            "agent_role": "worker",
            "context": "customer_worker_interaction",
            "role": "assistant"
        }
    ]
}
```

### Key Features Demonstrated

- **Context Sharing**: Both agents share the same conversation context
- **Role Mapping**: Customer acts as 'user', worker as 'assistant'
- **Parsing Tools**: Customer provides structured satisfaction feedback
- **Decision Logic**: Workflow continues based on customer satisfaction
- **State Transitions**: Dynamic flow based on interaction outcomes

## Best Practices

### Workflow Design

1. **Clear Objectives**: Define clear input/output and success criteria
2. **Modular States**: Keep states focused on single responsibilities
3. **Error Handling**: Include error states and recovery mechanisms
4. **Context Management**: Use appropriate context sizes and cleanup
5. **Variable Usage**: Use variables for configuration and thresholds

### Script Development

1. **Defensive Programming**: Check for null/undefined values
2. **Logging**: Use logger for debugging and monitoring
3. **State Validation**: Validate state before transitions
4. **Data Persistence**: Store important data in common_data
5. **Clean Transitions**: Ensure clear state transition logic

### Testing

1. **Unit Tests**: Test individual script functions
2. **Integration Tests**: Test agent interactions
3. **End-to-End Tests**: Test complete workflow execution
4. **Mock Responses**: Use HTTP mocking for consistent testing
5. **Edge Cases**: Test error conditions and edge cases

### Performance

1. **Context Size**: Monitor and manage context length
2. **API Calls**: Minimize unnecessary API requests
3. **State Efficiency**: Avoid redundant state transitions
4. **Memory Usage**: Clean up unused data
5. **Execution Time**: Set appropriate timeouts

## Troubleshooting

### Common Issues

#### Workflow Not Found

```
Error: Workflow 'my_workflow' not found
```

**Solution**: Ensure workflow JSON file exists in `src/config/workflows/`

#### Script Function Error

```
Error: Function 'myFunction' not found in workflow script
```

**Solution**: Check script.js exports and function names

#### Context Overflow

```
Warning: Context 'shared_context' approaching max length
```

**Solution**: Increase max_length or implement context cleanup

#### Agent Configuration Error

```
Error: Agent role 'invalid_role' not found
```

**Solution**: Ensure agent_role exists in AI roles configuration

### Debugging

1. **Increase Verbosity**: Set `SYNTHDEV_VERBOSITY_LEVEL=4` for detailed logs
2. **Check Script Syntax**: Validate JavaScript syntax in script files
3. **Validate Configuration**: Ensure JSON configuration is valid
4. **Test Incrementally**: Start with simple workflows and add complexity
5. **Monitor Context**: Watch context length and message flow

---

_For AI role configuration, see the Configuration guide. For tool usage in workflows, see the Tools guide._
