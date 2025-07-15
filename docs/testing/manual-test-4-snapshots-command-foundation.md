# Manual Test 4: Snapshots Command Foundation Validation

## Overview

This manual test validates the basic snapshots command interface implementation, including command registration, interactive navigation, and mock functionality.

## Prerequisites

- SynthDev application is properly configured
- All tests pass: `npm test`
- Application can be started successfully

## Test Scenarios

### Scenario 1: Command Registration Verification

**Objective**: Verify that the `/snapshots` command is properly registered and accessible.

**Steps**:

1. Start the SynthDev application: `npm start`
2. Type `/help` and press Enter
3. Look for the snapshots command in the help output

**Expected Results**:

- The help output should include:
    ```
    /snapshots - Interactive snapshot management interface
       Usage: /snapshots
    ```

**Pass Criteria**: ✅ The `/snapshots` command appears in the help menu with correct description

---

### Scenario 2: Basic Command Execution

**Objective**: Verify that the snapshots command can be executed and shows the interactive interface.

**Steps**:

1. In the SynthDev application, type `/snapshots` and press Enter
2. Observe the output

**Expected Results**:

- Should display a header: `📸 Available Snapshots:`
- Should show separator line with equals signs
- Should display mode header (either Git or File-based mode)
- Should show enhanced snapshots summary with counts: `📊 Total: X | 🔗 Git: Y | 📁 File: Z`
- Should show current mode indicator: `📁 Current: File Mode` or `🔗 Current: Git Mode`
- Should show mock snapshots list with:
    - Enhanced timestamp formatting (relative time like "5m ago", "2h ago")
    - Truncated instruction text if too long
    - Mode-specific details (file counts, sizes, git hashes, etc.)
    - Proper formatting with numbered items
- Should display commands menu with available options
- Should show prompt: `snapshots> `

**Pass Criteria**: ✅ All expected interface elements are displayed correctly

---

### Scenario 3: Interactive Navigation - View Details

**Objective**: Test the snapshot detail view functionality.

**Steps**:

1. Execute `/snapshots` command
2. Type `1` and press Enter (to view details of first snapshot)
3. Observe the detailed information display
4. Press Enter to continue

**Expected Results**:

- Should display detailed snapshot information including:
    - Snapshot number and title
    - Instruction text
    - Creation timestamp
    - Mode (git/file)
    - Mode-specific details (Git hash, branch, author OR file count, modified files)
- Should prompt "Press Enter to continue..."
- Should return to main snapshots menu after pressing Enter

**Pass Criteria**: ✅ Snapshot details are displayed correctly and navigation works

---

### Scenario 4: Interactive Navigation - Restore Workflow

**Objective**: Test the snapshot restoration confirmation workflow.

**Steps**:

1. Execute `/snapshots` command
2. Type `r1` and press Enter (to restore first snapshot)
3. When prompted for confirmation, type `y` and press Enter
4. Observe the restoration process

**Expected Results**:

- Should display restoration confirmation prompt with:
    - Snapshot details
    - Warning about changes being discarded
    - Confirmation prompt: "Confirm? (y/N): "
- After confirming, should show:
    - "🔄 Restoring snapshot..." message
    - Success message with snapshot details
- Should return to snapshots menu

**Pass Criteria**: ✅ Restoration workflow completes successfully with proper confirmations

---

### Scenario 5: Interactive Navigation - Cancel Operations

**Objective**: Test cancellation of operations.

**Steps**:

1. Execute `/snapshots` command
2. Type `r1` and press Enter
3. When prompted for confirmation, type `n` and press Enter
4. Observe the cancellation behavior

**Expected Results**:

- Should display "❌ Restore cancelled" message
- Should return to snapshots menu without performing restoration

**Pass Criteria**: ✅ Operations can be cancelled properly

---

### Scenario 6: Command Menu Navigation

**Objective**: Test various command menu options.

**Steps**:

1. Execute `/snapshots` command
2. Try each of the following commands:
    - Type `invalid` and press Enter (test invalid command handling)
    - Type `q` and press Enter (test quit functionality)

**Expected Results**:

- Invalid command should show: "❌ Invalid command. Please try again."
- Quit command should exit the snapshots interface and return to main application

**Pass Criteria**: ✅ All menu navigation works as expected

---

### Scenario 7: Mode-Specific Commands (Git Mode)

**Objective**: Test Git-specific commands when in Git mode.

**Steps**:

1. Execute `/snapshots` command
2. If in Git mode (shows Git status header), try:
    - Type `m` and press Enter (merge command)
    - Type `n` when prompted for confirmation
    - Type `s` and press Enter (switch command)
    - Type `n` when prompted for confirmation

**Expected Results**:

- Merge command should show merge confirmation with branch details
- Switch command should show switch confirmation with branch details
- Both should be cancellable and return to menu

**Pass Criteria**: ✅ Git-specific commands work correctly (if in Git mode)

---

### Scenario 8: Enhanced Listing Interface

**Objective**: Test the enhanced snapshot listing features including formatting, pagination, and summary information.

**Steps**:

1. Execute `/snapshots` command
2. Observe the enhanced listing display
3. Look for:
    - Summary statistics at the top
    - Current mode indicator
    - Relative timestamps (e.g., "5m ago", "2h ago")
    - File size formatting
    - Mode-specific details for each snapshot

**Expected Results**:

- Should display summary line: `📊 Total: X | 🔗 Git: Y | 📁 File: Z`
- Should show current mode: `📁 Current: File Mode` or `🔗 Current: Git Mode`
- Timestamps should be relative for recent items ("5m ago") and absolute for older items
- File-based snapshots should show file counts and sizes
- Git-based snapshots should show commit hashes and branch names
- Long instruction text should be truncated with "..."
- If more than 10 snapshots exist, should show pagination message

**Pass Criteria**: ✅ Enhanced listing displays all information correctly with proper formatting

---

### Scenario 9: Mode-Specific Commands (File Mode)

**Objective**: Test File-specific commands when in File mode.

**Steps**:

1. Execute `/snapshots` command
2. If in File mode (shows "File-based Mode: Active"), try:
    - Type `d1` and press Enter (delete command)
    - Type `n` when prompted for confirmation
    - Type `c` and press Enter (clear command)
    - Type `n` when prompted for confirmation

**Expected Results**:

- Delete command should show delete confirmation for specific snapshot
- Clear command should show clear all confirmation
- Both should be cancellable and return to menu

**Pass Criteria**: ✅ File-specific commands work correctly (if in File mode)

---

## Test Execution Checklist

- [ ] Scenario 1: Command Registration Verification
- [ ] Scenario 2: Basic Command Execution
- [ ] Scenario 3: Interactive Navigation - View Details
- [ ] Scenario 4: Interactive Navigation - Restore Workflow
- [ ] Scenario 5: Interactive Navigation - Cancel Operations
- [ ] Scenario 6: Command Menu Navigation
- [ ] Scenario 7: Mode-Specific Commands (Git Mode)
- [ ] Scenario 8: Enhanced Listing Interface
- [ ] Scenario 9: Mode-Specific Commands (File Mode)

## Notes

- This test validates the foundation with mock data
- Real snapshot functionality will be tested in later phases
- The interface should be responsive and user-friendly
- All confirmations should work properly to prevent accidental operations

## Success Criteria

All scenarios must pass for the foundation to be considered complete and ready for the next phase of development.
