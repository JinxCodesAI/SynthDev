# Technical Implementation Guide: Phase 5 Completion

## Overview

This document provides detailed technical guidance for completing Phase 5 of the snapshot system implementation.

## Task 5.5: Backend Integration - Technical Details

### Problem Analysis

**Current Issue**: In `SnapshotsCommand._doInitialization()`:

```javascript
const initResult = await this.snapshotManager.initialize();
if (!initResult.success) {
    // Falls back to mock data
    this.snapshotManager = this._createMockSnapshotManager();
}
```

### Root Cause Investigation

1. **Check SnapshotManager.initialize()** in `src/core/snapshot/SnapshotManager.js:64`
2. **Check StrategyFactory.initialize()** in strategy factory
3. **Check FileSnapshotStrategy.initialize()** in file strategy
4. **Check configuration loading** in command context

### Implementation Steps

#### Step 1: Debug Initialization Failure

```javascript
// Add detailed logging to SnapshotsCommand._doInitialization()
async _doInitialization() {
    const logger = getLogger();

    try {
        logger.debug('Creating SnapshotManager instance...');
        this.snapshotManager = new SnapshotManager();

        logger.debug('Initializing SnapshotManager...');
        const initResult = await this.snapshotManager.initialize();

        logger.debug('SnapshotManager initialization result:', initResult);

        if (!initResult.success) {
            logger.error('SnapshotManager initialization failed:', initResult.error);
            throw new Error(`Snapshot system initialization failed: ${initResult.error}`);
        }

        logger.info('SnapshotManager initialized successfully');
    } catch (error) {
        logger.error('Error in snapshot system initialization:', error);
        throw error; // Don't fall back to mock data
    }
}
```

#### Step 2: Fix Configuration Issues

Check if configuration is properly loaded in command context:

```javascript
// In SnapshotManager constructor, add validation
constructor(config = null, eventEmitter = null) {
    this.config = config || new SnapshotConfig();

    // Validate configuration
    const configData = this.config.getSnapshotConfig();
    if (!configData) {
        throw new Error('Snapshot configuration not loaded');
    }

    // Continue with initialization...
}
```

#### Step 3: Remove Mock Fallback

```javascript
// Remove _createMockSnapshotManager() method entirely
// Update command to fail gracefully instead of using mock data
async _initializeSnapshotManager() {
    if (this.initializationPromise) {
        return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialization();

    try {
        await this.initializationPromise;
    } catch (error) {
        const logger = getLogger();
        logger.error('Failed to initialize snapshot system:', error.message);
        logger.raw('❌ Snapshot system unavailable. Please check configuration.');
        throw error;
    }
}
```

## Task 5.6: Tool Integration - Technical Details

### Integration Points

1. **ToolManager.executeTool()** - Add snapshot hooks
2. **CommandHandler.handleCommand()** - Detect non-command input
3. **App main loop** - Trigger snapshots on user instructions

### Implementation Steps

#### Step 1: Modify ToolManager

```javascript
// In src/core/managers/toolManager.js
import { SnapshotManager } from '../snapshot/SnapshotManager.js';

class ToolManager {
    constructor() {
        // ... existing code
        this.snapshotManager = null;
        this.snapshotEnabled = true; // Make configurable
    }

    async initialize() {
        // ... existing initialization

        // Initialize snapshot manager
        try {
            this.snapshotManager = new SnapshotManager();
            await this.snapshotManager.initialize();
            this.logger.info('Snapshot integration enabled');
        } catch (error) {
            this.logger.warn('Snapshot integration disabled:', error.message);
            this.snapshotEnabled = false;
        }
    }

    async executeTool(toolName, args, context) {
        let snapshotId = null;

        // Create snapshot before tool execution
        if (this.snapshotEnabled && this.snapshotManager) {
            try {
                const instruction = context.instruction || `Execute ${toolName}`;
                const result = await this.snapshotManager.createSnapshot(instruction);
                if (result.success) {
                    snapshotId = result.snapshot.id;
                    this.logger.debug(`Created snapshot ${snapshotId} before ${toolName}`);
                }
            } catch (error) {
                this.logger.warn('Failed to create snapshot before tool execution:', error);
            }
        }

        try {
            // Execute the tool
            const result = await this._executeToolInternal(toolName, args, context);

            // Commit changes to snapshot after successful execution
            if (snapshotId && this.snapshotEnabled) {
                try {
                    await this._commitToSnapshot(snapshotId, result);
                } catch (error) {
                    this.logger.warn('Failed to commit to snapshot:', error);
                }
            }

            return result;
        } catch (error) {
            // Tool execution failed, snapshot remains as backup
            throw error;
        }
    }

    async _commitToSnapshot(snapshotId, toolResult) {
        // Implementation depends on how we want to handle tool results
        // This might involve updating the snapshot with new file states
    }
}
```

#### Step 2: Add Instruction-Based Snapshots

```javascript
// In src/core/interface/commandHandler.js or main app loop
class InstructionHandler {
    constructor(snapshotManager) {
        this.snapshotManager = snapshotManager;
    }

    async processUserInput(input, context) {
        // Check if input is a command
        if (input.startsWith('/')) {
            return await this.commandRegistry.handleCommand(input, context);
        }

        // Non-command input - create snapshot before AI processing
        if (this.snapshotManager) {
            try {
                const result = await this.snapshotManager.createSnapshot(input);
                if (result.success) {
                    context.snapshotId = result.snapshot.id;
                    this.logger.debug(
                        `Created snapshot for instruction: ${input.substring(0, 50)}...`
                    );
                }
            } catch (error) {
                this.logger.warn('Failed to create snapshot for instruction:', error);
            }
        }

        // Continue with AI processing...
        return await this.processAIInstruction(input, context);
    }
}
```

## Task 5.7: Testing Strategy

### Integration Test Structure

```javascript
// tests/integration/snapshot-tool-integration.test.js
describe('Snapshot-Tool Integration', () => {
    let toolManager;
    let snapshotManager;

    beforeEach(async () => {
        // Setup test environment
        toolManager = new ToolManager();
        await toolManager.initialize();

        snapshotManager = toolManager.snapshotManager;
    });

    it('should create snapshot before tool execution', async () => {
        const context = { instruction: 'Create test file' };

        await toolManager.executeTool(
            'write_file',
            {
                file_path: 'test.txt',
                content: 'test content',
            },
            context
        );

        const snapshots = await snapshotManager.getSnapshots();
        expect(snapshots.success).toBe(true);
        expect(snapshots.snapshots.length).toBeGreaterThan(0);
    });
});
```

### End-to-End Test Structure

```javascript
// tests/e2e/complete-snapshot-workflow.test.js
describe('Complete Snapshot Workflow', () => {
    it('should handle complete user workflow', async () => {
        // 1. Start app
        const app = await startTestApp();

        // 2. Send user instruction
        const response1 = await sendInput(app, 'Create a new file called hello.txt');

        // 3. Verify snapshot was created
        const snapshotsResponse = await sendCommand(app, '/snapshots');
        expect(snapshotsResponse).toContain('hello.txt');

        // 4. Test restoration
        await sendInput(app, 'r1'); // Restore first snapshot

        // 5. Verify file state
        // ... verification logic
    });
});
```

## Configuration Requirements

### Environment Variables

```bash
# Add to .env
SYNTHDEV_SNAPSHOTS_ENABLED=true
SYNTHDEV_SNAPSHOTS_AUTO_CREATE=true
SYNTHDEV_SNAPSHOTS_MODE=auto
```

### Application Configuration

```javascript
// In src/config/defaults/application.json
{
  "snapshots": {
    "enabled": true,
    "autoCreate": true,
    "mode": "auto",
    "toolIntegration": {
      "enabled": true,
      "createBeforeExecution": true,
      "commitAfterExecution": true
    }
  }
}
```

## Error Handling Strategy

### Graceful Degradation

```javascript
// If snapshot system fails, continue without it
try {
    await createSnapshot(instruction);
} catch (error) {
    logger.warn('Snapshot creation failed, continuing without snapshot:', error);
    // Continue with normal operation
}
```

### User Communication

```javascript
// Provide clear feedback to users
if (snapshotCreated) {
    logger.raw('📸 Snapshot created');
} else {
    logger.raw('⚠️ Snapshot creation failed - changes not backed up');
}
```

## Performance Considerations

### Async Operations

- Make snapshot creation non-blocking
- Use background processing for large files
- Implement timeout mechanisms

### Memory Management

- Monitor memory usage during snapshot creation
- Implement cleanup for old snapshots
- Use streaming for large file operations

## Next Steps

1. **Start with Task 5.5**: Debug and fix backend integration
2. **Implement logging**: Add comprehensive logging for debugging
3. **Test incrementally**: Test each component before moving to next
4. **Monitor performance**: Add metrics to track snapshot overhead
5. **Document issues**: Keep detailed log of problems and solutions

This technical guide provides the specific implementation details needed to complete Phase 5 successfully.
