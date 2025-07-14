# SynthDev Snapshots and Git Integration - Functional Specification

## Overview

SynthDev's Snapshots system provides comprehensive state management and version control capabilities for AI-assisted development workflows. The system operates in two modes: **Legacy Mode** (in-memory file backups) and **Git Mode** (Git-based version control), automatically selecting the appropriate mode based on the project environment.

## Core Architecture

### Dual-Mode Operation

The system intelligently switches between two operational modes:

1. **Legacy Mode**: In-memory file backup system for non-Git projects
2. **Git Mode**: Git-based version control for Git repositories with automatic branch management

### Key Components

- **SnapshotManager**: Core orchestrator managing snapshots and Git integration
- **GitUtils**: Git operations wrapper using the execute_terminal tool
- **ToolManager**: Handles file backup triggers via `requires_backup` flag
- **SnapshotsCommand**: User interface for snapshot management

## Functional Requirements

### 1. Automatic Snapshot Creation

**Trigger**: When user provides a new instruction to the AI (non-command input)

**Process**:
1. System creates a new snapshot with user instruction as metadata
2. Snapshot includes timestamp and unique ID
3. If current snapshot is empty (no files tracked), it gets overridden instead of creating new one
4. For first snapshot in Git repositories, automatic Git integration is evaluated

**Implementation Location**: `src/core/app.js:319` - `await this.snapshotManager.createSnapshot(finalPrompt)`

### 2. Git Integration Decision Logic

#### **Conditions for Git Mode Activation**

**Reference**: `src/core/managers/snapshotManager.js:164-206` (`_shouldCreateNewBranch()`)

The system evaluates Git Mode activation through a multi-step decision process:

**Step 1: Basic Git Availability Check**
- Git command must be available on system
- Current directory must be a Git repository
- This check happens during SnapshotManager initialization

**Step 2: Branch Creation Evaluation (Only for First Snapshot)**
- **Location**: `src/core/managers/snapshotManager.js:103-105`
- **Condition**: `this.gitAvailable && this.isGitRepo && snapshot.isFirstSnapshot`
- Only the very first snapshot in a session triggers branch creation evaluation

**Step 3: Current Branch Analysis**
- **Check**: Is current branch already a `synth-dev/` branch?
- **Logic**: `this.originalBranch && this.originalBranch.startsWith('synth-dev/')`
- **If TRUE**: Skip branch creation, enable Git Mode on existing branch
- **If FALSE**: Continue to uncommitted changes check

**Step 4: Uncommitted Changes Detection**
- **Command**: `git status --porcelain`
- **Logic**: If output is not empty, there are uncommitted changes
- **If NO uncommitted changes**: Skip branch creation (nothing to isolate)
- **If HAS uncommitted changes**: Proceed with branch creation

**Final Decision Matrix**:
```
Git Available + Git Repo + First Snapshot + NOT on synth-dev + Has Uncommitted = CREATE BRANCH
Git Available + Git Repo + First Snapshot + IS on synth-dev + Any Changes = USE EXISTING BRANCH
Git Available + Git Repo + First Snapshot + Any Branch + No Changes = NO BRANCH (Legacy Mode)
Any other combination = Legacy Mode
```

#### **Branch Creation Logic**

**When Branch is Created**:
- **Timing**: During first snapshot creation only
- **Trigger**: All conditions above are met
- **Location**: `src/core/managers/snapshotManager.js:141-153`

**Branch Creation Process**:
1. **Generate Branch Name**:
   - Format: `synth-dev/{timestamp}-{sanitized-instruction}`
   - Timestamp: `YYYYMMDDTHHMMSS` format
   - Instruction sanitization: lowercase, special chars removed, spaces to hyphens, max 30 chars
   - Example: `synth-dev/20241205T143022-fix-login-bug`

2. **Execute Git Commands**:
   - Command: `git checkout -b "{branchName}"`
   - This creates AND switches to the new branch
   - All uncommitted changes move to the new branch

3. **Update System State**:
   - Set `this.gitMode = true`
   - Set `this.featureBranch = branchName`
   - Set `snapshot.gitBranch = branchName`
   - Log branch creation to user

**Error Handling**:
- If branch creation fails, system falls back to Legacy Mode
- Error is logged but doesn't stop snapshot creation
- User continues with in-memory backups

### 3. File Backup System (`requires_backup` Flag)

**Purpose**: Automatic file state preservation before destructive operations

**Tools with `requires_backup: true`**:
- `write_file`: Backs up file at `file_path` parameter
- `edit_file`: Backs up file at `file_path` parameter

**Tools with `requires_backup: false`**:
- `read_file`: Read-only operation
- `list_directory`: Read-only operation
- `exact_search`: Read-only operation
- `explain_codebase`: Analysis only

**Backup Process**:
1. Before tool execution, ToolManager checks `requires_backup` flag
2. If true, calls `snapshotManager.backupFileIfNeeded(filePath)`
3. File content is stored in current snapshot's `files` map
4. Non-existent files are recorded with `null` value for deletion tracking
5. Modified files are tracked in `modifiedFiles` Set

**Implementation**: `src/core/managers/toolManager.js:272-274`

### 4. Automatic Git Commits

#### **Detailed Commit Conditions**

**Reference**: `src/core/managers/toolManager.js:353-428` (`_handlePostExecutionGitCommit()`)

**Primary Conditions for Git Commits**:

**Condition 1: Git Mode Must Be Active**
- **Check**: `gitStatus.gitMode === true`
- **Meaning**: System must have successfully created or detected a synth-dev branch
- **Important**: If we're on an existing `synth-dev/` branch, `gitMode` is still `true`
- **Clarification**: Being on a `synth-dev/` branch does NOT prevent commits

**Condition 2: Active Snapshot Must Exist**
- **Check**: `snapshotManager.getCurrentSnapshot() !== null`
- **Meaning**: There must be a current snapshot to track changes

**Condition 3: Tool Must Require Backup**
- **Check**: Tool definition has `requires_backup: true`
- **Meaning**: Only file-modifying tools trigger commits

**Condition 4: Files Must Be Modified**
- **Check**: `currentSnapshot.modifiedFiles.length > 0`
- **Meaning**: At least one file must have been backed up/modified

**Condition 5: Git Must Detect Changes**
- **Command**: `git status --porcelain`
- **Check**: Output is not empty
- **Meaning**: Git must see actual file system changes

#### **Commit Process Flow**

**Step 1: Pre-Commit Validation**
```javascript
// Location: src/core/managers/toolManager.js:354-359
if (!gitStatus.gitMode || !snapshotManager.getCurrentSnapshot()) {
    return; // Skip commit
}
```

**Step 2: Collect Modified Files**
```javascript
// Location: src/core/managers/toolManager.js:361-362
const currentSnapshot = snapshotManager.getCurrentSnapshot();
const modifiedFiles = Array.from(currentSnapshot.modifiedFiles);
```

**Step 3: Git Status Check**
```javascript
// Location: src/core/managers/toolManager.js:369-390
const statusResult = await gitUtils.getStatus();
if (!statusResult.hasChanges) {
    return; // No actual Git changes detected
}
```

**Step 4: Stage Files**
```javascript
// Location: src/core/managers/toolManager.js:393-398
const addResult = await gitUtils.addFiles(modifiedFiles);
```

**Step 5: Create Commit**
```javascript
// Location: src/core/managers/toolManager.js:410
const commitResult = await snapshotManager.commitChangesToGit(modifiedFiles);
```

#### **Commit Message Format**

**Structure**:
```
Synth-Dev [YYYY-MM-DD HH:MM:SS]: Modified {file_list}

Original instruction: {sanitized_user_instruction}
```

**File List Logic**:
- If ≤3 files: List all files
- If >3 files: List first 3 + "and X more"

**Instruction Sanitization**:
- Replace newlines with spaces
- Normalize whitespace
- Trim excess spaces

#### **Critical Clarification: synth-dev Branch Behavior**

**IMPORTANT**: The condition "Current branch is NOT already a `synth-dev/` branch" applies ONLY to branch creation, NOT to commits.

**Branch Creation Logic**:
- If already on `synth-dev/` branch → Don't create new branch, use existing
- If NOT on `synth-dev/` branch → Create new branch

**Commit Logic**:
- If in Git Mode (regardless of branch name) → Make commits
- Commits happen on whatever branch Git Mode is active on

**Scenario Examples**:
1. **Fresh start on main branch**: Creates `synth-dev/` branch, makes commits there
2. **Already on synth-dev/xyz branch**: Uses existing branch, makes commits there
3. **No uncommitted changes**: Stays in Legacy Mode, no commits ever
4. **Git not available**: Legacy Mode, no commits ever

This means commits will be made on `synth-dev/` branches - the condition only affects whether a NEW branch is created or an existing one is used.

### 5. Snapshot Restoration

**Legacy Mode Restoration**:
- Restores files from in-memory backup
- Overwrites existing files with backed-up content
- Deletes files that didn't exist in snapshot (marked with `null`)
- Uses `write_file` tool for restoration to maintain consistency

**Git Mode Restoration**:
- Uses `git reset --hard {commit_hash}` to restore to specific commit
- Provides commit verification before reset
- Shows commit details and affected files
- Warns about discarding changes after selected commit

### 6. User Interface Commands

**Primary Command**: `/snapshots`

**Available Operations**:
- `[number]`: View detailed snapshot information
- `r[number]`: Restore to specific snapshot
- `d[number]`: Delete snapshot (Legacy Mode only)
- `c`: Clear all snapshots (Legacy Mode only)
- `m`: Merge feature branch to original branch (Git Mode only)
- `s`: Switch to original branch without merge (Git Mode only)
- `q`: Quit snapshots interface

### 7. Git Branch Management

**Feature Branch Operations**:
- **Merge**: Switches to original branch, merges feature branch, deletes feature branch
- **Switch**: Returns to original branch without merging, leaves feature branch intact
- **Cleanup**: Automatic cleanup when no uncommitted changes remain

**Branch Lifecycle**:
1. Created on first snapshot with uncommitted changes
2. All commits during session go to feature branch
3. User can merge back to original branch or switch without merging
4. Automatic cleanup available when branch has no uncommitted changes

## Technical Implementation Details

### Snapshot Data Structure

**Legacy Mode Snapshot**:
```javascript
{
    id: number,
    instruction: string,
    timestamp: string (ISO),
    files: { [filePath]: string | null },
    modifiedFiles: Set<string>,
    gitBranch: null,
    isFirstSnapshot: boolean
}
```

**Git Mode Snapshot** (derived from commits):
```javascript
{
    id: number,
    gitHash: string,
    shortHash: string,
    instruction: string (commit subject),
    timestamp: string,
    author: string,
    isGitCommit: true
}
```

### Configuration Schema

**Tool Definition Requirements**:
```json
{
    "requires_backup": boolean,
    "backup_resource_path_property_name": string
}
```

**Validation Rules**:
- If `requires_backup: true`, `backup_resource_path_property_name` must be specified
- Property name must match a parameter in the tool's schema
- Parameter must contain the file path to backup

### Error Handling

**Git Operation Failures**:
- System gracefully falls back to Legacy Mode
- Logs warnings but continues operation
- User informed of Git integration status

**File Backup Failures**:
- Individual file backup failures logged as warnings
- Tool execution continues
- Restoration may have partial failures with detailed error reporting

**Restoration Failures**:
- Detailed error reporting per file
- Partial success information provided
- System remains in consistent state

## Integration Points

### With Tool System
- Tools declare backup requirements via `requires_backup` flag
- ToolManager orchestrates backup before execution
- Automatic Git commits after successful tool execution

### With Command System
- `/snapshots` command provides full management interface
- Integration with confirmation prompts for destructive operations
- Context-aware help and status information

### With AI Workflow
- Snapshots created automatically on user instructions
- No manual intervention required for basic operation
- Transparent to AI agents and tool execution

## Security Considerations

### Path Validation
- All file operations use `validateAndResolvePath()`
- Restricted to project directory only
- Prevents directory traversal attacks

### Git Safety
- Commit verification before destructive operations
- User confirmation for branch operations
- Automatic branch naming prevents conflicts

### Data Integrity
- Atomic operations where possible
- Detailed error reporting and recovery information
- Consistent state maintenance across failures

## Performance Characteristics

### Memory Usage
- Legacy Mode: Files stored in memory until application exit
- Git Mode: Minimal memory footprint, leverages Git storage

### Disk Usage
- Legacy Mode: No additional disk usage
- Git Mode: Standard Git repository overhead

### Operation Speed
- File backup: O(1) per file, only on first access per snapshot
- Git operations: Standard Git performance characteristics
- Restoration: Depends on number and size of files involved

## Future Extensibility

### Planned Enhancements
- Snapshot compression for large files
- Selective file restoration
- Snapshot export/import functionality
- Integration with remote Git repositories

### Extension Points
- Custom backup strategies via plugin system
- Additional version control system support
- Snapshot metadata enrichment
- Custom restoration workflows
