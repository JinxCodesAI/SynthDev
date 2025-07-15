# Quick Validation Script for File-based Snapshots

## Overview

This script provides a quick automated validation of the file-based snapshot system. Run this before manual testing to ensure the system is properly configured.

## Quick Validation Commands

### 1. Run Automated Tests

```bash
# Navigate to project directory
cd /path/to/synth-dev

# Install dependencies (if not already done)
npm install

# Run file-based snapshot tests
npm test tests/e2e/file-based-snapshots.test.js

# Expected: All 8 tests should pass
```

### 2. Verify Configuration

```bash
# Check that file-based mode is configured
node -e "
const config = require('./src/core/config/ConfigManager');
const snapshotConfig = config.getSnapshotConfig();
console.log('Snapshot mode:', snapshotConfig.mode);
console.log('Max snapshots:', snapshotConfig.maxSnapshots);
console.log('Max memory:', snapshotConfig.maxMemoryUsage);
"

# Expected output:
# Snapshot mode: file
# Max snapshots: 10
# Max memory: 104857600
```

### 3. Test Basic Functionality

```bash
# Create test files
mkdir -p test-snapshots
echo "Test file 1" > test-snapshots/file1.txt
echo "Test file 2" > test-snapshots/file2.txt

# Start application and test (manual step)
npm start
# Then use /snapshots command to test interface
```

### 4. Cleanup Test Files

```bash
# Remove test files after validation
rm -rf test-snapshots/
rm -f test-snapshot-file.txt
rm -f test-file-*.txt
```

## Expected Results Summary

✅ **All automated tests pass (8/8)**
✅ **Configuration shows file mode**
✅ **Application starts without errors**
✅ **Snapshots interface accessible via /snapshots**

## If Tests Fail

### Common Issues:

1. **Configuration Issues:**

    ```bash
    # Check if config files exist
    ls -la src/core/config/

    # Verify SnapshotConfig is properly configured
    node -e "
    const SnapshotConfig = require('./src/core/snapshot/SnapshotConfig');
    const config = new SnapshotConfig({ mode: 'file' });
    console.log('Config loaded:', config.getSnapshotConfig());
    "
    ```

2. **Dependency Issues:**

    ```bash
    # Reinstall dependencies
    rm -rf node_modules package-lock.json
    npm install
    ```

3. **File Permission Issues:**

    ```bash
    # Check file permissions
    ls -la src/core/snapshot/

    # Ensure all files are readable
    chmod -R 755 src/
    ```

## Quick Smoke Test

Run this one-liner to verify basic functionality:

```bash
npm test tests/e2e/file-based-snapshots.test.js && echo "✅ File-based snapshots working!" || echo "❌ Tests failed - check configuration"
```

**Expected Result:** All 8 tests should pass with output similar to:

```
✓ File-based Snapshots Integration Test > should initialize with file-based strategy
✓ File-based Snapshots Integration Test > should create snapshots with file content
✓ File-based Snapshots Integration Test > should retrieve all snapshots
✓ File-based Snapshots Integration Test > should handle snapshot deletion
✓ File-based Snapshots Integration Test > should handle memory limits and eviction
✓ File-based Snapshots Integration Test > should handle compression when enabled
✓ File-based Snapshots Integration Test > should validate file paths for security
✓ File-based Snapshots Integration Test > should provide comprehensive status information
```

## Next Steps

If all validations pass:

1. Proceed with manual testing using `manual-test-file-based-snapshots.md`
2. Test the user interface thoroughly
3. Validate performance with realistic file loads

If validations fail:

1. Check the troubleshooting section in the manual testing guide
2. Verify all dependencies are installed
3. Check configuration files for correct settings
4. Review error messages for specific issues
