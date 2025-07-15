# Manual Test 2: Git Integration Validation

## Overview

This manual test validates the Git Integration Layer functionality, including Git command wrapper, branch lifecycle management, and Git-based snapshot strategy.

## Prerequisites

- Node.js environment set up
- Git installed and available in PATH
- Working directory is a Git repository
- All dependencies installed (`npm install`)

## Test Environment Setup

### 1. Verify Git Availability

```bash
# Check Git installation
git --version

# Verify repository status
git status

# Ensure clean working directory
git stash push -m "Manual test backup" || echo "No changes to stash"
```

### 2. Initialize Test Environment

```bash
# Run foundation tests first
npm test tests/unit/snapshot/git-integration.test.js

# Expected: All 28 tests should pass
```

## Test Cases

### Test Case 1: Git Integration Initialization

**Objective**: Verify Git integration initializes correctly

**Steps**:

1. Open Node.js REPL or create test script:

```javascript
import { GitIntegration } from './src/core/snapshot/git/GitIntegration.js';
import SnapshotConfig from './src/core/snapshot/SnapshotConfig.js';
import SnapshotEventEmitter from './src/core/snapshot/events/SnapshotEventEmitter.js';

const config = new SnapshotConfig();
const eventEmitter = new SnapshotEventEmitter();
const gitIntegration = new GitIntegration(config, eventEmitter);

// Test initialization
const result = await gitIntegration.initialize();
console.log('Initialization result:', result);
```

**Expected Results**:

- `result.success` should be `true`
- No error messages in console
- Git integration should be ready for operations

**Pass Criteria**: ✅ Initialization succeeds without errors

---

### Test Case 2: Branch Name Sanitization

**Objective**: Verify branch name sanitization works correctly

**Steps**:

```javascript
// Test various invalid branch names
const testNames = [
    'test/branch:with*invalid?chars',
    '.invalid-start',
    'invalid..double-dots',
    'invalid@@at-signs',
    'invalid~tilde',
    'valid-branch-name',
];

for (const name of testNames) {
    const sanitized = gitIntegration.sanitizeBranchName(name);
    const isValid = gitIntegration.isValidBranchName(sanitized);
    console.log(`Original: "${name}" -> Sanitized: "${sanitized}" -> Valid: ${isValid}`);
}
```

**Expected Results**:

- Invalid characters should be replaced with hyphens
- All sanitized names should pass validation
- Valid names should remain unchanged

**Pass Criteria**: ✅ All sanitized names are valid Git branch names

---

### Test Case 3: Branch Lifecycle Management

**Objective**: Test complete branch lifecycle operations

**Steps**:

```javascript
import { BranchLifecycleManager } from './src/core/snapshot/git/BranchLifecycleManager.js';

const branchManager = new BranchLifecycleManager(gitIntegration, config, eventEmitter);
await branchManager.initialize();

// Test branch creation
const instruction = 'Manual test branch creation';
const createResult = await branchManager.createSnapshotBranch(instruction);
console.log('Branch creation result:', createResult);

// Test branch switching
const switchResult = await branchManager.switchToBranch('main');
console.log('Branch switch result:', switchResult);

// Test branch information
const branchInfo = await branchManager.getBranchInfo();
console.log('Branch info:', branchInfo);
```

**Expected Results**:

- Branch creation should succeed with unique name
- Branch switching should work correctly
- Branch info should show created branches

**Pass Criteria**: ✅ All branch operations complete successfully

---

### Test Case 4: Git Snapshot Strategy

**Objective**: Validate Git-based snapshot strategy functionality

**Steps**:

```javascript
import { GitSnapshotStrategy } from './src/core/snapshot/strategies/GitSnapshotStrategy.js';

const strategy = new GitSnapshotStrategy(config, eventEmitter);
await strategy.initialize();

// Test availability check
const availability = await strategy.isAvailable();
console.log('Strategy availability:', availability);

// Test commit message generation
const instruction = 'Test snapshot creation';
const snapshotId = 'test-snapshot-123';
const commitMessage = strategy.generateCommitMessage(instruction, snapshotId);
console.log('Generated commit message:', commitMessage);
```

**Expected Results**:

- Strategy should be available when Git is present
- Commit messages should be properly formatted
- Strategy should initialize without errors

**Pass Criteria**: ✅ Strategy is available and generates proper commit messages

---

### Test Case 5: File Operations and Security

**Objective**: Test file operations with security validation

**Steps**:

```javascript
// Test file path validation
const testPaths = [
    'src/test.js', // Valid
    '../dangerous/path', // Invalid - parent directory
    '/absolute/path', // Invalid - absolute path
    'file<>:"|?*', // Invalid - special characters
    'normal/file.txt', // Valid
];

for (const path of testPaths) {
    const isValid = gitIntegration.isValidFilePath(path);
    console.log(`Path: "${path}" -> Valid: ${isValid}`);
}

// Test commit message sanitization
const dangerousMessage = 'Test\x00message\x01with\x02control\rchars\n';
const sanitized = gitIntegration.sanitizeCommitMessage(dangerousMessage);
console.log('Original message length:', dangerousMessage.length);
console.log('Sanitized message:', JSON.stringify(sanitized));
```

**Expected Results**:

- Dangerous file paths should be rejected
- Control characters should be removed from commit messages
- Valid paths and messages should pass through unchanged

**Pass Criteria**: ✅ Security validation works correctly

---

### Test Case 6: Error Handling and Retry Logic

**Objective**: Verify error handling and retry mechanisms

**Steps**:

```javascript
// Test retry mechanism with mock failure
let attemptCount = 0;
const mockOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
        return { success: false, error: 'Temporary failure' };
    }
    return { success: true, result: 'Success after retries' };
};

const retryResult = await gitIntegration.executeWithRetry('test-operation', mockOperation);
console.log('Retry result:', retryResult);
console.log('Total attempts:', attemptCount);
```

**Expected Results**:

- Operation should succeed after retries
- Retry count should match expected attempts
- Error handling should be graceful

**Pass Criteria**: ✅ Retry mechanism works as expected

---

## Cleanup

### Post-Test Cleanup

```bash
# Return to original branch
git checkout main

# Clean up test branches (if any were created)
git branch -D $(git branch | grep "synth-dev" | xargs) 2>/dev/null || echo "No test branches to clean"

# Restore original state
git stash pop || echo "No stash to restore"
```

## Success Criteria

### All tests must pass with the following results:

- ✅ Git integration initializes successfully
- ✅ Branch name sanitization works correctly
- ✅ Branch lifecycle operations complete successfully
- ✅ Git snapshot strategy is functional
- ✅ File operations have proper security validation
- ✅ Error handling and retry logic work correctly

### Performance Expectations:

- Initialization should complete within 2 seconds
- Branch operations should complete within 5 seconds
- No memory leaks during extended operations
- Proper cleanup of resources

### Security Validation:

- All user inputs are properly sanitized
- File paths are validated for security
- Branch names follow Git conventions
- Commit messages are safe for Git operations

## Troubleshooting

### Common Issues:

1. **Git not available**: Ensure Git is installed and in PATH
2. **Not a Git repository**: Run tests in a Git repository
3. **Permission errors**: Ensure write permissions in working directory
4. **Branch conflicts**: Clean up existing test branches

### Debug Commands:

```bash
# Check Git status
git status --porcelain

# List all branches
git branch -a

# Check Git configuration
git config --list

# Verify Node.js modules
npm list --depth=0
```

## Report Template

```
Manual Test 2: Git Integration Validation - [PASS/FAIL]

Test Environment:
- Git Version: [version]
- Node.js Version: [version]
- Operating System: [OS]
- Test Date: [date]

Test Results:
- Test Case 1 (Git Integration Initialization): [PASS/FAIL]
- Test Case 2 (Branch Name Sanitization): [PASS/FAIL]
- Test Case 3 (Branch Lifecycle Management): [PASS/FAIL]
- Test Case 4 (Git Snapshot Strategy): [PASS/FAIL]
- Test Case 5 (File Operations and Security): [PASS/FAIL]
- Test Case 6 (Error Handling and Retry Logic): [PASS/FAIL]

Issues Found: [List any issues]
Notes: [Additional observations]
```
