# Required Development Plan

This document provides a detailed, step-by-step development plan for implementing the desired interactive workflow architecture. The plan is designed to introduce the new functionality through a series of minimal, targeted changes. Each phase includes a dedicated testing strategy to ensure stability and correctness.

For a developer-focused, step-by-step guide, please refer to the `README.md` file inside each phase's respective folder.

## Phase 1: Core Mode & Input Routing

**Goal:** Establish the global `currentMode` and correctly route user input without altering the workflow engine itself.

### 1.1. Update Application Configuration

- **File:** `src/config/defaults/application.json`
- **Change:** Rename `defaultRole` to `currentMode` and set its value to `"role:dude"`.

### 1.2. Implement Mode State and Input Routing

- **File:** `src/core/app.js`
- **Change:** Implement the central input router in the `handleInput` method to delegate input based on the `currentMode` (`role:` vs `workflow:`).

### 1.3. Update Mode-Switching Commands

- **Files:** `src/commands/role/RoleCommand.js`, `src/commands/workflow/WorkflowCommand.js`
- **Change:** Modify commands to set the `currentMode` configuration value instead of directly controlling application state.

### 1.4. Testing Strategy

- **Unit Tests:**
    - Verify that `ConfigManager` correctly loads `currentMode` instead of `defaultRole`.
    - Test the `handleInput` router in `app.js` with mock objects to ensure it calls the correct service (`apiClient` or `workflowStateMachine`) based on the mode.
    - Test the `RoleCommand` and `WorkflowCommand` to ensure they correctly format and set the `currentMode` string.
- **Manual E2E Tests:**
    1.  Start the application. Verify it defaults to `role:dude`.
    2.  Send a message. Verify it communicates with the standard AI.
    3.  Use `/role coder`. Verify the mode changes to `role:coder`.
    4.  Use `/workflow grocery_store_test`. Verify the mode changes to `workflow:grocery_store_test`.
    5.  At this stage, non-command input in workflow mode will do nothing, which is expected. Verify that commands like `/cost` still work.
    6.  Use `/workflow stop` (or similar new command) to verify the mode correctly reverts to the default role.

---

## Phase 2: Non-Blocking Workflow Engine & UI Feedback

**Goal:** Allow the workflow to run in the background and provide real-time feedback to the user without blocking the prompt.

### 2.1. Make the State Machine Non-Blocking

- **File:** `src/workflow/WorkflowStateMachine.js`
- **Change:** Add a small `await sleep(100);` delay inside the main execution `while` loop.

### 2.2. Implement Event Emitter for UI Updates

- **File:** `src/workflow/WorkflowStateMachine.js`
- **Change:** Convert the class into an `EventEmitter` and emit lifecycle events (`stateChanged`, `agentThinking`, etc.) during execution.

### 2.3. Create the UI Wrapper/Listener

- **Files:** `src/core/app.js`, `src/core/interface/consoleInterface.js`
- **Change:** In `app.js`, subscribe to the workflow's events. In `consoleInterface.js`, add a method to display status messages above the active prompt.

### 2.4. Testing Strategy

- **Unit Tests:**
    - Test the `WorkflowStateMachine` to ensure it emits the correct events with the correct payloads at each step of a mock execution.
    - Test the new `consoleInterface` method to ensure it formats and displays status messages correctly.
- **Manual E2E Tests:**
    1.  Run a workflow that has multiple states (e.g., `grocery_store_test`).
    2.  Verify that status messages for state transitions and agent activity are printed to the console in real-time.
    3.  Verify that the user prompt `(workflow: ...)>` remains active and usable at the bottom of the screen while these messages are being displayed.

---

## Phase 3: Implementing User Input Mechanisms

**Goal:** Provide the two defined methods for a workflow to receive user input.

### 3.1. Implement the `request_users_input` Tool

- **File:** `src/tools/request_users_input/RequestUsersInputCommand.js` (new file)
- **Change:** Create a new tool that pauses the workflow and waits for user input.

### 3.2. Implement the "Resume" State Logic

- **File:** `src/workflow/WorkflowStateMachine.js`
- **Change:** In `handleUserInput`, implement the logic to check for a `resume` state and either jump to it or restart the workflow if the input is unsolicited.

### 3.3. Testing Strategy

- **Unit Tests:**
    - Test the `request_users_input` tool to ensure it correctly signals a pause and returns the user's input.
    - Test the `handleUserInput` method in `WorkflowStateMachine` to verify the "resume" logic. Mock a workflow with and without a `resume` state to test both paths.
- **Integration/E2E Tests:**
    1.  Create a new test workflow that uses the `request_users_input` tool. Run it and verify that it pauses, accepts your input, and then continues execution using that input.
    2.  Create another test workflow that has a `resume` state. Run it, and while it's in the middle of a step, type a message. Verify that the workflow immediately transitions to the `resume` state.
    3.  Run a workflow _without_ a `resume` state. Interrupt it with a message and verify that it gracefully restarts from the `start` state.
