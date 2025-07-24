# Detailed Development Plan: Snapshot Functionality Fixes

## Overview

This document provides a comprehensive development plan with specific code references and implementation strategies to fix all identified snapshot functionality issues.

## Issue 1: Empty File Validation Bug (Priority 1 - Critical)

### Problem

`FileBackup.validateFileData()` at line 301 fails for empty files because it treats empty string `""` as falsy.

### Current Code (src/core/snapshot/FileBackup.js:301-303)

```javascript
if (!fileInfo.content || typeof fileInfo.content !== 'string') {
    throw new Error(`Invalid file data: content missing for ${relativePath}`);
}
```

### Fix Implementation

```javascript
if (
    fileInfo.content === undefined ||
    fileInfo.content === null ||
    typeof fileInfo.content !== 'string'
) {
    throw new Error(`Invalid file data: content missing for ${relativePath}`);
}
```

### Code Changes Required

1. **File**: `src/core/snapshot/FileBackup.js`
    - **Line**: 301
    - **Change**: Update validation logic to allow empty strings
    - **Test**: Ensure `.gitkeep` and other empty files can be restored

### Validation Steps

- Create test with empty `.gitkeep` file
- Verify snapshot creation includes empty file
- Verify restoration works without throwing validation error
- Test with various empty file types (`.env`, `config.json`, etc.)

## Issue 2: Initial Snapshot Not Visible (Priority 1 - Critical)

### Problem

Initial snapshots created by `AutoSnapshotManager` are not stored in the same store instance that `SnapshotsCommand` queries.

### Root Cause Analysis

- `AutoSnapshotManager` creates its own `SnapshotManager` instance (line 25)
- `SnapshotsCommand` creates a separate `SnapshotManager` instance (line 54)
- Each has its own `MemorySnapshotStore` instance
- Initial snapshot goes to AutoSnapshotManager's store, but commands query SnapshotsCommand's store

### Current Code Issues

**AutoSnapshotManager.js:25**

```javascript
this.snapshotManager = new SnapshotManager();
```

**SnapshotsCommand.js:54**

```javascript
this.snapshotManager = new SnapshotManager();
```

### Fix Implementation: Singleton Pattern for SnapshotManager

#### Step 1: Create SnapshotManager Singleton

**New File**: `src/core/snapshot/SnapshotManagerSingleton.js`

```javascript
import { SnapshotManager } from './SnapshotManager.js';

let instance = null;

export function getSnapshotManager() {
    if (!instance) {
        instance = new SnapshotManager();
    }
    return instance;
}

export function resetSnapshotManager() {
    instance = null;
}
```

#### Step 2: Update AutoSnapshotManager

**File**: `src/core/snapshot/AutoSnapshotManager.js`
**Line**: 25
**Change**:

```javascript
// OLD
this.snapshotManager = new SnapshotManager();

// NEW
import { getSnapshotManager } from './SnapshotManagerSingleton.js';
this.snapshotManager = getSnapshotManager();
```

#### Step 3: Update SnapshotsCommand

**File**: `src/commands/snapshots/SnapshotsCommand.js`
**Line**: 54
**Change**:

```javascript
// OLD
this.snapshotManager = new SnapshotManager();

// NEW
import { getSnapshotManager } from '../core/snapshot/SnapshotManagerSingleton.js';
this.snapshotManager = getSnapshotManager();
```

### Alternative Fix: Dependency Injection

Instead of singleton, inject the same SnapshotManager instance:

**File**: `src/core/app.js`
**Lines**: 95-96, 280-281

```javascript
// Create single SnapshotManager instance
this.snapshotManager = new SnapshotManager();

// Pass to AutoSnapshotManager
this.autoSnapshotManager = new AutoSnapshotManager(this.toolManager, this.snapshotManager);

// Pass to commands when they're created
// (requires updating command initialization)
```

## Issue 3: Missing Tool Execution Integration (Priority 1 - Critical)

### Problem

`ToolManagerIntegration` exists but is not properly connected to the actual `ToolManager.executeToolCall()` method.

### Current Integration Attempt

The `ToolManagerIntegration.integrateWithToolManager()` method tries to replace `executeToolCall` but the signature doesn't match the actual method.

### Current Code Issues

**ToolManagerIntegration.js:48**

```javascript
toolManager.executeToolCall = async (toolCall, consoleInterface, snapshotManager) => {
    return await this.enhancedExecuteToolCall(/* ... */);
};
```

**Actual ToolManager.executeToolCall signature (toolManager.js:223)**

```javascript
async executeToolCall(toolCall, consoleInterface, snapshotManager = null)
```

### Fix Implementation

#### Step 1: Fix Integration Method Signature

**File**: `src/core/snapshot/ToolManagerIntegration.js`
**Lines**: 48-58
**Change**:

```javascript
integrateWithToolManager(toolManager) {
    if (!toolManager) {
        this.logger.warn('No ToolManager provided for integration');
        return;
    }

    this.logger.debug('Integrating with ToolManager');

    // Store original executeToolCall method
    const originalExecuteToolCall = toolManager.executeToolCall.bind(toolManager);

    // Replace with our enhanced version - FIXED SIGNATURE
    toolManager.executeToolCall = async (toolCall, consoleInterface, snapshotManager = null) => {
        return await this.enhancedExecuteToolCall(
            originalExecuteToolCall,
            toolCall,
            consoleInterface,
            snapshotManager
        );
    };

    this.logger.debug('ToolManager integration complete');
}
```

#### Step 2: Fix Enhanced ExecuteToolCall Method

**File**: `src/core/snapshot/ToolManagerIntegration.js`
**Lines**: 64-99
**Change**:

```javascript
async enhancedExecuteToolCall(
    originalExecuteToolCall,
    toolCall,
    consoleInterface,
    snapshotManager = null
) {
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments);
    const executionId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        if (!this.config.enabled) {
            return await originalExecuteToolCall(toolCall, consoleInterface, snapshotManager);
        }

        // Before tool execution hook - CREATE SNAPSHOT HERE
        await this.beforeToolExecution(toolName, toolArgs, { executionId });

        // Execute the original tool
        const result = await originalExecuteToolCall(toolCall, consoleInterface, snapshotManager);

        // After tool execution hook
        await this.afterToolExecution(toolName, result, { executionId });

        return result;
    } catch (error) {
        await this.onToolError(toolName, error, { executionId });
        throw error;
    }
}
```

#### Step 3: Ensure Integration is Called

**File**: `src/core/snapshot/AutoSnapshotManager.js`
**Lines**: 129-139
**Verify this method properly calls integration**:

```javascript
async _initializeToolManagerIntegration() {
    if (!this.toolManager) {
        this.logger.warn('No ToolManager available for integration');
        return;
    }

    const integrationConfig = this.config.integration;
    this.toolManagerIntegration = new ToolManagerIntegration(
        this.snapshotTrigger,
        this.toolMonitor,
        this.fileChangeDetector,
        integrationConfig
    );

    // ENSURE THIS IS CALLED
    this.toolManagerIntegration.integrateWithToolManager(this.toolManager);
    this.logger.debug('ToolManagerIntegration initialized');
}
```

## Issue 4: Differential Snapshots Implementation (Priority 2 - Important)

### Problem

Current implementation stores complete file copies for every snapshot, wasting storage and violating efficiency principles.

### Current Storage Structure

```javascript
// Current: Full file storage per snapshot
snapshot = {
    id: 'uuid',
    fileData: {
        files: {
            'file1.txt': { content: 'full content', checksum: 'hash1' },
            'file2.js': { content: 'full content', checksum: 'hash2' },
            // ... all files stored completely
        },
    },
};
```

### Target Differential Structure

```javascript
// Target: Differential storage with file versioning
snapshot = {
    id: 'uuid',
    type: 'differential', // or "full" for base snapshots
    baseSnapshotId: 'previous-snapshot-id', // null for full snapshots
    fileData: {
        files: {
            'file1.txt': {
                action: 'modified',
                content: 'new content',
                checksum: 'new-hash',
                previousChecksum: 'old-hash',
            },
            'file2.js': {
                action: 'unchanged',
                checksum: 'same-hash',
                snapshotId: 'previous-snapshot-id', // reference to where content is stored
            },
            'file3.py': {
                action: 'created',
                content: 'new file content',
                checksum: 'new-hash',
            },
            'deleted-file.txt': {
                action: 'deleted',
                previousChecksum: 'old-hash',
            },
        },
    },
};
```

### Implementation Plan

#### Step 1: Create File Version Tracker

**New File**: `src/core/snapshot/FileVersionTracker.js`

```javascript
export class FileVersionTracker {
    constructor() {
        this.fileVersions = new Map(); // filePath -> { checksum, snapshotId, version }
        this.checksumIndex = new Map(); // checksum -> { snapshotId, filePath }
    }

    /**
     * Track a file version in a snapshot
     */
    trackFileVersion(filePath, checksum, snapshotId) {
        const version = {
            checksum,
            snapshotId,
            timestamp: Date.now(),
            version: this.getNextVersion(filePath),
        };

        this.fileVersions.set(filePath, version);
        this.checksumIndex.set(checksum, { snapshotId, filePath });
    }

    /**
     * Find which snapshot contains a file with specific checksum
     */
    findSnapshotForChecksum(checksum) {
        return this.checksumIndex.get(checksum);
    }

    /**
     * Get file changes between current state and last snapshot
     */
    async analyzeFileChanges(basePath, lastSnapshotId) {
        // Implementation to compare current files with tracked versions
    }
}
```
