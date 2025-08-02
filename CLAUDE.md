# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SynthDev is a Node.js-based AI coding assistant designed to explore agentic capabilities of AI models. It provides comprehensive development tools, multi-model support, conversation management, and multi-agent workflows.

## Key Architecture Components

### Core Application Structure

- **Entry Point**: `src/core/app.js` - Main application orchestrator
- **AI Layer**: `src/core/ai/` - API client, system messages, prompt enhancement
- **Interface Layer**: `src/core/interface/` - Console interface and command handling
- **Management Layer**: `src/core/managers/` - Tool, config, costs, and snapshot management

### Command System (`src/commands/`)

- **Base Classes**: All commands extend `BaseCommand` in `src/commands/base/`
- **Categories**: Config, conversation, info, role, snapshots, system, terminal, workflow
- **Registration**: Commands auto-register through `CommandRegistrySetup.js`

### Tool System (`src/tools/`)

- **Base Classes**: All tools extend `BaseTool` from `src/tools/common/base-tool.js`
- **Security**: Path validation, AI safety assessment, role-based access control
- **Categories**: File operations, search & analysis, code execution, utilities

### Multi-Agent Workflows (`src/workflow/`)

- **StateMachine**: `WorkflowStateMachine.js` orchestrates multi-agent execution
- **Agents**: Individual AI agents with role-specific configurations
- **Context**: Shared conversation context with role-based message mapping

### Configuration System (`src/config/`)

- **Multi-layered**: Built-in defaults → config files → environment variables → CLI args
- **Managers**: Separate managers for different config types (tool, UI, snapshot)
- **Validation**: Comprehensive validation through `src/config/validation/`

## Common Development Commands

### Building and Testing

```bash
# Start development server with file watching
npm run dev

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with UI
npm run test:ui

# Run minimal reporter (for CI)
npm run test:minimal
```

### Code Quality

```bash
# Lint code
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Run full quality check (lint + format + test)
npm run quality

# Pre-commit checks
npm run pre-commit

# Fix common lint issues automatically
npm run fix-lint
```

### Application Usage

```bash
# Start application
npm start

# Start with specific configuration
npm start -- --api-key=your_key --base-model=gpt-4.1-mini

# Use global installation
synth-dev
```

## Development Guidelines

### Task Management

- Always create list of tasks (possibly with subtasks, for big chunks of work) using task creation tools
- Always read current task list before updating it
- Keep task list up to date
- Never rush to next stage until all tasks from previous stage are finished

### Branch Management

- Before implementing any changes create feature branch from current branch
- Do commits frequently with meaningful messages
- Finish work by pushing current feature branch to remote and create PR requesting merge to branch current branch has been created from (not necessarily master/main)

### Testing Requirements

- Include automated tests in task list as frequently as possible
- Never edit existing tests to make them passing without explicit permission
- Test coverage targets: 40%+ lines, branches, functions, statements
- Use Vitest for all testing (configured with sequential execution to prevent race conditions)

### Code Review Process

- When explicitly asked to review some file or directory always read full content of file or directory before proceeding
- You can still use codebase search and Augment Context tools, but use them on top of reading files, not instead of
- Under no circumstances write bullshit like "Major success" when there are still failing tests

### File Operations

- If file editing tool call fails then before retrying always read full content of the file you were trying to edit, and only knowing exact content of a file run improved edit command
- Do not create documentation (Markdown files) if you are not explicitly asked to

## Tool Development Patterns

### Adding New Tools

1. Create directory under `src/tools/` with `definition.json` and `implementation.js`
2. Extend `BaseTool` class from `src/tools/common/base-tool.js`
3. Implement security validation using `validateAndResolvePath()`
4. Add comprehensive unit and integration tests
5. Update tool configuration if needed

### Adding New Commands

1. Create command class extending `BaseCommand` from `src/commands/base/BaseCommand.js`
2. Implement required methods: `execute()`, `getHelp()`
3. Place in appropriate category directory under `src/commands/`
4. Commands auto-register through the command system

### Configuration Management

- Environment variables follow `SYNTHDEV_*` pattern
- Multi-model support: base, smart, fast model tiers
- Configuration validation through JSON schemas
- Use `ConfigManager` for centralized config access

## Testing Strategy

### Test Structure

```
tests/
├── unit/           # Individual component tests with mocks
├── integration/    # Component interaction tests
├── e2e/           # End-to-end workflow tests
├── mocks/         # Mock implementations
└── helpers/       # Test utilities and fixtures
```

### Test Configuration

- **Framework**: Vitest with Node.js environment
- **Execution**: Sequential (no concurrent tests to prevent race conditions)
- **Timeouts**: 45s for tests, 20s for hooks (60s/30s in CI)
- **Retry**: 2 retries locally, 3 in CI for flaky tests

### Security Considerations

- All file operations restricted to project directory via path validation
- AI safety assessment for script execution
- Role-based tool access control with pattern matching
- No sensitive information in code or commits

## Multi-Agent Workflow Development

- Workflows defined in JSON format under `src/config/workflows/`
- Custom JavaScript functions for workflow logic
- State machine execution with defined states and transitions
- Shared context management between agents
- Example workflow: `grocery_store_test` demonstrates multi-agent interaction

## Original Development Guidelines (Preserved)

Always create list of tasks (possibly with subtasks, for big chunks of work) using task creation tools

Before implementing any changes create feature branch from current branch

Include automated tests in task list as frequently as possible
Always read current task list before updating it

Keep task list up to date.

Never rush to next stage until all tasks from previous stage are finished.

Never edit existing tests to make them passing without explicit permission

When explicitly asked to review some file or directory always read full content of file or directory before proceeding.

You can still use codebase search and Augment Context tools, but you should use them on top of reading files, not instead of.

Do not create documentation (Markdown files) if you are not explicitly asked to.

If file editing tool call fails then before retrying always read full content of the file you were trying to edit, and only knowing exact content of a file run improved edit command

Under no circumstances write bullshit like "Major success" when there are still failing tests

do commits frequently with meaningful messages

finish your work by pushing current feature branch to remote and create PR requesting merge to branch current branch has been created from (not necessarily master/main)
