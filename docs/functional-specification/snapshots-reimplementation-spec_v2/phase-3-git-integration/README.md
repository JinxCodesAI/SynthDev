# Phase 3: Git Integration Foundation

## Overview

This phase adds Git-based snapshot storage for projects in Git repositories, while maintaining file-based fallback for non-Git projects.

## User Stories

- As a developer working in a Git repository, I want my snapshots to use Git commits for better tracking and integration with my version control workflow
- As a developer, I want to see Git commit hashes in my snapshot list, so that I can correlate snapshots with my Git history
- As a developer, I want snapshot restoration to use Git reset for accuracy, so that I get exact file states without manual file operations
- As a developer working in a non-Git project, I want the system to automatically fall back to file-based snapshots, so that I can still use the snapshot feature
- As a developer, I want to see clear indication of which storage mode is active, so that I understand how my snapshots are being managed
- As a developer, I want to clean up Git-based snapshots by removing commits, so that I can maintain a clean Git history

## Deliverables

- Git availability detection using existing GitUtils.js
- Git-based snapshot storage using commits
- Git reset for restoration
- Automatic fallback to file mode when Git unavailable
- Clear mode indication in UI
- Git-based snapshot cleanup

## Technical Components

- GitSnapshotStore (Git-based storage strategy)
- Integration with existing GitUtils.js
- Git availability detection
- Automatic fallback mechanism
- Git commit-based snapshot format
- Git reset restoration workflow

## Documentation to be Added

- Git integration architecture
- GitUtils integration and enhancement
- Commit-based snapshot format specification
- Fallback mechanism design
- Git reset restoration workflow
- Error handling for Git operations
- Test scenarios for Git and non-Git environments

## Success Criteria

- Git repositories use commit-based snapshots automatically
- Non-Git projects continue using file-based snapshots
- Restoration is accurate using Git reset
- Clear indication of which mode is active
- Can clean up Git-based snapshots
