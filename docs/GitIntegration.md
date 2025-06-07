# Git Integration for SnapshotManager

The SnapshotManager now includes comprehensive Git integration that automatically manages feature branches and commits when Git is available.

## Overview

The enhanced SnapshotManager provides two modes of operation:

1. **Legacy Mode**: Traditional in-memory file backup (when Git is not available)
2. **Git Mode**: Automatic Git branch management with commits (when Git is available)

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

The snapshots interface now includes Git-specific commands when in Git mode:

- `m` or `merge` - Merge feature branch to original branch
- `s` or `switch` - Switch back to original branch without merging

### Git Status Display
The snapshots interface shows Git status information:
- Git availability and mode status
- Original branch name
- Current feature branch name (if active)

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

#### Enhanced SnapshotManager
- Automatic Git initialization on startup
- Git-aware snapshot creation
- Automatic file backup and commit workflow
- Branch management methods

#### Updated SnapshotsCommand
- Git status display in interactive interface
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

4. **User can manage branches via `/snapshots`**
   ```
   🌿 Git Status: Active
      Original branch: main
      Feature branch: synth-dev/20250607T123456-create-new-configuration-file
   
   Commands:
     m - Merge feature branch to original branch
     s - Switch back to original branch (without merge)
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

1. **Version Control Integration**: Seamless integration with existing Git workflows
2. **Automatic Branch Management**: No manual Git operations required
3. **Safe Experimentation**: Changes are isolated in feature branches
4. **Easy Rollback**: Git history provides additional rollback options
5. **Team Collaboration**: Feature branches can be shared and reviewed
6. **Audit Trail**: Git commits provide detailed change history

## Limitations

- Requires Git to be installed and available in PATH
- Only works in Git repositories
- Does not handle Git conflicts automatically
- Feature branches are created locally (not pushed to remote)

## Future Enhancements

Potential future improvements:
- Remote repository integration (push/pull)
- Automatic conflict resolution
- Integration with Git hosting platforms (GitHub, GitLab)
- Branch cleanup automation
- Stash management for uncommitted changes
