# Phase 3: User Input Mechanisms

**Goal:** Implement the two distinct methods for a running workflow to receive input from the user: an explicit, tool-based request and an implicit, interruption-based "resume" flow.

**Pre-requisites:** Phase 1 and 2 must be complete. The application must have a non-blocking workflow engine that can receive routed input.

---

## 1. Detailed Implementation Steps

### Step 3.1: Implement the `request_users_input` Tool

1.  **Create the Tool File:**

    - Create a new file: `src/tools/request_users_input/RequestUsersInputCommand.js`.
    - Define a new class `RequestUsersInputCommand` that extends `BaseTool`.

2.  **Implement the Tool Logic:**

    - The tool's `execute(args)` method will be unique. It doesn't call an external API. Instead, it needs to signal to the `WorkflowStateMachine` that it must pause and wait for input.
    - **Recommended Approach:** The `execute` method will return a special, symbolic `Promise` that never resolves on its own. The `WorkflowStateMachine` will `await` this promise, effectively pausing its execution loop.

3.  **Modify the `WorkflowStateMachine`:**
    - In `_executeState`, when a tool call for `request_users_input` is detected, instead of just calling the tool, it will store the `resolve` function of the special promise.
    - In the `handleUserInput` method, if the machine is paused waiting for this tool, it will call the stored `resolve` function with the user's input. This unpauses the `_executeState` method, and the user's text becomes the return value of the tool call.

### Step 3.2: Implement the "Resume" State Logic

- **File to Edit:** `src/workflow/WorkflowStateMachine.js`
- **Task:** Modify the `handleUserInput(input)` method.
    1.  Add a check to see if the workflow is currently paused waiting for the `request_users_input` tool. If it is, do nothing further; the logic from Step 3.1 will handle it.
    2.  If the workflow is running freely, this is an unsolicited interruption. Proceed with the resume logic.
    3.  Load the workflow's configuration and check if a state named `"resume"` is defined in the `states` array.
    4.  **If `resume` state exists:**
        - Add the user's input to a known location in the shared data object: `this.commonData.resume_input = input;`
        - Force the state machine to the resume state: `this.currentStateName = "resume";`
        - The main execution loop will automatically pick up the new state on its next iteration.
    5.  **If `resume` state does NOT exist:**
        - Log a warning to the user that the workflow does not support interruption and will be restarted.
        - Force the state machine to the start state: `this.currentStateName = "start";`

## 2. Testing Strategy

### Unit & Integration Tests

- **`request_users_input` Tool:** Write a test that mocks the `WorkflowStateMachine`. Call the tool and assert that the state machine enters a "paused" state. Then, simulate user input and assert that the tool's promise resolves with the correct value.
- **`WorkflowStateMachine` (Resume Logic):** Write a unit test for the `handleUserInput` method.
    1.  Create a mock workflow _with_ a `resume` state. Call `handleUserInput` and assert that `commonData.resume_input` is set and `currentStateName` is changed to `"resume"`.
    2.  Create a mock workflow _without_ a `resume` state. Call `handleUserInput` and assert that `currentStateName` is changed to `"start"`.

### Manual End-to-End Tests

1.  **Create a `request_input_test` workflow:** This workflow will have a state where an agent uses the `request_users_input` tool to ask a question (e.g., "What should I do next?").

    - **Test:** Run the workflow. Verify that it prints the question and pauses. The prompt should remain active. Type a response and press Enter. Verify the workflow resumes and uses your input in the next state.

2.  **Create a `resume_test` workflow:** This workflow will have a `resume` state defined. The main loop could be a simple counter. The `resume` state could print the value of `commonData.resume_input` and then transition back to the main loop.

    - **Test:** Run the workflow. While it is counting, type an interruption message (e.g., "hello"). Verify that the workflow immediately prints the message from the `resume` state and then continues its main loop.

3.  **Test a workflow without a `resume` state (e.g., `grocery_store_test`):**
    - **Test:** Run the workflow. While it is running, type an interruption message. Verify that you see a warning and that the workflow gracefully restarts from its `start` state.
