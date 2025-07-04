# SynthDev Project Restructuring Plan

## Current State Analysis

The SynthDev project currently has **22 JavaScript files** and **multiple configuration files** scattered in the root directory, making it difficult to navigate and maintain. The project has some semi-structured areas (commands/, tools/, config/) but lacks a coherent overall organization.

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

## Detailed Refactoring Steps

### Phase 1: Create New Directory Structure

1. **Create main source directory structure:**

    ```bash
    mkdir -p src/core/ai
    mkdir -p src/core/interface
    mkdir -p src/core/managers
    mkdir -p src/config/managers
    mkdir -p src/shared
    ```

2. **Move configuration system:**

    ```bash
    # Move config managers
    mv configManager.js src/config/managers/
    mv toolConfigManager.js src/config/managers/
    mv uiConfigManager.js src/config/managers/
    mv configurationChecker.js src/config/validation/
    mv configurationLoader.js src/config/validation/
    mv configurationValidator.js src/config/validation/

    # Move existing config directory contents to src/config/
    mv config/* src/config/
    rmdir config
    ```

### Phase 2: Reorganize Core Components

3. **Move AI-related components:**

    ```bash
    mv aiAPIClient.js src/core/ai/
    mv systemMessages.js src/core/ai/
    mv promptEnhancer.js src/core/ai/
    ```

4. **Move interface components:**

    ```bash
    mv consoleInterface.js src/core/interface/
    mv commandHandler.js src/core/interface/
    ```

5. **Move core managers:**

    ```bash
    mv costsManager.js src/core/managers/
    mv snapshotManager.js src/core/managers/
    mv toolManager.js src/core/managers/
    mv logger.js src/core/managers/
    ```

6. **Move main application:**
    ```bash
    mv app.js src/core/
    ```

### Phase 3: Move Existing Structured Directories

7. **Move existing well-structured directories:**
    ```bash
    mv commands src/
    mv tools src/
    mv workflow src/
    mv utils src/
    ```

### Phase 4: Update Import Paths

8. **Update all import statements** in moved files to reflect new paths
9. **Update package.json** main entry point: `"main": "src/core/app.js"`
10. **Update bin entry** in package.json: `"synth-dev": "./src/core/app.js"`

### Phase 5: Create Shared Constants

11. **Create shared constants file** (`src/shared/constants.js`) for:
    - Default configuration values
    - Error messages
    - File paths
    - Common enums

### Phase 6: Update Configuration and Build Files

12. **Update configuration files:**
    - Update paths in `vitest.config.js`
    - Update paths in `eslint.config.js`
    - Update any Docker configurations
    - Update scripts in `package.json`

### Phase 7: Update Documentation

13. **Update documentation:**
    - Update README.md with new structure
    - Update docs/architecture.md
    - Update any path references in documentation

## Benefits of This Restructuring

### 1. **Clear Separation of Concerns**

- **Core logic** separated from configuration
- **AI components** grouped together
- **Interface components** isolated
- **Managers** organized by responsibility

### 2. **Improved Maintainability**

- Easier to locate specific functionality
- Clearer dependencies between modules
- Better organization for new developers

### 3. **Scalability**

- Room for growth in each category
- Clear patterns for adding new components
- Modular structure supports future features

### 4. **Better Testing**

- Easier to write focused unit tests
- Clear boundaries for integration tests
- Simplified mocking and dependency injection

### 5. **Enhanced Developer Experience**

- Faster navigation in IDEs
- Clearer mental model of the codebase
- Reduced cognitive load when working on specific features

## Migration Strategy

### Approach: Gradual Migration

1. **Phase-by-phase implementation** to avoid breaking changes
2. **Comprehensive testing** after each phase
3. **Backward compatibility** during transition
4. **Documentation updates** alongside code changes

### Risk Mitigation

- **Backup current state** before starting
- **Test thoroughly** after each phase
- **Update CI/CD** configurations as needed
- **Validate all functionality** works after migration

## Import Path Updates Required

### Critical Import Relationships to Update

**app.js imports (will become src/core/app.js):**

```javascript
// Current imports that need path updates:
import AIAPIClient from './aiAPIClient.js'; // → './ai/aiAPIClient.js'
import ToolManager from './toolManager.js'; // → './managers/toolManager.js'
import CommandHandler from './commandHandler.js'; // → './interface/commandHandler.js'
import ConsoleInterface from './consoleInterface.js'; // → './interface/consoleInterface.js'
import costsManager from './costsManager.js'; // → './managers/costsManager.js'
import SnapshotManager from './snapshotManager.js'; // → './managers/snapshotManager.js'
import PromptEnhancer from './promptEnhancer.js'; // → './ai/promptEnhancer.js'
import WorkflowStateMachine from './workflow/WorkflowStateMachine.js'; // → '../workflow/WorkflowStateMachine.js'
import { initializeLogger, getLogger } from './logger.js'; // → './managers/logger.js'
import GitUtils from './utils/GitUtils.js'; // → '../utils/GitUtils.js'
```

**Configuration Manager imports:**

```javascript
// Files importing configuration managers need updates:
import ConfigManager from './configManager.js'; // → '../config/managers/configManager.js'
import { getToolConfigManager } from './toolConfigManager.js'; // → '../config/managers/toolConfigManager.js'
import { getUIConfigManager } from './uiConfigManager.js'; // → '../config/managers/uiConfigManager.js'
```

**Cross-module dependencies:**

- **aiAPIClient.js** imports ConfigManager, logger
- **toolManager.js** imports logger, tool schema from tools/common/
- **systemMessages.js** imports configurationLoader
- **All managers** import logger
- **Commands** import various managers and interfaces

### Files Requiring Import Updates (Estimated 40+ files)

1. **Core files:** app.js, aiAPIClient.js, commandHandler.js, consoleInterface.js
2. **All command files** in commands/ directory (15+ files)
3. **All tool implementations** in tools/ directory (9+ files)
4. **Workflow files** (4 files)
5. **Test files** throughout tests/ directory (20+ files)
6. **Configuration files** that import managers

## Implementation Checklist

### Pre-Migration Checklist

- [ ] Create backup branch
- [ ] Run full test suite to establish baseline
- [ ] Document current test coverage
- [ ] Verify all current functionality works

### Phase 1: Directory Structure

- [ ] Create src/ directory structure
- [ ] Create src/core/ subdirectories
- [ ] Create src/config/managers/ directory
- [ ] Verify directory permissions

### Phase 2: Move Configuration System

- [ ] Move config managers to src/config/managers/
- [ ] Move validation files to src/config/validation/
- [ ] Move config/ contents to src/config/
- [ ] Update config manager imports
- [ ] Test configuration loading

### Phase 3: Move Core Components

- [ ] Move AI components to src/core/ai/
- [ ] Move interface components to src/core/interface/
- [ ] Move managers to src/core/managers/
- [ ] Move app.js to src/core/
- [ ] Update core component imports

### Phase 4: Move Structured Directories

- [ ] Move commands/ to src/commands/
- [ ] Move tools/ to src/tools/
- [ ] Move workflow/ to src/workflow/
- [ ] Move utils/ to src/utils/
- [ ] Update cross-directory imports

### Phase 5: Update Entry Points

- [ ] Update package.json main field
- [ ] Update package.json bin field
- [ ] Update npm scripts if needed
- [ ] Test npm start and npm install -g

### Phase 6: Update Build Configuration

- [ ] Update vitest.config.js paths
- [ ] Update eslint.config.js paths
- [ ] Update any Docker file paths
- [ ] Update GitHub Actions if present

### Phase 7: Testing and Validation

- [ ] Run full test suite
- [ ] Test all commands manually
- [ ] Test tool execution
- [ ] Test workflow functionality
- [ ] Test configuration loading
- [ ] Test global installation
- [ ] Verify no broken imports

### Phase 8: Documentation

- [ ] Update README.md
- [ ] Update docs/architecture.md
- [ ] Update docs/configuration.md
- [ ] Update any path references in docs/
- [ ] Update tool-development.md

## Rollback Plan

If issues arise during migration:

1. **Immediate rollback:** `git reset --hard backup-branch`
2. **Partial rollback:** Revert specific phases in reverse order
3. **Import fix:** Use find/replace to revert import paths
4. **Test validation:** Ensure all tests pass after rollback

## Success Criteria

- [ ] All existing tests pass
- [ ] All commands work as before
- [ ] All tools execute correctly
- [ ] Configuration loads properly
- [ ] Global installation works
- [ ] No broken imports or missing files
- [ ] Documentation is updated and accurate

## Next Steps

1. **Review and approve** this restructuring plan
2. **Create feature branch** for restructuring work
3. **Implement Phase 1** (directory creation)
4. **Proceed through phases** systematically with testing after each
5. **Update tests and documentation** continuously
6. **Merge when complete and fully tested**

This restructuring will transform SynthDev from a flat, hard-to-navigate structure into a well-organized, maintainable codebase that follows modern Node.js project conventions while maintaining all existing functionality.
