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

## 11. Detailed Implementation Plan

This section provides a comprehensive task breakdown for implementing the SynthDev Snapshots system. Each task includes clear deliverables, acceptance criteria, and dependencies to guide the development process.

### 11.1 Phase 1: Foundation & Core Infrastructure

#### Task 1.1: Project Setup and Architecture Foundation

**Description**: Establish the basic project structure, dependencies, and core architectural components for the snapshot system.

**Deliverables**:

- Create directory structure under `src/core/snapshot/`
- Set up package dependencies (crypto, fs, path utilities)
- Implement base interfaces and abstract classes
- Create configuration schema and environment variable handling
- Set up logging infrastructure with structured logging

**Acceptance Criteria**:

- [x] Directory structure matches specification (Section 7.2)
- [x] All required dependencies are installed and configured
- [x] Base interfaces compile without errors
- [x] Configuration can be loaded from environment variables
- [x] Logging outputs structured JSON format

**Estimated Time**: 1-2 days

#### Task 1.2: Content Change Detection System

**Description**: Implement the content hashing and change detection system that forms the foundation of efficient snapshot operations.

**Deliverables**:

- `ContentChangeDetector` class with MD5 hashing
- `SnapshotIntegrityValidator` for validation
- File checksum calculation and caching
- Change detection algorithms
- Performance optimization for large files

**Acceptance Criteria**:

- [x] Can detect file changes using content hashing
- [x] Handles binary files correctly
- [x] Caches checksums to avoid recalculation
- [x] Validates snapshot integrity
- [x] Performance tests pass for files up to 10MB

**Dependencies**: Task 1.1
**Estimated Time**: 2-3 days

#### Task 1.3: Core Data Models and Storage Interface

**Description**: Implement the core data structures and unified storage interface for both Git and file-based modes.

**Deliverables**:

- `Snapshot` data model with all required properties
- `SnapshotMetadata` management class
- `SnapshotStore` unified interface
- In-memory storage implementation
- Serialization/deserialization logic

**Acceptance Criteria**:

- [x] Snapshot model supports both Git and file modes
- [x] Metadata includes all required fields from API specification
- [x] Storage interface is mode-agnostic
- [x] Can serialize/deserialize snapshots correctly
- [x] Memory usage is tracked and controlled

**Dependencies**: Task 1.1, Task 1.2
**Estimated Time**: 2-3 days

#### Phase 1 Product Owner Testing

**How to Test**: The product owner can validate the foundation is solid by:

**Setup Verification**:

- [x] Run `npm test` - all foundation tests pass
- [x] Check configuration loading: modify environment variables and verify they're reflected
- [x] Verify logging: check that structured JSON logs are generated for test operations

**Content Change Detection**:

- [x] Create a test file, modify it, verify system detects the change
- [x] Test with binary files (images, etc.) - system should handle without errors
- [x] Performance test: create 100 small files, verify change detection completes in <2 seconds

**Data Models**:

- [x] Create a snapshot object, serialize/deserialize it, verify data integrity
- [x] Test both Git and file mode snapshot creation
- [x] Verify memory usage stays within configured limits

**Success Criteria**: All tests pass, configuration works, change detection is accurate, and performance meets thresholds.

### 11.2 Phase 2: Git Integration Layer

#### Task 2.1: Git Command Wrapper and Safety Layer

**Description**: Create a secure, robust wrapper around Git command-line operations with proper error handling and security measures. Use src\utils\GitUtils.js implementation where possible, adjust if needed.

**Deliverables**:

- `GitIntegration` class with command execution
- Command sanitization and injection prevention
- Git availability detection
- Repository state validation
- Error handling and retry mechanisms
- Structured logging for all Git operations
- Unit tests for Git wrapper functionality
- Security validation tests

**Acceptance Criteria**:

- [x] All Git commands are properly sanitized
- [x] Can detect Git availability and repository state
- [x] Handles Git command failures gracefully
- [x] Implements retry logic for transient failures
- [x] Security tests pass for command injection attempts
- [x] All Git operations are logged with structured format
- [x] Unit tests achieve >90% coverage
- [x] Performance tests validate command execution times

**Dependencies**: Task 1.1
**Estimated Time**: 4-5 days

#### Task 2.2: Branch Lifecycle Management

**Description**: Implement automatic branch creation, switching, and cleanup for Git-based snapshot operations.

**Deliverables**:

- Branch naming utilities with timestamp generation
- Automatic branch creation logic
- Branch switching and merging operations
- Cleanup mechanisms for abandoned branches
- Uncommitted changes detection
- Branch name validation and sanitization
- Comprehensive logging for branch operations
- Unit and integration tests for branch management
- Performance optimization for branch operations

**Acceptance Criteria**:

- [x] Creates branches with proper naming convention
- [x] Only creates branches when uncommitted changes exist
- [x] Can switch between original and feature branches
- [x] Automatically cleans up empty branches
- [x] Handles edge cases (detached HEAD, etc.)
- [x] Branch names are validated and sanitized
- [x] All branch operations are logged
- [x] Tests cover all branch lifecycle scenarios
- [x] Branch operations complete within performance thresholds

**Dependencies**: Task 2.1
**Estimated Time**: 3-4 days

#### Task 2.3: Git-based Snapshot Strategy

**Description**: Implement the Git strategy for snapshot operations using commits and branch management.

**Deliverables**:

- `GitSnapshotStrategy` class implementation
- Automatic commit functionality
- Commit message generation and sanitization
- Git-based snapshot retrieval
- Integration with branch lifecycle
- Error handling and recovery mechanisms
- Comprehensive logging for Git strategy operations
- Unit and integration tests with real Git repositories
- Performance optimization for large repositories

**Acceptance Criteria**:

- [x] Creates snapshots as Git commits
- [x] Generates meaningful commit messages
- [x] Can retrieve snapshots from Git history
- [x] Integrates with branch management
- [x] Handles merge conflicts appropriately
- [x] Commit messages are properly sanitized
- [x] All operations are logged with context
- [x] Tests cover Git strategy with real repositories
- [x] Performance is acceptable for repositories with 1000+ files

**Dependencies**: Task 2.1, Task 2.2, Task 1.3
**Estimated Time**: 4-5 days

#### Phase 2 Product Owner Testing

**How to Test**: The product owner can validate Git integration by testing in a real Git repository:

**Git Environment Setup**:

- [x] Navigate to a Git repository with uncommitted changes
- [x] Run snapshot creation test - verify it creates a `synth-dev/` branch
- [x] Check that original branch remains untouched

**Branch Management**:

- [x] Test branch creation with various instruction types
- [x] Verify branch naming follows `synth-dev/YYYYMMDDTHHMMSS-description` format
- [x] Test branch switching and cleanup functionality

**Git Operations**:

- [x] Create snapshot, make file changes, verify automatic commits
- [x] Test commit message generation - should include timestamp and instruction
- [x] Verify Git history shows proper commit sequence

**Security & Error Handling**:

- [x] Test with malicious input (special characters in instructions) - should be sanitized
- [x] Test Git command failures (simulate by removing Git temporarily) - should fail gracefully
- [x] Test in non-Git directory - should detect and handle appropriately

**Performance**:

- [x] Test with repository containing 500+ files - operations should complete in <5 seconds
- [x] Verify memory usage remains stable during Git operations

**Success Criteria**: Git operations work correctly, branches are managed properly, security is enforced, and performance is acceptable.

### 11.3 Phase 3: File-based Fallback System

#### Task 3.1: File-based Storage Implementation

**Description**: Implement the fallback file-based storage system for environments without Git or when Git operations fail.

**Deliverables**:

- `FileSnapshotStrategy` class implementation
- In-memory file content storage with memory limits
- File backup and restoration logic
- Path validation and sanitization
- File permission handling and security checks
- Compression support for large files
- Memory usage monitoring and optimization
- Comprehensive logging for file operations
- Unit tests for file strategy functionality
- Cross-platform compatibility testing

**Acceptance Criteria**:

- [x] Can backup and restore files without Git
- [x] Manages memory usage efficiently with configurable limits
- [x] Supports file compression when beneficial
- [x] Handles file permissions correctly
- [x] Works across different operating systems
- [x] All file paths are validated and sanitized
- [x] File operations are logged with details
- [x] Tests achieve >90% coverage
- [x] Performance is acceptable for 1000+ files

**Dependencies**: Task 1.2, Task 1.3
**Estimated Time**: 4-5 days

#### Task 3.2: Strategy Pattern Implementation

**Description**: Implement the strategy pattern for automatic mode selection and switching between Git and file-based operations.

**Deliverables**:

- `StrategyFactory` for automatic strategy selection
- Mode detection logic with environment validation
- Strategy switching mechanisms with state preservation
- Graceful degradation from Git to file mode
- Configuration-based mode forcing
- Error handling for strategy failures
- Comprehensive logging for strategy operations
- Unit tests for strategy pattern implementation
- Integration tests for strategy switching scenarios

**Acceptance Criteria**:

- [x] Automatically selects appropriate strategy
- [x] Can switch strategies during runtime
- [x] Gracefully degrades when Git fails
- [x] Respects configuration overrides
- [x] Maintains state consistency during switches
- [x] Strategy operations are logged with context
- [x] Tests cover all strategy switching scenarios
- [x] Error handling prevents system instability

**Dependencies**: Task 2.3, Task 3.1
**Estimated Time**: 3-4 days

#### Phase 3 Product Owner Testing

**How to Test**: The product owner can validate the fallback system by testing without Git:

**Non-Git Environment Setup**:

- [x] Test in directory without Git (or temporarily disable Git)
- [x] Verify system automatically switches to file-based mode
- [x] Check that appropriate mode indicator is shown

**File-based Operations**:

- [x] Create snapshots in file mode - verify files are backed up in memory
- [x] Modify files, create new snapshot, verify only changed files are backed up
- [x] Test file restoration - verify files are restored to exact previous state

**Strategy Switching**:

- [x] Start in Git mode, simulate Git failure, verify graceful fallback to file mode
- [x] Test configuration override to force file mode
- [x] Verify state consistency during mode switches

**Memory Management**:

- [x] Create snapshots with 100+ files, verify memory usage is tracked
- [x] Test memory limits - system should handle gracefully when approaching limits
- [x] Verify compression works for large files (>1MB)

**Cross-platform Testing**:

- [x] Test file operations on different operating systems
- [x] Verify file permissions are handled correctly
- [x] Test with various file types (text, binary, special characters in names)

**Security Validation**:

- [x] Test with file paths containing `..` or `~` - should be rejected
- [x] Verify files outside project directory cannot be accessed
- [x] Test with files having special permissions

**Success Criteria**: File-based mode works reliably, strategy switching is seamless, memory is managed efficiently, and security is enforced.

### 11.4 Phase 4: Snapshot Manager and Core Logic

#### Task 4.1: SnapshotManager Implementation

**Description**: Implement the main orchestrator class that coordinates all snapshot operations and manages the overall system state.

**Deliverables**:

- `SnapshotManager` class with full API implementation
- Snapshot creation and retrieval logic with validation
- File operation coordination with error handling
- State management and tracking with consistency checks
- Integration with both strategies
- Concurrent operation safety mechanisms
- Performance monitoring and optimization
- Comprehensive logging for all operations
- Unit tests for SnapshotManager functionality
- Integration tests with both strategies

**Acceptance Criteria**:

- [ ] Implements all methods from API specification
- [ ] Coordinates between strategies correctly
- [ ] Maintains consistent state
- [ ] Handles concurrent operations safely
- [ ] Provides comprehensive status information
- [ ] All operations are logged with structured format
- [ ] Tests achieve >90% coverage
- [ ] Performance meets specified thresholds

**Dependencies**: Task 3.2, Task 1.2
**Estimated Time**: 5-6 days

#### Task 4.2: Automatic Snapshot Creation Integration

**Description**: Integrate snapshot creation with the existing tool execution system to automatically create snapshots before AI operations.

**Deliverables**:

- Integration hooks with tool execution system
- Instruction parsing and snapshot triggering logic
- Tool execution monitoring with change detection
- Automatic commit after tool operations
- Error handling and recovery during tool execution
- Input validation and sanitization
- Comprehensive logging for integration operations
- Unit tests for integration functionality
- End-to-end tests with real tool execution

**Acceptance Criteria**:

- [ ] Creates snapshots before tool execution
- [ ] Monitors tool execution for file changes
- [ ] Commits changes automatically after tools
- [ ] Handles tool execution failures gracefully
- [ ] Maintains snapshot consistency
- [ ] All inputs are validated and sanitized
- [ ] Integration operations are logged
- [ ] Tests cover complete integration workflow

**Dependencies**: Task 4.1
**Estimated Time**: 3-4 days

#### Phase 4 Product Owner Testing

**How to Test**: The product owner can validate the core system functionality:

**SnapshotManager API Testing**:

- [ ] Test snapshot creation: provide instruction, verify snapshot is created with correct metadata
- [ ] Test snapshot retrieval: create multiple snapshots, verify they can be listed and retrieved
- [ ] Test both Git and file modes work through the same API

**Automatic Integration Testing**:

- [ ] Simulate tool execution: verify snapshot is created before tool runs
- [ ] Make file changes during "tool execution", verify changes are committed automatically
- [ ] Test error handling: simulate tool failure, verify system remains consistent

**Concurrent Operations**:

- [ ] Test multiple snapshot operations simultaneously - should handle safely
- [ ] Verify state consistency under concurrent access
- [ ] Test performance with multiple operations

**Status and Information**:

- [ ] Verify system provides accurate status information (mode, snapshot count, etc.)
- [ ] Test health checks - should report system health accurately
- [ ] Verify comprehensive logging for all operations

**End-to-End Workflow**:

- [ ] Complete workflow: instruction → snapshot creation → file changes → automatic commit
- [ ] Test in both Git and file modes
- [ ] Verify error recovery maintains system stability

**Performance Validation**:

- [ ] Create 50 snapshots, verify system remains responsive
- [ ] Test with large files (10MB+), verify reasonable performance
- [ ] Monitor memory usage during extended operations

**Success Criteria**: Core system works reliably, automatic integration functions correctly, performance is acceptable, and error handling maintains stability.

### 11.5 Phase 5: User Interface and Commands

#### Task 5.1: Interactive Snapshots Command

**Description**: Implement the `/snapshots` command with full interactive interface for snapshot management.

**Deliverables**:

- `SnapshotsCommand` class implementation
- Interactive menu system with input validation
- Snapshot listing with proper formatting
- Context-aware command options
- User input validation and sanitization
- Error handling with user-friendly messages
- Performance optimization for large snapshot lists
- Comprehensive logging for user interactions
- Unit tests for command functionality
- Integration tests for complete user workflows

**Acceptance Criteria**:

- [ ] Displays snapshots in specified format
- [ ] Shows different options for Git vs file mode
- [ ] Handles user input validation
- [ ] Provides clear error messages
- [ ] Supports all specified commands
- [ ] User inputs are validated and sanitized
- [ ] Command interactions are logged
- [ ] Tests cover all user interaction scenarios
- [ ] Performance is acceptable with 100+ snapshots

**Dependencies**: Task 4.1
**Estimated Time**: 4-5 days

#### Task 5.2: Snapshot Restoration Workflows

**Description**: Implement the complete restoration workflows with confirmations and detailed feedback.

**Deliverables**:

- Restoration confirmation dialogs with impact preview
- File restoration logic with validation
- Git reset operations with safety checks
- Progress indicators and user feedback
- Detailed success/failure reporting
- Error handling and recovery mechanisms
- Security validation for restoration operations
- Comprehensive logging for restoration activities
- Unit tests for restoration logic
- Integration tests for complete restoration workflows

**Acceptance Criteria**:

- [ ] Shows clear confirmation prompts
- [ ] Displays impact of restoration operations
- [ ] Provides detailed progress feedback
- [ ] Reports all changes made during restoration
- [ ] Handles restoration failures gracefully
- [ ] Restoration operations are validated for security
- [ ] All restoration activities are logged
- [ ] Tests cover all restoration scenarios
- [ ] Error recovery maintains system consistency

**Dependencies**: Task 5.1
**Estimated Time**: 3-4 days

#### Task 5.3: Branch Management Commands

**Description**: Implement Git-specific branch management commands for merging and switching.

**Deliverables**:

- Merge command implementation with conflict handling
- Branch switching functionality with state preservation
- Conflict detection and reporting with resolution guidance
- Cleanup operations with safety checks
- Integration with Git strategy
- Error handling for branch operations
- Performance optimization for large repositories
- Comprehensive logging for branch management
- Unit tests for branch commands
- Integration tests with real Git scenarios

**Acceptance Criteria**:

- [ ] Can merge feature branches to original
- [ ] Switches branches without losing work
- [ ] Detects and reports merge conflicts
- [ ] Cleans up branches appropriately
- [ ] Provides clear status information
- [ ] Branch operations are logged with context
- [ ] Tests cover all branch management scenarios
- [ ] Performance is acceptable for large repositories

**Dependencies**: Task 5.1, Task 2.2
**Estimated Time**: 3-4 days

#### Phase 5 Product Owner Testing

**How to Test**: The product owner can validate the complete user interface and experience:

**Interactive Command Testing**:

- [ ] Run `/snapshots` command, verify it shows snapshots in correct format
- [ ] Test in Git mode: verify shows Git-specific options (merge, switch)
- [ ] Test in file mode: verify shows file-specific options (delete, clear)
- [ ] Verify snapshot listing shows all required information (timestamp, instruction, mode indicators)

**Snapshot Management Operations**:

- [ ] Test snapshot selection: enter number, verify correct snapshot details are shown
- [ ] Test restoration workflow: select snapshot, confirm restoration, verify files are restored correctly
- [ ] Test restoration confirmation: verify shows impact preview before proceeding

**Git-specific Features**:

- [ ] Test branch merging: create snapshots, test merge command, verify branch is merged to original
- [ ] Test branch switching: verify can switch back to original branch without losing work
- [ ] Test conflict handling: create conflicting changes, verify conflicts are detected and reported

**User Experience Validation**:

- [ ] Test input validation: enter invalid commands, verify clear error messages
- [ ] Test with large number of snapshots (50+): verify interface remains responsive
- [ ] Test cancellation: start operations and cancel, verify system handles gracefully

**Error Scenarios**:

- [ ] Test restoration of non-existent snapshot: verify appropriate error handling
- [ ] Test operations with insufficient permissions: verify graceful failure
- [ ] Test with corrupted snapshots: verify system detects and handles appropriately

**Complete User Workflows**:

- [ ] Full Git workflow: instruction → snapshot → changes → `/snapshots` → restoration → merge
- [ ] Full file workflow: instruction → snapshot → changes → `/snapshots` → restoration → cleanup
- [ ] Mixed workflow: start in Git mode, fallback to file mode, continue operations

**Performance and Usability**:

- [ ] All command responses should be immediate (<1 second)
- [ ] Interface should be intuitive without requiring documentation
- [ ] Error messages should be actionable and user-friendly

**Success Criteria**: User interface is intuitive and responsive, all workflows function correctly, error handling is user-friendly, and performance meets expectations.

### 11.6 Implementation Timeline and Dependencies

#### Critical Path Analysis

The implementation follows a logical progression with clear dependencies and built-in validation:

1. **Foundation Phase** (Tasks 1.1-1.3): 5-8 days

    - Must be completed before any other work
    - Establishes core architecture and data models
    - **Product Owner Testing**: Configuration, change detection, data models

2. **Git Integration Phase** (Tasks 2.1-2.3): 11-13 days

    - Git wrapper, branch management, and Git strategy
    - Includes integrated security, testing, and performance work
    - **Product Owner Testing**: Git operations, branch management, security validation

3. **File-based Fallback Phase** (Tasks 3.1-3.2): 7-9 days

    - File strategy and strategy pattern implementation
    - Cross-platform compatibility and memory management
    - **Product Owner Testing**: File operations, strategy switching, memory management

4. **Core Logic Phase** (Tasks 4.1-4.2): 8-10 days

    - SnapshotManager and automatic integration
    - Comprehensive testing and logging integrated
    - **Product Owner Testing**: API functionality, automatic integration, performance

5. **User Interface Phase** (Tasks 5.1-5.3): 10-13 days
    - Interactive commands and complete user workflows
    - All user interaction testing included
    - **Product Owner Testing**: Complete user workflows, interface usability, error handling

#### Total Estimated Timeline

- **Minimum**: 41-53 days (8-11 weeks)
- **Realistic**: 50-65 days (10-13 weeks)
- **With buffer**: 60-75 days (12-15 weeks)

#### Product Owner Validation Benefits

- **Incremental Validation**: Each phase is fully testable by the product owner
- **Early Issue Detection**: Problems are caught and addressed within each phase
- **Stakeholder Confidence**: Regular demonstrations of working functionality
- **Quality Assurance**: Built-in testing ensures quality throughout development
- **Risk Mitigation**: Issues are identified and resolved before they compound

#### Resource Requirements

- **Primary Developer**: Full-time throughout project
- **Testing Specialist**: Part-time during testing phases
- **DevOps Engineer**: Part-time for deployment preparation
- **Technical Writer**: Part-time for documentation

#### Risk Mitigation

- **Git Integration Complexity**: Allocate extra time for Git edge cases and leverage existing GitUtils.js
- **Cross-platform Issues**: Integrated testing covers different platforms throughout development
- **Performance Requirements**: Performance optimization integrated into each task
- **User Experience**: User interaction testing included in each UI task with product owner validation
- **Security Concerns**: Security validation integrated into all relevant tasks
- **Quality Assurance**: Testing integrated into each phase with product owner validation checkpoints

#### Product Owner Testing Guidelines

**Testing Environment Setup**:

- Prepare test repositories (Git and non-Git environments)
- Set up test files of various types and sizes
- Configure different operating system environments for cross-platform testing

**Testing Approach**:

- Each phase includes specific, actionable test scenarios
- Tests are designed to be performed by non-technical product owners
- Clear success criteria provided for each test
- Tests validate both functional and non-functional requirements

**Documentation for Testing**:

- Step-by-step testing instructions for each phase
- Expected outcomes clearly defined
- Troubleshooting guide for common issues during testing
- Escalation path for technical issues discovered during testing

This implementation plan provides a comprehensive roadmap with built-in product owner validation at each phase, ensuring that the SynthDev Snapshots system meets requirements and quality standards throughout development rather than only at the end.
