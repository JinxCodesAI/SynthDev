# SynthDev Workflows - User Experience Functional Specification

## Executive Summary

This specification defines how SynthDev's multi-agent workflow system should integrate with the end-user experience. The proposed design pivots from a simple command-execution model to a persistent **"workflow mode,"** where users can interact with complex AI agent collaborations in a more conversational and dynamic manner.

**Current Status**: The core workflow engine is functional but follows a synchronous, "fire-and-forget" model. This specification outlines a new, more interactive UX and the architectural changes required to implement it.

## Table of Contents

1.  [User Experience Overview](#user-experience-overview)
2.  [Workflow Lifecycle Management](#workflow-lifecycle-management)
3.  [User Interaction Model](#user-interaction-model)
4.  [User Interface Design](#user-interface-design)
5.  [Required Architectural Changes](#required-architectural-changes)
6.  [Error Handling & Recovery](#error-handling--recovery)
7.  [Implementation Plan](#implementation-plan)
8.  [Affected Documentation](#affected-documentation)

## 1. User Experience Overview

### Vision Statement

Workflows should function as a persistent environment that a user enters. Instead of being a one-shot command, a workflow becomes the context for the user's conversation with the AI. This allows for richer interaction, real-time input, and greater control over complex, long-running tasks.

### Core User Journey

```
User Intent → Workflow Activation → Conversational Interaction → Results
     ↓              ↓                       ↓                      ↓
"I need help" → /workflow <name> → User provides input/guidance → Get output
               (Enters mode)      (Workflow runs, user can      (Workflow completes
                                   interject or cancel)           or is exited)
```

### Target Users

This new model targets the same users but provides a more powerful and intuitive interface for their complex tasks:

- **Developers**: Can guide a refactoring workflow step-by-step.
- **Technical Leaders**: Can interact with an architecture review, asking follow-up questions as it runs.
- **Teams**: Can collaboratively engage with a multi-step process, providing input as needed.

## 2. Workflow Lifecycle Management

### Workflow Discovery (`/workflows`)

The discovery command remains the same. It lists available workflows so the user knows which modes they can enter.

**Command Behavior:**

```bash
> /workflows
```

**Expected Output:**

```
📋 Available Workflow Modes:

🏪 grocery_store_test
   Multi-agent customer-worker interaction simulation.
   Starts: On user input.

🏗️ code_architecture_review
   Comprehensive code analysis with architect and reviewer agents.
   Starts: Immediately.

Type '/workflow <name>' to enter a workflow mode.
```

### Entering Workflow Mode (`/workflow <name>`)

This command transitions the application into a specific workflow mode.

**Command Behavior:**

```bash
> /workflow code_architecture_review
```

**Expected Output:**
The system immediately indicates that the mode has been entered. The prompt changes to reflect the current workflow context.

```
✅ Entered workflow mode: code_architecture_review
(workflow: code_architecture_review) >
```

### Exiting Workflow Mode

The user can exit the workflow mode at any time.

**Keyboard Shortcut:**

- Pressing `ESC` will immediately prompt the user to confirm exiting the workflow.

**Command:**

```bash
(workflow: code_architecture_review) > /exit
```

**Expected Output:**

```
✅ Exited workflow mode: code_architecture_review
>
```

## 3. User Interaction Model

### Workflow Start Conditions

Each workflow must define how it starts after the user enters its mode. This will be a new property in the workflow's configuration file (e.g., `start_condition`).

1.  **Starts on User Input (`on_user_input`):**

    - After the user types `/workflow <name>`, the system waits.
    - The very next message the user sends is treated as the initial input for the workflow.
    - **Example:**
        ```
        > /workflow grocery_store_test
        ✅ Entered workflow mode: grocery_store_test
        (workflow: grocery_store_test) > I need to find ingredients for a pasta dinner.
        🔄 Workflow starting with your input...
        [Workflow output begins]
        ```

2.  **Starts Immediately (`immediate`):**
    - The workflow begins execution the moment the user enters the mode.
    - This is for workflows that perform an action without needing initial data from the user (e.g., analyzing a predefined set of files).
    - **Example:**
        ```
        > /workflow code_architecture_review
        ✅ Entered workflow mode: code_architecture_review
        (workflow: code_architecture_review) > 🔄 Workflow starting immediately...
        [Workflow output begins]
        ```

### Interaction During Execution

This is the most significant change from the original specification.

- **Continuous Output:** The workflow runs in the background, printing its progress, thoughts, and results to the console in real-time (respecting the user's verbosity settings).
- **Asynchronous User Input:** While the workflow is running, the user can type and send messages at any time.
- **Input Handling:** This user input is captured and placed into a queue or buffer within the workflow's context.
- **Workflow Logic:** The workflow's internal logic (via its script functions) is responsible for checking for and deciding how to use this user input. It can be used to guide an agent, answer a question the workflow has, or change the course of the execution.

**Example Interaction:**

```
(workflow: code_architecture_review) > 🔄 Workflow starting immediately...
⚡ Executing state: analyze_dependencies
🧠 Agent architect thinking...
   Analyzing package.json to build dependency graph...
✅ Analysis complete. Found 25 dependencies.

(workflow: code_architecture_review) > focus on the 'src/core' directory first
[User input is captured by the workflow]

⚡ Executing state: identify_core_components
🧠 Agent architect thinking...
   Received user guidance: "focus on the 'src/core' directory first". Prioritizing analysis.
   Reading files in src/core...
```

## 4. User Interface Design

### Prompt

- The command prompt MUST change to indicate the active workflow mode, providing clear context to the user.
- Example: `(workflow: <name>) >`

### Output Formatting

- Workflow output should be clearly distinguished from user input.
- The visual design principles (emojis, color-coding for states) from the original specification should be retained to ensure clarity.

## 5. Required Architectural Changes

Implementing this UX requires a fundamental shift from a synchronous command model to an asynchronous, stateful one.

1.  **Application State Management (High Impact):**

    - The core application (`app.js`, `consoleInterface.js`) must be aware of a new global state: `IN_WORKFLOW`.
    - A `WorkflowSessionManager` should be introduced to manage the active workflow instance.
    - The main input loop must be modified:
        - If in `IN_WORKFLOW` mode, user input is not sent to the default AI but is instead routed to the active `WorkflowStateMachine` instance via a new method (e.g., `workflowStateMachine.handleUserInput(input)`).

2.  **`WorkflowStateMachine.js` (High Impact):**

    - The `executeWorkflow` method can no longer be a blocking `while` loop. It needs to be refactored into an event-driven or asynchronous process.
    - It needs a `start()` method that kicks off the execution.
    - It needs a `handleUserInput(input)` method to receive input from the main application loop and store it in a queue.
    - It needs a `stop()` method to terminate execution gracefully.
    - The `scriptContext` provided to script functions must be augmented with a method to access user input, e.g., `this.getUserInput()`.

3.  **Commands (Medium Impact):**

    - `/workflow <name>`: No longer executes the workflow directly. It now tells the `WorkflowSessionManager` to instantiate and activate a new workflow, putting the app in `IN_WORKFLOW` mode.
    - `/exit`: Must be updated to check if the app is in a workflow mode and call the `WorkflowSessionManager` to terminate it.

4.  **Workflow Configuration (Low Impact):**

    - The workflow's `.json` file needs a new top-level property:
        ```json
        "start_condition": "immediate" // or "on_user_input"
        ```

5.  **Console Interface (`consoleInterface.js`) (Medium Impact):**
    - Must be updated to render the new `(workflow: <name>) >` prompt when the mode is active.
    - Must capture the `ESC` key to trigger the exit confirmation flow.
    - Needs to handle displaying asynchronous output from the workflow while simultaneously waiting for user input without the two interfering with each other.

## 6. Error Handling & Recovery

- **Execution Errors:** If a workflow fails, it should exit the mode and report the error clearly. The concept of `--retry` could be adapted to re-enter the mode and attempt to resume from a saved state.
- **Input Errors:** Invalid commands sent while in workflow mode should be handled gracefully, reminding the user they are in a workflow and how to exit.

## 7. Implementation Plan

#### Phase 1: Core Architectural Changes (High Effort)

1.  Implement the `WorkflowSessionManager` and the global `IN_WORKFLOW` state.
2.  Refactor `WorkflowStateMachine` to be non-blocking and support `start()`, `stop()`, and `handleUserInput()`.
3.  Modify `WorkflowCommand` to activate the mode instead of executing directly.
4.  Update the main input loop to route input based on the application's mode.

#### Phase 2: UX and Interaction (Medium Effort)

1.  Implement the `start_condition` logic in the `WorkflowStateMachine`.
2.  Expose the user input queue to the workflow's script functions.
3.  Update the console prompt and `ESC` key handling.
4.  Adapt the `grocery_store_test` workflow to use the new interactive model.

#### Phase 3: Polish and Documentation (Low Effort)

1.  Refine error messages and UI feedback.
2.  Update all affected documentation.

## 8. Affected Documentation

The following documents will require significant updates:

- **`docs/workflows.md`**: The entire guide on creating and running workflows needs to be rewritten to reflect the new interactive, event-driven paradigm.
- **`docs/commands.md`**: The description for `/workflow` and `/exit` must be updated.
- **`docs/README.md`**: The section on workflows should be revised to describe the new UX.
- **This Document**: This document will serve as the new functional specification.
