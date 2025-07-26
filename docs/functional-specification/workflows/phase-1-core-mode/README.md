# Phase 1: Core Mode & Input Routing

**Goal:** Establish a global `currentMode` and correctly route user input based on that mode. This phase lays the foundation for the interactive workflow experience by decoupling input handling from any single component.

**Pre-requisites:** A solid understanding of the existing application startup sequence in `src/core/app.js` and how commands are registered and executed.

---

## 1. Detailed Implementation Steps

### Step 1.1: Update Application Configuration

- **File to Edit:** `src/config/defaults/application.json`
- **Task:** Locate the `ui_settings` object. Rename the `defaultRole` key to `currentMode`. Change its value from `"dude"` to `"role:dude"`.

    - **Why:** This establishes the new, explicit mode system as a core part of the application's configuration.

- **File to Edit:** `src/config/managers/configManager.js`
- **Task:** Search for any instance of `defaultRole` within this file. It is likely used to retrieve the default setting. Update these references to use `currentMode` instead. Pay close attention to the `getConfig()` or similar methods.
    - **Why:** This ensures the application continues to load its initial configuration correctly without errors.

### Step 1.2: Implement Central Input Router

- **File to Edit:** `src/core/app.js` (within the `AICoderConsole` class)
- **Task:** Modify the `handleInput(input)` method.
    1.  The first check in the method should be `if (input.trim().startsWith(''))`. If true, let the `commandHandler` process it as usual and `return`. This preserves global command availability.
    2.  After the command check, retrieve the current mode: `const mode = this.config.getConfig().ui.currentMode;`
    3.  If `mode.startsWith('workflow:')`, route the input to the (yet to be implemented) active workflow: `this.activeWorkflow.handleUserInput(input);` and then `return`.
    4.  If the mode is `role:`, let the existing logic for prompt enhancement and `apiClient.sendUserMessage(finalPrompt)` proceed.
    - **Why:** This change centralizes the decision-making for all non-command input into a single, easily understandable location.

### Step 1.3: Update Mode-Switching Commands

- **File to Edit:** `src/commands/role/RoleCommand.js`
- **Task:** In the `implementation` method, find where it sets the AI's system message. At this spot, add a line to update the application's configuration. This will require access to the `ConfigManager` instance, which may need to be passed into the command's context.

    - `this.config.setConfig('ui.currentMode', `role:${roleName}`);`
    - **Why:** This command now correctly updates the global application mode, making the change persistent and visible to the input router.

- **File to Edit:** `src/commands/workflow/WorkflowCommand.js`
- **Task:** Drastically simplify the `implementation` method.
    1.  Its new primary job is to set the mode: `this.config.setConfig('ui.currentMode', `workflow:${workflowName}`);`
    2.  It should then set `app.isWorkflowActive = true;` and `app.activeWorkflow = new WorkflowStateMachine(...)`.
    3.  Finally, it should call `app.activeWorkflow.start(...)`. All logic for prompting the user for input is now removed from this file.
    - **Why:** This aligns the command with its new, singular responsibility: activating a workflow mode.

## 2. Testing Strategy

### Unit & Integration Tests

- **`ConfigManager`:** Write a test to confirm that calling `config.getConfig().ui.currentMode` returns the value from the JSON file.
- **`app.js` Router:** Write a unit test for the `handleInput` method. Provide it with a mock `config` object. Call `handleInput` with a non-command string and assert that `apiClient.sendUserMessage` is called when the mode is `role:test` and that `activeWorkflow.handleUserInput` is called when the mode is `workflow:test`.
- **Commands:** Write unit tests for the `RoleCommand` and `WorkflowCommand` to ensure they call `config.setConfig` with the correctly formatted string.

### Manual End-to-End Tests

1.  **Initial State:** Launch the application. The prompt should be the default (`> ` or similar). Send a message like "hello". It should be processed by the AI.
2.  **Switch to Role:** Type `/role coder`. The role should switch. Send a message like "what is a class?" and verify the AI responds from a coder's perspective.
3.  **Enter Workflow Mode:** Type `/workflow grocery_store_test`. The application prompt should change to `(workflow: grocery_store_test) >` (this UI change will be fully implemented in Phase 2, but the mode itself should be active).
4.  **Test Input Routing:** Type a message like "hello workflow". **Expected behavior:** Nothing happens visually, and the AI does not respond. This is correct for this phase, as the workflow engine isn't yet equipped to process the input.
5.  **Test Command Availability:** While in workflow mode, type `/cost`. The cost command should execute correctly.
6.  **Exit Workflow Mode:** Type `/workflow stop` (or your designated command). The prompt should revert to the default, and the application should be back in `role:dude` mode. Sending "hello" again should go to the AI.
