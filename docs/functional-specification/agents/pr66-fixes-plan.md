# PR #66 Comprehensive Fixes Plan - Agentic System Implementation

## Overview

This document provides a complete, self-contained guide to fix all issues identified in PR #66 review comments. The current agentic system implementation has critical architectural flaws that must be addressed before merging.

**Context**: This PR implements Phase 1 of an agentic collaboration system that allows AI roles to spawn, manage, and communicate with other specialized agents. The system uses a singleton `AgentManager` to orchestrate agent lifecycles and four tools (`spawn_agent`, `speak_to_agent`, `get_agents`, `return_results`) for agent interaction.

## Review Comments Analysis

**Total Comments**: 18 review comments requiring fixes
**Critical Issues**: 7 major architectural problems
**Files Affected**: 15+ files across agents, tools, configs, and documentation

## Critical Issues Identified

### Issue 1: Agent Hierarchy Using Roles Instead of Agent IDs

**Problem**: The system uses `supervisorRole` (string) as parent ID instead of actual agent IDs (UUIDs), making it impossible to track multiple agents of the same role.

**Affected Code**:
- `src/agents/AgentManager.js` lines 50, 57: `supervisorRole` passed as `parentId`
- `src/agents/AgentProcess.js` line 14: Constructor accepts role name as `parentId`
- `src/tools/get_agents/implementation.js` line 25: Uses `currentRole` for hierarchy lookup

**Root Cause**: The system conflates roles (types) with agent instances (individuals).

### Issue 2: Synchronous Communication Creating Deadlock Risk

**Problem**: `sendMessageToAgent()` uses `await agent.execute()` which can create circular dependencies when agents try to communicate with each other.

**Affected Code**:
- `src/agents/AgentManager.js` line 87: `const response = await agent.execute();`
- `src/tools/speak_to_agent/implementation.js` line 36: Returns immediate agent response

**Root Cause**: Synchronous communication model doesn't account for agent-to-agent messaging scenarios.

### Issue 3: Incomplete Agent Status Management

**Problem**: Agent status definitions don't match implementation, and status transitions are incomplete.

**Current Status Issues**:
- Status transitions not implemented in `execute()` method
- `running` agents can be messaged (should not be disturbed)
- Missing `inactive` status handling
- Documentation contradicts implementation

**Affected Code**:
- `src/agents/AgentProcess.js`: Missing status transition logic
- `src/agents/README.md`: Incorrect status descriptions
- `src/tools/speak_to_agent/implementation.js`: Incomplete status checking

### Issue 4: Missing Parent Notification System

**Problem**: When agents complete tasks via `return_results`, their results are not automatically forwarded to parent agents as messages.

**Affected Code**:
- `src/agents/AgentManager.js` line 147: TODO comment about notifying supervisor
- `src/tools/return_results/implementation.js`: No parent notification logic
- `src/agents/AgentProcess.js`: No result forwarding mechanism

### Issue 5: Inadequate Tool Documentation

**Problem**: Tool definitions lack detailed response specifications and usage guidance.

**Affected Files**:
- `src/tools/get_agents/definition.json`: Vague response format description
- `src/tools/speak_to_agent/definition.json`: Missing status-based usage guidance
- All agent tool definitions: Lack comprehensive examples

### Issue 6: Poor Role Configurations

**Problem**: Role system messages are generic and don't provide specific workflow guidance. Tool assignments are inappropriate for role purposes.

**Specific Issues**:
- PM role lacks task creation and delegation specifics
- Architect role should focus on documentation creation
- Test-runner role has development tools instead of execution tools
- Git-manager role lacks safety guidance

### Issue 7: Misleading Documentation Terminology

**Problem**: Documentation uses "isolated environment" suggesting filesystem isolation when it's only conversational context isolation.

## Detailed Implementation Guide

This section provides step-by-step instructions with exact code changes needed to fix each issue.

### CRITICAL FIX 1: Agent Hierarchy System

**Problem**: System uses role names instead of agent IDs for parent-child relationships.

#### Step 1.1: Update AgentManager.spawnAgent() Method

**File**: `src/agents/AgentManager.js`

**Current Code (lines 37-68)**:
```javascript
async spawnAgent(supervisorRole, workerRoleName, taskPrompt, context) {
    // Validate spawn permission
    if (!this._validateSpawnPermission(supervisorRole, workerRoleName)) {
        throw new Error(
            `Role '${supervisorRole}' is not authorized to spawn '${workerRoleName}' agents. ` +
                "Check the 'enabled_agents' configuration for this role."
        );
    }

    // Create new agent process
    const agent = new AgentProcess(
        workerRoleName,
        taskPrompt,
        supervisorRole, // Use supervisor role as parent ID for now
        context.costsManager,
        context.toolManager
    );

    // Register agent
    this.activeAgents.set(agent.agentId, agent);
    this._trackAgentHierarchy(supervisorRole, agent.agentId);
    // ... rest of method
}
```

**Fixed Code**:
```javascript
async spawnAgent(supervisorRole, workerRoleName, taskPrompt, context) {
    // Validate spawn permission
    if (!this._validateSpawnPermission(supervisorRole, workerRoleName)) {
        throw new Error(
            `Role '${supervisorRole}' is not authorized to spawn '${workerRoleName}' agents. ` +
                "Check the 'enabled_agents' configuration for this role."
        );
    }

    // Get supervisor agent ID from context (null for main user)
    const supervisorAgentId = context?.currentAgentId || null;

    // Create new agent process
    const agent = new AgentProcess(
        workerRoleName,
        taskPrompt,
        supervisorAgentId, // Use actual agent ID as parent
        context.costsManager,
        context.toolManager
    );

    // Register agent
    this.activeAgents.set(agent.agentId, agent);
    this._trackAgentHierarchy(supervisorAgentId, agent.agentId);

    this.logger.info(
        `Spawned ${workerRoleName} agent ${agent.agentId} for supervisor ${supervisorAgentId || 'user'}`
    );

    return {
        agentId: agent.agentId,
        status: agent.status,
        createdAt: agent.createdAt,
        roleName: workerRoleName,
    };
}
```

#### Step 1.2: Update AgentManager.listAgents() Method

**File**: `src/agents/AgentManager.js`

**Current Code (lines 107-128)**:
```javascript
listAgents(supervisorId, options = {}) {
    const { include_completed = true } = options;
    const childIds = this.agentHierarchy.get(supervisorId) || new Set();
    // ... rest of method
}
```

**Fixed Code**:
```javascript
listAgents(supervisorAgentId, options = {}) {
    const { include_completed = true } = options;
    // Use null for main user, actual agent ID for agent supervisors
    const childIds = this.agentHierarchy.get(supervisorAgentId) || new Set();

    const agents = [];
    for (const agentId of childIds) {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            const status = agent.getStatus();
            if (include_completed || status.status !== 'completed') {
                agents.push(status);
            }
        }
    }

    return agents;
}
```

#### Step 1.3: Update Tool Context Passing

**File**: `src/core/app.js` (around line 214)

**Current Code**:
```javascript
const toolContext = {
    currentRole: this.apiClient.role,
    agentManager: this.agentManager,
    costsManager: this.costsManager,
    toolManager: this.toolManager,
    app: this,
};
```

**Fixed Code**:
```javascript
const toolContext = {
    currentRole: this.apiClient.role,
    currentAgentId: null, // Main user has no agent ID
    agentManager: this.agentManager,
    costsManager: this.costsManager,
    toolManager: this.toolManager,
    app: this,
};
```

#### Step 1.4: Update get_agents Tool

**File**: `src/tools/get_agents/implementation.js`

**Current Code (lines 22-25)**:
```javascript
const currentRole = this.context?.currentRole || 'unknown';

// Get agents spawned by current supervisor
const agents = agentManager.listAgents(currentRole, { include_completed });
```

**Fixed Code**:
```javascript
const currentAgentId = this.context?.currentAgentId || null;

// Get agents spawned by current supervisor (null for main user)
const agents = agentManager.listAgents(currentAgentId, { include_completed });
```

### CRITICAL FIX 2: Asynchronous Communication Model

**Problem**: `sendMessageToAgent()` uses `await` creating deadlock risk.

#### Step 2.1: Update AgentManager.sendMessageToAgent()

**File**: `src/agents/AgentManager.js`

**Current Code (lines 77-94)**:
```javascript
async sendMessageToAgent(agentId, message) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
    }

    // Add message to agent's conversation history
    agent.addMessage({ role: 'user', content: message });

    // Execute agent's API client to get response
    const response = await agent.execute();

    return {
        content: response,
        status: agent.status,
        agentId: agentId,
    };
}
```

**Fixed Code**:
```javascript
async sendMessageToAgent(agentId, message) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
    }

    // Check if agent can receive messages
    if (agent.status === 'failed') {
        throw new Error(`Agent ${agentId} has failed and cannot process messages`);
    }

    if (agent.status === 'running') {
        throw new Error(`Agent ${agentId} is currently processing and should not be disturbed`);
    }

    // Add message to agent's conversation history
    agent.addMessage({ role: 'user', content: message });

    // Set agent to running status before execution
    agent.status = 'running';

    // Execute agent asynchronously and handle status transitions
    this._executeAgentAsync(agent);

    return {
        message_sent: true,
        agent_id: agentId,
        status: 'running',
        message: 'Message has been sent, response will be sent in future message. If response blocks your progress wait, otherwise continue operation.',
    };
}

/**
 * Execute agent asynchronously and handle status transitions
 * @param {AgentProcess} agent - Agent to execute
 * @private
 */
async _executeAgentAsync(agent) {
    try {
        const response = await agent.execute();

        // Check if agent called return_results during execution
        if (agent.status !== 'completed') {
            agent.markInactive();
        }

        this.logger.info(`Agent ${agent.agentId} finished execution with status: ${agent.status}`);
    } catch (error) {
        agent.markFailed(error);
        this.logger.error(`Agent ${agent.agentId} execution failed: ${error.message}`);
    }
}
```

#### Step 2.2: Update speak_to_agent Tool

**File**: `src/tools/speak_to_agent/implementation.js`

**Current Code (lines 35-45)**:
```javascript
// Send message and get response
const response = await agentManager.sendMessageToAgent(agent_id, message);

return this.createSuccessResponse({
    agent_id: agent_id,
    message_sent: true,
    agent_response: response.content,
    agent_status: response.status,
    timestamp: new Date().toISOString(),
    message: `Message sent to agent ${agent_id} successfully`,
});
```

**Fixed Code**:
```javascript
// Send message (now asynchronous)
const response = await agentManager.sendMessageToAgent(agent_id, message);

return this.createSuccessResponse({
    agent_id: agent_id,
    message_sent: response.message_sent,
    agent_status: response.status,
    timestamp: new Date().toISOString(),
    message: response.message,
});
```

### CRITICAL FIX 3: Agent Status Management

**Problem**: Incomplete status transition logic and incorrect status definitions.

#### Step 3.1: Update AgentProcess Status Transitions

**File**: `src/agents/AgentProcess.js`

**Add after line 88 (in execute method)**:
```javascript
async execute() {
    try {
        // Set status to running at start of execution
        this.status = 'running';

        const response = await this.apiClient.sendMessage();

        // If execution completes without calling return_results, mark as inactive
        if (this.status === 'running') {
            this.markInactive();
        }

        return response;
    } catch (error) {
        this.logger.error(`Agent ${this.agentId} execution failed: ${error.message}`);
        this.markFailed(error);
        throw error;
    }
}
```

#### Step 3.2: Update Agent Status Definitions

**File**: `src/agents/README.md`

**Current Content (lines 25-30)**:
```markdown
## Agent Statuses

- **running**: Agent is actively processing tasks and can receive messages
- **inactive**: Agent finished it's responde without sending `return_results`
- **completed**: Agent has finished its primary task by calling `return_results` but can still receive follow-up messages for corrections
- **failed**: Agent encountered an error and cannot process further messages
```

**Fixed Content**:
```markdown
## Agent Statuses

- **running**: Agent is actively processing tasks and should NOT be disturbed with new messages
- **inactive**: Agent finished its response without sending `return_results`, CAN receive messages
- **completed**: Agent called `return_results` to finish its task, CAN receive messages for clarifications
- **failed**: Agent encountered an error and CANNOT process messages

### Message Sending Rules

- **running** agents: Cannot receive messages (will throw error)
- **inactive** agents: Can receive messages to continue work
- **completed** agents: Can receive messages for corrections or follow-up tasks
- **failed** agents: Cannot receive messages (will throw error)
```

### CRITICAL FIX 4: Parent Notification System

**Problem**: Results from `return_results` are not automatically sent to parent agents as messages.

#### Step 4.1: Add Parent Notification to AgentManager

**File**: `src/agents/AgentManager.js`

**Add new method after line 149**:
```javascript
/**
 * Notify parent agent of child completion
 * @param {string} childAgentId - Child agent ID
 * @param {Object} result - Completion result
 * @private
 */
async _notifyParentOfCompletion(childAgentId, result) {
    const childAgent = this.activeAgents.get(childAgentId);
    if (!childAgent || !childAgent.parentId) {
        return; // No parent to notify (main user spawned this agent)
    }

    const parentAgent = this.activeAgents.get(childAgent.parentId);
    if (!parentAgent) {
        this.logger.warn(`Parent agent ${childAgent.parentId} not found for child ${childAgentId}`);
        return;
    }

    // Format result message for parent
    const resultMessage = {
        role: 'user',
        content: `Agent ${childAgent.roleName} (${childAgentId}) has completed its task.\n\n` +
                `Status: ${result.status}\n` +
                `Summary: ${result.summary}\n` +
                `Artifacts: ${result.artifacts?.length || 0} files\n` +
                `Known Issues: ${result.known_issues?.length || 0}\n\n` +
                `Full result details available via get_agents tool.`
    };

    // Add message to parent's conversation
    parentAgent.addMessage(resultMessage);

    this.logger.info(`Notified parent agent ${childAgent.parentId} of child ${childAgentId} completion`);
}
```

**Update reportResult method (lines 136-149)**:
```javascript
async reportResult(workerId, result) {
    const agent = this.activeAgents.get(workerId);
    if (!agent) {
        throw new Error(`Worker agent ${workerId} not found`);
    }

    // Mark agent as completed
    agent.markCompleted(result);

    this.logger.info(`Agent ${workerId} reported completion with status: ${result.status}`);

    // Notify parent agent of completion
    await this._notifyParentOfCompletion(workerId, result);
}
```

#### Step 4.2: Update return_results Tool Response

**File**: `src/tools/return_results/implementation.js`

**Current Code (lines 47-55)**:
```javascript
return this.createSuccessResponse({
    task_completed: true,
    agent_id: currentAgentId,
    result_status: result.status,
    summary: result.summary,
    artifacts_count: result.artifacts?.length || 0,
    completed_at: enrichedResult.completed_at,
    message: `Task completed successfully with status: ${result.status}`,
});
```

**Fixed Code**:
```javascript
return this.createSuccessResponse({
    task_completed: true,
    agent_id: currentAgentId,
    message: `Results have been sent to parent agent. Wait for response or further instructions.`,
});
```

### HIGH PRIORITY FIX 5: Tool Documentation Enhancement

**Problem**: Tool definitions lack detailed response specifications and usage guidance.

#### Step 5.1: Update get_agents Tool Definition

**File**: `src/tools/get_agents/definition.json`

**Current Code (lines 11-13)**:
```json
"response_format": {
    "description": "Returns array of agent objects with detailed status information"
}
```

**Fixed Code**:
```json
"response_format": {
    "description": "Returns comprehensive agent listing with status details",
    "properties": {
        "agents": {
            "type": "array",
            "description": "Array of agent objects spawned by current supervisor",
            "items": {
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "Unique agent identifier"},
                    "role_name": {"type": "string", "description": "Agent's role type"},
                    "status": {"type": "string", "enum": ["running", "inactive", "completed", "failed"]},
                    "created_at": {"type": "string", "description": "ISO timestamp of creation"},
                    "task_prompt": {"type": "string", "description": "Truncated initial task"},
                    "has_result": {"type": "boolean", "description": "Whether agent has completed with results"},
                    "parent_id": {"type": "string", "description": "Parent agent ID or null for user-spawned"}
                }
            }
        },
        "total_count": {"type": "number", "description": "Total number of agents"},
        "active_count": {"type": "number", "description": "Agents currently running"},
        "completed_count": {"type": "number", "description": "Agents that finished successfully"},
        "failed_count": {"type": "number", "description": "Agents that encountered errors"}
    }
}
```

#### Step 5.2: Update speak_to_agent Tool Definition

**File**: `src/tools/speak_to_agent/definition.json`

**Current Code (lines 3, 12)**:
```json
"description": "Sends a message to a previously spawned agent for follow-up instructions or status updates",
"description": "Sends a follow-up message to a specific worker agent. Use this to provide additional instructions, clarifications, feedback, or to request progress updates from spawned agents.",
```

**Fixed Code**:
```json
"description": "Sends a message to a previously spawned agent for follow-up instructions or status updates. Check agent status first with get_agents - only inactive and completed agents can receive messages.",
"description": "Sends a follow-up message to a specific worker agent. IMPORTANT: Check agent status first using get_agents tool. Only 'inactive' and 'completed' agents can receive messages. 'running' agents should not be disturbed, 'failed' agents cannot process messages. Use this for additional instructions, clarifications, feedback, or progress updates.",
```

**Add after line 28**:
```json
"usage_guidance": {
    "description": "Agent status determines messaging capability",
    "rules": [
        "running: Cannot send messages (agent is processing)",
        "inactive: Can send messages (agent waiting for instructions)",
        "completed: Can send messages (for corrections/follow-up)",
        "failed: Cannot send messages (agent has errored)"
    ],
    "best_practices": [
        "Always check agent status with get_agents before messaging",
        "Be specific and actionable in messages",
        "Use for clarifications, corrections, or additional work"
    ]
}
```

### MEDIUM PRIORITY FIX 6: Role Configuration Improvements

**Problem**: Role system messages are generic and lack specific workflow guidance.

#### Step 6.1: Enhanced PM Role Configuration

**File**: `src/config/roles/agentic/team-roles.agentic.json`

**Current PM systemMessage (line 4)**:
```json
"systemMessage": "You are a Project Manager responsible for coordinating software development projects. You can delegate work to architects and developers to ensure successful project delivery. You excel at breaking down complex requirements, planning work phases, managing timelines, and ensuring quality deliverables. You coordinate between different specialists and ensure all project goals are met. When you need architectural guidance, spawn an architect. When you need code implementation, spawn a developer. Always maintain clear communication and track progress effectively."
```

**Fixed PM systemMessage**:
```json
"systemMessage": "You are a Project Manager responsible for coordinating software development projects through agent delegation.\n\nWORKFLOW:\n1. ANALYZE requirements and break them into phases\n2. CREATE tasks using task management tools\n3. SPAWN architect for system design (when architectural decisions needed)\n4. SPAWN developer for implementation (when code needs to be written)\n5. MONITOR progress using get_agents and speak_to_agent\n6. COORDINATE between agents and handle their results\n7. DELIVER final project summary using return_results\n\nAGENT MANAGEMENT:\n- Use spawn_agent for new specialized work\n- Use get_agents to check status before messaging\n- Use speak_to_agent only for inactive/completed agents\n- Process agent results and provide feedback\n- Ensure all agents complete before finalizing project\n\nDELIVERABLES:\n- Create comprehensive project plans\n- Coordinate between specialists\n- Ensure quality and timeline adherence\n- Provide detailed project completion reports"
```

#### Step 6.2: Enhanced Architect Role Configuration

**Current Architect systemMessage (line 21)**:
```json
"systemMessage": "You are a Software Architect focused on designing robust, scalable system architectures. You create technical specifications, design patterns, and architectural decisions. You analyze requirements and design solutions that are maintainable, performant, and align with best practices. You document architectural decisions and provide guidance on system design. When you complete your architectural work, use return_results to provide comprehensive design documentation and recommendations."
```

**Fixed Architect systemMessage**:
```json
"systemMessage": "You are a Software Architect focused on creating comprehensive technical specifications and design documentation.\n\nPRIMARY RESPONSIBILITIES:\n1. ANALYZE requirements and create functional specifications\n2. DESIGN system architecture and component interactions\n3. CREATE detailed development plans with implementation steps\n4. DOCUMENT architectural decisions and rationale\n5. PROVIDE technical guidance and best practices\n\nDELIVERABLES (create as markdown files):\n- functional-specification.md: Detailed requirements analysis\n- development-plan.md: Step-by-step implementation guide\n- architecture-decisions.md: Technical choices and rationale\n- api-specifications.md: Interface definitions (if applicable)\n\nTOOLS FOCUS:\n- Use write_file to create comprehensive documentation\n- Use read_file and explain_codebase to understand existing systems\n- Use exact_search to analyze current implementations\n\nCOMPLETION:\n- Use return_results with detailed artifact descriptions\n- Include all created documentation files\n- Provide clear next steps for developers"
```

#### Step 6.3: Specialized Test-Runner Role

**Current test-runner systemMessage and tools (lines 54-68)**:
```json
"systemMessage": "You are a Testing Specialist responsible for creating and executing comprehensive test suites...",
"includedTools": [
    "spawn_agent", "speak_to_agent", "get_agents", "return_results",
    "read_file", "write_file", "edit_file", "list_directory",
    "exact_search", "execute_terminal", "execute_script"
]
```

**Fixed test-runner configuration**:
```json
"systemMessage": "You are a Test Execution Specialist focused on running existing tests and reporting results. You do NOT write tests - that's the developer's job.\n\nPRIMARY RESPONSIBILITIES:\n1. DISCOVER how to run tests in the project (package.json, Makefile, etc.)\n2. EXECUTE test commands using execute_terminal\n3. ANALYZE test results and identify failures\n4. REPORT detailed test outcomes with specific error information\n5. SUGGEST fixes for failing tests (but don't implement them)\n\nWORKFLOW:\n1. Read project files to understand test setup\n2. Run test commands (npm test, pytest, etc.)\n3. Parse output to identify failures\n4. Provide clear, actionable failure reports\n5. Use return_results with detailed test summary\n\nFOCUS AREAS:\n- Test execution, not test creation\n- Clear error reporting and analysis\n- Actionable feedback for developers",

"includedTools": [
    "return_results",
    "read_file",
    "list_directory",
    "execute_terminal"
]
```

#### Step 6.4: Specialized Git-Manager Role

**Current git-manager systemMessage (line 72)**:
```json
"systemMessage": "You are a Git Operations Specialist responsible for version control management. You handle git operations including commits, branches, merges, and repository management. You follow git best practices, write meaningful commit messages, and manage branching strategies effectively. You ensure clean git history and proper version control workflows. When you complete git operations, use return_results to provide a summary of version control actions taken."
```

**Fixed git-manager systemMessage**:
```json
"systemMessage": "You are a Git Operations Specialist focused on SAFE version control operations.\n\nSAFETY FIRST:\n- ALWAYS use 'git status' before any operation\n- ALWAYS use 'git diff' to review changes before committing\n- NEVER use destructive commands (reset --hard, force push, etc.)\n- NEVER commit without reviewing changes first\n\nWORKFLOW:\n1. CHECK current status with 'git status'\n2. REVIEW changes with 'git diff' \n3. STAGE specific files with 'git add <file>'\n4. COMMIT with meaningful messages\n5. PUSH safely to remote branches\n\nBEST PRACTICES:\n- Write clear, descriptive commit messages\n- Commit related changes together\n- Use conventional commit format when possible\n- Check branch status before operations\n\nCOMPLETION:\n- Use return_results with summary of git operations\n- Include commit hashes and branch information\n- Report any conflicts or issues encountered"
```

### LOW PRIORITY FIX 7: Documentation Terminology

**Problem**: Documentation uses misleading terminology suggesting filesystem isolation.

#### Step 7.1: Update Specification Terminology

**File**: `docs/functional-specification/agents/agentic-system-spec.md`

**Current Code (line 13)**:
```markdown
3. **Isolated Contexts**: Every spawned agent operates in a completely isolated environment with its own `AIAPIClient` instance. This prevents context pollution and allows each agent to remain focused on its specific task.
```

**Fixed Code**:
```markdown
3. **Isolated Contexts**: Every spawned agent operates in a completely isolated context with its own `AIAPIClient` instance. This prevents context pollution and allows each agent to remain focused on its specific task.
```

## Test Updates Required

The following test files need updates to reflect the new agent hierarchy system:

### Update AgentManager Tests

**File**: `tests/agents/AgentManager.test.js`

**Key Changes Needed**:
1. Update `spawnAgent` tests to use agent IDs instead of roles
2. Update `listAgents` tests to use agent IDs for hierarchy lookup
3. Add tests for parent notification system
4. Update context mocking to include `currentAgentId`

### Update Integration Tests

**File**: `tests/agents/agent-collaboration.integration.test.js`

**Key Changes Needed**:
1. Update agent spawning scenarios to track agent IDs
2. Test parent-child messaging with actual agent IDs
3. Verify result notification flows to parent agents
4. Test status transitions during communication

### Update Tool Tests

**Files**: `tests/unit/tools/spawn_agent.test.js`, `tests/unit/tools/get_agents.test.js`, `tests/unit/tools/speak_to_agent.test.js`, `tests/unit/tools/return_results.test.js`

**Key Changes Needed**:
1. Update context mocking to include `currentAgentId`
2. Test new asynchronous communication model
3. Verify enhanced tool documentation compliance
4. Test status-based messaging restrictions

## Implementation Priority and Timeline

### Phase 1: Critical Fixes (Must complete before merge)
**Estimated Time**: 2-3 days

1. **Agent Hierarchy System** (6-8 hours)
   - Update AgentManager.spawnAgent()
   - Update AgentManager.listAgents()
   - Update tool context passing
   - Update get_agents tool
   - Update related tests

2. **Asynchronous Communication** (4-6 hours)
   - Update AgentManager.sendMessageToAgent()
   - Add _executeAgentAsync() method
   - Update speak_to_agent tool
   - Update related tests

3. **Agent Status Management** (3-4 hours)
   - Update AgentProcess.execute()
   - Update status transition logic
   - Update README documentation
   - Update related tests

4. **Parent Notification System** (4-5 hours)
   - Add _notifyParentOfCompletion() method
   - Update reportResult() method
   - Update return_results tool response
   - Update related tests

### Phase 2: High Priority Fixes (Should complete before merge)
**Estimated Time**: 1-2 days

1. **Tool Documentation Enhancement** (3-4 hours)
   - Update get_agents definition
   - Update speak_to_agent definition
   - Add usage guidance
   - Update tool tests

### Phase 3: Medium Priority Fixes (Can be follow-up PR)
**Estimated Time**: 1-2 days

1. **Role Configuration Improvements** (4-6 hours)
   - Update PM role configuration
   - Update Architect role configuration
   - Update test-runner role configuration
   - Update git-manager role configuration
   - Test role behavior

### Phase 4: Low Priority Fixes (Documentation cleanup)
**Estimated Time**: 1-2 hours

1. **Documentation Terminology** (1-2 hours)
   - Update specification terminology
   - Update README files

## Success Criteria Checklist

- [ ] **Agent Hierarchy**: System uses agent IDs instead of role names for parent-child relationships
- [ ] **Asynchronous Communication**: Messages are sent asynchronously without blocking
- [ ] **Status Management**: Agent status transitions work correctly with proper messaging rules
- [ ] **Parent Notification**: Results are automatically forwarded to parent agents
- [ ] **Tool Documentation**: All tools have comprehensive documentation with usage guidance
- [ ] **Role Configurations**: All roles have specific workflow guidance and appropriate tools
- [ ] **Test Coverage**: All tests pass and cover new functionality
- [ ] **No Breaking Changes**: Existing functionality continues to work
- [ ] **Documentation Accuracy**: All documentation uses correct terminology

## Final Notes

This comprehensive fixes plan addresses all 18 review comments and provides detailed implementation guidance. Each fix includes:

- **Problem identification** with specific file locations
- **Current code** showing what needs to be changed
- **Fixed code** showing the exact replacement
- **Context** explaining why the change is needed

The plan is designed to be self-contained, allowing any proficient developer unfamiliar with the codebase to implement all necessary changes correctly. The priority system ensures critical architectural issues are addressed first, while lower-priority improvements can be handled in follow-up work.

**Important**: Test each phase thoroughly before proceeding to the next. The agent hierarchy changes are foundational and affect all other components.
