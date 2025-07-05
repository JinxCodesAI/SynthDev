# ADR-003: Adding New Workflows

## Status

Accepted

## Context

SynthDev supports complex multi-agent workflows where different AI personas collaborate through a state machine system. New workflows need to be added following a consistent pattern to ensure proper integration with the workflow system and reliable execution.

## Decision

We will follow a standardized approach for adding new workflows to SynthDev that ensures consistency, maintainability, and proper integration with the existing workflow architecture.

## Workflow Structure

### Directory Organization

Workflows are defined as JSON configuration files in `src/config/workflows/`:

```
src/config/workflows/
├── example_workflow.json           # Simple workflow example
├── complex_workflow/              # Complex workflow with scripts
│   ├── config.json               # Workflow configuration
│   └── script.js                 # Custom JavaScript functions
└── your_workflow.json            # Your new workflow
```

### Basic Workflow Configuration

```json
{
    "workflow_name": "your_workflow",
    "description": "Brief description of what this workflow does",
    "input": {
        "name": "user_request",
        "type": "string",
        "description": "User's request or input"
    },
    "output": {
        "name": "result",
        "type": "string",
        "description": "Final workflow result"
    },
    "variables": {
        "max_iterations": 5,
        "timeout": 30000
    },
    "contexts": [
        {
            "name": "main_context",
            "starting_messages": [],
            "max_length": 1000
        }
    ],
    "agents": [
        {
            "agent_role": "coder",
            "context": "main_context",
            "role": "assistant"
        }
    ],
    "states": [
        {
            "name": "start",
            "agent": "coder",
            "message": "Please help with: {input.user_request}",
            "next_state": "stop"
        },
        {
            "name": "stop"
        }
    ]
}
```

### Advanced Workflow with Custom Scripts

For complex workflows requiring custom logic:

```json
{
    "workflow_name": "advanced_workflow",
    "description": "Advanced workflow with custom script functions",
    "input": {
        "name": "task_description",
        "type": "string",
        "description": "Description of the task to perform"
    },
    "output": {
        "name": "final_result",
        "type": "object",
        "description": "Structured result with analysis and recommendations"
    },
    "variables": {
        "max_iterations": 10,
        "confidence_threshold": 0.8
    },
    "contexts": [
        {
            "name": "analysis_context",
            "starting_messages": [],
            "max_length": 2000
        },
        {
            "name": "implementation_context",
            "starting_messages": [],
            "max_length": 1500
        }
    ],
    "agents": [
        {
            "agent_role": "architect",
            "context": "analysis_context",
            "role": "assistant"
        },
        {
            "agent_role": "coder",
            "context": "implementation_context",
            "role": "assistant"
        }
    ],
    "states": [
        {
            "name": "start",
            "agent": "architect",
            "pre_handler": "initializeAnalysis",
            "message": "Analyze this task: {input.task_description}",
            "post_handler": "processAnalysis",
            "transition_handler": "decideNextStep"
        },
        {
            "name": "implement",
            "agent": "coder",
            "pre_handler": "prepareImplementation",
            "post_handler": "validateImplementation",
            "transition_handler": "checkCompletion"
        },
        {
            "name": "stop"
        }
    ]
}
```

## Workflow Components

### Input/Output Definition

Define clear input and output schemas:

```json
{
    "input": {
        "name": "parameter_name",
        "type": "string|number|boolean|object|array",
        "description": "Clear description of the input",
        "required": true,
        "default": "default_value"
    },
    "output": {
        "name": "result_name",
        "type": "string|number|boolean|object|array",
        "description": "Clear description of the output"
    }
}
```

### Variables

Define workflow-level variables for configuration:

```json
{
    "variables": {
        "max_iterations": 5,
        "timeout_seconds": 30,
        "confidence_threshold": 0.8,
        "retry_count": 3
    }
}
```

### Contexts

Define shared conversation contexts between agents:

```json
{
    "contexts": [
        {
            "name": "context_name",
            "starting_messages": [
                {
                    "role": "system",
                    "content": "Initial system message for this context"
                }
            ],
            "max_length": 1000
        }
    ]
}
```

### Agents

Define AI agents with specific roles and contexts:

```json
{
    "agents": [
        {
            "agent_role": "coder|architect|reviewer|test_writer",
            "context": "context_name",
            "role": "assistant|user"
        }
    ]
}
```

### States

Define workflow states with the 4-step pattern:

```json
{
    "states": [
        {
            "name": "state_name",
            "agent": "agent_role",
            "pre_handler": "functionName", // Optional: prepare state
            "message": "Message template", // Optional: send message
            "post_handler": "functionName", // Optional: process response
            "transition_handler": "functionName", // Optional: decide next state
            "next_state": "next_state_name" // Optional: fixed next state
        }
    ]
}
```

## Custom Script Functions

### Script File Structure (`script.js`)

```javascript
/**
 * Custom workflow script functions
 * All functions receive 'this' context with:
 * - this.common_data: Shared workflow data
 * - this.input: Workflow input parameters
 * - this.context: Current workflow context
 * - this.last_response: Last agent response
 */

/**
 * Initialize workflow state
 */
export function initializeWorkflow() {
    this.common_data.iteration_count = 0;
    this.common_data.start_time = Date.now();

    console.log(`Starting workflow: ${this.input.task_description}`);
}

/**
 * Pre-handler: Prepare state before agent execution
 */
export function prepareAnalysis() {
    this.common_data.analysis_phase = 'requirements';

    // Add context to the agent's context
    const context = this.context.getContext('analysis_context');
    context.addMessage({
        role: 'system',
        content: `Analysis phase: ${this.common_data.analysis_phase}`,
    });
}

/**
 * Post-handler: Process agent response
 */
export function processAnalysis() {
    const response = this.last_response;

    // Extract structured data from response
    this.common_data.analysis_result = {
        complexity: this.extractComplexity(response),
        requirements: this.extractRequirements(response),
        timestamp: Date.now(),
    };

    console.log('Analysis completed:', this.common_data.analysis_result);
}

/**
 * Transition handler: Decide next state
 */
export function decideNextStep() {
    const analysis = this.common_data.analysis_result;

    if (analysis.complexity === 'high') {
        return 'detailed_planning';
    } else if (analysis.complexity === 'medium') {
        return 'implement';
    } else {
        return 'simple_implementation';
    }
}

/**
 * Helper function to extract complexity from response
 */
function extractComplexity(response) {
    // Implement logic to determine complexity
    if (response.includes('complex') || response.includes('difficult')) {
        return 'high';
    } else if (response.includes('moderate') || response.includes('medium')) {
        return 'medium';
    }
    return 'low';
}

/**
 * Helper function to extract requirements
 */
function extractRequirements(response) {
    // Implement logic to extract requirements
    const requirements = [];
    const lines = response.split('\n');

    for (const line of lines) {
        if (line.includes('requirement') || line.includes('need')) {
            requirements.push(line.trim());
        }
    }

    return requirements;
}

/**
 * Final output processing
 */
export function generateFinalOutput() {
    return {
        success: true,
        analysis: this.common_data.analysis_result,
        implementation: this.common_data.implementation_result,
        execution_time: Date.now() - this.common_data.start_time,
        iterations: this.common_data.iteration_count,
    };
}
```

## State Machine Patterns

### 4-Step State Pattern

Each state can implement up to 4 steps:

1. **Pre-handler**: Prepare state and context
2. **Agent Execution**: AI agent processes the state
3. **Post-handler**: Process agent response
4. **Transition Handler**: Decide next state

### Linear Workflow

Simple sequential execution:

```json
{
    "states": [
        {
            "name": "analyze",
            "agent": "architect",
            "message": "Analyze: {input.request}",
            "next_state": "implement"
        },
        {
            "name": "implement",
            "agent": "coder",
            "message": "Implement based on analysis",
            "next_state": "stop"
        },
        {
            "name": "stop"
        }
    ]
}
```

### Conditional Workflow

Dynamic state transitions based on conditions:

```json
{
    "states": [
        {
            "name": "evaluate",
            "agent": "reviewer",
            "message": "Evaluate: {input.code}",
            "transition_handler": "decideAction"
        },
        {
            "name": "fix_issues",
            "agent": "coder",
            "message": "Fix identified issues",
            "next_state": "evaluate"
        },
        {
            "name": "approve",
            "agent": "reviewer",
            "message": "Approve the solution",
            "next_state": "stop"
        },
        {
            "name": "stop"
        }
    ]
}
```

### Iterative Workflow

Workflows with loops and iteration limits:

```json
{
    "states": [
        {
            "name": "iterate",
            "agent": "coder",
            "pre_handler": "checkIterationLimit",
            "message": "Improve the solution",
            "post_handler": "evaluateProgress",
            "transition_handler": "decideIteration"
        },
        {
            "name": "finalize",
            "agent": "reviewer",
            "message": "Finalize the solution",
            "next_state": "stop"
        },
        {
            "name": "stop"
        }
    ]
}
```

## Context Management

### Shared Context

Agents can share conversation context:

```javascript
// In script function
const sharedContext = this.context.getContext('shared_context');
sharedContext.addMessage({
    role: 'user',
    content: 'Information to share between agents',
});
```

### Context Isolation

Each context maintains separate conversation history:

```json
{
    "contexts": [
        {
            "name": "planning_context",
            "starting_messages": [
                {
                    "role": "system",
                    "content": "You are focused on planning and architecture"
                }
            ]
        },
        {
            "name": "implementation_context",
            "starting_messages": [
                {
                    "role": "system",
                    "content": "You are focused on implementation details"
                }
            ]
        }
    ]
}
```

## Testing Workflows

### Unit Testing Script Functions

```javascript
import { describe, it, expect } from 'vitest';

// Mock workflow context
const mockContext = {
    common_data: {},
    input: { task_description: 'Test task' },
    context: {
        getContext: () => ({
            addMessage: () => {}
        })
    },
    last_response: 'Test response'
};

describe('Workflow Script Functions', () => {
    it('should initialize workflow correctly', () => {
        const { initializeWorkflow } = await import('./script.js');
        initializeWorkflow.call(mockContext);

        expect(mockContext.common_data.iteration_count).toBe(0);
        expect(mockContext.common_data.start_time).toBeDefined();
    });
});
```

### Integration Testing

```javascript
import { describe, it, expect } from 'vitest';
import WorkflowStateMachine from '../../../src/workflow/WorkflowStateMachine.js';

describe('Your Workflow Integration', () => {
    it('should execute workflow successfully', async () => {
        const stateMachine = new WorkflowStateMachine();
        await stateMachine.loadWorkflow('./src/config/workflows/your_workflow.json');

        const result = await stateMachine.executeWorkflow({
            user_request: 'Test input',
        });

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
    });
});
```

## Error Handling

### Workflow-Level Error Handling

```javascript
export function handleWorkflowError() {
    const error = this.last_error;

    this.common_data.error_count = (this.common_data.error_count || 0) + 1;

    if (this.common_data.error_count > 3) {
        return 'stop'; // Terminate workflow
    }

    return 'retry'; // Retry current state
}
```

### State-Level Error Recovery

```json
{
    "states": [
        {
            "name": "risky_operation",
            "agent": "coder",
            "message": "Perform risky operation",
            "error_handler": "handleOperationError",
            "max_retries": 3
        }
    ]
}
```

## Best Practices

### Workflow Design

- Keep workflows focused on specific use cases
- Use clear, descriptive state names
- Implement proper error handling and recovery
- Define clear input/output contracts

### State Management

- Use the 4-step pattern for complex states
- Keep state transitions predictable
- Implement iteration limits for loops
- Use meaningful variable names

### Context Usage

- Isolate contexts by concern
- Share information appropriately between agents
- Manage context length to avoid token limits
- Use starting messages to set agent context

### Script Functions

- Keep functions focused and testable
- Use descriptive function names
- Handle edge cases gracefully
- Document complex logic

## Consequences

### Positive

- Standardized workflow development patterns
- Flexible state machine architecture
- Reusable script functions
- Clear separation of concerns
- Comprehensive error handling

### Negative

- Complex configuration for simple workflows
- Learning curve for state machine concepts
- Debugging can be challenging
- Need to manage context and state carefully

---

_This ADR establishes the standard pattern for adding new workflows to SynthDev. Follow this structure to ensure proper integration and maintainability._
