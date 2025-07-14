# SynthDev Snapshots - Complete Reimplementation Functional Specification

## 1. Business Value & Purpose

### Problem Statement

AI-assisted development workflows require reliable state management to:

- **Provide safety nets** for AI-generated changes that may introduce bugs or unwanted modifications
- **Enable experimentation** by allowing developers to easily revert to known good states
- **Support iterative development** where developers can explore multiple solution paths
- **Maintain development confidence** by ensuring changes can always be undone

### Business Value

- **Risk Mitigation**: Reduces fear of AI making destructive changes
- **Development Velocity**: Enables faster experimentation without manual backup processes
- **User Confidence**: Provides transparent, reliable undo functionality
- **Workflow Integration**: Seamlessly integrates with existing Git workflows when available

## 2. User Journey & Flow

### 2.1 Automatic Snapshot Creation

**Trigger**: User provides new instruction to AI (non-command input)

**User Experience**:

1. User types instruction: "Add authentication to the login form"
2. System automatically creates snapshot before AI processes instruction
3. User sees subtle confirmation: "📸 Snapshot created"
4. AI processes instruction and makes changes
5. Changes are automatically committed to snapshot system

**No manual intervention required** - snapshots are transparent to the user.

### 2.2 Snapshot Management Interface

**Command**: `/snapshots`

#### 2.2.1 Git Repository Mode

**User Experience** (when in Git repository):

```
📸 Available Snapshots:
════════════════════════════════════════════════════════════════════════════════
🌿 Git Status: Active | Original: main | Feature: synth-dev/20241205T143022-auth

1. [2024-12-05 14:30:22] Add authentication to the login form
   🔗 Git: a1b2c3d | Author: SynthDev

2. [2024-12-05 14:25:15] Fix responsive layout issues
   🔗 Git: e4f5g6h | Author: SynthDev

Commands:
  [number] - View detailed snapshot info
  r[number] - Restore snapshot (e.g., r1)
  m - Merge feature branch to original branch
  s - Switch back to original branch (without merge)
  q - Quit snapshots view

snapshots>
```

#### 2.2.2 Non-Git Mode

**User Experience** (when not in Git repository or Git unavailable):

```
📸 Available Snapshots:
════════════════════════════════════════════════════════════════════════════════
📁 File-based Mode: Active (Git not available)

1. [2024-12-05 14:30:22] Add authentication to the login form
   📁 Files: 3 | Modified: login.js, auth.js, styles.css

2. [2024-12-05 14:25:15] Fix responsive layout issues
   📁 Files: 2 | Modified: layout.css, mobile.css

Commands:
  [number] - View detailed snapshot info
  r[number] - Restore snapshot (e.g., r1)
  📁 File mode: Restore overwrites files with backed-up content
  d[number] - Delete snapshot (e.g., d1)
  c - Clear all snapshots
  q - Quit snapshots view

snapshots>
```

### 2.3 Snapshot Restoration Flow

#### 2.3.1 Git Repository Mode

**Command**: `r1` (restore snapshot 1)

**User Experience**:

```
Reset to Git commit a1b2c3d?
  🔗 Commit: Add authentication to the login form
  ⚠️  This will discard all changes after this commit!

Confirm? (y/N): y

🔄 Resetting to commit a1b2c3d...
✅ Successfully reset to commit a1b2c3d
   🔗 Add authentication to the login form
```

#### 2.3.2 Non-Git Mode

**Command**: `r1` (restore snapshot 1)

**User Experience**:

```
Restore snapshot 1?
  📄 Will restore: login.js, auth.js, styles.css
  🗑️ Will delete: temp.js (didn't exist in snapshot)

Confirm? (y/N): y

🔄 Restoring snapshot 1...
✅ Successfully restored snapshot 1:
   📄 Restored 3 files:
      ✓ login.js
      ✓ auth.js
      ✓ styles.css
   🗑️ Deleted 1 file (didn't exist in snapshot):
      ✗ temp.js
```

### 2.4 Git Integration Workflow

**Scenario**: Developer working in Git repository

#### 2.4.1 Automatic Branch Creation Logic

**Conditions for branch creation** (all must be true):

1. Git is available and current directory is a Git repository
2. This is the first snapshot in the session
3. Current branch is NOT already a `synth-dev/` branch
4. There are uncommitted changes in the working directory

**Branch Creation Process**:

- System creates `synth-dev/YYYYMMDDTHHMMSS-description` branch
- All AI changes are committed to this branch
- Original branch remains untouched

#### 2.4.2 Read-Only Instructions Handling

**Scenario**: User gives instruction like "Explain codebase" that doesn't modify files

**Behavior**:

- Snapshot is created but remains empty (no files backed up)
- No branch is created because no uncommitted changes exist
- System operates in file-based mode for this session
- If later instructions modify files, branch creation is re-evaluated

#### 2.4.3 Branch Management

**Available operations** (when in Git mode):

- `m`: Merge feature branch back to original
- `s`: Switch to original branch without merging
- Automatic cleanup when branch has no uncommitted changes

## 3. Technical Architecture

### 3.1 Core Components

#### SnapshotManager

- **Primary orchestrator** for all snapshot operations
- **Dual-mode operation**: Git mode vs Legacy mode
- **Automatic mode detection** based on Git availability and repository state
- **State management** for current snapshot and Git integration

#### GitIntegration

- **Git operations wrapper** using command-line Git
- **Branch lifecycle management** for feature branches
- **Commit history integration** for snapshot retrieval
- **Safety checks** for Git operations

#### SnapshotStore

- **Unified interface** for both Git and in-memory storage
- **Metadata management** for snapshot information
- **File state tracking** for backup and restoration

#### SnapshotCommand

- **Interactive user interface** for snapshot management
- **Context-aware commands** based on Git mode
- **Confirmation flows** for destructive operations

### 3.2 Architecture Patterns

#### Strategy Pattern

- **GitSnapshotStrategy**: Git-based snapshot operations
- **FileSnapshotStrategy**: In-memory file-based operations (fallback mode)
- **Automatic strategy selection** based on environment

#### Observer Pattern

- **SnapshotEvents**: Notify interested components of snapshot lifecycle
- **Integration hooks** for tool execution and file changes

#### Command Pattern

- **Snapshot operations** as executable commands with undo capability
- **Batch operations** for multiple file changes

### 3.3 Data Flow

```
User Instruction → SnapshotManager.createSnapshot()
                ↓
            Mode Detection (Git vs File)
                ↓
        Strategy Selection & Execution
                ↓
        Content Change Detection (Hashing)
                ↓
        File Backup & State Tracking
                ↓
        Tool Execution with Auto-commit
                ↓
        Snapshot Finalization
```

## 4. API Specification

### 4.1 SnapshotManager Interface

```javascript
class SnapshotManager {
    // Lifecycle Management
    async initialize()
    async shutdown()

    // Snapshot Operations
    async createSnapshot(instruction: string): Promise<Snapshot>
    async getSnapshots(): Promise<Snapshot[]>
    async getSnapshot(id: string): Promise<Snapshot | null>
    async restoreSnapshot(id: string): Promise<RestoreResult>
    async deleteSnapshot(id: string): Promise<boolean>

    // File Operations
    async backupFile(filePath: string): Promise<void>
    async restoreFile(filePath: string, snapshotId: string): Promise<void>

    // Content change detection
    async hasFileChanged(filePath: string): Promise<boolean>
    async calculateContentHash(content: string): Promise<string>
    async validateSnapshotIntegrity(snapshotId: string): Promise<boolean>

    // Git Integration
    async commitChanges(files: string[], message: string): Promise<CommitResult>
    async mergeBranch(): Promise<MergeResult>
    async switchBranch(branchName: string): Promise<SwitchResult>

    // Status & Information
    getMode(): 'git' | 'legacy'
    getStatus(): SnapshotStatus
    isReady(): boolean
}
```

### 4.2 Data Structures

```javascript
interface Snapshot {
    id: string
    instruction: string
    timestamp: Date
    mode: 'git' | 'file'
    contentHash?: string  // MD5 hash of snapshot content for change detection

    // Git mode properties
    gitHash?: string
    branchName?: string
    author?: string

    // File mode properties
    files?: Map<string, string | null>  // null = file didn't exist
    modifiedFiles?: Set<string>
    fileChecksums?: Map<string, string>  // MD5 checksums for change detection
}

interface RestoreResult {
    success: boolean
    method: 'git-reset' | 'file-restore'
    filesRestored: string[]
    filesDeleted: string[]
    errors: string[]
}

interface SnapshotStatus {
    mode: 'git' | 'file'
    ready: boolean
    gitAvailable: boolean
    isGitRepo: boolean
    currentBranch?: string
    featureBranch?: string
    snapshotCount: number
    hasUncommittedChanges?: boolean
}
```

### 4.3 Content Change Detection

The snapshot system implements content hashing to efficiently detect file changes and avoid unnecessary backup operations.

#### 4.3.1 Hash-Based Change Detection

```javascript
class ContentChangeDetector {
    constructor() {
        this.fileHashes = new Map(); // filePath -> hash
        this.hashAlgorithm = 'md5';
    }

    async hasFileChanged(filePath) {
        const currentContent = await this.readFileContent(filePath);
        const currentHash = this.calculateHash(currentContent);
        const lastKnownHash = this.fileHashes.get(filePath);

        if (lastKnownHash && currentHash === lastKnownHash) {
            return false; // No change detected
        }

        this.fileHashes.set(filePath, currentHash);
        return true; // File has changed or is new
    }

    calculateHash(content) {
        return createHash(this.hashAlgorithm).update(content, 'utf8').digest('hex');
    }

    async backupFileIfChanged(filePath) {
        if (await this.hasFileChanged(filePath)) {
            return await this.performFileBackup(filePath);
        }
        return null; // No backup needed
    }
}
```

#### 4.3.2 Snapshot Integrity Validation

```javascript
class SnapshotIntegrityValidator {
    async validateSnapshot(snapshot) {
        const validationResults = {
            contentHashes: await this.validateContentHashes(snapshot),
            fileExistence: await this.validateFileExistence(snapshot),
            checksumConsistency: await this.validateChecksumConsistency(snapshot),
        };

        return {
            valid: Object.values(validationResults).every(result => result.valid),
            details: validationResults,
        };
    }

    async validateContentHashes(snapshot) {
        if (!snapshot.fileChecksums) {
            return { valid: true, reason: 'No checksums to validate' };
        }

        const inconsistencies = [];

        for (const [filePath, expectedHash] of snapshot.fileChecksums) {
            const fileContent = snapshot.files.get(filePath);
            if (fileContent !== null) {
                const actualHash = this.calculateHash(fileContent);
                if (actualHash !== expectedHash) {
                    inconsistencies.push({
                        file: filePath,
                        expected: expectedHash,
                        actual: actualHash,
                    });
                }
            }
        }

        return {
            valid: inconsistencies.length === 0,
            inconsistencies: inconsistencies,
        };
    }
}
```

#### 4.3.3 Performance Optimization

- **Incremental hashing**: Only recalculate hashes for modified files
- **Hash caching**: Store file hashes to avoid repeated calculations
- **Lazy validation**: Validate snapshot integrity only when needed
- **Batch processing**: Process multiple files in batches for better performance

## 5. Error Handling

### 5.1 Error Categories

#### 5.1.1 Git Operation Errors

**Branch Creation Failures**:

- **Cause**: Git command fails, invalid branch name, branch already exists
- **Recovery**: Fallback to file-based mode, sanitize branch name, generate unique name
- **User Message**: "⚠️ Git branch creation failed, using file-based snapshots"

**Commit Failures**:

- **Cause**: Nothing to commit, commit message issues, Git repository corruption
- **Recovery**: Skip empty commits, sanitize commit messages, validate repository state
- **User Message**: "⚠️ Git commit failed: [specific reason], changes tracked in memory"

**Merge Conflicts**:

- **Cause**: Conflicting changes between branches
- **Recovery**: Provide conflict resolution guidance, offer manual merge option
- **User Message**: "🔀 Merge conflicts detected. Please resolve manually or use 's' to switch without merging"

**Repository State Errors**:

- **Cause**: Detached HEAD, corrupted repository, missing remote
- **Recovery**: Detect state issues, provide recovery suggestions, fallback to file mode
- **User Message**: "⚠️ Git repository in unusual state, switching to file-based mode"

#### 5.1.2 File System Errors

**Permission Errors**:

- **Cause**: Insufficient permissions to read/write files
- **Recovery**: Skip inaccessible files, provide clear error messages
- **User Message**: "❌ Permission denied for file [path]. Please check file permissions"

**Disk Space Errors**:

- **Cause**: Insufficient disk space for file operations
- **Recovery**: Cleanup old snapshots, compress data, warn user
- **User Message**: "💾 Low disk space detected. Consider cleaning up old snapshots"

**File Lock Errors**:

- **Cause**: Files locked by other processes
- **Recovery**: Retry with exponential backoff, skip locked files
- **User Message**: "🔒 File [path] is locked by another process. Retrying..."

**Path Resolution Errors**:

- **Cause**: Invalid paths, directory traversal attempts, non-existent directories
- **Recovery**: Validate and sanitize paths, create directories as needed
- **User Message**: "📁 Invalid file path [path]. Please check the path and try again"

#### 5.1.3 State Consistency Errors

**Corrupted Snapshots**:

- **Cause**: Incomplete writes, system crashes, data corruption
- **Recovery**: Validate snapshot integrity, remove corrupted snapshots, rebuild index
- **User Message**: "🔧 Snapshot [id] appears corrupted and has been removed"

**Missing Files**:

- **Cause**: Files deleted externally, moved, or renamed
- **Recovery**: Track missing files, provide restoration options, update snapshot metadata
- **User Message**: "📄 File [path] no longer exists. Snapshot will create it during restoration"

**Concurrent Modifications**:

- **Cause**: External changes to tracked files during snapshot operations
- **Recovery**: Detect changes using checksums, provide conflict resolution options
- **User Message**: "⚠️ File [path] was modified externally. Current version differs from snapshot"

**Memory Exhaustion**:

- **Cause**: Too many large files in memory for file-based mode
- **Recovery**: Implement streaming, compress data, limit snapshot size
- **User Message**: "💾 Memory usage high. Consider using Git mode for better performance"

### 5.2 Error Recovery Strategies

#### 5.2.1 Graceful Degradation

**Git → File Mode Fallback**:

```javascript
// Automatic fallback when Git operations fail
if (gitOperationFailed) {
    this.logger.warn('Git operation failed, switching to file-based mode');
    this.mode = 'file';
    this.strategy = new FileSnapshotStrategy();
}
```

**Partial Operation Success**:

- Continue with successful operations
- Report partial failures with detailed information
- Maintain system consistency despite partial failures

**Resource Constraints**:

- Implement resource monitoring
- Automatic cleanup when limits approached
- Degrade functionality gracefully under constraints

#### 5.2.2 Retry Mechanisms

**Exponential Backoff**:

```javascript
async retryOperation(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await this.delay(Math.pow(2, attempt) * 1000);
        }
    }
}
```

**Transient Error Handling**:

- Network timeouts → Retry with backoff
- File locks → Wait and retry
- Temporary permission issues → Retry with different approach

#### 5.2.3 User Communication

**Error Message Structure**:

```
[Icon] [Severity] [Context]: [Description]
💡 Suggestion: [Actionable next step]
🔧 Technical: [Technical details for advanced users]
```

**Progress Indicators**:

- Long-running operations show progress
- Cancellation options for user-initiated operations
- Clear indication of current operation status

**Confirmation Prompts**:

- Destructive operations require explicit confirmation
- Show impact of operations before execution
- Provide undo information where applicable

## 6. Testing Strategy

_Reference: ADR-004 Testing Strategies and E2E Testing for detailed testing patterns_

### 6.1 Unit Testing

#### 6.1.1 Component Isolation

**SnapshotManager Testing**:

```javascript
describe('SnapshotManager', () => {
    let snapshotManager;
    let mockGitUtils;
    let mockFileSystem;

    beforeEach(() => {
        mockGitUtils = createMockGitUtils();
        mockFileSystem = createMockFileSystem();
        snapshotManager = new SnapshotManager(mockGitUtils, mockFileSystem);
    });

    it('should create snapshot with Git mode when available', async () => {
        mockGitUtils.checkGitAvailability.mockResolvedValue({
            available: true,
            isRepo: true,
        });

        const snapshot = await snapshotManager.createSnapshot('test instruction');
        expect(snapshot.mode).toBe('git');
    });
});
```

**Strategy Pattern Testing**:

- Test GitSnapshotStrategy in isolation with mocked Git operations
- Test FileSnapshotStrategy with mocked file system
- Test automatic strategy selection logic
- Verify strategy switching scenarios

#### 6.1.2 Edge Case Coverage

**Git Availability Scenarios**:

- Git command not found
- Not in Git repository
- Git repository corrupted
- Detached HEAD state
- No uncommitted changes

**File System Scenarios**:

- Permission denied errors
- Disk space exhaustion
- File locks and concurrent access
- Invalid file paths
- Large file handling

**Content Hashing Scenarios**:

- File content change detection
- Checksum calculation failures
- Hash collision handling
- Binary file processing

#### 6.1.3 State Transition Testing

**Mode Switching**:

```javascript
it('should switch from git to file mode on git failure', async () => {
    snapshotManager.mode = 'git';
    mockGitUtils.createBranch.mockRejectedValue(new Error('Git failed'));

    await snapshotManager.createSnapshot('test');

    expect(snapshotManager.mode).toBe('file');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Git operation failed'));
});
```

### 6.2 Integration Testing

#### 6.2.1 Git Integration

**Real Repository Testing**:

- Create temporary Git repositories for testing
- Test branch creation, switching, and merging
- Verify commit history integration
- Test with various Git configurations

**Git Command Integration**:

```javascript
describe('Git Integration', () => {
    let testRepo;

    beforeEach(async () => {
        testRepo = await createTestGitRepository();
        process.chdir(testRepo.path);
    });

    afterEach(async () => {
        await cleanupTestRepository(testRepo);
    });

    it('should create feature branch with uncommitted changes', async () => {
        await writeFile('test.js', 'console.log("test");');

        const result = await snapshotManager.createSnapshot('Add test file');

        expect(result.mode).toBe('git');
        expect(await getCurrentBranch()).toMatch(/^synth-dev\//);
    });
});
```

#### 6.2.2 File System Integration

**Real File Operations**:

- Test with actual file creation, modification, deletion
- Verify file backup and restoration accuracy
- Test with various file types and sizes
- Cross-platform path handling

#### 6.2.3 Command Integration

**Interactive Command Testing**:

```javascript
describe('SnapshotsCommand Integration', () => {
    it('should handle complete snapshot workflow', async () => {
        const mockInput = ['1', 'r1', 'y', 'q'];
        mockConsoleInterface.promptForInput.mockImplementation(() => mockInput.shift());

        await snapshotsCommand.execute('', context);

        expect(mockSnapshotManager.restoreSnapshot).toHaveBeenCalledWith('1');
    });
});
```

### 6.3 End-to-End Testing

#### 6.3.1 Complete User Workflows

**Git Workflow E2E**:

```javascript
describe('Complete Git Workflow', () => {
    it('should handle full development cycle', async () => {
        // 1. Create initial snapshot
        await app.processUserInput('Add authentication system');

        // 2. Verify branch creation
        expect(await getCurrentBranch()).toMatch(/^synth-dev\/.*auth/);

        // 3. Make file changes
        await toolManager.executeTool('write_file', {
            file_path: 'auth.js',
            content: 'module.exports = { authenticate: () => {} };',
        });

        // 4. Verify automatic commit
        const commits = await gitUtils.getCommitHistory(1);
        expect(commits[0].subject).toContain('Modified auth.js');

        // 5. Test restoration
        await snapshotsCommand.restoreSnapshot(1);

        // 6. Verify file state
        expect(await readFile('auth.js')).toBe(originalContent);
    });
});
```

#### 6.3.2 Error Recovery Scenarios

**System Failure Testing**:

- Simulate Git command failures
- Test recovery from corrupted snapshots
- Verify graceful degradation
- Test concurrent access scenarios

#### 6.3.3 Performance Testing

**Large File Set Testing**:

```javascript
describe('Performance Tests', () => {
    it('should handle large number of files efficiently', async () => {
        const fileCount = 1000;
        const files = await createTestFiles(fileCount);

        const startTime = Date.now();
        await snapshotManager.createSnapshot('Large file test');
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(5000); // 5 second limit
        expect(snapshotManager.getCurrentSnapshot().files.size).toBe(fileCount);
    });
});
```

### 6.4 Mocking Strategies

#### 6.4.1 Git Operations Mocking

```javascript
function createMockGitUtils() {
    return {
        checkGitAvailability: vi.fn().mockResolvedValue({
            available: true,
            isRepo: true,
        }),
        createBranch: vi.fn().mockResolvedValue({ success: true }),
        commit: vi.fn().mockResolvedValue({ success: true }),
        getCommitHistory: vi.fn().mockResolvedValue({
            success: true,
            commits: [],
        }),
        hasUncommittedChanges: vi.fn().mockResolvedValue({
            success: true,
            hasUncommittedChanges: false,
        }),
    };
}
```

#### 6.4.2 File System Mocking

```javascript
function createMockFileSystem() {
    const mockFiles = new Map();

    return {
        readFile: vi.fn().mockImplementation(async path => {
            if (mockFiles.has(path)) return mockFiles.get(path);
            throw new Error(`File not found: ${path}`);
        }),
        writeFile: vi.fn().mockImplementation(async (path, content) => {
            mockFiles.set(path, content);
        }),
        existsSync: vi.fn().mockImplementation(path => mockFiles.has(path)),
        calculateChecksum: vi
            .fn()
            .mockImplementation(content => createHash('md5').update(content).digest('hex')),
    };
}
```

### 6.5 Test Data Management

#### 6.5.1 Fixture Repositories

```javascript
async function createTestGitRepository() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-test-'));

    await executeCommand('git init', { cwd: tempDir });
    await executeCommand('git config user.name "Test User"', { cwd: tempDir });
    await executeCommand('git config user.email "test@example.com"', { cwd: tempDir });

    // Create initial commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Repository');
    await executeCommand('git add README.md', { cwd: tempDir });
    await executeCommand('git commit -m "Initial commit"', { cwd: tempDir });

    return { path: tempDir, cleanup: () => fs.rm(tempDir, { recursive: true }) };
}
```

#### 6.5.2 Scenario-Based Test Data

```javascript
const testScenarios = {
    emptyRepository: {
        files: {},
        gitState: 'clean',
    },
    withUncommittedChanges: {
        files: { 'modified.js': 'new content' },
        gitState: 'dirty',
    },
    onFeatureBranch: {
        files: { 'feature.js': 'feature code' },
        gitState: 'clean',
        branch: 'synth-dev/existing-feature',
    },
};
```

## 7. Implementation Guidelines

### 7.1 Development Phases

#### Phase 1: Core Infrastructure

- **SnapshotManager base class** with mode detection
- **Strategy pattern implementation** for Git vs Legacy modes
- **Basic snapshot creation and retrieval**
- **File backup mechanisms**

#### Phase 2: Git Integration

- **GitIntegration component** with command-line Git wrapper
- **Branch lifecycle management**
- **Automatic commit functionality**
- **Git-based snapshot retrieval**

#### Phase 3: User Interface

- **SnapshotCommand interactive interface**
- **Snapshot listing and detail views**
- **Restoration workflows with confirmations**
- **Branch management commands**

#### Phase 4: Advanced Features

- **Error recovery mechanisms**
- **Performance optimizations**
- **Cleanup and maintenance features**
- **Integration with existing tool system**

### 7.2 Code Organization

```
src/core/snapshot/
├── SnapshotManager.js           # Main orchestrator
├── strategies/
│   ├── GitSnapshotStrategy.js   # Git-based operations
│   ├── FileSnapshotStrategy.js  # In-memory file operations
│   └── StrategyFactory.js       # Strategy selection logic
├── storage/
│   ├── SnapshotStore.js         # Unified storage interface
│   ├── GitIntegration.js        # Git command wrapper
│   └── FileStorage.js           # File-based storage implementation
├── models/
│   ├── Snapshot.js              # Snapshot data model
│   ├── SnapshotMetadata.js      # Metadata management
│   └── ContentHash.js           # Content hashing utilities
├── events/
│   ├── SnapshotEvents.js        # Event system for notifications
│   └── EventEmitter.js          # Custom event emitter
├── validation/
│   ├── PathValidator.js         # File path validation
│   └── ContentValidator.js      # Content validation
└── utils/
    ├── BranchNaming.js          # Git branch naming utilities
    ├── CommitMessage.js         # Commit message formatting
    └── FileUtils.js             # File operation utilities
```

### 7.3 Configuration

#### Environment Variables

```bash
SYNTHDEV_SNAPSHOT_MODE=auto|git|legacy  # Force specific mode
SYNTHDEV_SNAPSHOT_BRANCH_PREFIX=synth-dev/  # Branch naming
SYNTHDEV_SNAPSHOT_MAX_COUNT=50           # Maximum snapshots to keep
SYNTHDEV_SNAPSHOT_AUTO_CLEANUP=true     # Enable automatic cleanup
```

#### Configuration Schema

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

## 8. Security Considerations

### 8.1 File System Security

#### 8.1.1 Path Validation

```javascript
class PathValidator {
    static validatePath(filePath) {
        // Prevent directory traversal
        if (filePath.includes('..') || filePath.includes('~')) {
            throw new SecurityError('Directory traversal attempt detected');
        }

        // Ensure path is within project directory
        const resolvedPath = path.resolve(filePath);
        const projectRoot = path.resolve(process.cwd());

        if (!resolvedPath.startsWith(projectRoot)) {
            throw new SecurityError('Path outside project directory');
        }

        return resolvedPath;
    }
}
```

#### 8.1.2 Permission Management

- **Read-only validation**: Check file permissions before backup attempts
- **Write permission verification**: Ensure restore operations are permitted
- **Directory creation limits**: Restrict directory creation to project scope
- **Temporary file security**: Use secure temporary directories with proper permissions

#### 8.1.3 File Content Security

- **Binary file detection**: Handle binary files safely without content exposure
- **Large file limits**: Prevent memory exhaustion from oversized files
- **Malicious content scanning**: Basic checks for suspicious file patterns
- **Encoding validation**: Ensure proper text encoding handling

### 8.2 Git Security

#### 8.2.1 Command Injection Prevention

```javascript
class GitCommandSanitizer {
    static sanitizeCommitMessage(message) {
        // Remove shell metacharacters
        return message
            .replace(/[`$(){}[\]|&;<>]/g, '')
            .replace(/\n/g, ' ')
            .trim()
            .substring(0, 500); // Limit length
    }

    static sanitizeBranchName(name) {
        // Git-safe branch name
        return name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
    }
}
```

#### 8.2.2 Repository Validation

- **Git repository verification**: Ensure valid Git repository before operations
- **Branch existence checks**: Validate branches before switching
- **Remote repository safety**: Avoid operations on untrusted remotes
- **Hook validation**: Check for malicious Git hooks

#### 8.2.3 Git Command Safety

- **Parameter escaping**: Properly escape all Git command parameters
- **Command whitelisting**: Only allow specific Git commands
- **Output sanitization**: Clean Git command output before logging
- **Timeout enforcement**: Prevent hanging Git operations

### 8.3 Data Protection

#### 8.3.1 Sensitive Data Detection

```javascript
class SensitiveDataDetector {
    static patterns = [
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
        /secret\s*[:=]\s*['"][^'"]+['"]/i,
        /token\s*[:=]\s*['"][^'"]+['"]/i,
    ];

    static detectSensitiveContent(content) {
        return this.patterns.some(pattern => pattern.test(content));
    }

    static sanitizeForLogging(content) {
        let sanitized = content;
        this.patterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });
        return sanitized;
    }
}
```

#### 8.3.2 Access Control

- **Operation permissions**: Role-based access to snapshot operations
- **File access restrictions**: Limit file access to authorized paths
- **Command authorization**: Verify user permissions for destructive operations
- **Audit trail**: Log all security-relevant operations

#### 8.3.3 Data Encryption (Optional)

- **At-rest encryption**: Encrypt snapshot data when stored
- **Key management**: Secure handling of encryption keys
- **Transport security**: Secure data transmission if applicable
- **Compliance support**: Meet data protection requirements

## 9. Performance Considerations

### 9.1 Optimization Strategies

#### 9.1.1 Lazy Loading Implementation

```javascript
class SnapshotMetadataCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.accessOrder = [];
    }

    async getSnapshot(id) {
        if (this.cache.has(id)) {
            this.updateAccessOrder(id);
            return this.cache.get(id);
        }

        const snapshot = await this.loadSnapshotFromStorage(id);
        this.addToCache(id, snapshot);
        return snapshot;
    }

    addToCache(id, snapshot) {
        if (this.cache.size >= this.maxSize) {
            const oldestId = this.accessOrder.shift();
            this.cache.delete(oldestId);
        }

        this.cache.set(id, snapshot);
        this.accessOrder.push(id);
    }
}
```

#### 9.1.2 Incremental Backup Strategy

```javascript
class IncrementalBackup {
    async backupFileIfChanged(filePath) {
        const currentChecksum = await this.calculateFileChecksum(filePath);
        const lastChecksum = this.getLastKnownChecksum(filePath);

        if (currentChecksum !== lastChecksum) {
            await this.performFullBackup(filePath);
            this.updateChecksum(filePath, currentChecksum);
            return true;
        }

        return false; // No backup needed
    }
}
```

#### 9.1.3 Content Compression

```javascript
class ContentCompressor {
    static async compressContent(content) {
        if (content.length < 1024) return content; // Skip small files

        const compressed = await gzip(content);
        return compressed.length < content.length * 0.8 ? compressed : content;
    }

    static async decompressContent(content) {
        try {
            return await gunzip(content);
        } catch {
            return content; // Not compressed
        }
    }
}
```

### 9.2 Resource Management

#### 9.2.1 Memory Usage Control

```javascript
class MemoryManager {
    constructor(maxMemoryMB = 100) {
        this.maxMemory = maxMemoryMB * 1024 * 1024;
        this.currentUsage = 0;
        this.snapshots = new Map();
    }

    async addSnapshot(snapshot) {
        const snapshotSize = this.calculateSnapshotSize(snapshot);

        if (this.currentUsage + snapshotSize > this.maxMemory) {
            await this.evictOldestSnapshots(snapshotSize);
        }

        this.snapshots.set(snapshot.id, snapshot);
        this.currentUsage += snapshotSize;
    }

    async evictOldestSnapshots(requiredSpace) {
        const sortedSnapshots = Array.from(this.snapshots.values()).sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        let freedSpace = 0;
        for (const snapshot of sortedSnapshots) {
            if (freedSpace >= requiredSpace) break;

            await this.persistSnapshotToDisk(snapshot);
            const size = this.calculateSnapshotSize(snapshot);
            this.snapshots.delete(snapshot.id);
            this.currentUsage -= size;
            freedSpace += size;
        }
    }
}
```

#### 9.2.2 Disk Space Monitoring

```javascript
class DiskSpaceMonitor {
    async checkDiskSpace() {
        const stats = await fs.statvfs(process.cwd());
        const freeSpace = stats.bavail * stats.frsize;
        const totalSpace = stats.blocks * stats.frsize;

        return {
            free: freeSpace,
            total: totalSpace,
            usagePercent: ((totalSpace - freeSpace) / totalSpace) * 100,
        };
    }

    async ensureSufficientSpace(requiredBytes) {
        const { free } = await this.checkDiskSpace();

        if (free < requiredBytes * 1.1) {
            // 10% buffer
            await this.performCleanup();

            const { free: newFree } = await this.checkDiskSpace();
            if (newFree < requiredBytes) {
                throw new Error('Insufficient disk space');
            }
        }
    }
}
```

#### 9.2.3 Background Processing

```javascript
class BackgroundProcessor {
    constructor() {
        this.taskQueue = [];
        this.processing = false;
    }

    addTask(task) {
        this.taskQueue.push(task);
        this.processQueue();
    }

    async processQueue() {
        if (this.processing) return;

        this.processing = true;

        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            try {
                await task();
            } catch (error) {
                this.logger.warn(`Background task failed: ${error.message}`);
            }
        }

        this.processing = false;
    }
}
```

### 9.3 Scalability

#### 9.3.1 Efficient Indexing

```javascript
class SnapshotIndex {
    constructor() {
        this.byTimestamp = new Map();
        this.byInstruction = new Map();
        this.byFilePattern = new Map();
    }

    addSnapshot(snapshot) {
        // Index by timestamp for chronological access
        const timeKey = this.getTimeKey(snapshot.timestamp);
        if (!this.byTimestamp.has(timeKey)) {
            this.byTimestamp.set(timeKey, []);
        }
        this.byTimestamp.get(timeKey).push(snapshot.id);

        // Index by instruction keywords for search
        const keywords = this.extractKeywords(snapshot.instruction);
        keywords.forEach(keyword => {
            if (!this.byInstruction.has(keyword)) {
                this.byInstruction.set(keyword, []);
            }
            this.byInstruction.get(keyword).push(snapshot.id);
        });
    }

    findSnapshots(criteria) {
        if (criteria.timeRange) {
            return this.findByTimeRange(criteria.timeRange);
        }
        if (criteria.instruction) {
            return this.findByInstruction(criteria.instruction);
        }
        if (criteria.filePattern) {
            return this.findByFilePattern(criteria.filePattern);
        }
    }
}
```

#### 9.3.2 Batch Operations

```javascript
class BatchOperations {
    async batchBackupFiles(filePaths) {
        const batchSize = 10;
        const results = [];

        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(path => this.backupFile(path)));
            results.push(...batchResults);
        }

        return results;
    }

    async batchRestoreFiles(fileRestoreOperations) {
        // Group by operation type for efficiency
        const restores = fileRestoreOperations.filter(op => op.type === 'restore');
        const deletions = fileRestoreOperations.filter(op => op.type === 'delete');

        // Process restores first, then deletions
        await Promise.all(restores.map(op => this.restoreFile(op.path, op.content)));
        await Promise.all(deletions.map(op => this.deleteFile(op.path)));
    }
}
```

## 10. Monitoring & Observability

### 10.1 Logging Strategy

#### 10.1.1 Structured Logging Format

```javascript
class SnapshotLogger {
    logSnapshotOperation(operation, metadata) {
        this.logger.info({
            component: 'snapshot',
            operation: operation,
            timestamp: new Date().toISOString(),
            mode: metadata.mode,
            duration: metadata.duration,
            filesAffected: metadata.filesAffected,
            success: metadata.success,
            error: metadata.error,
            userId: metadata.userId,
            sessionId: metadata.sessionId,
        });
    }

    logPerformanceMetric(metric, value, context) {
        this.logger.debug({
            type: 'performance',
            metric: metric,
            value: value,
            context: context,
            timestamp: new Date().toISOString(),
        });
    }
}
```

#### 10.1.2 Log Levels and Categories

**ERROR Level**:

- Git operation failures
- File system errors
- Snapshot corruption
- Security violations

**WARN Level**:

- Fallback mode activation
- Performance degradation
- Resource constraints
- Partial operation failures

**INFO Level**:

- Snapshot creation/restoration
- Mode switches
- Branch operations
- User interactions

**DEBUG Level**:

- File backup operations
- Checksum calculations
- Cache operations
- Internal state changes

### 10.2 Metrics Collection

#### 10.2.1 Performance Metrics

```javascript
class PerformanceMetrics {
    constructor() {
        this.metrics = {
            snapshotCreation: new HistogramMetric(),
            fileBackup: new HistogramMetric(),
            gitOperations: new HistogramMetric(),
            restoration: new HistogramMetric(),
        };
    }

    recordSnapshotCreation(duration, fileCount, mode) {
        this.metrics.snapshotCreation.record(duration, {
            fileCount: this.bucketizeFileCount(fileCount),
            mode: mode,
        });
    }

    recordGitOperation(operation, duration, success) {
        this.metrics.gitOperations.record(duration, {
            operation: operation,
            success: success,
        });
    }

    getMetricsSummary() {
        return {
            snapshotCreation: this.metrics.snapshotCreation.getSummary(),
            fileBackup: this.metrics.fileBackup.getSummary(),
            gitOperations: this.metrics.gitOperations.getSummary(),
            restoration: this.metrics.restoration.getSummary(),
        };
    }
}
```

#### 10.2.2 Usage Analytics

```javascript
class UsageAnalytics {
    trackUserInteraction(action, context) {
        this.analytics.track('snapshot_interaction', {
            action: action,
            mode: context.mode,
            snapshotCount: context.snapshotCount,
            sessionDuration: context.sessionDuration,
            timestamp: Date.now(),
        });
    }

    trackModeSwitch(fromMode, toMode, reason) {
        this.analytics.track('mode_switch', {
            fromMode: fromMode,
            toMode: toMode,
            reason: reason,
            timestamp: Date.now(),
        });
    }

    generateUsageReport() {
        return {
            totalSnapshots: this.getTotalSnapshots(),
            modeDistribution: this.getModeDistribution(),
            averageSessionLength: this.getAverageSessionLength(),
            mostCommonOperations: this.getMostCommonOperations(),
            errorRate: this.getErrorRate(),
        };
    }
}
```

### 10.3 Health Checks

#### 10.3.1 System Health Monitoring

```javascript
class HealthMonitor {
    async performHealthCheck() {
        const checks = await Promise.allSettled([
            this.checkGitAvailability(),
            this.checkFileSystemHealth(),
            this.checkMemoryUsage(),
            this.checkDiskSpace(),
            this.validateSnapshotIntegrity(),
        ]);

        return {
            timestamp: new Date().toISOString(),
            overall: checks.every(check => check.status === 'fulfilled' && check.value.healthy),
            details: {
                git:
                    checks[0].status === 'fulfilled'
                        ? checks[0].value
                        : { healthy: false, error: checks[0].reason },
                filesystem:
                    checks[1].status === 'fulfilled'
                        ? checks[1].value
                        : { healthy: false, error: checks[1].reason },
                memory:
                    checks[2].status === 'fulfilled'
                        ? checks[2].value
                        : { healthy: false, error: checks[2].reason },
                disk:
                    checks[3].status === 'fulfilled'
                        ? checks[3].value
                        : { healthy: false, error: checks[3].reason },
                snapshots:
                    checks[4].status === 'fulfilled'
                        ? checks[4].value
                        : { healthy: false, error: checks[4].reason },
            },
        };
    }

    async checkGitAvailability() {
        try {
            const result = await this.gitUtils.checkGitAvailability();
            return {
                healthy: result.available,
                details: {
                    available: result.available,
                    isRepo: result.isRepo,
                    version: result.version,
                },
            };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    async validateSnapshotIntegrity() {
        const snapshots = await this.snapshotManager.getSnapshots();
        const corruptedSnapshots = [];

        for (const snapshot of snapshots) {
            if (!(await this.isSnapshotValid(snapshot))) {
                corruptedSnapshots.push(snapshot.id);
            }
        }

        return {
            healthy: corruptedSnapshots.length === 0,
            details: {
                totalSnapshots: snapshots.length,
                corruptedSnapshots: corruptedSnapshots,
                integrityScore: (snapshots.length - corruptedSnapshots.length) / snapshots.length,
            },
        };
    }
}
```

#### 10.3.2 Alerting System

```javascript
class AlertingSystem {
    constructor() {
        this.thresholds = {
            errorRate: 0.05, // 5% error rate
            memoryUsage: 0.8, // 80% memory usage
            diskUsage: 0.9, // 90% disk usage
            responseTime: 5000, // 5 second response time
        };
    }

    checkThresholds(metrics) {
        const alerts = [];

        if (metrics.errorRate > this.thresholds.errorRate) {
            alerts.push({
                level: 'warning',
                message: `High error rate detected: ${(metrics.errorRate * 100).toFixed(1)}%`,
                metric: 'errorRate',
                value: metrics.errorRate,
                threshold: this.thresholds.errorRate,
            });
        }

        if (metrics.memoryUsage > this.thresholds.memoryUsage) {
            alerts.push({
                level: 'critical',
                message: `High memory usage: ${(metrics.memoryUsage * 100).toFixed(1)}%`,
                metric: 'memoryUsage',
                value: metrics.memoryUsage,
                threshold: this.thresholds.memoryUsage,
            });
        }

        return alerts;
    }

    async sendAlert(alert) {
        this.logger.warn(`ALERT [${alert.level.toUpperCase()}]: ${alert.message}`, {
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
            timestamp: new Date().toISOString(),
        });

        // Additional alerting mechanisms can be added here
        // (email, Slack, monitoring systems, etc.)
    }
}
```

## 11. Migration Strategy

### 11.1 Backward Compatibility

#### 11.1.1 Legacy Format Support

```javascript
class LegacySnapshotAdapter {
    async convertLegacySnapshot(legacySnapshot) {
        return {
            id: legacySnapshot.id,
            instruction: legacySnapshot.instruction,
            timestamp: legacySnapshot.timestamp,
            mode: 'file',
            contentHash: this.calculateContentHash(legacySnapshot.files),
            files: new Map(Object.entries(legacySnapshot.files)),
            modifiedFiles: new Set(legacySnapshot.modifiedFiles || []),
            fileChecksums: this.calculateFileChecksums(legacySnapshot.files),
            // Legacy fields for compatibility
            _legacy: true,
            _originalFormat: legacySnapshot,
        };
    }

    async migrateLegacySnapshots(legacySnapshots) {
        const migrated = [];
        const errors = [];

        for (const legacy of legacySnapshots) {
            try {
                const converted = await this.convertLegacySnapshot(legacy);
                await this.validateMigratedSnapshot(converted);
                migrated.push(converted);
            } catch (error) {
                errors.push({
                    snapshotId: legacy.id,
                    error: error.message,
                });
            }
        }

        return { migrated, errors };
    }
}
```

#### 11.1.2 Gradual Migration Strategy

```javascript
class GradualMigrationManager {
    constructor() {
        this.migrationState = {
            phase: 'assessment',
            totalSnapshots: 0,
            migratedSnapshots: 0,
            errors: [],
        };
    }

    async startMigration() {
        try {
            await this.assessmentPhase();
            await this.preparationPhase();
            await this.migrationPhase();
            await this.validationPhase();
            await this.cleanupPhase();
        } catch (error) {
            await this.rollbackMigration();
            throw error;
        }
    }

    async assessmentPhase() {
        this.migrationState.phase = 'assessment';

        const legacySnapshots = await this.loadLegacySnapshots();
        this.migrationState.totalSnapshots = legacySnapshots.length;

        // Analyze compatibility issues
        const compatibility = await this.analyzeCompatibility(legacySnapshots);

        if (compatibility.criticalIssues.length > 0) {
            throw new Error(
                `Critical compatibility issues found: ${compatibility.criticalIssues.join(', ')}`
            );
        }

        this.logger.info(
            `Migration assessment complete: ${legacySnapshots.length} snapshots to migrate`
        );
    }

    async migrationPhase() {
        this.migrationState.phase = 'migration';

        const legacySnapshots = await this.loadLegacySnapshots();
        const batchSize = 10;

        for (let i = 0; i < legacySnapshots.length; i += batchSize) {
            const batch = legacySnapshots.slice(i, i + batchSize);
            await this.migrateBatch(batch);

            this.migrationState.migratedSnapshots += batch.length;
            this.reportProgress();
        }
    }
}
```

### 11.2 Migration Process

#### 11.2.1 Pre-Migration Validation

```javascript
class PreMigrationValidator {
    async validateMigrationReadiness() {
        const checks = {
            diskSpace: await this.checkDiskSpace(),
            permissions: await this.checkPermissions(),
            gitState: await this.checkGitState(),
            dataIntegrity: await this.checkDataIntegrity(),
        };

        const issues = Object.entries(checks)
            .filter(([_, result]) => !result.valid)
            .map(([check, result]) => ({ check, issue: result.issue }));

        return {
            ready: issues.length === 0,
            issues: issues,
        };
    }

    async checkDiskSpace() {
        const required = await this.estimateRequiredSpace();
        const available = await this.getAvailableSpace();

        return {
            valid: available > required * 1.5, // 50% buffer
            issue:
                available <= required * 1.5
                    ? `Insufficient disk space. Required: ${required}MB, Available: ${available}MB`
                    : null,
        };
    }

    async checkDataIntegrity() {
        const snapshots = await this.loadLegacySnapshots();
        const corruptedSnapshots = [];

        for (const snapshot of snapshots) {
            if (!(await this.validateSnapshotIntegrity(snapshot))) {
                corruptedSnapshots.push(snapshot.id);
            }
        }

        return {
            valid: corruptedSnapshots.length === 0,
            issue:
                corruptedSnapshots.length > 0
                    ? `Corrupted snapshots found: ${corruptedSnapshots.join(', ')}`
                    : null,
        };
    }
}
```

#### 11.2.2 Migration Rollback Strategy

```javascript
class MigrationRollback {
    async createRollbackPoint() {
        const rollbackData = {
            timestamp: new Date().toISOString(),
            legacySnapshots: await this.exportLegacySnapshots(),
            systemState: await this.captureSystemState(),
            configuration: await this.exportConfiguration(),
        };

        await this.saveRollbackData(rollbackData);
        return rollbackData.timestamp;
    }

    async performRollback(rollbackPointId) {
        const rollbackData = await this.loadRollbackData(rollbackPointId);

        // Restore legacy snapshots
        await this.restoreLegacySnapshots(rollbackData.legacySnapshots);

        // Restore system state
        await this.restoreSystemState(rollbackData.systemState);

        // Restore configuration
        await this.restoreConfiguration(rollbackData.configuration);

        // Clean up migrated data
        await this.cleanupMigratedData();

        this.logger.info(`Rollback completed to point: ${rollbackPointId}`);
    }
}
```

#### 11.2.3 Post-Migration Validation

```javascript
class PostMigrationValidator {
    async validateMigration() {
        const validationResults = {
            dataIntegrity: await this.validateDataIntegrity(),
            functionality: await this.validateFunctionality(),
            performance: await this.validatePerformance(),
            compatibility: await this.validateCompatibility(),
        };

        const overallSuccess = Object.values(validationResults).every(result => result.success);

        return {
            success: overallSuccess,
            results: validationResults,
            recommendations: this.generateRecommendations(validationResults),
        };
    }

    async validateDataIntegrity() {
        const originalCount = await this.getLegacySnapshotCount();
        const migratedCount = await this.getMigratedSnapshotCount();

        if (originalCount !== migratedCount) {
            return {
                success: false,
                issue: `Snapshot count mismatch: ${originalCount} original, ${migratedCount} migrated`,
            };
        }

        // Validate content integrity
        const integrityChecks = await this.performContentIntegrityChecks();

        return {
            success: integrityChecks.passed,
            details: integrityChecks,
        };
    }

    async validateFunctionality() {
        const functionalTests = [
            () => this.testSnapshotCreation(),
            () => this.testSnapshotRestoration(),
            () => this.testGitIntegration(),
            () => this.testFileOperations(),
        ];

        const results = await Promise.allSettled(functionalTests.map(test => test()));

        const failures = results
            .filter(result => result.status === 'rejected')
            .map(result => result.reason.message);

        return {
            success: failures.length === 0,
            failures: failures,
        };
    }
}
```

### 11.3 Migration Monitoring

#### 11.3.1 Progress Tracking

```javascript
class MigrationProgressTracker {
    constructor() {
        this.progress = {
            phase: 'not_started',
            startTime: null,
            currentStep: null,
            totalSteps: 0,
            completedSteps: 0,
            errors: [],
            estimatedCompletion: null,
        };
    }

    updateProgress(step, completed, total) {
        this.progress.currentStep = step;
        this.progress.completedSteps = completed;
        this.progress.totalSteps = total;

        if (this.progress.startTime) {
            const elapsed = Date.now() - this.progress.startTime;
            const rate = completed / elapsed;
            const remaining = total - completed;
            this.progress.estimatedCompletion = new Date(Date.now() + remaining / rate);
        }

        this.reportProgress();
    }

    reportProgress() {
        const percentage = (this.progress.completedSteps / this.progress.totalSteps) * 100;

        this.logger.info(
            `Migration progress: ${percentage.toFixed(1)}% (${this.progress.completedSteps}/${this.progress.totalSteps})`,
            {
                phase: this.progress.phase,
                currentStep: this.progress.currentStep,
                estimatedCompletion: this.progress.estimatedCompletion,
                errors: this.progress.errors.length,
            }
        );
    }
}
```

---

**Implementation Note**: This specification defines a complete reimplementation approach that maintains the core value proposition while improving reliability, user experience, and maintainability. The modular architecture allows for incremental development and testing of individual components.
