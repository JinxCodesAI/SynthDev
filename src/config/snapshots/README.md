# Snapshot Configuration

This directory contains configuration files for the SynthDev snapshot system, which provides file backup and restoration capabilities for safe project state management.

## Configuration Files

### `file-filters.json`

Defines patterns for files and directories to exclude from snapshots. This is the primary configuration file for controlling which files are included in snapshots.

**Structure:**

```json
{
  "defaultPatterns": {
    "dependencies": ["node_modules/**", ".venv/**", ...],
    "buildArtifacts": ["dist/**", "build/**", ".husky/**", ...],
    "versionControl": [".git/**", ".svn/**", ...],
    "ideFiles": [".vscode/**", ".idea/**", ...],
    "temporaryFiles": ["*.tmp", "*.temp", "*.log", ...],
    "environmentFiles": [".env", ".env.*"],
    "testCoverage": ["coverage/**", ".nyc_output/**"],
    "documentation": ["docs/_build/**", "site/**"]
  },
  "languageSpecific": {
    "javascript": ["node_modules/**", "npm-debug.log*", ...],
    "python": ["__pycache__/**", "*.py[cod]", ...],
    "java": ["*.class", "*.jar", "target/**", ...],
    "csharp": ["bin/**", "obj/**", "*.user", ...],
    "rust": ["target/**", "Cargo.lock"],
    "go": ["vendor/**", "go.sum"]
  },
  "binaryExtensions": [".jpg", ".jpeg", ".png", ...]
}
```

**Pattern Groups:**

- **dependencies**: Package managers and dependency directories
- **buildArtifacts**: Compiled code, build outputs, and build tools (including `.husky/**`)
- **versionControl**: Version control system files
- **ideFiles**: IDE-specific files and temporary files
- **temporaryFiles**: Temporary files, logs, and cache files
- **environmentFiles**: Environment configuration files (often contain secrets)
- **testCoverage**: Test coverage reports and outputs
- **documentation**: Documentation build outputs

### `snapshot-defaults.json`

Contains default settings for snapshot behavior, storage, and file filtering.

**Structure:**

```json
{
  "storage": {
    "type": "memory",
    "maxSnapshots": 50,
    "maxMemoryMB": 100,
    "persistToDisk": false
  },
  "fileFiltering": {
    "defaultExclusions": [...],
    "customExclusions": [],
    "maxFileSize": 10485760,
    "binaryFileHandling": "exclude",
    "followSymlinks": false,
    "caseSensitive": false
  },
  "backup": {
    "createBackups": true,
    "backupSuffix": ".backup",
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

### `snapshot-messages.json`

Defines user-facing messages, prompts, and help text for the snapshot system.

**Structure:**

```json
{
  "success": {
    "snapshotCreated": "✅ Snapshot created successfully!",
    "snapshotRestored": "✅ Snapshot restored successfully!",
    ...
  },
  "info": {
    "scanningFiles": "📂 Scanning and capturing files...",
    "analyzingRestore": "🔍 Analyzing restoration impact...",
    ...
  },
  "warnings": {
    "largeFile": "⚠️  Large file detected: {filename} ({size})",
    ...
  },
  "errors": {
    "snapshotNotFound": "❌ Snapshot not found: {id}",
    ...
  },
  "help": {
    "examples": [...],
    "notes": [...]
  }
}
```

## Usage

### Basic Configuration

The snapshot system automatically loads configuration from these files. No additional setup is required for basic usage.

### Custom Exclusion Patterns

To exclude additional files or directories from snapshots, you can:

1. **Add patterns to `file-filters.json`**: Edit the appropriate section (e.g., add to `defaultPatterns.buildArtifacts`)
2. **Use runtime configuration**: Add custom exclusions programmatically through the snapshot manager

**Example patterns:**

```json
{
    "defaultPatterns": {
        "buildArtifacts": ["dist/**", "build/**", ".husky/**", "your-custom-build-dir/**"]
    }
}
```

### Pattern Syntax

The system uses [minimatch](https://github.com/isaacs/minimatch) for pattern matching, which supports:

- **Wildcards**: `*` matches any characters except `/`
- **Globstar**: `**` matches any characters including `/`
- **Character classes**: `[abc]` matches any of the characters
- **Negation**: `!pattern` excludes the pattern (when used as first character)
- **Brace expansion**: `{a,b}` matches either `a` or `b`

**Pattern Examples:**

- `*.log` - excludes all `.log` files
- `node_modules/**` - excludes everything in `node_modules` directory
- `.env*` - excludes `.env`, `.env.local`, `.env.production`, etc.
- `**/*.tmp` - excludes all `.tmp` files in any directory
- `{dist,build}/**` - excludes everything in `dist` or `build` directories

### File Size and Binary Handling

**File Size Limits:**

- Default maximum file size: 10MB (`maxFileSize: 10485760`)
- Files exceeding this limit are automatically excluded
- Configurable in `snapshot-defaults.json`

**Binary File Handling:**

- Default behavior: exclude binary files (`binaryFileHandling: "exclude"`)
- Alternative: include binary files (`binaryFileHandling: "include"`)
- Binary files are detected by extension (see `binaryExtensions` in `file-filters.json`)

### Storage Configuration

**Memory Storage (default):**

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

**Settings:**

- `maxSnapshots`: Maximum number of snapshots to keep
- `maxMemoryMB`: Maximum memory usage in MB
- `persistToDisk`: Whether to save snapshots to disk (future feature)

### Backup Behavior

**Backup Settings:**

```json
{
    "backup": {
        "createBackups": true,
        "backupSuffix": ".backup",
        "preservePermissions": true,
        "validateChecksums": true,
        "maxConcurrentFiles": 10,
        "encoding": "utf8"
    }
}
```

**Options:**

- `createBackups`: Create backup files before restoration
- `backupSuffix`: Suffix for backup files
- `preservePermissions`: Maintain file permissions
- `validateChecksums`: Verify file integrity
- `maxConcurrentFiles`: Maximum concurrent file operations
- `encoding`: Default file encoding

### System Behavior

**Behavior Settings:**

```json
{
    "behavior": {
        "autoCleanup": true,
        "cleanupThreshold": 40,
        "confirmRestore": true,
        "showPreview": true
    }
}
```

**Options:**

- `autoCleanup`: Automatically clean up old snapshots
- `cleanupThreshold`: Number of snapshots to trigger cleanup
- `confirmRestore`: Ask for confirmation before restoring
- `showPreview`: Show preview of restoration impact

## Advanced Configuration

### Runtime Configuration Updates

You can update configuration at runtime through the snapshot manager:

```javascript
import { getSnapshotConfigManager } from './src/config/managers/snapshotConfigManager.js';

const configManager = getSnapshotConfigManager();

// Add custom exclusion pattern
configManager.addCustomExclusion('my-temp-files/**');

// Remove custom exclusion pattern
configManager.removeCustomExclusion('my-temp-files/**');

// Test if a path would be excluded
const isExcluded = configManager.testExclusion('.husky/pre-commit');
console.log('Would exclude .husky/pre-commit:', isExcluded);
```

### Configuration Validation

The system validates patterns and settings automatically:

- Invalid JSON syntax will prevent loading
- Missing required fields will use defaults
- Invalid patterns will be logged as warnings
- Configuration errors fall back to hardcoded defaults

### Debugging Configuration

To debug configuration loading and pattern matching:

1. Enable debug logging (verbosity level 3+)
2. Check console output for configuration load messages
3. Use `testExclusion()` method to test specific paths
4. Verify pattern syntax with minimatch documentation

## Examples

### Excluding Build Tools

To exclude additional build tools like Husky (already included):

```json
{
    "defaultPatterns": {
        "buildArtifacts": ["dist/**", "build/**", ".husky/**", ".github/**", "scripts/build/**"]
    }
}
```

### Language-Specific Exclusions

For Python projects:

```json
{
    "languageSpecific": {
        "python": [
            "__pycache__/**",
            "*.pyc",
            "*.pyo",
            "*.pyd",
            ".Python",
            "build/**",
            "dist/**",
            ".venv/**",
            "venv/**"
        ]
    }
}
```

### Custom Project Exclusions

For project-specific directories:

```json
{
    "defaultPatterns": {
        "projectSpecific": ["tmp/**", "uploads/**", "cache/**", "*.backup", "local-config/**"]
    }
}
```

## Troubleshooting

### Common Issues

1. **Files not being excluded**: Check pattern syntax and case sensitivity
2. **Large memory usage**: Reduce `maxMemoryMB` or increase exclusion patterns
3. **Backup failures**: Check file permissions and disk space
4. **Pattern not matching**: Use `testExclusion()` to debug specific paths

### Configuration Loading Errors

If configuration files can't be loaded:

1. System falls back to hardcoded defaults
2. Check JSON syntax validity
3. Verify file permissions
4. Check console for error messages

### Pattern Matching Issues

If patterns aren't working as expected:

1. Check minimatch documentation for syntax
2. Test patterns with `testExclusion()` method
3. Verify case sensitivity settings
4. Use debug logging to see pattern evaluation

## See Also

- [Phase 1 Specification](../../docs/functional-specification/snapshots-reimplementation-spec_v2/phase-1-basic-memory-snapshots/README.md)
- [Solution Architecture](../../docs/functional-specification/snapshots-reimplementation-spec_v2/phase-1-basic-memory-snapshots/solution_architecture.md)
- [Main Configuration README](../README.md)
