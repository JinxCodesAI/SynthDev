# Synth-Dev Agentic Architecture Design

## Executive Summary

This document outlines a comprehensive, **state machine-based** architecture for introducing multi-agent capabilities to Synth-Dev. The design follows the **Open-Closed Principle** by extending functionality without modifying existing code, enabling sophisticated agentic workflows through JSON configuration alone - just like the current role system.

**Key Principles**:

- **State Machine Workflows**: All workflows are finite state machines with transitions and conditions
- **Context Isolation**: Contexts are first-class entities that can be shared or isolated
- **Agent Role Separation**: Agents can play different roles (user/assistant) within the same context
- **No Hardcoded Logic**: All workflow behavior defined through JSON configuration

## Current Architecture Analysis

### Strengths to Preserve

Synth-Dev's current architecture demonstrates exceptional design with sophisticated capabilities:

- **Multi-Model Management**: Dynamic role-based model switching (base/smart/fast)
- **Advanced Tool System**: Auto-discovery, Git integration, role-based filtering
- **Sophisticated Role System**: Specialized AI personas with few-shot prompting
- **Git-Integrated State Management**: Snapshot system with branch management
- **Performance Optimization**: Direct API communication without abstraction layers

### Critical Limitation: Single-Agent Design

The current `AIAPIClient` uses role switching which overwrites context instead of maintaining separate agent instances:

```javascript
// Current: Single conversation thread with role switching
class AIAPIClient {
    constructor() {
        this.messages = []; // Single conversation thread
        this.role = null; // Single active role
    }

    async setSystemMessage(systemMessage, role = null) {
        // Role switching overwrites context
        this.messages = this.messages.filter(msg => msg.role !== 'system');
        this.role = role;
    }
}
```

This prevents:

- Concurrent agent execution
- Agent-to-agent communication
- Self-reflection patterns
- Hierarchical workflows
- Context isolation between agents

## State Machine-Based Workflow Architecture

### Core Domain Objects

#### 1. Workflow Configuration Schema

```json
{
    "workflow_name": "string",
    "description": "string",
    "input": {
        "name": "parameter_name",
        "type": "string|number|object",
        "description": "parameter description"
    },
    "output": {
        "name": "result_name",
        "type": "string|object"
    },
    "variables": {
        "variable_name": "default_value"
    },
    "contexts": [
        {
            "name": "context_name",
            "starting_messages": [],
            "max_length": 50000
        }
    ],
    "agents": [
        {
            "agent_role": "role_name",
            "context": "context_name",
            "role": "user|assistant"
        }
    ],
    "states": [
        {
            "name": "state_name",
            "agent": "agent_role",
            "input": "expression",
            "action": {
                "function": "sendUserMessage|script",
                "script": "javascript_code"
            },
            "transition": [
                {
                    "target": "next_state",
                    "condition": "boolean_expression",
                    "before": "javascript_code"
                }
            ]
        }
    ]
}
```

#### 2. Context Management

Contexts are first-class entities that manage conversation history:

```javascript
class WorkflowContext {
    constructor(contextConfig) {
        this.name = contextConfig.name;
        this.messages = [...(contextConfig.starting_messages || [])];
        this.maxLength = contextConfig.max_length || 50000;
        this.agents = new Map(); // agents using this context
    }

    addAgent(agent, role) {
        this.agents.set(agent.id, { agent, role });
        // Share the actual message array for true context sharing
        agent.apiClient.messages = this.messages;
    }

    addMessage(message, fromAgent) {
        // Add message to shared context
        this.messages.push(message);

        // Trim context if it exceeds max length
        if (this._getContextLength() > this.maxLength) {
            this._trimContext();
        }
    }

    _getContextLength() {
        return this.messages.reduce((total, msg) => total + msg.content.length, 0);
    }

    _trimContext() {
        // Keep system message and recent messages within limit
        const systemMessages = this.messages.filter(msg => msg.role === 'system');
        const otherMessages = this.messages.filter(msg => msg.role !== 'system');

        while (this._getContextLength() > this.maxLength && otherMessages.length > 10) {
            otherMessages.shift(); // Remove oldest non-system message
        }

        this.messages = [...systemMessages, ...otherMessages];
    }
}
```

#### 3. Agent Definition

Agents are instances of roles that interact with specific contexts:

```javascript
class WorkflowAgent {
    constructor(agentConfig, context, config, toolManager, snapshotManager) {
        this.agentRole = agentConfig.agent_role;
        this.contextRole = agentConfig.role; // 'user' or 'assistant'
        this.context = context;

        // Create AIAPIClient instance for this agent
        this.apiClient = new AIAPIClient(
            config.costsManager,
            config.getModel(SystemMessages.getLevel(this.agentRole)).apiKey,
            config.getModel(SystemMessages.getLevel(this.agentRole)).baseUrl,
            config.getModel(SystemMessages.getLevel(this.agentRole)).model
        );

        this._initializeAgent(toolManager);

        // Connect to shared context
        context.addAgent(this, agentConfig.role);
    }

    async _initializeAgent(toolManager) {
        // Set role-specific system message and tools
        const systemMessage = SystemMessages.getSystemMessage(this.agentRole);
        await this.apiClient.setSystemMessage(systemMessage, this.agentRole);

        // Apply role-based tool filtering
        const allTools = toolManager.getTools();
        const excludedTools = SystemMessages.getExcludedTools(this.agentRole);
        const agentTools = allTools.filter(
            tool => !excludedTools.includes(tool.function?.name || tool.name)
        );
        this.apiClient.setTools(agentTools);
    }

    // Send message as user or assistant based on context role
    async sendMessage(message) {
        if (this.contextRole === 'user') {
            // Agent acts as user in the context
            return await this.apiClient.sendUserMessage(message);
        } else {
            // Agent acts as assistant - add assistant message directly
            const assistantMessage = { role: 'assistant', content: message };
            this.context.addMessage(assistantMessage, this);
            return message;
        }
    }

    // Get tool calls from last response
    getToolCalls() {
        const messages = this.context.messages;
        const lastMessage = messages[messages.length - 1];
        return lastMessage?.tool_calls || [];
    }

    getRole() {
        return this.agentRole;
    }
    getContextRole() {
        return this.contextRole;
    }
}
```

#### 4. State Machine Engine

The core workflow execution engine that processes state transitions:

```javascript
class WorkflowStateMachine {
    constructor(config, toolManager, snapshotManager, consoleInterface) {
        this.config = config;
        this.toolManager = toolManager;
        this.snapshotManager = snapshotManager;
        this.consoleInterface = consoleInterface;
        this.workflowConfigs = new Map();
        this.contexts = new Map();
        this.agents = new Map();
        this.commonData = {};
    }

    // Load workflow configurations
    loadWorkflowConfigs() {
        const workflowsPath = join(__dirname, 'config', 'workflows', 'workflows.json');
        if (existsSync(workflowsPath)) {
            const workflows = JSON.parse(readFileSync(workflowsPath, 'utf8'));
            for (const workflow of workflows) {
                this.workflowConfigs.set(workflow.workflow_name, workflow);
            }
        }
    }

    // Execute workflow by name
    async executeWorkflow(workflowName, inputParams) {
        const workflowConfig = this.workflowConfigs.get(workflowName);
        if (!workflowConfig) {
            throw new Error(`Unknown workflow: ${workflowName}`);
        }

        // Initialize workflow execution context
        const executionContext = this._initializeWorkflow(workflowConfig, inputParams);

        // Create workflow snapshot
        await this.snapshotManager.createSnapshot(`Workflow: ${workflowName}`);

        // Execute state machine
        return await this._executeStateMachine(executionContext);
    }
}
```

#### 5. State Machine Execution Logic

```javascript
class WorkflowStateMachine {
    // ... previous code

    _initializeWorkflow(workflowConfig, inputParams) {
        // Reset execution state
        this.contexts.clear();
        this.agents.clear();
        this.commonData = {};

        // Initialize contexts
        for (const contextConfig of workflowConfig.contexts) {
            const context = new WorkflowContext(contextConfig);
            this.contexts.set(contextConfig.name, context);
        }

        // Initialize agents
        for (const agentConfig of workflowConfig.agents) {
            const context = this.contexts.get(agentConfig.context);
            const agent = new WorkflowAgent(
                agentConfig,
                context,
                this.config,
                this.toolManager,
                this.snapshotManager
            );
            this.agents.set(agentConfig.agent_role, agent);
        }

        // Set input parameters
        const inputName = workflowConfig.input.name;
        this.commonData[inputName] = inputParams;

        // Initialize variables
        Object.assign(this.commonData, workflowConfig.variables);

        return {
            config: workflowConfig,
            currentState: 'start',
            states: new Map(workflowConfig.states.map(s => [s.name, s])),
            executionHistory: [],
        };
    }

    async _executeStateMachine(executionContext) {
        const { config, states } = executionContext;
        let currentStateName = executionContext.currentState;

        while (currentStateName && currentStateName !== 'stop') {
            const state = states.get(currentStateName);
            if (!state) {
                throw new Error(`Unknown state: ${currentStateName}`);
            }

            // Execute state
            const stateResult = await this._executeState(state, executionContext);
            executionContext.executionHistory.push({
                state: currentStateName,
                result: stateResult,
                timestamp: new Date(),
            });

            // Determine next state
            currentStateName = this._getNextState(state, stateResult, executionContext);
        }

        // Return workflow output
        const outputName = config.output.name;
        return this.commonData[outputName];
    }

    async _executeState(state, executionContext) {
        // Execute pre-transition script if present
        if (state.action && state.action.script) {
            this._executeScript(state.action.script);
        }

        // Execute agent action if present
        if (state.agent) {
            const agent = this.agents.get(state.agent);
            if (!agent) {
                throw new Error(`Unknown agent: ${state.agent}`);
            }

            // Evaluate input expression
            const input = this._evaluateExpression(state.input);

            // Execute agent function
            const functionName = state.action.function || 'sendUserMessage';
            let result;

            if (functionName === 'sendUserMessage') {
                result = await agent.sendMessage(input);
            } else {
                // Custom function execution
                result = await agent[functionName](input);
            }

            return {
                success: true,
                result: result,
                agent: state.agent,
                toolCalls: agent.getToolCalls(),
            };
        }

        return { success: true };
    }

    _getNextState(state, stateResult, executionContext) {
        for (const transition of state.transition || []) {
            // Execute before script if present
            if (transition.before) {
                this._executeScript(transition.before);
            }

            // Evaluate transition condition
            if (this._evaluateCondition(transition.condition, stateResult)) {
                return transition.target;
            }
        }

        return 'stop'; // Default to stop if no transitions match
    }

    _evaluateCondition(condition, context = {}) {
        // Simple condition evaluation - can be enhanced
        if (condition === 'true') return true;
        if (condition === 'false') return false;

        // Evaluate JavaScript expressions in safe context
        try {
            const func = new Function('this', 'context', `return ${condition}`);
            return func.call(this, context);
        } catch (error) {
            console.warn(`Condition evaluation failed: ${condition}`, error);
            return false;
        }
    }

    _executeScript(script) {
        try {
            const func = new Function('this', script);
            return func.call(this);
        } catch (error) {
            console.error(`Script execution failed: ${script}`, error);
        }
    }

    _evaluateExpression(expression) {
        if (typeof expression === 'string' && expression.startsWith('common_data.')) {
            const path = expression.substring(12); // Remove 'common_data.'
            return this._getNestedProperty(this.commonData, path);
        }
        return expression;
    }

    _getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}
```

## Workflow Configuration Specification

### Schema Definition

```typescript
interface WorkflowConfig {
    workflow_name: string; // Unique identifier for the workflow
    description: string; // Human-readable description
    input: ParameterDefinition; // Input parameter specification
    output: ParameterDefinition; // Output parameter specification
    variables?: Record<string, any>; // Default variables for common_data
    contexts: ContextDefinition[]; // Context definitions
    agents: AgentDefinition[]; // Agent definitions
    states: StateDefinition[]; // State machine definition
}

interface ParameterDefinition {
    name: string; // Parameter name
    type: 'string' | 'number' | 'object' | 'array';
    description: string; // Parameter description
}

interface ContextDefinition {
    name: string; // Context identifier
    starting_messages?: Message[]; // Initial messages in context
    max_length?: number; // Maximum context length in characters
}

interface AgentDefinition {
    agent_role: string; // Role name from roles.json
    context: string; // Context name to connect to
    role: 'user' | 'assistant'; // How agent interacts with context
}

interface StateDefinition {
    name: string; // State identifier
    agent?: string; // Agent role to execute (optional)
    input?: string; // Input expression (optional)
    action?: ActionDefinition; // Action to execute (optional)
    transition: TransitionDefinition[]; // State transitions
}

interface ActionDefinition {
    function?: 'sendUserMessage' | 'addUserMessage' | 'clearConversation';
    script?: string; // JavaScript code to execute
    sub_workflow?: string; // Sub-workflow to execute
    sub_workflow_input?: Record<string, string>; // Input mapping for sub-workflow
}

interface TransitionDefinition {
    target: string; // Target state name
    condition: string; // JavaScript boolean expression
    before?: string; // JavaScript code to execute before transition
}
```

### Sub-Workflow Composition

Sub-workflows are referenced by name and executed as atomic operations:

```json
{
    "name": "execute_sub_workflow",
    "action": {
        "sub_workflow": "coder_reviewer",
        "sub_workflow_input": {
            "task_to_do": "common_data.implementation_task"
        }
    },
    "transition": [
        {
            "target": "next_state",
            "condition": "true",
            "before": "() => { this.common_data.sub_result = this.sub_workflow_result; }"
        }
    ]
}
```

### Available Interfaces and Objects

#### 1. Agent Functions

Available in `action.function`:

```typescript
// Send user message and get AI response
'sendUserMessage'; // Calls agent.apiClient.sendUserMessage(input)

// Add user message without getting response
'addUserMessage'; // Calls agent.apiClient.addUserMessage(input)

// Clear conversation history
'clearConversation'; // Calls agent.apiClient.clearConversation()
```

#### 2. Context Objects in Conditions and Scripts

```javascript
// Access to workflow state machine instance
this.common_data; // Shared data object
this.agents; // Map of agent_role -> WorkflowAgent
this.contexts; // Map of context_name -> WorkflowContext
this.sub_workflow_result; // Result from last sub-workflow execution

// Access to last agent execution result
this.last_agent_response; // Last response from agent
this.last_tool_calls; // Tool calls from last agent response
this.last_parsing_tool_calls; // Parsing tool calls from last response

// Utility functions
this.getAgent(role); // Get agent by role
this.getContext(name); // Get context by name
this.getToolCalls(agent_role); // Get tool calls from specific agent's last response
```

#### 3. Function Call Access Pattern

Access parsing tool function calls using this pattern:

```javascript
// For condition: "function.review_work.arguments.improvement_needed === true"
// This accesses:
this.last_parsing_tool_calls.find(call => call.function.name === 'review_work')
    ?.function.arguments.improvement_needed

// Shorthand available in conditions:
function.{function_name}.arguments.{argument_name}
```

#### 4. Expression Evaluation

Input expressions are evaluated with access to:

```javascript
// Direct variable access
'common_data.current_task'; // Evaluates to this.common_data.current_task
'variables.max_iterations'; // Evaluates to this.common_data.max_iterations

// Agent context access
'agents.coder.getLastResponse()'; // Get last response from coder agent
'contexts.code_history.messages'; // Access context messages directly
```

### Condition and Script Execution Context

#### 1. Condition Evaluation

Conditions are JavaScript boolean expressions evaluated with this context:

```javascript
// Available objects in condition scope
this.common_data                    // Workflow shared data
this.agents                         // Map of agents
this.contexts                       // Map of contexts
this.last_agent_response           // Last agent response
this.last_tool_calls              // All tool calls from last response
this.last_parsing_tool_calls      // Parsing tool calls only

// Special shortcuts for parsing tool calls
function.{tool_name}.arguments.{arg_name}  // Access parsing tool arguments

// Examples:
"true"                                      // Always true
"this.common_data.iteration_count < 5"     // Variable comparison
"this.getToolCalls('coder').length > 0"    // Tool call check
"function.review_work.arguments.improvement_needed === true"  // Parsing tool result
```

#### 2. Script Execution

Scripts are JavaScript functions executed with full workflow context:

```javascript
// Script function signature
executionContext => {
    // Available in script scope:
    this.common_data; // Workflow shared data
    this.agents; // Map of agents
    this.contexts; // Map of contexts
    this.sub_workflow_result; // Result from sub-workflow

    // Utility functions:
    this.getAgent(role); // Get agent by role
    this.getContext(name); // Get context by name
    this.evaluateExpression(expr); // Evaluate expression

    // Example script:
    this.common_data.current_task = 'New task: ' + this.common_data.user_input;
    this.common_data.iteration_count = (this.common_data.iteration_count || 0) + 1;
};
```

#### 3. Input Expression Evaluation

Input expressions are evaluated to provide agent input:

```javascript
// Simple variable access
'common_data.current_task'; // Direct property access
'common_data.variables.max_iterations'; // Nested property access

// Complex expressions
"'Task ' + common_data.current_task_index + ': ' + common_data.task_list[common_data.current_task_index].description";

// Agent response access
'agents.product_manager.getLastResponse()';
'contexts.pm_context.messages[contexts.pm_context.messages.length - 1].content';
```

### Tool Call Integration

#### 1. Parsing Tools in Roles

Roles must define parsing tools for structured responses:

```json
{
    "reviewer": {
        "parsingTools": [
            {
                "type": "function",
                "function": {
                    "name": "review_work",
                    "description": "Provide review feedback on coder's work",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "improvement_needed": {
                                "type": "boolean",
                                "description": "Whether the work needs improvement"
                            },
                            "continue_message": {
                                "type": "string",
                                "description": "Message to send to coder if improvement needed"
                            },
                            "work_summary": {
                                "type": "string",
                                "description": "Summary of completed work if no improvement needed"
                            }
                        },
                        "required": ["improvement_needed"]
                    }
                }
            }
        ]
    }
}
```

#### 2. Tool Call Detection in Conditions

```javascript
// Check if agent made any tool calls
"this.getToolCalls('coder').length > 0";

// Check for specific parsing tool calls
'function.review_work.arguments.improvement_needed === true';

// Access tool call arguments
'function.task_approval.arguments.approved === false';
```

## Complete Workflow Examples

### 1. Coder-Reviewer Workflow (Corrected Implementation)

```json
{
    "workflow_name": "coder_reviewer",
    "description": "Workflow suitable to implement medium size features and mitigate AI stopping halfway. Reviewer validates if coder is on track and corrects him if necessary",
    "input": {
        "name": "task_to_do",
        "type": "string",
        "description": "detailed description of a task that needs to be carried over"
    },
    "output": {
        "name": "work_summary",
        "type": "string"
    },
    "variables": {
        "max_iterations": 10
    },
    "contexts": [
        {
            "name": "code_history",
            "starting_messages": [],
            "max_length": 50000
        }
    ],
    "agents": [
        {
            "agent_role": "coder",
            "context": "code_history",
            "role": "assistant"
        },
        {
            "agent_role": "reviewer",
            "context": "code_history",
            "role": "user"
        }
    ],
    "states": [
        {
            "name": "start",
            "action": {
                "script": "() => { this.common_data.current_task = 'Perform following task: ' + this.common_data.task_to_do; this.common_data.review_instruction = 'review coder\\'s work, provide continue_message or work_summary'; }"
            },
            "transition": [
                {
                    "target": "code",
                    "condition": "true"
                }
            ]
        },
        {
            "name": "code",
            "agent": "coder",
            "input": "common_data.current_task",
            "action": {
                "function": "sendUserMessage"
            },
            "transition": [
                {
                    "target": "code",
                    "condition": "this.getToolCalls('coder').length > 0"
                },
                {
                    "target": "review",
                    "condition": "true"
                }
            ]
        },
        {
            "name": "review",
            "agent": "reviewer",
            "input": "common_data.review_instruction",
            "action": {
                "function": "sendUserMessage"
            },
            "transition": [
                {
                    "target": "code",
                    "condition": "function.review_work.arguments.improvement_needed === true",
                    "before": "() => { this.common_data.current_task = function.review_work.arguments.continue_message; }"
                },
                {
                    "target": "stop",
                    "condition": "function.review_work.arguments.improvement_needed === false",
                    "before": "() => { this.common_data.work_summary = function.review_work.arguments.work_summary; }"
                }
            ]
        },
        {
            "name": "stop",
            "input": "common_data.work_summary"
        }
    ]
}
```

### 2. Hierarchical Development with Sub-Workflow

```json
{
    "workflow_name": "hierarchical_development",
    "description": "PM → Architect → Coder + Reviewer → Architect → PM full development lifecycle",
    "input": {
        "name": "business_requirements",
        "type": "string",
        "description": "High-level business requirements"
    },
    "output": {
        "name": "final_approval_status",
        "type": "string"
    },
    "variables": {
        "max_iterations": 3
    },
    "contexts": [
        {
            "name": "pm_context",
            "starting_messages": [],
            "max_length": 20000
        },
        {
            "name": "architect_context",
            "starting_messages": [],
            "max_length": 30000
        }
    ],
    "agents": [
        {
            "agent_role": "product_manager",
            "context": "pm_context",
            "role": "assistant"
        },
        {
            "agent_role": "architect",
            "context": "architect_context",
            "role": "assistant"
        }
    ],
    "states": [
        {
            "name": "start",
            "action": {
                "script": "() => { this.common_data.business_analysis_prompt = 'Analyze these business requirements: ' + this.common_data.business_requirements + '. Focus on: business objectives, user stories, acceptance criteria, non-functional requirements, risk assessment.'; }"
            },
            "transition": [
                {
                    "target": "business_analysis",
                    "condition": "true"
                }
            ]
        },
        {
            "name": "business_analysis",
            "agent": "product_manager",
            "input": "common_data.business_analysis_prompt",
            "action": {
                "function": "sendUserMessage"
            },
            "transition": [
                {
                    "target": "technical_specification",
                    "condition": "true",
                    "before": "() => { this.common_data.business_analysis = this.getAgent('product_manager').getLastResponse(); }"
                }
            ]
        },
        {
            "name": "technical_specification",
            "agent": "architect",
            "input": "'Create detailed technical specification for: ' + common_data.business_analysis + '. Provide: system architecture, design patterns, technology stack, implementation approach, technical risks.'",
            "action": {
                "function": "sendUserMessage"
            },
            "transition": [
                {
                    "target": "implementation_with_review",
                    "condition": "true",
                    "before": "() => { this.common_data.technical_spec = this.getAgent('architect').getLastResponse(); }"
                }
            ]
        },
        {
            "name": "implementation_with_review",
            "action": {
                "sub_workflow": "coder_reviewer",
                "sub_workflow_input": {
                    "task_to_do": "common_data.technical_spec"
                }
            },
            "transition": [
                {
                    "target": "architecture_review",
                    "condition": "true",
                    "before": "() => { this.common_data.implementation_result = this.sub_workflow_result; }"
                }
            ]
        },
        {
            "name": "architecture_review",
            "agent": "architect",
            "input": "'Review implementation against technical specification. Original spec: ' + common_data.technical_spec + '. Implementation: ' + common_data.implementation_result + '. Evaluate: adherence to architecture, code quality, performance, recommendations.'",
            "action": {
                "function": "sendUserMessage"
            },
            "transition": [
                {
                    "target": "final_approval",
                    "condition": "true",
                    "before": "() => { this.common_data.architect_review = this.getAgent('architect').getLastResponse(); }"
                }
            ]
        },
        {
            "name": "final_approval",
            "agent": "product_manager",
            "input": "'Final review: Requirements: ' + common_data.business_requirements + ', Business Analysis: ' + common_data.business_analysis + ', Implementation: ' + common_data.implementation_result + ', Architect Review: ' + common_data.architect_review + '. Does this meet business requirements?'",
            "action": {
                "function": "sendUserMessage"
            },
            "transition": [
                {
                    "target": "stop",
                    "condition": "true",
                    "before": "() => { this.common_data.final_approval_status = this.getAgent('product_manager').getLastResponse(); }"
                }
            ]
        },
        {
            "name": "stop",
            "input": "common_data.final_approval_status"
        }
    ]
}
```

## Implementation Interfaces

### 1. WorkflowAgent Class Interface

```javascript
class WorkflowAgent {
    constructor(agentConfig, context, config, toolManager, snapshotManager)

    // Core agent functions (available as action.function)
    async sendUserMessage(message)     // Send user message and get AI response
    async addUserMessage(message)      // Add user message without response
    async clearConversation()          // Clear conversation history

    // State access methods (available in conditions/scripts)
    getLastResponse()                  // Get last AI response content
    getToolCalls()                     // Get tool calls from last response
    getParsingToolCalls()              // Get parsing tool calls only
    getRole()                          // Get agent role name
    getContextRole()                   // Get context role (user/assistant)
}
```

### 2. WorkflowStateMachine Class Interface

```javascript
class WorkflowStateMachine {
    constructor(config, toolManager, snapshotManager, consoleInterface)

    // Main execution method
    async executeWorkflow(workflowName, inputParams)

    // Context access methods (available in conditions/scripts)
    getAgent(role)                     // Get agent by role
    getContext(name)                   // Get context by name
    getToolCalls(agentRole)           // Get tool calls from specific agent
    evaluateExpression(expression)     // Evaluate input expression

    // State machine properties (available in conditions/scripts)
    this.common_data                   // Shared workflow data
    this.agents                        // Map of agent_role -> WorkflowAgent
    this.contexts                      // Map of context_name -> WorkflowContext
    this.sub_workflow_result          // Result from last sub-workflow
    this.last_agent_response          // Last agent response
    this.last_tool_calls              // Tool calls from last response
    this.last_parsing_tool_calls      // Parsing tool calls only
}
```

### 3. Function Call Access Pattern

For parsing tool function calls, use this pattern in conditions:

```javascript
// Pattern: function.{tool_name}.arguments.{argument_name}
'function.review_work.arguments.improvement_needed === true';
'function.task_approval.arguments.approved === false';

// This is shorthand for:
this.last_parsing_tool_calls.find(call => call.function.name === 'review_work')?.function.arguments
    .improvement_needed === true;
```

### 4. Sub-Workflow Execution

Sub-workflows are executed as atomic operations:

```json
{
    "name": "execute_sub_workflow",
    "action": {
        "sub_workflow": "coder_reviewer",
        "sub_workflow_input": {
            "task_to_do": "common_data.implementation_task"
        }
    },
    "transition": [
        {
            "target": "next_state",
            "condition": "true",
            "before": "() => { this.common_data.sub_result = this.sub_workflow_result; }"
        }
    ]
}
```

The sub-workflow:

1. Executes completely in isolation
2. Returns its output value
3. Result available as `this.sub_workflow_result`
4. Sub-workflow agents/contexts are not accessible from parent workflow

## Workflow Creation Guide

### Step-by-Step Workflow Creation

1. **Define Workflow Metadata**

    ```json
    {
        "workflow_name": "my_workflow",
        "description": "Clear description of workflow purpose",
        "input": { "name": "input_param", "type": "string", "description": "Input description" },
        "output": { "name": "result_param", "type": "string" }
    }
    ```

2. **Define Contexts**

    ```json
    "contexts": [
        {
            "name": "shared_context",
            "starting_messages": [],
            "max_length": 50000
        }
    ]
    ```

3. **Define Agents**

    ```json
    "agents": [
        {
            "agent_role": "coder",
            "context": "shared_context",
            "role": "assistant"
        }
    ]
    ```

4. **Create State Machine**
    ```json
    "states": [
        {
            "name": "start",
            "action": {"script": "() => { /* initialization */ }"},
            "transition": [{"target": "next_state", "condition": "true"}]
        }
    ]
    ```

### Common Patterns

#### 1. Agent Interaction Loop

```json
{
    "name": "agent_loop",
    "agent": "coder",
    "input": "common_data.task",
    "action": { "function": "sendUserMessage" },
    "transition": [
        {
            "target": "agent_loop",
            "condition": "this.getToolCalls('coder').length > 0"
        },
        {
            "target": "next_state",
            "condition": "true"
        }
    ]
}
```

#### 2. Conditional Branching on Tool Calls

```json
{
    "transition": [
        {
            "target": "continue_work",
            "condition": "function.review_work.arguments.improvement_needed === true",
            "before": "() => { this.common_data.feedback = function.review_work.arguments.continue_message; }"
        },
        {
            "target": "finish",
            "condition": "function.review_work.arguments.improvement_needed === false"
        }
    ]
}
```

#### 3. Sub-Workflow Integration

```json
{
    "name": "delegate_to_sub_workflow",
    "action": {
        "sub_workflow": "coder_reviewer",
        "sub_workflow_input": {
            "task_to_do": "common_data.detailed_task"
        }
    },
    "transition": [
        {
            "target": "process_result",
            "condition": "true",
            "before": "() => { this.common_data.implementation = this.sub_workflow_result; }"
        }
    ]
}
```

### Required Role Definitions

Add these roles to `config/roles/roles.json`:

```json
{
    "product_manager": {
        "level": "smart",
        "systemMessage": "You are a Product Manager responsible for breaking down requirements into actionable tasks and ensuring deliverables meet business needs.",
        "excludedTools": ["edit_file", "write_file", "execute_terminal"],
        "parsingTools": [
            {
                "type": "function",
                "function": {
                    "name": "task_approval",
                    "description": "Approve or reject task implementation",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "approved": { "type": "boolean" },
                            "feedback": { "type": "string" }
                        },
                        "required": ["approved"]
                    }
                }
            }
        ]
    },
    "reviewer": {
        "parsingTools": [
            {
                "type": "function",
                "function": {
                    "name": "review_work",
                    "description": "Provide review feedback on coder's work",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "improvement_needed": { "type": "boolean" },
                            "continue_message": { "type": "string" },
                            "work_summary": { "type": "string" }
                        },
                        "required": ["improvement_needed"]
                    }
                }
            }
        ]
    }
}
```

## Integration with Existing System

### Command System Extension

Add new commands to `commands/workflow/`:

```javascript
// commands/workflow/WorkflowCommand.js
class WorkflowCommand extends BaseCommand {
    constructor() {
        super('workflow', 'Execute multi-agent state machine workflows');
    }

    async execute(args, context) {
        const { workflowStateMachine } = context;
        const [workflowName, ...taskArgs] = args;
        const inputParams = taskArgs.join(' ');

        if (!workflowName) {
            return this._showAvailableWorkflows(workflowStateMachine);
        }

        try {
            const result = await workflowStateMachine.executeWorkflow(workflowName, inputParams);
            return this._formatWorkflowResult(result);
        } catch (error) {
            throw new Error(`Workflow execution failed: ${error.message}`);
        }
    }

    _showAvailableWorkflows(workflowStateMachine) {
        const workflows = Array.from(workflowStateMachine.workflowConfigs.keys());
        return `Available workflows:\n${workflows.map(w => `  - ${w}`).join('\n')}`;
    }
}
```

### App.js Integration

Extend the main application to support multi-agent mode:

```javascript
// app.js modifications
class SynthDev {
    constructor() {
        // ... existing initialization
        this.workflowStateMachine = new WorkflowStateMachine(
            this.config,
            this.toolManager,
            this.snapshotManager,
            this.consoleInterface
        );
        this.workflowStateMachine.loadWorkflowConfigs();
        this.multiAgentMode = false;
    }

    async handleInput(input) {
        // Check for multi-agent workflow commands
        if (input.startsWith('/workflow')) {
            this.multiAgentMode = true;
            const args = input.slice(9).trim().split(' ');
            return await this.workflowStateMachine.executeWorkflow(
                args[0],
                args.slice(1).join(' ')
            );
        }

        // Existing single-agent handling
        if (!this.multiAgentMode) {
            return await this.aiAPIClient.sendUserMessage(input);
        }
    }
}
```

## Benefits of This State Machine Architecture

### 1. True State Machine Workflows

- **Finite state machines**: Clear state transitions with conditions
- **Conditional branching**: Dynamic workflow routing based on agent responses
- **Loop constructs**: Iterative patterns with exit conditions
- **Sub-workflow support**: Compose complex workflows from simpler ones

### 2. Flexible Context Management

- **First-class contexts**: Contexts are independent entities with their own configuration
- **Shared contexts**: Multiple agents can interact in the same conversation thread
- **Context roles**: Agents can play different roles (user/assistant) within contexts
- **Context length management**: Automatic trimming to stay within limits

### 3. Perfect Open-Closed Principle Compliance

- **Zero hardcoded workflows**: All workflow logic defined in JSON configuration
- **Generic state machine engine**: Single engine handles all workflow types
- **Extensible through configuration**: Add new workflows without touching code
- **Backward compatibility**: All existing functionality preserved

### 4. Advanced Agent Interaction Patterns

- **Reviewer in coder's context**: Reviewer truly interacts within coder's thread
- **Hierarchical workflows**: Independent contexts per stage with result passing
- **Parallel analysis**: Multiple agents building on shared context
- **Sub-workflow composition**: Complex workflows built from simpler components

### 5. Maximum Reuse of Existing Excellence

- **Sophisticated tool system**: Auto-discovery, Git integration, role filtering
- **Multi-model management**: Smart/fast/base model selection per role
- **Advanced state management**: Snapshot system with Git integration
- **Performance optimization**: Direct API communication efficiency

## Implementation Timeline

### Phase 1: Foundation (2-3 weeks)

- Implement `WorkflowContext` class for context management
- Create `WorkflowAgent` class with context role support
- Build `WorkflowStateMachine` core engine
- Add workflow configuration loading system

### Phase 2: State Machine Features (3-4 weeks)

- Implement state transition logic with conditions
- Add JavaScript expression evaluation for conditions and scripts
- Create sub-workflow execution capability
- Add common_data variable system

### Phase 3: Advanced Features (2-3 weeks)

- Workflow monitoring and debugging
- Error handling and recovery mechanisms
- Performance optimization
- Documentation and example workflows

## Usage Examples

### Single-Agent Mode (Existing)

```bash
# Continue using current system
/role coder
Create a new React component
```

### State Machine Workflows

```bash
# Coder-Reviewer workflow with shared context
/workflow coder_reviewer "Optimize database query performance"

# Product Manager-Coder workflow with isolated contexts
/workflow product_manager_coder "Build user authentication system"

# Hierarchical development with context passing
/workflow hierarchical_development "Design microservices architecture"

# Parallel analysis with shared context
/workflow parallel_analysis_shared "Analyze security implications of new API"

# Custom workflows (defined in JSON state machines)
/workflow my_custom_workflow "Any task description"
```

## Key Advantages of State Machine Approach

### 1. True Workflow Flexibility

- **State machines**: Workflows are proper finite state machines
- **Conditional transitions**: Dynamic routing based on agent responses and tool calls
- **JavaScript expressions**: Full programming capability in conditions and scripts
- **Sub-workflow composition**: Build complex workflows from simpler state machines

### 2. Context as First-Class Citizens

- **Independent context entities**: Contexts defined separately from agents
- **Flexible agent-context relationships**: Agents can share or isolate contexts
- **Context roles**: Agents can be 'user' or 'assistant' within the same context
- **Automatic context management**: Length limits and message trimming

### 3. Perfect Configuration-Driven Design

- **Zero hardcoded logic**: All workflow behavior defined in JSON
- **Generic state machine engine**: Single engine executes any workflow
- **JavaScript integration**: Conditions and scripts provide unlimited flexibility
- **Variable system**: common_data provides shared state across workflow execution

### 4. Natural Agent Interaction

- **Reviewer in coder's thread**: True shared context interaction
- **Hierarchical information flow**: Independent contexts with result passing
- **Parallel collaboration**: Multiple agents building on shared conversation
- **Tool call awareness**: State transitions based on agent tool usage

This state machine architecture enables unlimited workflow possibilities while maintaining the excellent foundation of the current Synth-Dev system. Users can create sophisticated multi-agent workflows through JSON configuration alone, with the full power of state machines and JavaScript expressions.
