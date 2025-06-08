# Configuration System Migration Plan

## Overview

This document outlines the implementation plan for migrating hardcoded configuration texts to external JSON files in the Synth-Dev application.

## Architecture

### Core Components

1. **ConfigurationLoader** (`configurationLoader.js`)

    - Centralized configuration file loading with caching
    - Required configuration files (no fallbacks)
    - Deep merge functionality for configuration inheritance

2. **SystemMessages** (`systemMessages.js`)

    - Replaced implementation with external config support
    - Requires role definitions from `config/roles/roles.json`
    - Requires environment template from `config/roles/environment-template.json`

3. **UIConfigManager** (`uiConfigManager.js`)

    - Manages console interface messages and command help text
    - Requires files from `config/ui/` directory
    - Parameter substitution for dynamic messages

4. **ToolConfigManager** (`toolConfigManager.js`)
    - Manages tool-related configuration
    - Requires safety patterns and error messages from config files
    - Tool descriptions and parameter documentation

### Configuration Structure

```
config/
├── roles/                       # AI role definitions
│   ├── roles.json              # Main role configurations
│   └── environment-template.json # Environment info template
├── tools/                       # Tool configuration
│   ├── tool-messages.json      # Common tool messages
│   └── safety-patterns.json    # Security patterns
├── ui/                         # User interface text
│   ├── console-messages.json   # Console interface messages
│   └── command-help.json       # Command descriptions
├── validation/                 # Validation rules
│   └── config-validation.json  # Configuration validation
└── defaults/                   # Default values
    └── application.json        # Application defaults
```

## Migration Steps

### Phase 1: Core Infrastructure ✅ COMPLETED

- [x] Create ConfigurationLoader system
- [x] Create configuration directory structure
- [x] Create UIConfigManager and ToolConfigManager
- [x] Extract role definitions to JSON
- [x] Extract UI messages to JSON
- [x] Extract tool safety patterns to JSON
- [x] Remove hardcoded fallbacks from all configuration managers

### Phase 2: SystemMessages Migration ✅ COMPLETED

- [x] Replace SystemMessages implementation with configurable version
- [x] Remove hardcoded role definitions (200+ lines removed)
- [x] Load role configurations from `config/roles/roles.json`
- [x] Load environment template from `config/roles/environment-template.json`
- [x] Maintain same API interface for backward compatibility
- [x] Add missing roles (codebase_explainer, command_generator) to config
- [x] Verify all dependent files continue to work without changes

### Phase 3: Console Interface Migration ✅ COMPLETED

- [x] Update `consoleInterface.js` to use UIConfigManager
- [x] Update startup message generation with parameter substitution
- [x] Update error message handling and enhancement messages
- [x] Update command prompt formatting and confirmation prompts
- [x] Update CLI help text in `app.js` to use configuration
- [x] Update startup error messages in `app.js`
- [x] Update command error messages in `CommandRegistry.js`
- [x] Update help command in `HelpCommand.js` to use configuration

### Phase 4: Command System Migration ✅ COMPLETED

- [x] Update command help generation in `commands/info/HelpCommand.js`
- [x] Update CLI help text in `app.js`
- [x] Update command error messages in `CommandRegistry.js`
- [x] Update `/cmd` command messages in `CmdCommand.js`
- [x] Extract 20+ hardcoded messages from cmd command
- [x] Update command usage display to use configuration
- [x] Update command execution and result display messages
- [x] Update context integration messages

### Phase 5: Tool System Migration ✅ COMPLETED

- [x] Update `execute_script` tool to use ToolConfigManager
- [x] Update safety validation system with configurable patterns and prompts
- [x] Update `edit_file` tool to use ToolConfigManager for descriptions and errors
- [x] Update `read_file` tool to use ToolConfigManager for descriptions
- [x] Update `write_file` tool to use ToolConfigManager for descriptions and errors
- [x] Update `list_directory` tool to use ToolConfigManager for descriptions
- [x] Update `exact_search` tool to use ToolConfigManager for descriptions
- [x] Update `base-tool.js` validation methods to use configuration
- [x] Replace 15+ hardcoded error messages with configurable ones
- [x] Tool descriptions now load from configuration

### Phase 6: Configuration Validation

- [ ] Implement configuration validation using validation rules
- [ ] Update ConfigManager to use validation configuration
- [ ] Add configuration file existence checks
- [ ] Implement configuration reload functionality

### Phase 7: Testing and Documentation

- [ ] Create comprehensive tests for configuration loading
- [ ] Test error handling when config files are missing
- [ ] Update documentation with configuration customization guide
- [ ] Create migration guide for existing users

## Implementation Details

### Configuration Requirements

All configuration files are required. The system will:

1. Load external configuration files from the `config/` directory
2. Throw errors if required configuration files are missing
3. Cache loaded configurations for performance
4. Support configuration reloading for development

### Configuration Loading Order

1. Built-in defaults (lowest priority)
2. Configuration files
3. Environment variables
4. Command line arguments (highest priority)

### Error Handling

- Missing configuration files: Throw clear error with file path
- Invalid JSON: Throw error with parsing details
- Missing configuration keys: Application handles missing keys gracefully
- Invalid configuration values: Validate and reject with clear error messages

## Benefits

1. **User Customization**: Users can modify AI behavior, UI text, and tool settings without touching source code
2. **Internationalization Ready**: Easy to add multiple language support
3. **Environment-Specific Configs**: Different configurations for development, testing, production
4. **Maintainability**: Centralized configuration management
5. **Extensibility**: Easy to add new configuration options
6. **Clean Architecture**: No hardcoded fallbacks, clear separation of concerns

## Usage Examples

### Customizing AI Roles

Edit `config/roles/roles.json`:

```json
{
    "coder": {
        "systemMessage": "You are a specialized Python developer...",
        "excludedTools": ["execute_terminal"]
    }
}
```

### Customizing UI Messages

Edit `config/ui/console-messages.json`:

```json
{
    "startup": {
        "title": "🎯 My Custom Dev Assistant Started!"
    }
}
```

### Customizing Tool Safety

Edit `config/tools/safety-patterns.json`:

```json
{
    "dangerous_patterns": [
        {
            "pattern": "custom_dangerous_function",
            "reason": "Custom security restriction"
        }
    ]
}
```

## Next Steps

1. Begin Phase 3: Console Interface Migration
2. Test each phase thoroughly before proceeding
3. No backward compatibility concerns (no fallbacks)
4. Document configuration options as they are implemented
5. Consider creating a configuration validation tool

## Current Status

**✅ Phases 1-5 Complete**: Core infrastructure, SystemMessages, Console Interface, Command System, and Tool System migration finished
**🚧 Next**: Phase 6 - Configuration Validation
