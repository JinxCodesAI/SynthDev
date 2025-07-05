# SynthDev Project Restructuring Plan - Staged Approach

## Current State Analysis

The SynthDev project currently has **22 JavaScript files** and **multiple configuration files** scattered in the root directory, making it difficult to navigate and maintain. The project has some semi-structured areas (commands/, tools/, config/) but lacks a coherent overall organization.

**CRITICAL**: This plan has been revised to use a **staged approach with frequent testing** to prevent breaking changes and ensure continuous functionality throughout the refactoring process.

### Current Root Directory Issues

**Core Files (22 JS files in root):**

- `app.js` - Main entry point
- `aiAPIClient.js` - AI API communication
- `commandHandler.js` - Command routing
- `consoleInterface.js` - User interface
- `configManager.js` - Configuration management
- `configurationChecker.js` - Config validation
- `configurationLoader.js` - Config loading
- `configurationValidator.js` - Config validation logic
- `costsManager.js` - Cost tracking
- `logger.js` - Logging system
- `promptEnhancer.js` - Prompt enhancement
- `snapshotManager.js` - Snapshot management
- `systemMessages.js` - AI role management
- `toolConfigManager.js` - Tool configuration
- `toolManager.js` - Tool management
- `uiConfigManager.js` - UI configuration

**Other Root Files:**

- Configuration files (`.env` examples)
- Docker files
- Package files
- Various config/setup files

### Dependency Analysis from Tests

Based on analysis of test imports and actual code dependencies, the following dependency graph has been identified:

**Core Dependencies:**

- `logger.js` → No dependencies (foundation)
- `configManager.js` → `configurationValidator.js`, `configurationLoader.js`
- `systemMessages.js` → `configurationLoader.js`
- `aiAPIClient.js` → `configManager.js`, `systemMessages.js`, `logger.js`
- `toolManager.js` → `logger.js`, `tools/common/tool-schema.js`
- `consoleInterface.js` → `logger.js`, `uiConfigManager.js`
- `commandHandler.js` → `logger.js`, `commands/base/CommandRegistrySetup.js`
- `app.js` → All of the above

**Command Dependencies:**

- All commands → `../base/BaseCommand.js`, `../../logger.js`
- Role commands → `../../systemMessages.js`
- Config commands → `../../uiConfigManager.js`
- Tool commands → `../../toolConfigManager.js`

**Tool Dependencies:**

- All tools → `../common/base-tool.js`, `../../toolConfigManager.js`

**Test Dependencies:**

- 57 test files with imports from root directory
- Heavy mocking of core modules in integration tests
- E2E tests import multiple core modules directly

## Proposed New Structure

```
src/
├── core/                    # Core application logic
│   ├── app.js              # Main application orchestrator
│   ├── ai/                 # AI-related components
│   │   ├── aiAPIClient.js
│   │   ├── systemMessages.js
│   │   └── promptEnhancer.js
│   ├── interface/          # User interface components
│   │   ├── consoleInterface.js
│   │   └── commandHandler.js
│   └── managers/           # Core managers
│       ├── costsManager.js
│       ├── snapshotManager.js
│       └── toolManager.js
├── config/                 # Configuration system (existing, enhanced)
│   ├── managers/           # Configuration managers
│   │   ├── configManager.js
│   │   ├── toolConfigManager.js
│   │   └── uiConfigManager.js
│   ├── validation/         # Configuration validation (existing)
│   │   ├── configurationChecker.js
│   │   ├── configurationLoader.js
│   │   ├── configurationValidator.js
│   │   └── config-validation.json
│   ├── defaults/           # Default configurations (existing)
│   ├── roles/              # AI roles (existing)
│   ├── tools/              # Tool configurations (existing)
│   ├── ui/                 # UI configurations (existing)
│   └── workflows/          # Workflow configurations (existing)
├── commands/               # Command system (existing structure)
├── tools/                  # Tool implementations (existing structure)
├── workflow/               # Workflow system (existing structure)
├── utils/                  # Utility functions
│   ├── GitUtils.js         # (existing)
│   └── [future utilities]
└── shared/                 # Shared constants and types
    ├── constants.js
    └── types.js
```

**Root Directory (cleaned up):**

```
├── src/                    # All source code
├── docs/                   # Documentation (existing)
├── tests/                  # Tests (existing)
├── scripts/                # Build/utility scripts (existing)
├── examples/               # Examples (existing)
├── config/                 # Moved to src/config/
├── package.json            # Package configuration
├── README.md               # Project documentation
├── .env.example            # Environment template
├── docker-compose.yaml     # Docker configuration
├── Dockerfile              # Docker configuration
├── eslint.config.js        # ESLint configuration
├── vitest.config.js        # Test configuration
└── [other config files]
```

## Staged Refactoring Approach

**CRITICAL PRINCIPLE**: Run `npm test` after every single stage to ensure no functionality is broken. Never proceed to the next stage if any tests fail.

### Stage 1: Foundation Setup (Test-Safe)

**Goal**: Create directory structure without moving any files
**Test Impact**: None - no imports change

1. **Create new directory structure:**

    ```bash
    mkdir -p src/core/ai
    mkdir -p src/core/interface
    mkdir -p src/core/managers
    mkdir -p src/config/managers
    mkdir -p src/config/validation
    mkdir -p src/shared
    ```

2. **Verify structure creation:**
    ```bash
    npm test  # Should pass - no changes to imports
    ```

### Stage 2: Move Foundation Layer (Logger First)

**Goal**: Move logger.js as it has no dependencies
**Test Impact**: All files importing logger need path updates

1. **Move logger to new location:**

    ```bash
    mv logger.js src/core/managers/
    ```

2. **Update ALL imports of logger.js** (identified from test analysis):

    - `app.js`: `'./logger.js'` → `'./src/core/managers/logger.js'`
    - `aiAPIClient.js`: `'./logger.js'` → `'./src/core/managers/logger.js'`
    - `toolManager.js`: `'./logger.js'` → `'./src/core/managers/logger.js'`
    - `consoleInterface.js`: `'./logger.js'` → `'./src/core/managers/logger.js'`
    - `commandHandler.js`: `'./logger.js'` → `'./src/core/managers/logger.js'`
    - All command files: `'../../logger.js'` → `'../../src/core/managers/logger.js'`
    - All workflow files: `'../logger.js'` → `'../src/core/managers/logger.js'`
    - All test files: Update mock paths accordingly

3. **Test after logger move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 3: Move Configuration Foundation

**Goal**: Move configuration validation files (no circular dependencies)
**Test Impact**: Files importing these need path updates

1. **Move configuration validation files:**

    ```bash
    mv configurationValidator.js src/config/validation/
    mv configurationLoader.js src/config/validation/
    mv configurationChecker.js src/config/validation/
    ```

2. **Update imports for configuration files:**

    - `configManager.js`: Update paths to validation files
    - `systemMessages.js`: Update `configurationLoader.js` import
    - Test files: Update mock paths

3. **Test after config validation move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 4: Move Configuration Managers

**Goal**: Move config managers that depend on validation files
**Test Impact**: Many files import these managers

1. **Move configuration managers:**

    ```bash
    mv configManager.js src/config/managers/
    mv toolConfigManager.js src/config/managers/
    mv uiConfigManager.js src/config/managers/
    ```

2. **Update imports for config managers** (extensive updates needed):

    - `app.js`: Update configManager import
    - `aiAPIClient.js`: Update configManager import
    - `consoleInterface.js`: Update uiConfigManager import
    - All command files: Update config manager imports
    - All tool files: Update toolConfigManager import
    - All test files: Update mock paths

3. **Test after config managers move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 5: Move Core Managers (No Dependencies)

**Goal**: Move managers that only depend on logger and config
**Test Impact**: Files importing these managers need updates

1. **Move core managers:**

    ```bash
    mv costsManager.js src/core/managers/
    mv snapshotManager.js src/core/managers/
    mv toolManager.js src/core/managers/
    ```

2. **Update imports for core managers:**

    - `app.js`: Update all manager imports
    - `aiAPIClient.js`: Update costsManager import if any
    - Command files: Update manager imports
    - Test files: Update mock paths

3. **Test after core managers move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 6: Move AI Components

**Goal**: Move AI-related components that depend on config and logger
**Test Impact**: Files importing AI components need updates

1. **Move AI components:**

    ```bash
    mv systemMessages.js src/core/ai/
    mv promptEnhancer.js src/core/ai/
    mv aiAPIClient.js src/core/ai/
    ```

2. **Update imports for AI components:**

    - `app.js`: Update AI component imports
    - Command files: Update systemMessages imports
    - Test files: Update mock paths

3. **Test after AI components move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 7: Move Interface Components

**Goal**: Move interface components
**Test Impact**: Files importing interface components need updates

1. **Move interface components:**

    ```bash
    mv consoleInterface.js src/core/interface/
    mv commandHandler.js src/core/interface/
    ```

2. **Update imports for interface components:**

    - `app.js`: Update interface imports
    - Test files: Update mock paths

3. **Test after interface components move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 8: Move Main Application

**Goal**: Move app.js to final location
**Test Impact**: Package.json and any direct imports need updates

1. **Move main application:**

    ```bash
    mv app.js src/core/
    ```

2. **Update package.json:**

    - Update `"main"` field to `"src/core/app.js"`
    - Update `"bin"` field to `"./src/core/app.js"`

3. **Test after app.js move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 9: Move Existing Directories

**Goal**: Move well-structured directories
**Test Impact**: Imports within moved directories need updates

1. **Move existing directories:**

    ```bash
    mv commands src/
    mv tools src/
    mv workflow src/
    mv utils src/
    ```

2. **Update cross-directory imports:**

    - Commands importing from root: Update paths
    - Tools importing from root: Update paths
    - Workflow importing from root: Update paths
    - Test files: Update import paths

3. **Test after directory moves:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 10: Move Config Directory

**Goal**: Move existing config directory contents
**Test Impact**: Configuration loading paths need updates

1. **Move config directory:**

    ```bash
    mv config/* src/config/ 2>/dev/null || true
    rmdir config 2>/dev/null || true
    ```

2. **Update configuration loading paths:**

    - Update any hardcoded config paths in configuration loaders
    - Update test fixture paths

3. **Test after config directory move:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 11: Update Build Configuration

**Goal**: Update build and test configuration files
**Test Impact**: Test execution and build processes

1. **Update configuration files:**

    - Update `vitest.config.js` paths if needed
    - Update `eslint.config.js` paths if needed
    - Update any Docker configurations
    - Update scripts in `package.json`

2. **Test after build config updates:**
    ```bash
    npm test  # Must pass before proceeding
    ```

### Stage 12: Final Validation and Documentation

**Goal**: Ensure everything works and update documentation
**Test Impact**: Final comprehensive testing

1. **Run comprehensive tests:**

    ```bash
    npm test  # All tests must pass
    npm start  # Verify application starts
    ```

2. **Update documentation:**
    - Update README.md with new structure
    - Update docs/architecture.md
    - Update any path references in documentation

## Benefits of Staged Restructuring Approach

### 1. **Risk Mitigation Through Testing**

- **Continuous validation** - tests run after every stage
- **Early problem detection** - issues caught immediately
- **Safe rollback points** - each stage is a stable checkpoint
- **Confidence in changes** - no guesswork about what broke

### 2. **Dependency-Aware Migration**

- **Foundation-first approach** - move files with no dependencies first
- **Logical progression** - each stage builds on previous stable state
- **Minimal import disruption** - changes are isolated and predictable
- **Clear dependency mapping** - understand what depends on what

### 3. **Test-Driven Refactoring**

- **57 test files** provide comprehensive coverage validation
- **Integration tests** catch cross-module issues immediately
- **E2E tests** validate full application functionality
- **Mock updates** ensure test isolation remains intact

### 4. **Incremental Progress**

- **12 distinct stages** - each represents meaningful progress
- **Clear success criteria** - npm test must pass for each stage
- **Manageable chunks** - no overwhelming "big bang" changes
- **Reversible steps** - easy to undo individual stages if needed

## Migration Strategy

### Approach: Test-First Staged Migration

1. **Never skip testing** - `npm test` after every single stage
2. **Stop on failure** - investigate and fix before proceeding
3. **Document issues** - track any problems encountered
4. **Validate manually** - run application after major stages

### Risk Mitigation

- **Comprehensive test coverage** - 1048 tests provide safety net
- **Dependency analysis** - understand import relationships first
- **Staged rollback** - can revert individual stages
- **Continuous validation** - never proceed with broken functionality

### Success Criteria for Each Stage

- [ ] All existing tests pass (`npm test`)
- [ ] No new linting errors
- [ ] Application starts successfully
- [ ] No broken imports or missing files
- [ ] All functionality works as before

## Detailed Import Path Analysis

### Stage-by-Stage Import Updates Required

**Stage 2 - Logger Move Impact:**

- **Files affected**: 15+ core files, 20+ command files, 4 workflow files, 57 test files
- **Pattern**: `'./logger.js'` → `'./src/core/managers/logger.js'` (from root)
- **Pattern**: `'../../logger.js'` → `'../../src/core/managers/logger.js'` (from commands)
- **Pattern**: `'../logger.js'` → `'../src/core/managers/logger.js'` (from workflow)

**Stage 3 - Config Validation Move Impact:**

- **Files affected**: configManager.js, systemMessages.js, test files
- **Pattern**: `'./configurationValidator.js'` → `'./src/config/validation/configurationValidator.js'`
- **Pattern**: `'./configurationLoader.js'` → `'./src/config/validation/configurationLoader.js'`

**Stage 4 - Config Managers Move Impact:**

- **Files affected**: 10+ core files, 20+ command files, 15+ tool files, 30+ test files
- **Pattern**: `'./configManager.js'` → `'./src/config/managers/configManager.js'` (from root)
- **Pattern**: `'../../configManager.js'` → `'../../src/config/managers/configManager.js'` (from commands)
- **Pattern**: `'../../toolConfigManager.js'` → `'../../src/config/managers/toolConfigManager.js'` (from tools)

**Stage 5 - Core Managers Move Impact:**

- **Files affected**: app.js, command files, test files
- **Pattern**: `'./costsManager.js'` → `'./src/core/managers/costsManager.js'`
- **Pattern**: `'./toolManager.js'` → `'./src/core/managers/toolManager.js'`
- **Pattern**: `'./snapshotManager.js'` → `'./src/core/managers/snapshotManager.js'`

**Stage 6 - AI Components Move Impact:**

- **Files affected**: app.js, role commands, test files
- **Pattern**: `'./aiAPIClient.js'` → `'./src/core/ai/aiAPIClient.js'`
- **Pattern**: `'../../systemMessages.js'` → `'../../src/core/ai/systemMessages.js'` (from commands)

**Stage 7 - Interface Components Move Impact:**

- **Files affected**: app.js, test files
- **Pattern**: `'./consoleInterface.js'` → `'./src/core/interface/consoleInterface.js'`
- **Pattern**: `'./commandHandler.js'` → `'./src/core/interface/commandHandler.js'`

**Stage 9 - Directory Moves Impact:**

- **Commands**: Internal imports need `../` adjustments for new location
- **Tools**: Internal imports need `../` adjustments for new location
- **Workflow**: Internal imports need `../` adjustments for new location
- **Cross-references**: Any files importing from these directories need path updates

### Critical Test File Updates

**Test files requiring updates at each stage:**

- **Unit tests**: 40+ files with direct imports from root
- **Integration tests**: 7 files with complex import patterns
- **E2E tests**: 2 files with full application imports
- **Mock files**: 3 files that mock core modules

**Test import patterns to update:**

```javascript
// Current patterns in tests:
import AIAPIClient from '../../../aiAPIClient.js';
import ConfigManager from '../../../configManager.js';
import ToolManager from '../../../toolManager.js';

// Will become (after respective stages):
import AIAPIClient from '../../../src/core/ai/aiAPIClient.js';
import ConfigManager from '../../../src/config/managers/configManager.js';
import ToolManager from '../../../src/core/managers/toolManager.js';
```

## Staged Implementation Checklist

### Pre-Migration Checklist

- [ ] Create backup branch: `git checkout -b backup-before-restructure`
- [ ] Run baseline test: `npm test` (all 1048 tests must pass)
- [ ] Document current test coverage and timing
- [ ] Verify application starts: `npm start`

### Stage 1: Foundation Setup

- [ ] Create src/ directory structure
- [ ] Create src/core/ subdirectories (ai, interface, managers)
- [ ] Create src/config/ subdirectories (managers, validation)
- [ ] Create src/shared/ directory
- [ ] **TEST**: `npm test` (should pass - no changes to imports)

### Stage 2: Move Logger (Foundation Layer)

- [ ] Move logger.js to src/core/managers/
- [ ] Update logger imports in app.js
- [ ] Update logger imports in aiAPIClient.js
- [ ] Update logger imports in toolManager.js
- [ ] Update logger imports in consoleInterface.js
- [ ] Update logger imports in commandHandler.js
- [ ] Update logger imports in all command files (20+ files)
- [ ] Update logger imports in all workflow files (4 files)
- [ ] Update logger imports in all test files (57 files)
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 3: Move Configuration Validation

- [ ] Move configurationValidator.js to src/config/validation/
- [ ] Move configurationLoader.js to src/config/validation/
- [ ] Move configurationChecker.js to src/config/validation/
- [ ] Update imports in configManager.js
- [ ] Update imports in systemMessages.js
- [ ] Update imports in test files
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 4: Move Configuration Managers

- [ ] Move configManager.js to src/config/managers/
- [ ] Move toolConfigManager.js to src/config/managers/
- [ ] Move uiConfigManager.js to src/config/managers/
- [ ] Update configManager imports in app.js
- [ ] Update configManager imports in aiAPIClient.js
- [ ] Update uiConfigManager imports in consoleInterface.js
- [ ] Update toolConfigManager imports in all tool files (15+ files)
- [ ] Update config manager imports in all command files (20+ files)
- [ ] Update config manager imports in all test files (30+ files)
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 5: Move Core Managers

- [ ] Move costsManager.js to src/core/managers/
- [ ] Move snapshotManager.js to src/core/managers/
- [ ] Move toolManager.js to src/core/managers/
- [ ] Update manager imports in app.js
- [ ] Update manager imports in command files
- [ ] Update manager imports in test files
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 6: Move AI Components

- [ ] Move systemMessages.js to src/core/ai/
- [ ] Move promptEnhancer.js to src/core/ai/
- [ ] Move aiAPIClient.js to src/core/ai/
- [ ] Update AI component imports in app.js
- [ ] Update systemMessages imports in role commands
- [ ] Update AI component imports in test files
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 7: Move Interface Components

- [ ] Move consoleInterface.js to src/core/interface/
- [ ] Move commandHandler.js to src/core/interface/
- [ ] Update interface imports in app.js
- [ ] Update interface imports in test files
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 8: Move Main Application

- [ ] Move app.js to src/core/
- [ ] Update package.json main field to "src/core/app.js"
- [ ] Update package.json bin field to "./src/core/app.js"
- [ ] **TEST**: `npm test` (all tests must pass)
- [ ] **TEST**: `npm start` (application must start)

### Stage 9: Move Existing Directories

- [ ] Move commands/ to src/commands/
- [ ] Move tools/ to src/tools/
- [ ] Move workflow/ to src/workflow/
- [ ] Move utils/ to src/utils/
- [ ] Update cross-directory imports in moved files
- [ ] Update imports from external files to moved directories
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 10: Move Config Directory

- [ ] Move config/ contents to src/config/
- [ ] Remove empty config/ directory
- [ ] Update configuration loading paths
- [ ] Update test fixture paths
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 11: Update Build Configuration

- [ ] Update vitest.config.js paths if needed
- [ ] Update eslint.config.js paths if needed
- [ ] Update Docker configurations if needed
- [ ] Update npm scripts if needed
- [ ] **TEST**: `npm test` (all tests must pass)

### Stage 12: Final Validation

- [ ] Run comprehensive test suite: `npm test`
- [ ] Test application startup: `npm start`
- [ ] Test global installation if applicable
- [ ] Verify no broken imports or missing files
- [ ] Test all major commands manually
- [ ] Update documentation (README.md, architecture.md)
- [ ] **FINAL TEST**: Complete application functionality check

## Rollback Strategy

### Stage-Level Rollback

If any stage fails (tests don't pass):

1. **Stop immediately** - do not proceed to next stage
2. **Investigate the failure** - identify which imports are broken
3. **Fix the specific issue** - update the missed import paths
4. **Re-test** - ensure `npm test` passes before proceeding
5. **Document the issue** - note what was missed for future reference

### Complete Rollback

If major issues arise:

1. **Immediate rollback:** `git reset --hard backup-before-restructure`
2. **Verify rollback:** `npm test` should pass after rollback
3. **Analyze failure:** Review what went wrong in the failed stage
4. **Plan fix:** Update the restructuring plan based on lessons learned

### Partial Stage Rollback

If only some files in a stage are problematic:

1. **Revert specific files:** `git checkout HEAD~1 -- <problematic-files>`
2. **Fix import paths:** Manually correct the import statements
3. **Test incrementally:** Run tests after each fix
4. **Complete the stage:** Once tests pass, continue

## Success Criteria (Per Stage)

Each stage must meet ALL criteria before proceeding:

- [ ] **All 1048 tests pass** - `npm test` returns 0 exit code
- [ ] **No linting errors** - `npm run lint` if available
- [ ] **Application starts** - `npm start` works without errors
- [ ] **No broken imports** - no "module not found" errors
- [ ] **Functionality intact** - core features work as before

## Final Success Criteria

- [ ] All existing tests pass (1048 tests)
- [ ] All commands work as before (/help, /tools, /role, etc.)
- [ ] All tools execute correctly
- [ ] Configuration loads properly
- [ ] Workflow functionality works
- [ ] Global installation works (if applicable)
- [ ] No broken imports or missing files
- [ ] Documentation is updated and accurate
- [ ] Performance is not degraded

## Implementation Guidelines

### Before Starting

1. **Create backup branch:** `git checkout -b backup-before-restructure`
2. **Verify baseline:** Ensure all tests pass before any changes
3. **Plan time:** Allow sufficient time for each stage (don't rush)
4. **Have rollback ready:** Know how to quickly revert if needed

### During Implementation

1. **One stage at a time** - never combine stages
2. **Test after every stage** - no exceptions
3. **Document issues** - keep notes of any problems encountered
4. **Take breaks** - avoid fatigue-induced mistakes

### After Completion

1. **Comprehensive testing** - run full test suite multiple times
2. **Manual verification** - test key functionality by hand
3. **Performance check** - ensure no significant slowdown
4. **Documentation update** - reflect new structure in docs

This staged approach transforms the risky "big bang" refactoring into a series of safe, testable steps that maintain functionality throughout the process while providing clear rollback points at every stage.
