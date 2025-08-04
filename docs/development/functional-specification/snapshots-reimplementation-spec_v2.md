# SynthDev Snapshots - Simplified Reimplementation Specification v2

## Overview

This specification outlines a simplified, step-by-step reimplementation of the SynthDev snapshot system. The approach focuses on delivering working functionality at each phase, starting with the simplest possible implementation and gradually adding complexity.

## Core Principles

1. **Working Code at Every Phase** - Each phase delivers a functional `/snapshot` command with real value
2. **Start Simple** - Begin with in-memory snapshots before adding Git integration
3. **User-Centric Design** - Focus on user stories and practical workflows
4. **Incremental Complexity** - Add features only when previous phase is complete and tested

## High-Level Architecture

### Core Components

- **SnapshotManager** - Central orchestrator for all snapshot operations
- **SnapshotStore** - Storage abstraction (in-memory first, Git later)
- **SnapshotCommand** - User interface for snapshot management (following ADR-002 patterns)
- **FileBackup** - File state capture and restoration with filtering
- **FileFilter** - Determines which files should be included in snapshots

### Design Patterns

- **Strategy Pattern** - Different storage strategies (Memory, Git)
- **Command Pattern** - Snapshot operations as reversible commands
- **Observer Pattern** - Integration with tool execution lifecycle

## Implementation Phases

### Phase 1: Basic In-Memory Snapshots

**Goal**: Working `/snapshot` command with file backup and restore

**User Stories**:

- As a developer, I want to manually create a snapshot with a description, so that I can save the current state before making risky changes
- As a developer, I want to list all my snapshots with timestamps and descriptions, so that I can identify which state to restore to
- As a developer, I want to restore to any previous snapshot, so that I can undo unwanted changes
- As a developer, I want to see which files will be affected before restoring, so that I can make an informed decision
- As a developer, I want only relevant project files to be included in snapshots, so that I don't waste storage on dependencies like node_modules
- As a developer, I want to delete old snapshots, so that I can manage storage and keep my snapshot list clean

**Deliverables**:

- Manual snapshot creation via `/snapshot create "description"`
- Snapshot listing via `/snapshot list`
- File-based restoration via `/snapshot restore <id>`
- Snapshot deletion via `/snapshot delete <id>`
- Basic file backup when tools modify files
- File filtering system (exclude node_modules, .git, etc.)

**Success Criteria**:

- Can create snapshots manually with descriptive names
- Can restore files to previous state accurately
- Files are properly backed up before modification
- Only relevant files are included (no node_modules, build artifacts, etc.)
- User sees clear feedback on all operations
- Can clean up old snapshots

### Phase 2: Automatic Snapshot Creation

**Goal**: Snapshots created automatically on user instructions

**User Stories**:

- As a developer, I want snapshots to be created automatically when I give AI instructions, so that I don't need to remember to create them manually
- As a developer, I want to see the original instruction that triggered each snapshot, so that I can understand what changes were made
- As a developer, I want the system to avoid creating empty snapshots for read-only operations, so that my snapshot list stays relevant
- As a developer, I want automatic snapshots to have meaningful descriptions based on my instructions, so that I can easily identify them later
- As a developer, I want to configure which types of instructions trigger snapshots, so that I can customize the behavior for my workflow

**Deliverables**:

- Automatic snapshot creation on user input (integrated with app.js)
- Instruction metadata in snapshots
- Smart handling of read-only operations (no snapshots for /help, /cost, etc.)
- Integration with existing tool execution lifecycle
- Configuration for snapshot triggers

**Success Criteria**:

- Snapshots created automatically before AI processes file-modifying instructions
- No manual intervention required for basic workflow
- Clear snapshot descriptions based on user instructions
- No snapshots created for commands or read-only operations
- User can configure snapshot behavior

### Phase 3: Git Integration Foundation

**Goal**: Git-based snapshots when in Git repositories

**User Stories**:

- As a developer working in a Git repository, I want my snapshots to use Git commits for better tracking and integration with my version control workflow
- As a developer, I want to see Git commit hashes in my snapshot list, so that I can correlate snapshots with my Git history
- As a developer, I want snapshot restoration to use Git reset for accuracy, so that I get exact file states without manual file operations
- As a developer working in a non-Git project, I want the system to automatically fall back to file-based snapshots, so that I can still use the snapshot feature
- As a developer, I want to see clear indication of which storage mode is active, so that I understand how my snapshots are being managed
- As a developer, I want to clean up Git-based snapshots by removing commits, so that I can maintain a clean Git history

**Deliverables**:

- Git availability detection using existing GitUtils.js
- Git-based snapshot storage using commits
- Git reset for restoration
- Automatic fallback to file mode when Git unavailable
- Clear mode indication in UI
- Git-based snapshot cleanup

**Success Criteria**:

- Git repositories use commit-based snapshots automatically
- Non-Git projects continue using file-based snapshots
- Restoration is accurate using Git reset
- Clear indication of which mode is active
- Can clean up Git-based snapshots

### Phase 4: Smart Git Branch Management

**Goal**: Automatic feature branch creation for isolation

**User Stories**:

- As a developer, I want AI changes to be isolated on feature branches, so that my main development branch stays clean and stable
- As a developer, I want feature branches to be created automatically only when I have uncommitted changes, so that I don't get unnecessary branches for clean repositories
- As a developer, I want branch names to be based on my instructions, so that I can easily identify what each branch contains
- As a developer, I want to easily merge successful AI changes back to my original branch, so that I can incorporate the improvements into my main work
- As a developer, I want to easily discard AI changes by switching back without merging, so that I can abandon unsuccessful experiments
- As a developer, I want to see clear status information about which branches are active, so that I understand my current Git state

**Deliverables**:

- Automatic feature branch creation (only when uncommitted changes exist)
- Branch naming based on user instructions (using existing GitUtils.generateBranchName)
- Branch merge operations via `/snapshot merge`
- Branch switch operations via `/snapshot switch`
- Smart branch creation logic
- Branch status display

**Success Criteria**:

- Feature branches created automatically only when appropriate
- Original branch remains untouched during AI sessions
- Easy merge/discard workflow through snapshot commands
- No unnecessary branches created for clean repositories
- Clear branch status information

### Phase 5: Performance and Advanced Features

**Goal**: Optimize performance and add advanced snapshot management

**User Stories**:

- As a developer with many snapshots, I want fast snapshot operations, so that the system doesn't slow down my workflow
- As a developer, I want to search through my snapshots by description or date, so that I can quickly find specific states
- As a developer, I want to see detailed information about snapshot contents, so that I can understand what changed
- As a developer, I want automatic cleanup of old snapshots based on age or count, so that I don't need to manually manage storage
- As a developer, I want to export/import snapshots, so that I can share states with team members or backup important states
- As a developer, I want comprehensive error recovery, so that I can handle edge cases gracefully

**Deliverables**:

- Performance optimizations for large numbers of snapshots
- Snapshot search and filtering capabilities
- Enhanced snapshot details view with file diffs
- Automatic cleanup policies
- Snapshot export/import functionality
- Comprehensive error handling and recovery

**Success Criteria**:

- Fast performance with hundreds of snapshots
- Easy search and discovery of snapshots
- Rich information display with file change details
- Automatic maintenance reduces manual overhead
- Robust error handling covers edge cases

## File Filtering System

### Core Requirements

The snapshot system must intelligently filter files to include only relevant project files and exclude:

- **Dependencies**: node_modules, vendor, .venv, etc.
- **Build artifacts**: dist, build, target, bin, obj, etc.
- **Version control**: .git, .svn, .hg directories
- **IDE files**: .vscode, .idea, \*.swp, .DS_Store
- **Temporary files**: _.tmp, _.temp, \*.log
- **Large binary files**: Based on size and extension

**Integration Points**:

- Hook into tool execution for file backup (following ADR-002 patterns)
- Add `/snapshot` command to command system (extends InteractiveCommand)
- File filtering integrated with backup process
- Simple file read/write for backup/restore

### File Structure

```
src/core/snapshot/
├── SnapshotManager.js          # Main orchestrator
├── stores/
│   ├── MemorySnapshotStore.js  # Phase 1: In-memory storage
│   └── GitSnapshotStore.js     # Phase 3: Git-based storage
├── FileBackup.js               # File capture and restoration
├── FileFilter.js               # File filtering system
└── SnapshotCommand.js          # User interface (extends InteractiveCommand)

src/commands/snapshots/
└── SnapshotsCommand.js         # Command implementation following ADR-002

tests/snapshot/
├── unit/                       # Unit tests for each component (following ADR-004)
│   ├── SnapshotManager.test.js
│   ├── FileFilter.test.js
│   └── stores/
├── integration/                # Integration tests
│   └── snapshot-integration.test.js
└── e2e/                        # End-to-end workflow tests
    └── snapshot-workflow.test.js
```

## Success Metrics

### Phase Completion Criteria

Each phase must meet these criteria before proceeding:

1. **Functionality**: All user stories implemented and working
2. **Testing**: Comprehensive test coverage following ADR-004 (unit + integration + e2e)
3. **Documentation**: Clear documentation for implemented features
4. **User Feedback**: Positive user experience validation
5. **Performance**: Acceptable performance characteristics
6. **Code Quality**: Follows ADR-002 patterns for command implementation

### Quality Gates

- All tests passing (unit, integration, e2e)
- No critical bugs
- Performance within acceptable limits (< 1s for snapshot operations)
- Code review completed
- Documentation updated
- Command follows ADR-002 patterns
- Test coverage meets ADR-004 thresholds
