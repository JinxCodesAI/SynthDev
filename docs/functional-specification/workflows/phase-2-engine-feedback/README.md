# Phase 2: Non-Blocking Engine & UI Feedback

**Goal:** Evolve the `WorkflowStateMachine` from a blocking process to a non-blocking, background process that provides real-time feedback to the user without interrupting their ability to use the command prompt.

**Pre-requisites:** Phase 1 must be complete. The application must be able to enter and exit workflow mode and correctly route input.

---

## 1. Detailed Implementation Steps

### Step 2.1: Make the State Machine Non-Blocking

- **File to Edit:** `src/workflow/WorkflowStateMachine.js`
- **Task:** Locate the `_executeStateMachine` method. Inside its `while` loop, add a small, non-blocking delay.
    1.  Create a simple helper function: `const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));`
    2.  At the beginning or end of the `while (currentStateName && currentStateName !== 'stop')` loop, add the line: `await sleep(100);`
    - **Why:** This is the most critical and simplest change to prevent the workflow from consuming 100% of a CPU core. It yields control back to the Node.js event loop, allowing other operations (like listening for user input) to occur.

### Step 2.2: Implement Event Emitter

- **File to Edit:** `src/workflow/WorkflowStateMachine.js`
- **Task:** Turn the class into an event emitter.
    1.  Import Node.js's built-in `EventEmitter`: `import { EventEmitter } from 'events';`
    2.  Change the class definition: `export default class WorkflowStateMachine extends EventEmitter { ... }`
    3.  In the `constructor`, call the parent constructor: `super();`
    4.  In the `_executeState` method, emit events at key moments:
        - After identifying the current state: `this.emit('stateChanged', state.name);`
        - Right before calling `agent.makeContextCall()`: `this.emit('agentThinking', agent.getRole());`
        - If the agent's response contains content, emit it: `this.emit('agentResponse', responseContent);`
    - **Why:** This decouples the workflow's internal logic from the UI. The state machine's only job is to announce what it's doing; it doesn't know or care how that information is displayed.

### Step 2.3: Create the UI Listener

- **File to Edit:** `src/core/app.js` (`AICoderConsole` class)
- **Task:** When a workflow is started by the `WorkflowCommand`, attach the listeners that will react to the emitted events.

    1.  In the `WorkflowCommand` implementation, after creating the `WorkflowStateMachine` instance, pass it to a new method on the `app` instance, e.g., `app.registerActiveWorkflow(workflowInstance);`
    2.  In `app.js`, the `registerActiveWorkflow` method will contain the listener logic:
        ```javascript
        this.activeWorkflow.on('stateChanged', newState => {
            this.consoleInterface.showWorkflowStatus(`Transitioned to state: ${newState}`);
        });
        this.activeWorkflow.on('agentThinking', agentRole => {
            this.consoleInterface.showWorkflowStatus(`Agent [${agentRole}] is thinking...`);
        });
        // etc.
        ```

    - **Why:** This keeps the responsibility of managing the UI updates within the core application logic, not the command itself.

- **File to Edit:** `src/core/interface/consoleInterface.js`
- **Task:** Implement the `showWorkflowStatus(message)` method.
    - This method needs to be ableto print a line of text _above_ the current prompt line. The `readline` module in Node.js provides methods for this, such as `readline.cursorTo(process.stdout, 0);`, `readline.clearLine(process.stdout, 1);`, and then rewriting the prompt.
    - It should save the current prompt content, clear the line, print the status message, and then reprint the saved prompt content.
    - **Why:** This is essential for a clean user experience, preventing status updates from being jumbled with user input.

## 2. Testing Strategy

### Unit & Integration Tests

- **`WorkflowStateMachine` Emitter:** Write a unit test that executes a mock workflow. In the test, listen for the `stateChanged` and `agentThinking` events and assert that they are called in the correct order and with the correct data (e.g., the state name or agent role).
- **`ConsoleInterface` Display:** This is difficult to unit test directly. A manual test is more effective. However, you can write a test to ensure the `showWorkflowStatus` method calls the underlying `readline` functions with the correct arguments.

### Manual End-to-End Tests

1.  **Run a Workflow:** Execute `/workflow grocery_store_test`.
2.  **Observe Real-time Updates:** As the workflow runs, verify that you see messages like:
    - `Transitioned to state: start`
    - `Agent [grocery_worker] is thinking...`
    - `Transitioned to state: customer_decision`
    - `Agent [customer] is thinking...`
3.  **Verify Non-Blocking Prompt:** Crucially, while these messages are appearing, verify that your cursor is still active in the prompt `(workflow: grocery_store_test) >` at the bottom of the screen.
4.  **Test Command Interruption:** While the workflow is running, type `/cost` and press Enter. The workflow status messages should continue to appear, but the `cost` command should execute successfully and display its output, demonstrating that the UI is not blocked.
