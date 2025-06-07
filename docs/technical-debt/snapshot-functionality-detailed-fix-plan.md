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

````javascript
export class FileVersionTracker {
    constructor() {
        this.fileVersions = new Map(); // filePath -> { checksum, snapshotId, version }
        this.checksumIndex = new Map(); // checksum -> { snapshotId, filePath }
    }

    /**
     * Track a file version in a snapshot

#### Step 2: Enhance MemorySnapshotStore for Differential Storage

**File**: `src/core/snapshot/stores/MemorySnapshotStore.js`
**Add new methods**:

```javascript
/**
 * Store differential snapshot with file references
 */
async storeDifferential(snapshot, baseSnapshotId = null) {
    const snapshotId = snapshot.id || uuidv4();

    // Process files to create differential structure
    const processedFiles = {};
    for (const [filePath, fileInfo] of Object.entries(snapshot.fileData.files)) {
        const existingVersion = this.fileVersionTracker.findSnapshotForChecksum(fileInfo.checksum);

        if (existingVersion && existingVersion.snapshotId !== snapshotId) {
            // File unchanged - reference existing version
            processedFiles[filePath] = {
                action: 'unchanged',
                checksum: fileInfo.checksum,
                snapshotId: existingVersion.snapshotId,
                size: fileInfo.size
            };
        } else {
            // File changed or new - store full content
            processedFiles[filePath] = {
                action: baseSnapshotId ? 'modified' : 'created',
                content: fileInfo.content,
                checksum: fileInfo.checksum,
                size: fileInfo.size
            };
        }
    }

    // Store the differential snapshot
    const snapshotRecord = {
        id: snapshotId,
        type: baseSnapshotId ? 'differential' : 'full',
        baseSnapshotId,
        description: snapshot.description,
        fileData: { files: processedFiles },
        metadata: { ...snapshot.metadata, timestamp: new Date().toISOString() }
    };

    this.snapshots.set(snapshotId, snapshotRecord);
    return snapshotId;
}

/**
 * Reconstruct full file data from differential snapshots
 */
async reconstructSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    if (snapshot.type === 'full') {
        return snapshot; // Already complete
    }

    // Reconstruct from differential chain
    const reconstructedFiles = {};
    const snapshotChain = await this._buildSnapshotChain(snapshotId);

    // Process files from oldest to newest
    for (const chainSnapshot of snapshotChain.reverse()) {
        for (const [filePath, fileInfo] of Object.entries(chainSnapshot.fileData.files)) {
            if (fileInfo.action === 'deleted') {
                delete reconstructedFiles[filePath];
            } else if (fileInfo.action === 'unchanged') {
                // Get content from referenced snapshot
                const referencedSnapshot = this.snapshots.get(fileInfo.snapshotId);
                if (referencedSnapshot) {
                    const referencedFile = referencedSnapshot.fileData.files[filePath];
                    if (referencedFile) {
                        reconstructedFiles[filePath] = referencedFile;
                    }
                }
            } else {
                // Modified or created - use current content
                reconstructedFiles[filePath] = fileInfo;
            }
        }
    }

    return {
        ...snapshot,
        fileData: { files: reconstructedFiles }
    };
}
````

#### Step 3: Update FileBackup for Differential Capture

**File**: `src/core/snapshot/FileBackup.js`
**Add new method**:

```javascript
/**
 * Capture files differentially against a base snapshot
 */
async captureDifferentialFiles(basePath, baseSnapshotId = null, options = {}) {
    const currentFiles = await this.captureFiles(basePath, options);

    if (!baseSnapshotId) {
        // First snapshot - return as full
        return { ...currentFiles, type: 'full', baseSnapshotId: null };
    }

    // Get base snapshot for comparison
    const baseSnapshot = await this.snapshotStore.reconstructSnapshot(baseSnapshotId);
    if (!baseSnapshot) {
        // Base snapshot not found - create full snapshot
        return { ...currentFiles, type: 'full', baseSnapshotId: null };
    }

    // Compare files and create differential
    const differentialFiles = {};
    const baseFiles = baseSnapshot.fileData.files;

    // Check for modified and new files
    for (const [filePath, currentFile] of Object.entries(currentFiles.files)) {
        const baseFile = baseFiles[filePath];

        if (!baseFile) {
            // New file
            differentialFiles[filePath] = {
                ...currentFile,
                action: 'created'
            };
        } else if (baseFile.checksum !== currentFile.checksum) {
            // Modified file
            differentialFiles[filePath] = {
                ...currentFile,
                action: 'modified',
                previousChecksum: baseFile.checksum
            };
        } else {
            // Unchanged file - reference base
            differentialFiles[filePath] = {
                action: 'unchanged',
                checksum: currentFile.checksum,
                snapshotId: baseSnapshotId,
                size: currentFile.size
            };
        }
    }

    // Check for deleted files
    for (const [filePath, baseFile] of Object.entries(baseFiles)) {
        if (!currentFiles.files[filePath]) {
            differentialFiles[filePath] = {
                action: 'deleted',
                previousChecksum: baseFile.checksum
            };
        }
    }

    return {
        basePath: currentFiles.basePath,
        captureTime: currentFiles.captureTime,
        type: 'differential',
        baseSnapshotId,
        files: differentialFiles,
        stats: {
            ...currentFiles.stats,
            changedFiles: Object.values(differentialFiles).filter(f => f.action !== 'unchanged').length,
            unchangedFiles: Object.values(differentialFiles).filter(f => f.action === 'unchanged').length
        }
    };
}
```

#### Step 4: Update SnapshotManager for Differential Logic

**File**: `src/core/snapshot/SnapshotManager.js`
**Modify createSnapshot method around line 68**:

```javascript
async createSnapshot(description, metadata = {}) {
    const operationId = uuidv4();
    this.activeOperations.add(operationId);

    try {
        // Validate parameters
        if (!description || typeof description !== 'string') {
            throw new Error(this.messages.errors.invalidDescription);
        }

        const basePath = metadata.basePath || process.cwd();
        const resolvedBasePath = resolve(basePath);

        // Determine if this should be differential
        const enableDifferential = this.config.storage.enableDifferential !== false;
        let baseSnapshotId = null;

        if (enableDifferential) {
            // Get the most recent snapshot as base
            const recentSnapshots = await this.store.list({ limit: 1 });
            if (recentSnapshots.length > 0) {
                baseSnapshotId = recentSnapshots[0].id;
            }
        }

        // Capture files (differential or full)
        const captureStartTime = Date.now();
        const fileData = enableDifferential
            ? await this.fileBackup.captureDifferentialFiles(resolvedBasePath, baseSnapshotId, {
                specificFiles: metadata.specificFiles,
                recursive: true,
            })
            : await this.fileBackup.captureFiles(resolvedBasePath, {
                specificFiles: metadata.specificFiles,
                recursive: true,
            });

        // Create snapshot metadata
        const snapshotMetadata = {
            description,
            basePath: resolvedBasePath,
            triggerType: metadata.triggerType || 'manual',
            captureTime: Date.now() - captureStartTime,
            fileCount: Object.keys(fileData.files).length,
            totalSize: fileData.stats.totalSize,
            type: fileData.type || 'full',
            baseSnapshotId: fileData.baseSnapshotId,
            creator: process.env.USER || process.env.USERNAME || 'unknown',
            ...metadata,
        };

        // Store snapshot (differential or full)
        const snapshotId = enableDifferential
            ? await this.store.storeDifferential({
                description,
                fileData,
                metadata: snapshotMetadata,
            }, baseSnapshotId)
            : await this.store.store({
                description,
                fileData,
                metadata: snapshotMetadata,
            });

        // Update statistics and cleanup
        if (this.config.behavior.autoCleanup) {
            await this._performAutoCleanup();
        }

        this.activeOperations.delete(operationId);

        const result = {
            id: snapshotId,
            description,
            stats: {
                fileCount: snapshotMetadata.fileCount,
                totalSize: snapshotMetadata.totalSize,
                captureTime: snapshotMetadata.captureTime,
                type: snapshotMetadata.type,
                changedFiles: fileData.stats?.changedFiles || snapshotMetadata.fileCount,
                unchangedFiles: fileData.stats?.unchangedFiles || 0
            },
            metadata: snapshotMetadata,
        };

        this.logger.info('Snapshot created successfully', {
            id: snapshotId,
            type: result.stats.type,
            changedFiles: result.stats.changedFiles,
            unchangedFiles: result.stats.unchangedFiles
        });

        return result;
    } catch (error) {
        this.activeOperations.delete(operationId);
        this.logger.error(error, 'Snapshot creation failed');
        throw error;
    }
}
```

## Issue 5: Configuration and Integration Fixes

### Problem

Configuration loading and component integration has several issues that prevent proper initialization.

### Fix Implementation

#### Step 1: Fix Configuration Loading

**File**: `src/config/managers/snapshotConfigManager.js`
**Ensure getConfig method exists**:

```javascript
/**
 * Get complete snapshot configuration
 */
getConfig() {
    return {
        storage: this.getStorageConfig(),
        fileFiltering: this.getFileFilterConfig(),
        backup: this.getBackupConfig(),
        behavior: this.getBehaviorConfig(),
        messages: this.getMessagesConfig(),
        phase2: this.getPhase2Config()
    };
}
```

#### Step 2: Fix App.js Integration

**File**: `src/core/app.js\*\*
**Lines**: 278-284
**Ensure proper integration order**:

```javascript
// Initialize Auto Snapshot Manager after tools are loaded
try {
    await this.autoSnapshotManager.initialize();

    // CRITICAL: Integrate AFTER initialization
    this.autoSnapshotManager.integrateWithApplication(this);

    this.logger.info('✅ Auto Snapshot System initialized successfully');
} catch (error) {
    this.logger.warn('Failed to initialize Auto Snapshot Manager', error);
}
```

## Implementation Timeline

### Phase 1: Critical Fixes (Week 1)

1. **Day 1-2**: Fix empty file validation bug
2. **Day 3-4**: Implement SnapshotManager singleton pattern
3. **Day 5**: Fix tool execution integration

### Phase 2: Differential Implementation (Week 2)

1. **Day 1-2**: Create FileVersionTracker and differential storage
2. **Day 3-4**: Update FileBackup for differential capture
3. **Day 5**: Update SnapshotManager integration

### Phase 3: Testing and Validation (Week 3)

1. **Day 1-2**: Update all failing tests to pass
2. **Day 3-4**: Add comprehensive integration tests
3. **Day 5**: Performance testing and optimization

## Testing Strategy

### Unit Tests Updates

- Fix empty file validation tests
- Add differential snapshot tests
- Update integration tests

### Integration Tests

- End-to-end workflow tests
- Real tool execution with snapshot creation
- Configuration integration tests

### Performance Tests

- Large project differential snapshot performance
- Memory usage with differential storage
- Restoration speed comparisons

## Success Criteria

1. **All 30 failing tests pass**
2. **Empty files (.gitkeep) can be restored**
3. **Initial snapshots visible in /snapshot list**
4. **Automatic snapshots created on tool execution**
5. **Differential snapshots reduce storage by >70%**
6. **No regression in existing functionality**

This plan provides specific code changes, file locations, and implementation details to fix all identified snapshot functionality issues.
}

```

```
