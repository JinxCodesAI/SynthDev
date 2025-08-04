# Snapshots Configuration

SynthDev includes an advanced snapshot system that captures project states for backup, restoration, and change tracking. The system supports both manual and automatic snapshot creation with extensive customization options.

## Snapshot System Overview

### Two-Phase Architecture

- **Phase 1**: Manual snapshots with full user control
- **Phase 2**: Automatic snapshots triggered by tool execution
- **Unified storage**: Both phases share the same storage backend
- **Differential snapshots**: Only changed files are stored

### Key Features

- **File filtering**: Exclude unnecessary files (node_modules, .git, etc.)
- **Memory management**: Configurable limits and cleanup
- **Checksum validation**: Ensure data integrity
- **Performance optimization**: Fast differential snapshots
- **User-friendly**: Clear previews and confirmations

## Configuration Files

### Core Configuration

**File**: `src/config/snapshots/snapshot-defaults.json`

```json
{
    "fileFiltering": {
        "customExclusions": [],
        "maxFileSize": 10485760,
        "binaryFileHandling": "exclude",
        "followSymlinks": false,
        "caseSensitive": false
    },
    "storage": {
        "type": "memory",
        "maxSnapshots": 50,
        "maxMemoryMB": 100,
        "persistToDisk": false
    },
    "backup": {
        "preservePermissions": true,
        "validateChecksums": true,
        "maxConcurrentFiles": 10,
        "encoding": "utf8"
    },
    "behavior": {
        "autoCleanup": true,
        "cleanupThreshold": 40,
        "confirmRestore": true,
        "showPreview": true
    }
}
```

### Automatic Snapshots

**File**: `src/config/snapshots/auto-snapshot-defaults.json`

```json
{
    "autoSnapshot": {
        "enabled": false,
        "createOnToolExecution": false
    },
    "toolDeclarations": {
        "defaultModifiesFiles": false,
        "write_file": { "modifiesFiles": true },
        "edit_file": { "modifiesFiles": true },
        "execute_terminal": { "modifiesFiles": "conditional" },
        "execute_script": { "modifiesFiles": "conditional" }
    },
    "triggerRules": {
        "maxSnapshotsPerSession": 20,
        "cooldownPeriod": 5000,
        "enableSessionLimits": true
    },
    "initialSnapshot": {
        "enabled": true,
        "createOnStartup": true,
        "skipIfSnapshotsExist": true,
        "timeout": 30000
    }
}
```

### File Filtering

**File**: `src/config/snapshots/file-filters.json`

```json
{
    "defaultPatterns": {
        "general": [
            "node_modules/**",
            ".git/**",
            "dist/**",
            "build/**",
            "coverage/**",
            "*.log",
            "*.tmp",
            ".DS_Store",
            "Thumbs.db"
        ],
        "development": [".vscode/**", ".idea/**", "*.swp", "*.swo", "*~"]
    },
    "languageSpecific": {
        "javascript": ["npm-debug.log*", "yarn-debug.log*", ".npm", ".yarn-integrity"],
        "python": ["__pycache__/**", "*.pyc", "*.pyo", ".pytest_cache/**", ".mypy_cache/**"]
    }
}
```

## Configuration Options

### File Filtering

#### Basic Exclusions

```json
{
    "fileFiltering": {
        "customExclusions": ["my-temp-dir/**", "*.backup", "secret-config.json"],
        "maxFileSize": 10485760, // 10MB limit
        "binaryFileHandling": "exclude", // exclude|include|warn
        "followSymlinks": false,
        "caseSensitive": false
    }
}
```

#### Language-Specific Patterns

Add patterns for specific programming languages:

```json
{
    "languageSpecific": {
        "rust": ["target/**", "Cargo.lock"],
        "go": ["vendor/**", "go.sum"],
        "java": ["target/**", "*.class", ".gradle/**"]
    }
}
```

### Storage Configuration

#### Memory Storage

```json
{
    "storage": {
        "type": "memory",
        "maxSnapshots": 50,
        "maxMemoryMB": 100,
        "persistToDisk": false
    }
}
```

#### Disk Storage (Future)

```json
{
    "storage": {
        "type": "disk",
        "maxSnapshots": 200,
        "maxDiskMB": 1000,
        "persistToDisk": true,
        "storageDir": ".synthdev/snapshots"
    }
}
```

### Automatic Snapshot Triggers

#### Tool-Based Triggers

```json
{
    "toolDeclarations": {
        "defaultModifiesFiles": false,
        "write_file": { "modifiesFiles": true },
        "edit_file": { "modifiesFiles": true },
        "delete_file": { "modifiesFiles": true },
        "execute_terminal": { "modifiesFiles": "conditional" },
        "execute_script": { "modifiesFiles": "conditional" },
        "git_commit": { "modifiesFiles": false }
    }
}
```

#### Trigger Rules

```json
{
    "triggerRules": {
        "maxSnapshotsPerSession": 20,
        "cooldownPeriod": 5000, // 5 seconds between snapshots
        "enableSessionLimits": true,
        "skipIdenticalSnapshots": true
    }
}
```

### Behavior Settings

#### User Experience

```json
{
    "behavior": {
        "autoCleanup": true,
        "cleanupThreshold": 40, // Clean when 40+ snapshots
        "confirmRestore": true, // Ask before restoring
        "showPreview": true, // Show file changes
        "verboseLogging": false
    }
}
```

#### Performance Tuning

```json
{
    "performance": {
        "maxClassificationTime": 10, // Max time to classify files
        "batchingEnabled": true,
        "cacheEnabled": true,
        "maxConcurrentFiles": 10
    }
}
```

## Usage Scenarios

### Development Workflow

```json
{
    "autoSnapshot": {
        "enabled": true,
        "createOnToolExecution": true
    },
    "triggerRules": {
        "maxSnapshotsPerSession": 30,
        "cooldownPeriod": 3000
    },
    "toolDeclarations": {
        "write_file": { "modifiesFiles": true },
        "edit_file": { "modifiesFiles": true },
        "refactor_code": { "modifiesFiles": true }
    }
}
```

### Testing Environment

```json
{
    "autoSnapshot": {
        "enabled": true,
        "createOnToolExecution": false
    },
    "initialSnapshot": {
        "enabled": true,
        "description": "Clean test environment"
    },
    "behavior": {
        "confirmRestore": false,
        "autoCleanup": true
    }
}
```

### Production Deployment

```json
{
    "autoSnapshot": {
        "enabled": false
    },
    "storage": {
        "maxSnapshots": 10,
        "maxMemoryMB": 50
    },
    "behavior": {
        "confirmRestore": true,
        "showPreview": true
    }
}
```

## Advanced Configuration

### Custom File Filters

#### Project-Specific Exclusions

```json
{
    "customExclusions": [
        "data/large-dataset/**",
        "models/*.pkl",
        "cache/**",
        "temp-*",
        "*.generated.js"
    ]
}
```

#### Include Patterns (Override Exclusions)

```json
{
    "customInclusions": [
        "node_modules/my-custom-package/**",
        ".env.example",
        "important-cache.json"
    ]
}
```

### Conditional Snapshots

#### Smart Tool Detection

```json
{
    "toolDeclarations": {
        "execute_script": {
            "modifiesFiles": "conditional",
            "conditions": {
                "scriptPatterns": ["build*", "deploy*", "migrate*"],
                "excludePatterns": ["test*", "lint*"]
            }
        }
    }
}
```

### Integration Settings

#### Git Integration

```json
{
    "integration": {
        "gitAware": true,
        "respectGitignore": true,
        "excludeGitFiles": true,
        "trackBranches": false
    }
}
```

#### IDE Integration

```json
{
    "integration": {
        "vscodeIntegration": true,
        "ideaIntegration": true,
        "excludeIDEFiles": true
    }
}
```

## Performance Optimization

### Memory Management

```json
{
    "storage": {
        "maxMemoryMB": 200, // Increase for large projects
        "compressionEnabled": true,
        "compressionLevel": 6
    },
    "performance": {
        "lazyLoading": true,
        "backgroundCleanup": true,
        "cacheChecksums": true
    }
}
```

### File Processing

```json
{
    "fileProcessing": {
        "maxConcurrentFiles": 20, // Increase for faster processing
        "chunkSize": 65536, // 64KB chunks
        "useWorkerThreads": true
    }
}
```

## Monitoring and Debugging

### Logging Configuration

```json
{
    "logging": {
        "verboseSnapshots": true,
        "logFileChanges": true,
        "logPerformanceMetrics": true,
        "logLevel": "debug"
    }
}
```

### Metrics Collection

```json
{
    "metrics": {
        "collectTimings": true,
        "collectMemoryUsage": true,
        "collectFileStats": true,
        "reportInterval": 60000
    }
}
```

## Best Practices

### Configuration Strategy

1. **Start conservative**: Begin with default settings
2. **Monitor usage**: Track memory and performance
3. **Adjust gradually**: Increase limits as needed
4. **Test thoroughly**: Verify restore functionality

### File Filtering

1. **Exclude build artifacts**: Always exclude generated files
2. **Include source code**: Ensure all important files are captured
3. **Consider file sizes**: Set appropriate size limits
4. **Language-specific**: Use appropriate patterns for your stack

### Performance

1. **Memory limits**: Set realistic limits for your system
2. **Cleanup thresholds**: Balance history vs. memory usage
3. **Concurrent processing**: Adjust based on system capabilities
4. **Monitoring**: Enable metrics in development

## Troubleshooting

### Common Issues

- **Memory exhaustion**: Reduce maxMemoryMB or maxSnapshots
- **Slow snapshots**: Increase maxConcurrentFiles, check exclusions
- **Missing files**: Review file filtering patterns
- **Restore failures**: Check file permissions and checksums

### Debug Commands

```bash
# Enable verbose snapshot logging
SYNTHDEV_VERBOSITY_LEVEL=4

# Check snapshot configuration
node -e "console.log(require('./src/config/managers/snapshotConfigManager.js').getConfig())"

# Validate file filters
grep -E "node_modules|\.git" .synthdev/snapshots/*/manifest.json
```

## Next Steps

- [Tools and Safety](./tools.md) - Configure tools that trigger snapshots
- [Advanced Configuration](./advanced.md) - Programmatic snapshot management
- [Troubleshooting](./troubleshooting.md) - Common snapshot issues
