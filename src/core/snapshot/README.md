# SynthDev Snapshots System

A comprehensive snapshot system for AI-assisted development workflows that provides reliable state management with both Git integration and file-based fallback capabilities.

## Architecture Overview

The snapshot system is built with a modular architecture following the Strategy pattern for different storage backends:

```
src/core/snapshot/
├── SnapshotConfig.js           # Configuration management
├── index.js                    # Main entry point
├── interfaces/
│   └── SnapshotStrategy.js     # Abstract base classes
├── strategies/                 # Strategy implementations (to be added)
├── storage/                    # Storage implementations (to be added)
├── models/                     # Data models (to be added)
├── events/
│   └── SnapshotEventEmitter.js # Event system
├── validation/                 # Validation utilities (to be added)
└── utils/
    ├── SnapshotLogger.js       # Structured logging
    └── IdGenerator.js          # ID generation utilities
```

## Core Components

### SnapshotConfig

Manages configuration loading, validation, and runtime updates with support for environment variable overrides.

```javascript
import { SnapshotConfig } from './core/snapshot/index.js';

const config = new SnapshotConfig();
console.log(config.getSnapshotConfig().mode); // 'auto'
```

**Environment Variables:**

- `SYNTHDEV_SNAPSHOT_MODE`: Force specific mode (auto|git|file)
- `SYNTHDEV_SNAPSHOT_BRANCH_PREFIX`: Git branch prefix (default: synth-dev/)
- `SYNTHDEV_SNAPSHOT_MAX_COUNT`: Maximum snapshots to keep
- `SYNTHDEV_SNAPSHOT_AUTO_CLEANUP`: Enable automatic cleanup
- `SYNTHDEV_SNAPSHOT_MEMORY_LIMIT`: Memory limit for file mode
- `SYNTHDEV_SNAPSHOT_COMPRESSION`: Enable compression

### Abstract Interfaces

#### SnapshotStrategy

Base class for all snapshot strategies (Git and file-based).

```javascript
class MyStrategy extends SnapshotStrategy {
    async createSnapshot(instruction, files) {
        // Implementation
    }

    async restoreSnapshot(id) {
        // Implementation
    }

    getMode() {
        return 'my-mode';
    }
}
```

#### SnapshotStore

Base class for storage implementations.

```javascript
class MyStore extends SnapshotStore {
    async storeSnapshot(snapshot) {
        // Implementation
    }

    async getSnapshot(id) {
        // Implementation
    }
}
```

### Event System

The snapshot system uses an event-driven architecture for notifications and integration hooks.

```javascript
import { SnapshotEventEmitter, SnapshotEvents } from './core/snapshot/index.js';

const emitter = new SnapshotEventEmitter();

emitter.on(SnapshotEvents.SNAPSHOT_CREATED, snapshot => {
    console.log('Snapshot created:', snapshot.id);
});

emitter.emit(SnapshotEvents.SNAPSHOT_CREATED, snapshot);
```

**Available Events:**

- `snapshot:created` - Snapshot was created
- `snapshot:restored` - Snapshot was restored
- `snapshot:deleted` - Snapshot was deleted
- `strategy:switched` - Strategy was changed
- `git:branch_created` - Git branch was created
- `git:commit_created` - Git commit was created
- `system:initialized` - System was initialized

### Structured Logging

Enhanced logging with structured data for monitoring and debugging.

```javascript
import { SnapshotLogger } from './core/snapshot/index.js';

const logger = new SnapshotLogger();

logger.logSnapshotOperation('create', {
    mode: 'git',
    duration: 150,
    filesAffected: 3,
    success: true,
    snapshotId: 'snap_123',
});

const timer = logger.createTimer('restore');
// ... perform operation
timer(true, { snapshotId: 'snap_123' });
```

### ID Generation

Utilities for generating various types of identifiers used throughout the system.

```javascript
import { IdGenerator } from './core/snapshot/index.js';

// Generate snapshot ID
const snapshotId = IdGenerator.generateSnapshotId('Add authentication');
// Result: snap_1642678800000_a1b2c3d4_e5f6g7h8

// Generate Git branch name
const branchName = IdGenerator.generateBranchName('Fix responsive layout');
// Result: synth-dev/20240120T143022-fix-responsive-layout

// Generate content hash
const hash = IdGenerator.generateContentHash('file content');
// Result: 5d41402abc4b2a76b9719d911017c592

// Validate ID format
const isValid = IdGenerator.validateId(snapshotId, 'snapshot');
// Result: true
```

## Configuration Schema

```javascript
{
  "snapshots": {
    "mode": "auto",  // auto | git | file
    "contentHashing": {
      "enabled": true,
      "algorithm": "md5",  // md5 | sha1 | sha256
      "trackChanges": true
    },
    "git": {
      "branchPrefix": "synth-dev/",
      "autoCommit": true,
      "commitMessageTemplate": "Synth-Dev [{timestamp}]: {summary}\n\nOriginal instruction: {instruction}",
      "maxCommitHistory": 100,
      "autoCleanupBranches": true,
      "requireUncommittedChanges": true
    },
    "file": {
      "maxSnapshots": 50,
      "compressionEnabled": false,
      "memoryLimit": "100MB",
      "persistToDisk": false,
      "checksumValidation": true
    },
    "cleanup": {
      "autoCleanup": true,
      "cleanupOnExit": true,
      "retentionDays": 7,
      "maxDiskUsage": "1GB"
    },
    "performance": {
      "lazyLoading": true,
      "backgroundProcessing": true,
      "cacheSize": 10
    }
  }
}
```

## Usage

### Basic Initialization

```javascript
import { initializeSnapshotSystem } from './core/snapshot/index.js';

const { config, logger, eventEmitter } = initializeSnapshotSystem();

// Listen for system events
eventEmitter.on('snapshot:created', snapshot => {
    logger.user(`📸 Snapshot created: ${snapshot.instruction}`);
});
```

### Custom Configuration

```javascript
const customConfig = {
    snapshots: {
        mode: 'git',
        file: {
            maxSnapshots: 100,
            memoryLimit: '200MB',
        },
    },
};

const system = initializeSnapshotSystem(customConfig);
```

## Testing

The foundation components include comprehensive unit tests:

```bash
npm test tests/unit/snapshot/foundation.test.js
```

**Test Coverage:**

- Configuration loading and validation
- Environment variable overrides
- Abstract class enforcement
- Event system functionality
- ID generation and validation
- Logging functionality

## Next Steps

The foundation is now ready for the implementation of:

1. **Content Change Detection System** (Task 1.2)
2. **Core Data Models** (Task 1.3)
3. **Git Integration Layer** (Phase 2)
4. **File-based Fallback System** (Phase 3)
5. **Snapshot Manager** (Phase 4)
6. **User Interface** (Phase 5)

Each component builds upon this foundation and follows the established patterns and interfaces.
