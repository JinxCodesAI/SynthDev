# Automatic Cleanup Functionality Demo

This document demonstrates the automatic cleanup functionality that has been implemented in the application.

## Overview

The application now automatically cleans up temporary Git branches when exiting, provided certain conditions are met. This helps maintain a clean Git state by removing temporary branches that have no changes.

## How It Works

### 1. Exit Detection

The cleanup process triggers when the user exits the application through:

- Using the `/exit` command
- Forceful termination (e.g., Ctrl+C, window close, process kill)

### 2. Cleanup Conditions

The automatic cleanup will only execute if ALL of the following conditions are true:

- Git integration is currently active/enabled
- The user is currently on a temporarily created branch (not the original source branch)
- The current branch has zero uncommitted changes relative to the source branch

### 3. Cleanup Actions

When all conditions are met, the system automatically:

- Switches the user back to the original source branch
- Deletes the temporarily created branch
- Performs this cleanup silently without prompting the user for confirmation

### 4. Error Handling

The cleanup process handles potential Git errors gracefully and doesn't prevent the application from exiting if cleanup fails.

## Implementation Details

### New Methods Added

#### SnapshotManager

1. **`shouldPerformCleanup()`** - Checks all conditions for cleanup

    ```javascript
    const result = await snapshotManager.shouldPerformCleanup();
    // Returns: { shouldCleanup: boolean, reason?: string }
    ```

2. **`performCleanup()`** - Executes the cleanup process
    ```javascript
    const result = await snapshotManager.performCleanup();
    // Returns: { success: boolean, error?: string }
    ```

#### GitUtils

3. **`deleteBranch(branchName, force)`** - Deletes a Git branch
    ```javascript
    const result = await gitUtils.deleteBranch('branch-name', false);
    // Returns: { success: boolean, error?: string }
    ```

#### AICoderConsole (app.js)

4. **`handleExit(exitCode)`** - Centralized exit handler with cleanup

    ```javascript
    await app.handleExit(0); // Performs cleanup and exits
    ```

5. **`setupSignalHandlers()`** - Sets up signal handlers for graceful shutdown
    ```javascript
    app.setupSignalHandlers(); // Called during app startup
    ```

### Signal Handlers

The application now handles the following signals:

- **SIGINT** (Ctrl+C) - Graceful shutdown with cleanup
- **SIGTERM** (Process termination) - Graceful shutdown with cleanup
- **uncaughtException** - Error logging and exit
- **unhandledRejection** - Error logging and exit

## Example Scenarios

### Scenario 1: Successful Cleanup

```
User is on branch: synth-dev/feature-123
Original branch: main
Uncommitted changes: None
Git integration: Active

Exit action: /exit
Result:
- Switches to main
- Deletes synth-dev/feature-123
- Exits successfully
```

### Scenario 2: No Cleanup (Uncommitted Changes)

```
User is on branch: synth-dev/feature-123
Original branch: main
Uncommitted changes: Yes
Git integration: Active

Exit action: /exit
Result:
- No cleanup performed
- Exits successfully
- Branch synth-dev/feature-123 remains
```

### Scenario 3: No Cleanup (Git Not Active)

```
User is on branch: main
Git integration: Not active

Exit action: /exit
Result:
- No cleanup performed
- Exits successfully
```

## Testing

The implementation includes comprehensive tests:

### Unit Tests

- `tests/unit/snapshotManager.cleanup.test.js` - Tests cleanup logic
- `tests/unit/commands/exitCommand.test.js` - Tests exit command integration

### Integration Tests

- `tests/integration/cleanup.test.js` - Tests complete cleanup flow

### Running Tests

```bash
# Run cleanup-specific tests
npm test -- --testPathPattern="cleanup"

# Run exit command tests
npm test -- --testPathPattern="exitCommand"

# Run all tests
npm test
```

## Benefits

1. **Clean Git State** - Automatically removes temporary branches with no changes
2. **User-Friendly** - No manual cleanup required
3. **Safe** - Only cleans up when it's safe to do so
4. **Robust** - Handles errors gracefully without preventing exit
5. **Transparent** - Logs cleanup actions for user awareness

## Configuration

No additional configuration is required. The cleanup functionality works automatically based on the current Git state and application context.
