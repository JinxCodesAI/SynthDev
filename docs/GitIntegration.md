# Git Integration for SnapshotManager

The SnapshotManager includes comprehensive Git integration that leverages Git's native capabilities for snapshot management when Git is available.

## Overview

The enhanced SnapshotManager provides two distinct modes of operation:

1. **Legacy Mode**: Traditional in-memory file backup and restoration (when Git is not available)
2. **Git Mode**: Git-powered snapshots using commits and git reset for restoration (when Git is available)

## Features

### Automatic Git Detection

- Detects if Git is available on the system
- Checks if the current directory is a Git repository
- Automatically enables Git mode when both conditions are met

### Feature Branch Management

- Creates a feature branch on the first snapshot
- Branch naming: `synth-dev/YYYYMMDDTHHMMSS-instruction-preview`
- Remembers the original branch for later merge operations

### Automatic Commits

- Commits file changes to the feature branch after each tool execution
- Commit messages include timestamp and affected files: `Synth-Dev [YYYY-MM-DD HH:MM:SS]: Modified file1.js, file2.py`
- Multi-line commit messages include the original user instruction
- Only commits files that were actually modified

### Git-Powered Snapshots

- **Snapshots are Git commits**: Each user instruction creates a Git commit that serves as a snapshot
- **Restoration uses git reset**: Restoring a snapshot performs `git reset --hard` to the target commit
- **No file-based backup**: Git's native history tracking replaces in-memory file storage
- **Commit history as snapshot list**: The `/snapshots` command displays Git commit history
- **No snapshot deletion**: Individual commits cannot be "deleted" (use Git commands if needed)

### Merge Operations

- Provides merge functionality through the `/snapshots` command
- Option to merge feature branch back to original branch
- Option to switch back to original branch without merging

## Usage

### Automatic Operation

Git integration works automatically when:

1. Git is installed and available
2. The current directory is a Git repository
3. User provides instructions that trigger file modifications

### Manual Operations via `/snapshots` Command

```
/snapshots
```

The snapshots interface adapts based on the current mode:

**Git Mode Commands:**

- `r[number]` - Restore snapshot using `git reset --hard` to the commit
- `m` or `merge` - Merge feature branch to original branch
- `s` or `switch` - Switch back to original branch without merging
- `[number]` - View detailed commit information

**Legacy Mode Commands:**

- `r[number]` - Restore snapshot using file-based restoration
- `d[number]` - Delete snapshot from memory
- `c` - Clear all snapshots
- `[number]` - View detailed snapshot information

### Git Status Display

The snapshots interface shows Git status information:

- Git availability and mode status
- Original branch name
- Current feature branch name (if active)
- Commit history with hashes and authors (in Git mode)

## Implementation Details

### Core Components

#### GitUtils Class (`utils/GitUtils.js`)

Provides Git operations using the existing ExecuteTerminalTool:

- `checkGitAvailability()` - Check Git availability and repository status
- `getCurrentBranch()` - Get current branch name
- `createBranch(name)` - Create and switch to new branch
- `switchBranch(name)` - Switch to existing branch
- `addFiles(paths)` - Add files to staging area
- `commit(message)` - Commit staged changes
- `mergeBranch(name)` - Merge branch into current branch
- `generateBranchName(instruction)` - Generate safe branch names
- `getCommitHistory(limit)` - Get commit history for snapshot display
- `resetToCommit(hash)` - Perform hard reset to specific commit
- `getCommitDetails(hash)` - Get detailed information about a commit
- `commitExists(hash)` - Check if a commit exists

#### Enhanced SnapshotManager

- Automatic Git initialization on startup
- Git-aware snapshot creation and management
- Automatic file backup and commit workflow
- Git-powered restoration using `git reset`
- Dual-mode operation (Git vs Legacy)
- Branch management methods

#### Updated SnapshotsCommand

- Mode-aware interface (Git vs Legacy commands)
- Git commit history display
- Git reset-based restoration
- Merge and switch commands
- User-friendly Git operation confirmations

### Logging Integration

The Git integration follows the established verbosity system:

- **Level 0 (User)**: Branch creation, merge operations, switches
- **Level 1 (Status)**: Warnings and important status messages
- **Level 2 (Info)**: Git commits, general Git operations
- **Level 3 (Debug)**: Detailed Git operation information

### Error Handling

- Graceful fallback to legacy mode if Git operations fail
- Comprehensive error reporting for Git command failures
- Non-blocking operation - Git failures don't prevent tool execution

## Workflow Example

1. **User starts Synth-Dev in a Git repository**

    ```
    ℹ️ Git integration enabled. Original branch: main
    ```

2. **User provides first instruction**

    ```
    User: "Create a new configuration file"
    📸 Snapshot: 🌿 Created feature branch: synth-dev/20250607T123456-create-new-configuration-file
    ```

3. **AI modifies files**

    ```
    ℹ️ 📝 Committed changes to Git: config.json
    ```

    Git commit message:

    ```
    Synth-Dev [2025-06-07 12:34:56]: Modified config.json

    Original instruction: Create a new configuration file
    ```

4. **User can manage snapshots via `/snapshots`**

    ```
    📸 Available Snapshots:
    ════════════════════════════════════════════════════════════════════════════════
    🌿 Git Status: Active
       Original branch: main
       Feature branch: synth-dev/20250607T123456-create-new-configuration-file

    1. [2025-06-07 12:34:56] Create a new configuration file
       🔗 Git: a1b2c3d | Author: John Doe
    2. [2025-06-07 12:35:30] Update configuration with new settings
       🔗 Git: e4f5g6h | Author: John Doe

    Commands:
      [number] - View detailed snapshot info
      r[number] - Restore snapshot (e.g., r1)
      🔗 Git mode: Restore uses git reset to commit
      m - Merge feature branch to original branch
      s - Switch back to original branch (without merge)
      q - Quit snapshots view
    ```

5. **User can restore to any commit**

    ```
    User: r1
    Reset to Git commit a1b2c3d?
      🔗 Commit: Create a new configuration file
      ⚠️  This will discard all changes after this commit!

    ✅ Successfully reset to commit a1b2c3d
       🔗 Create a new configuration file
       📝 Successfully reset to commit a1b2c3d
    ```

## Configuration

No additional configuration is required. Git integration is automatically enabled when:

- Git is available in the system PATH
- Current directory is a Git repository

## Backward Compatibility

The enhanced SnapshotManager maintains full backward compatibility:

- Existing snapshot functionality remains unchanged
- Legacy mode operates identically to the original implementation
- No breaking changes to the API

## Benefits

1. **Native Git Integration**: Leverages Git's powerful history and reset capabilities
2. **Automatic Branch Management**: No manual Git operations required
3. **Safe Experimentation**: Changes are isolated in feature branches
4. **Powerful Restoration**: Git reset provides instant, complete state restoration
5. **Team Collaboration**: Feature branches can be shared and reviewed
6. **Comprehensive Audit Trail**: Git commits provide detailed change history
7. **No Storage Overhead**: Uses Git's native storage instead of duplicating file content
8. **Familiar Git Workflow**: Developers can use standard Git commands alongside Synth-Dev

## Limitations

- Requires Git to be installed and available in PATH
- Only works in Git repositories
- Does not handle Git conflicts automatically
- Feature branches are created locally (not pushed to remote)
- Git reset discards uncommitted changes (by design)
- Cannot "delete" individual commits (use Git commands if needed)
- Restoration in Git mode affects the entire working directory

## Future Enhancements

Potential future improvements:

- Remote repository integration (push/pull)
- Automatic conflict resolution
- Integration with Git hosting platforms (GitHub, GitLab)
- Branch cleanup automation
- Stash management for uncommitted changes
