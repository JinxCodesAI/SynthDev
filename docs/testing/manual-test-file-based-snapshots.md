# Manual Testing Guide: File-based Snapshot System

## Overview

This document provides step-by-step manual testing procedures for validating the complete file-based snapshot system functionality. These tests should be performed by product owners to ensure the system meets all requirements.

## Prerequisites

- Node.js and npm installed
- SynthDev project cloned and dependencies installed (`npm install`)
- Terminal/command prompt access

## Test Environment Setup

### 1. Verify Installation

```bash
cd /path/to/synth-dev
npm install
npm test tests/e2e/file-based-snapshots.test.js
```

**Expected Result:** All 8 tests should pass

### 2. Start SynthDev Application

```bash
npm start
```

**Expected Result:** Application starts successfully with file-based snapshot mode

## Manual Test Cases

### Test 1: Basic Snapshot Creation and Listing

#### Objective

Verify that users can create snapshots and view them through the command interface.

#### Steps

1. Start the SynthDev application (`npm start`)
2. Type `/snapshots` and press Enter
3. Verify the snapshots interface loads
4. Type `list` to view current snapshots
5. Note the initial state (should be empty or show existing snapshots)

#### Expected Results

- Snapshots interface loads without errors
- `list` command shows current snapshots in a readable format
- Interface displays appropriate message if no snapshots exist

#### Success Criteria

- [ ] Snapshots interface accessible via `/snapshots` command
- [ ] List command works and displays snapshots clearly
- [ ] No error messages or crashes

### Test 2: File-based Strategy Verification

#### Objective

Confirm the system is using file-based snapshots (not Git-based).

#### Steps

1. In the snapshots interface, type `status`
2. Review the displayed status information
3. Look for strategy/mode information

#### Expected Results

- Status shows "file" or "file-based" strategy
- Memory usage information displayed
- Snapshot count shown
- No Git-related errors or warnings

#### Success Criteria

- [ ] Strategy clearly identified as "file" mode
- [ ] Status information comprehensive and accurate
- [ ] No Git dependency errors

### Test 3: Snapshot Creation with File Changes

#### Objective

Test creating snapshots when files are modified in the project.

#### Steps

1. Create a test file in the project directory:
    ```bash
    echo "Test content for snapshot" > test-snapshot-file.txt
    ```
2. In SynthDev, navigate to snapshots interface (`/snapshots`)
3. Create a snapshot with a descriptive message
4. Verify the snapshot was created successfully
5. List snapshots to confirm it appears

#### Expected Results

- Snapshot creation succeeds
- New snapshot appears in list with correct timestamp and description
- File content is captured in the snapshot

#### Success Criteria

- [ ] Snapshot creation command works
- [ ] Created snapshot visible in list
- [ ] Snapshot contains the test file

### Test 4: Memory Limit and Eviction Testing

#### Objective

Verify that the system properly manages memory and evicts old snapshots when limits are reached.

#### Steps

1. Check current configuration for max snapshots (should be 10)
2. Create multiple test files and snapshots:
    ```bash
    for i in {1..12}; do
      echo "Large content $(date)" > "test-file-$i.txt"
      # Create snapshot in SynthDev interface
    done
    ```
3. After creating 12 snapshots, list all snapshots
4. Verify that only 10 snapshots are retained (oldest evicted)

#### Expected Results

- System maintains maximum of 10 snapshots
- Oldest snapshots are automatically evicted
- No memory overflow errors

#### Success Criteria

- [ ] Maximum snapshot count enforced (≤10 snapshots)
- [ ] Automatic eviction of oldest snapshots
- [ ] System remains stable during eviction

### Test 5: Snapshot Deletion

#### Objective

Test manual deletion of specific snapshots.

#### Steps

1. Ensure you have at least 3 snapshots created
2. List snapshots and note their IDs
3. Delete a specific snapshot using its ID
4. List snapshots again to confirm deletion
5. Verify the correct snapshot was removed

#### Expected Results

- Deletion command succeeds
- Specified snapshot is removed from the list
- Other snapshots remain intact

#### Success Criteria

- [ ] Delete command works with snapshot ID
- [ ] Correct snapshot removed
- [ ] Other snapshots unaffected

### Test 6: Error Handling and Edge Cases

#### Objective

Verify robust error handling for various edge cases.

#### Steps

1. **Invalid Commands:**

    - Type invalid commands in snapshots interface
    - Verify helpful error messages

2. **Non-existent Snapshot Operations:**

    - Try to delete a non-existent snapshot ID
    - Verify appropriate error message

3. **Large File Handling:**
    - Create a large file (>1MB) and snapshot it
    - Verify system handles it gracefully

#### Expected Results

- Clear, helpful error messages for invalid operations
- System remains stable during error conditions
- Large files handled appropriately

#### Success Criteria

- [ ] Invalid commands show helpful error messages
- [ ] Non-existent snapshot operations handled gracefully
- [ ] Large files processed without crashes

### Test 7: Interface Navigation and Help

#### Objective

Verify the user interface is intuitive and help is available.

#### Steps

1. Access snapshots interface (`/snapshots`)
2. Type `help` to view available commands
3. Test navigation between different views
4. Exit and re-enter the interface

#### Expected Results

- Help command shows comprehensive command list
- Navigation is smooth and intuitive
- Interface state is maintained appropriately

#### Success Criteria

- [ ] Help command provides useful information
- [ ] All advertised commands work as described
- [ ] Interface navigation is user-friendly

## Performance Validation

### Test 8: Performance with Multiple Files

#### Objective

Verify system performance with realistic file loads.

#### Steps

1. Create a directory with 50+ files of varying sizes
2. Create a snapshot including all files
3. Measure time taken for snapshot creation
4. Verify system responsiveness during operation

#### Expected Results

- Snapshot creation completes within reasonable time (<30 seconds for 50 files)
- System remains responsive during operation
- Memory usage stays within acceptable limits

#### Success Criteria

- [ ] Snapshot creation time acceptable
- [ ] System responsive during operations
- [ ] Memory usage controlled

## Test Completion Checklist

After completing all tests, verify:

- [ ] All 8 test cases completed successfully
- [ ] No critical errors or crashes encountered
- [ ] File-based snapshot system fully functional
- [ ] User interface intuitive and helpful
- [ ] Performance meets expectations
- [ ] Error handling robust and user-friendly

## Troubleshooting

### Common Issues and Solutions

1. **"Strategy not available" errors:**

    - Ensure Git is not required for file-based mode
    - Check configuration settings

2. **Memory or performance issues:**

    - Verify memory limits in configuration
    - Check for memory leaks during testing

3. **File access errors:**
    - Ensure proper file permissions
    - Verify project directory access

## Test Results Documentation

**Test Date:** ****\_\_\_****
**Tester:** ****\_\_\_****
**Version:** ****\_\_\_****

**Overall Result:** [ ] PASS [ ] FAIL

**Notes:**

---

---

---

**Issues Found:**

---

---

---
