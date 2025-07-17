# Testing and Validation Guide: Phase 5 Snapshot System

## Overview

This document provides comprehensive testing procedures for validating the Phase 5 file-based snapshot system implementation.

## Pre-Testing Setup

### Environment Preparation

```bash
# 1. Install dependencies
npm install

# 2. Create test environment file
cp .env.template .env.test

# 3. Set test configuration
echo "SYNTHDEV_SNAPSHOTS_ENABLED=true" >> .env.test
echo "SYNTHDEV_SNAPSHOTS_MODE=file" >> .env.test
echo "SYNTHDEV_VERBOSITY_LEVEL=3" >> .env.test
```

### Test Data Preparation

```bash
# Create test workspace
mkdir -p test-workspace
cd test-workspace

# Create sample files for testing
echo "console.log('Hello World');" > hello.js
echo "body { margin: 0; }" > styles.css
echo "# Test Project" > README.md
mkdir src
echo "export default function test() {}" > src/utils.js
```

## Unit Testing Validation

### Core Components Testing

```bash
# Test file snapshot strategy
npm test tests/unit/snapshot/file-strategy.test.js

# Expected: 21 tests passing
# Validates: File backup, restoration, memory management

# Test snapshot manager
npm test tests/unit/snapshot/snapshot-manager.test.js

# Expected: All manager operations working
# Validates: Orchestration, error handling, lifecycle

# Test content change detection
npm test tests/unit/snapshot/content-change-detection.test.js

# Expected: 24 tests passing
# Validates: File change detection, integrity validation
```

### Command Interface Testing

```bash
# Test snapshots command
npm test tests/unit/commands/snapshotsCommand.test.js

# Expected: All command operations working
# Validates: User interface, command parsing, mock data
```

## Integration Testing

### Backend Integration Testing

```bash
# Test real backend connection
npm test tests/integration/snapshot-backend-integration.test.js

# Expected Results:
# ✅ SnapshotManager initializes without falling back to mock
# ✅ Real snapshots created through command interface
# ✅ Real snapshots restored through command interface
# ✅ No mock data fallback occurs
```

### Tool Integration Testing

```bash
# Test tool-snapshot integration
npm test tests/integration/tool-snapshot-integration.test.js

# Expected Results:
# ✅ Snapshots created before tool execution
# ✅ Tool changes committed to snapshots
# ✅ Error handling works correctly
# ✅ Performance impact is minimal
```

## End-to-End Testing

### Manual CLI Testing

#### Test 1: Basic Snapshot Operations

```bash
# 1. Start application
node src/core/app.js

# 2. Check initial state
/snapshots
# Expected: Empty snapshots list or existing snapshots

# 3. Create some changes (simulate user instruction)
# Type: "Create a new authentication system"
# Expected: Snapshot should be created automatically

# 4. Check snapshots again
/snapshots
# Expected: New snapshot appears in list

# 5. View snapshot details
1
# Expected: Detailed snapshot information displayed

# 6. Test restoration
r1
# Confirm: y
# Expected: Files restored to snapshot state
```

#### Test 2: File Operations

```bash
# 1. Create test files
echo "original content" > test1.txt
echo "original content" > test2.txt

# 2. Start app and create snapshot
node src/core/app.js
# Type: "Modify test files"

# 3. Modify files externally
echo "modified content" > test1.txt
rm test2.txt
echo "new file" > test3.txt

# 4. Check snapshots and restore
/snapshots
r1
# Confirm: y

# 5. Verify restoration
cat test1.txt  # Should show "original content"
ls test2.txt   # Should exist again
ls test3.txt   # Should be deleted
```

#### Test 3: Tool Integration

```bash
# 1. Start app
node src/core/app.js

# 2. Use a tool that modifies files
# Type: "Create a new file called example.js with a hello function"

# 3. Check that snapshot was created
/snapshots
# Expected: Snapshot created before tool execution

# 4. Verify file was created
ls example.js  # Should exist

# 5. Test restoration
r1
# Expected: File changes reverted
```

### Automated E2E Testing

```bash
# Run comprehensive E2E tests
npm test tests/e2e/complete-snapshot-workflow.test.js

# Expected Results:
# ✅ Complete user workflow works
# ✅ Automatic snapshot creation
# ✅ Tool integration functional
# ✅ Restoration works correctly
# ✅ Error scenarios handled
```

## Performance Testing

### Large File Set Testing

```bash
# Create large test dataset
mkdir large-test
cd large-test

# Generate 1000 test files
for i in {1..1000}; do
    echo "File content $i" > "file$i.txt"
done

# Test snapshot creation performance
time node -e "
const { SnapshotManager } = require('./src/core/snapshot/SnapshotManager.js');
const manager = new SnapshotManager();
manager.initialize().then(() => {
    const files = Array.from({length: 1000}, (_, i) => \`file\${i+1}.txt\`);
    return manager.createSnapshot('Large file test', files);
}).then(result => {
    console.log('Snapshot created:', result.success);
    process.exit(0);
}).catch(console.error);
"

# Expected: Completes in < 5 seconds
# Memory usage should stay within configured limits
```

### Memory Usage Testing

```bash
# Monitor memory during snapshot operations
node --max-old-space-size=100 src/core/app.js

# Create multiple snapshots and monitor memory
# Expected: Memory usage stays within limits
# No memory leaks during repeated operations
```

## Security Testing

### Path Validation Testing

```bash
# Test malicious file paths
node -e "
const { FileSnapshotStrategy } = require('./src/core/snapshot/strategies/FileSnapshotStrategy.js');
const strategy = new FileSnapshotStrategy();

// Test dangerous paths
const maliciousPaths = [
    '../../../etc/passwd',
    '~/.ssh/id_rsa',
    '/etc/shadow',
    'file<>:\"|?*'
];

maliciousPaths.forEach(path => {
    console.log(\`Path '\${path}' valid: \${strategy.isValidFilePath(path)}\`);
});
"

# Expected: All malicious paths rejected (false)
```

### File Access Control Testing

```bash
# Create files with restricted permissions
touch restricted.txt
chmod 000 restricted.txt

# Test snapshot creation with restricted files
# Expected: Graceful handling of permission errors
# No system crashes or security violations
```

## Error Scenario Testing

### Configuration Error Testing

```bash
# Test with invalid configuration
echo "SYNTHDEV_SNAPSHOTS_MODE=invalid" > .env.test

node src/core/app.js
# Expected: Graceful error handling
# Clear error messages to user
# Fallback behavior works
```

### Disk Space Testing

```bash
# Simulate low disk space (if possible in test environment)
# Test snapshot creation under resource constraints
# Expected: Graceful degradation
# User notified of issues
```

### Concurrent Access Testing

```bash
# Test multiple snapshot operations simultaneously
# Expected: No data corruption
# Proper locking mechanisms work
# Error handling for conflicts
```

## Validation Checklist

### ✅ Core Functionality

- [ ] Snapshots created successfully
- [ ] Snapshots restored correctly
- [ ] File content preserved accurately
- [ ] Memory usage within limits
- [ ] Performance acceptable

### ✅ Integration

- [ ] Command interface works with real backend
- [ ] Tool integration creates snapshots automatically
- [ ] No fallback to mock data
- [ ] Error handling works correctly

### ✅ User Experience

- [ ] Clear feedback messages
- [ ] Intuitive command interface
- [ ] Helpful error messages
- [ ] Responsive performance

### ✅ Security

- [ ] Path validation prevents directory traversal
- [ ] File permissions respected
- [ ] No unauthorized file access
- [ ] Secure handling of sensitive files

### ✅ Reliability

- [ ] Handles edge cases gracefully
- [ ] Recovers from errors properly
- [ ] No data loss scenarios
- [ ] Consistent behavior across platforms

## Success Criteria

**Phase 5 is complete when all of the following are verified**:

1. **All unit tests pass** (100+ tests)
2. **All integration tests pass**
3. **All E2E tests pass**
4. **Manual testing scenarios work**
5. **Performance requirements met**
6. **Security validation passed**
7. **Error scenarios handled gracefully**

## Troubleshooting Common Issues

### Issue: SnapshotManager initialization fails

**Solution**: Check configuration loading and dependencies

### Issue: Mock data still appears

**Solution**: Verify backend integration fixes applied

### Issue: Poor performance with large files

**Solution**: Check memory limits and compression settings

### Issue: Permission errors

**Solution**: Verify file access permissions and error handling

This comprehensive testing guide ensures the snapshot system is thoroughly validated before release.
