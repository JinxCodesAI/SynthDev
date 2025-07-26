# Desired Workflow System Architecture

This document outlines the target architecture for the interactive workflow mode, incorporating the concepts of a global application mode, non-blocking execution, and multiple user input mechanisms.

## 1. Core Architectural Pillars

### 1.1. Global Application Mode

The application will operate based on a single, explicit `currentMode` setting, managed by `ConfigManager` and the main `app.js` instance.

- **Configuration:** The `defaultRole` setting in `src/config/defaults/application.json` will be replaced by `currentMode`.
- **Mode Syntax:** The mode will be a string formatted as `type:name`, for example:
    - `role:dude` (Default behavior)
    - `workflow:code_architecture_review` (When a workflow is active)
- **State Management:** The `AICoderConsole` class in `app.js` will hold the active mode and the current workflow instance, making it the central authority for state.

### 1.2. Asynchronous, Non-Blocking Workflow Execution

Workflows will execute in the background without blocking the user's ability to interact with the application.

- **Modified State Machine:** The `while` loop within `WorkflowStateMachine.js` will be preserved, but it will be made non-blocking by introducing a small `sleep` delay in each iteration. This prevents the loop from consuming a CPU core while waiting for asynchronous operations or user input.
- **Event-Driven UI Updates:** The `WorkflowStateMachine` will be converted into an **Event Emitter**. It will emit events for key lifecycle moments (e.g., `state_transition`, `agent_thinking`, `workflow_output`).
- **UI Wrapper/Listener:** A listener component, likely within `app.js`, will subscribe to these events. Upon receiving an event, it will call the appropriate `ConsoleInterface` method to display status updates to the user _above_ the command prompt, ensuring the UI remains responsive.

### 1.3. Decoupled Input Routing

User input handling will be decoupled from the core AI client and will be routed based on the `currentMode`.

- **Command Priority:** All user inputs starting with `/` will be treated as commands and handled by the `CommandHandler` regardless of the current mode. This ensures that system commands like `/cost`, `/help`, or `/exit` are always available.
- **Mode-Based Routing:** For any non-command input:
    - If `currentMode` is `role:...`, the input is routed to the `AIAPIClient` for a standard conversational turn.
    - If `currentMode` is `workflow:...`, the input is routed to the active `WorkflowStateMachine` instance for processing.

## 2. User Input Mechanisms within a Workflow

A running workflow can receive user input in two distinct ways:

### 2.1. Explicit Input via a Tool (`request_users_input`)

- **Mechanism:** A new, dedicated tool named `request_users_input` will be available to agents.
- **Execution Flow:**
    1.  An agent in the workflow calls this tool.
    2.  The `ToolManager` executes it, causing the `WorkflowStateMachine` to pause its execution loop.
    3.  The system now waits for the next non-command input from the user.
    4.  When the user provides input, it is captured and returned as the result of the tool call.
    5.  The `WorkflowStateMachine` resumes its execution loop, and the agent receives the user's input as the tool's output.

### 2.2. Implicit Input via a "Resume" State

- **Mechanism:** A user can provide unsolicited input at any time while a workflow is running.
- **Configuration:** A workflow's `.json` file can optionally define a special state named `resume`.
- **Execution Flow:**
    1.  A user types a non-command message while the workflow is running but not explicitly waiting for input.
    2.  The input is routed to the active `WorkflowStateMachine`.
    3.  The state machine checks its configuration for a `resume` state.
    4.  **If `resume` state exists:** The state machine immediately halts its current operation, injects the user's input into `common_data` (e.g., `common_data.resume_input = "..."`), and forcibly transitions its current state to `resume`.
    5.  **If `resume` state does NOT exist:** The workflow is reset to its `start` state. The existing conversation context is preserved, but the execution flow begins again from the beginning.

## 3. Architectural Diagram

```mermaid
graph TD
    subgraph User Interface
        UserInput
        ConsoleDisplay
    end

    subgraph Application Core
        App[`app.js` (AICoderConsole)]
        CmdHandler(CommandHandler)
    end

    subgraph Workflow Engine
        WSM(WorkflowStateMachine)
        W_Context(WorkflowContext)
        W_Agent(WorkflowAgent)
    end

    subgraph AI/Tools
        AI(AIAPIClient)
        Tools(ToolManager)
    end

    UserInput --> App

    App -- Mode Check --> Route_Input
    subgraph Input Routing
        Route_Input{currentMode?}
    end

    Route_Input -- "/command" --> CmdHandler
    Route_Input -- "role:name" --> AI
    Route_Input -- "workflow:name" --> WSM

    WSM -- Emits Events --> App
    App -- Listens & Updates --> ConsoleDisplay

    WSM -- Manages --> W_Context
    WSM -- Manages --> W_Agent
    W_Agent -- Uses --> Tools
    W_Agent -- Uses --> AI

```
