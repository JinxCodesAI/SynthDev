# Agentic Collaboration System Specification

## 1. Overview

This document outlines the functional specification for a new **Agentic Collaboration System** within SynthDev. The goal is to create a general-purpose framework that allows any AI role to be "supercharged" with the ability to spawn, manage, and collaborate with other agents. This enables multiple specialized agents to work together on complex tasks, such as a `coder` agent writing code and a `test_writer` agent creating corresponding tests.

The system is designed to be robust, preventing common failure modes like context pollution and silent task failures. This is achieved through a combination of isolated agent contexts and a central, deterministic **Agent Manager** that oversees agent lifecycles and communication.

## 2. Core Principles

1.  **Agents as Supercharged Roles**: The ability for an agent to supervise others is not a new, distinct feature but an enhancement of the existing role system. A role becomes "agentic" or a "supervisor" simply by having a new `enabled_agents` property in its configuration.
2.  **Deterministic System Core**: The complexity of agent lifecycle management, failure detection, and inter-agent communication is handled by a non-AI `AgentManager` component, not by the AI agents themselves. This makes the system's behavior predictable and robust.
3.  **Isolated Contexts**: Every spawned agent operates in a completely isolated environment with its own `AIAPIClient` instance. This prevents context pollution and allows each agent to remain focused on its specific task.
4.  **Event-Driven Communication**: Agents interact through a standardized set of tools (`spawn_agent`, `speak_to_agent`, `return_results`). The `AgentManager` acts as a message bus and watchdog, notifying supervisor agents of key events like task completion or unexpected termination.
5.  **Robust Failure Handling**: The system is explicitly designed to catch silent failures. The `AgentManager` detects when a worker agent terminates without formally calling `return_results` and escalates the issue to its supervisor for intervention.

## 3. High-Level Architecture

### Core Components

- **Agentic Role**: A standard SynthDev role that has been "supercharged" with a new `enabled_agents` property in its JSON configuration. This property lists the other roles it is permitted to spawn and manage.
- **Supervisor Agent**: An instance of an Agentic Role that initiates and manages one or more worker agents.
- **Worker Agent**: An instance of any role that is spawned by a Supervisor to perform a specific task.
- **AgentManager**: A new, deterministic, non-AI system component responsible for:
    - Managing the lifecycle of all spawned agents (creation, tracking, termination).
    - Enforcing permissions based on the `enabled_agents` configuration.
    - Monitoring agent processes for silent failures.
    - Routing messages between agents.
    - Notifying supervisor agents of child agent status changes.
- **Agent-Management Tools**: A new suite of tools available only to Agentic Roles:
    - `spawn_agent(role, task_prompt)`: Creates a new worker agent.
    - `despawn_agent(agent_id)`: Removes a completed or failed agent to free up resources.
    - `speak_to_agent(agent_id, message)`: Sends a message to a specific worker agent.
    - `get_agents()`: Lists all agents spawned by the current supervisor.
    - `return_results(result_object)`: The formal mechanism for a worker agent to signal task completion.

### Configuration Example

An `enabled_agents` property in `roles.json` would turn the `coder` into a supervisor that can manage testers and reviewers:

```json
{
    "coder": {
        "level": "base",
        "systemMessage": "You are a coder...",
        "enabled_agents": ["test_writer", "reviewer"],
        "tools": ["read_files", "write_file", "..."]
    },
    "test_writer": {
        "level": "base",
        "systemMessage": "You are a test writer...",
        "tools": ["read_files", "write_file", "execute_terminal"]
    }
}
```

## 4. Implementation Phases

### Phase 1: Core Agent & Tooling Foundation

**Goal**: Establish the foundational tools, configuration, and components for creating and communicating with agents.

**User Stories**:

- As a developer, I want to define in a role's configuration which other roles it is allowed to spawn.
- As a developer, I want to use an agentic role to manually spawn a worker agent with a specific task so it can work in an isolated context.
- As a developer, I want to send a follow-up message to a spawned agent to clarify instructions.
- As a developer, I want a spawned agent to be able to signal when it has finished its work by returning a structured result.

**Deliverables**:

1.  **New Tools**: Implement `spawn_agent`, `speak_to_agent`, `get_agents`, and `return_results`.
2.  **Role Configuration Update**: Modify the role loading system to recognize and process the new `enabled_agents` property.
3.  **Agent Context Isolation**: Ensure each spawned agent gets its own isolated `AIAPIClient` instance.
4.  **Basic `AgentManager`**: Implement the initial `AgentManager` to track spawned agents, their parent-child relationships, and enforce `enabled_agents` permissions.

**Success Criteria**:

- A role with `enabled_agents` configured can successfully use `spawn_agent`.
- An attempt to spawn a role not listed in `enabled_agents` results in a clear error.
- A supervisor can use `speak_to_agent` to communicate with its worker.
- A worker can successfully use `return_results` to signal completion.

### Phase 2: Supervised Execution & Failure Recovery

**Goal**: Implement the full supervised execution loop, including the `AgentManager`'s ability to detect and handle silent failures.

**User Stories**:

- As a user, I want a supervisor agent to automatically delegate a task to a worker agent and monitor its progress.
- As a user, I want the system to automatically detect if a worker agent gets "stuck" or exits without finishing, so its supervisor can intervene.
- As a user, I want the supervisor agent to report the final, verified result to me only when the entire collaborative task is complete.

**Deliverables**:

1.  **Agentic Role Integration**: Integrate the agentic system with the existing `/role` command. When a user switches to a role with `enabled_agents`, the `AgentManager` becomes active for that session.
2.  **Enhanced `AgentManager` (Watchdog)**:
    - Add logic to detect when a child agent's process terminates without calling `return_results`.
    - Implement the mechanism for the `AgentManager` to send an "ad hoc" alert to the parent supervisor agent upon detecting a silent failure.
3.  **Supervisor Agent Logic**:
    - Implement the general AI-side logic for a supervisor agent to:
        - Parse the `return_results` object from a worker to verify completion.
        - Handle failure alerts from the `AgentManager` by re-engaging the worker with `speak_to_agent`.

**Success Criteria**:

- Switching to an agentic role (e.g., `/role agentic.coder`) successfully enables the agentic system.
- When a worker agent is terminated prematurely (simulated failure), the `AgentManager` correctly alerts its supervisor.
- The supervisor agent successfully intervenes to get the task back on track after a failure alert.

### Phase 3: Advanced Features & UI Polish

**Goal**: Improve the usability and observability of the agentic system.

**User Stories**:

- As a user, I want to see a list of all the agent processes that are currently running or have been completed.
- As a user, I want to be able to inspect the detailed conversation history between a supervisor and its workers.
- As a user, I want the console output to clearly distinguish between my conversation and the conversations between agents.

**Deliverables**:

1.  **New UI Commands for Agent Processes**:
    - `/agents`: Lists all active and completed agent processes with their hierarchy and status (e.g., `running`, `completed`, `failed`).
    - `/agent <id>`: Displays the detailed history of a specific agent process, including the full conversation history.
2.  **UI Enhancements**:
    - Update the `ConsoleInterface` to format and prefix agent-to-agent communication differently for clarity.

**Success Criteria**:

- The `/agents` and `/agent <id>` commands provide accurate and useful information about running processes.
- The console output is clear and easy to follow, even with multiple agents communicating.

## 5. New System Components (File Structure)

```
src/
├── agents/                     # New directory for agent management
│   ├── AgentManager.js         # The core, non-AI task orchestrator
│   └── AgentProcess.js         # Represents a single spawned agent instance
├── tools/
│   ├── spawn_agent/
│   │   ├── definition.json
│   │   └── implementation.js
│   ├── despawn_agent/
│   │   ├── definition.json
│   │   └── implementation.js
│   ├── speak_to_agent/
│   │   ├── definition.json
│   │   └── implementation.js
│   ├── get_agents/
│   │   ├── definition.json
│   │   └── implementation.js
│   └── return_results/
│       ├── definition.json
│       └── implementation.js
├── config/
│   └── roles/
│       └── agentic-roles.json    # Example roles with 'enabled_agents' property
└── commands/
    └── agents/                  # New directory for agent-related commands
        └── ListAgentsCommand.js
tests/
└── agents/                     # New directory for agent system tests
    ├── AgentManager.test.js
    └── agent-collaboration.e2e.test.js
```

## 6. Success Metrics

- **Task Completion Rate**: The system should be able to reliably complete complex, multi-agent tasks that would cause a single agent to fail.
- **Failure Detection**: The `AgentManager` must demonstrate a 100% success rate in detecting and reporting silent agent failures in test scenarios.
- **Flexibility**: The system should successfully support different collaborative workflows (e.g., supervisor-worker, peer-to-peer handoff) as defined by the agentic roles.
- **Context Purity**: The user's main conversation context must remain free of verbose tool outputs and intermediate agent "thinking" steps.
