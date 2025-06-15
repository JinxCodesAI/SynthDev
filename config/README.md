# Configuration System

This directory contains external configuration files that control Synth-Dev's behavior. **All configuration files are required** - the system will fail to start if any are missing.

## Structure

```
config/
├── README.md                    # This file
├── defaults/                    # Application default values
│   ├── application.json         # Core application settings and limits
│   └── environment-template.json # Environment information template (moved from roles/)
├── roles/                       # AI role definitions (supports multiple files and subdirectories)
│   ├── roles.json              # Main AI persona configurations (legacy, optional)
│   ├── core-roles.json         # Core system roles (example)
│   ├── specialized-roles.json  # Specialized roles (example)
│   └── custom/                 # Custom role subdirectories (example)
│       └── my-roles.json       # Custom role definitions (example)
├── tools/                       # Tool configuration
│   ├── tool-messages.json      # Tool descriptions, error messages, and validation text
│   └── safety-patterns.json    # Security patterns and limits for execute_script tool
├── ui/                         # User interface text
│   ├── console-messages.json   # Console interface messages and prompts
│   └── command-help.json       # Command descriptions and help text
└── validation/                 # Configuration validation
    └── config-validation.json  # Validation rules and error messages
```

## Configuration Files and Their Effects

### `defaults/application.json`

**Affects**: Core application behavior, model settings, UI defaults, tool limits, logging configuration

- **Used by**: ConfigManager, application startup
- **Controls**: Model configurations, global settings, UI preferences, tool defaults, logging levels

### `roles/` directory (Multi-file support)

**Affects**: AI behavior, system messages, tool availability per role, few-shot prompting

- **Used by**: SystemMessages, AIAPIClient, PromptEnhancer, app.js
- **Controls**: AI persona definitions, system prompts, excluded tools per role, model levels, reminder messages, conversation examples for few-shot prompting
- **Structure**: Supports multiple JSON files and subdirectories. All JSON files in the roles/ directory and its subdirectories are automatically loaded and merged.
- **Backward Compatibility**: The legacy `roles.json` file is still supported and will be loaded first if present.

### `defaults/environment-template.json`

**Affects**: Environment information included in AI system messages

- **Used by**: SystemMessages
- **Controls**: Template for OS, working directory, index status, and timestamp information
- **Migration**: Moved from `roles/environment-template.json` to `defaults/environment-template.json`. The old location is still supported for backward compatibility with a deprecation warning.

### `tools/tool-messages.json`

**Affects**: All tool error messages, descriptions, parameter documentation, validation messages

- **Used by**: ToolConfigManager, all tool implementations
- **Controls**: Tool descriptions, common error messages, validation messages, parameter descriptions

### `tools/safety-patterns.json`

**Affects**: execute_script tool security validation and AI safety assessment

- **Used by**: ToolConfigManager, execute_script tool
- **Controls**: AI safety prompts, dangerous code patterns, error messages, execution limits

### `ui/console-messages.json`

**Affects**: Console interface text, prompts, status messages, startup messages

- **Used by**: UIConfigManager, ConsoleInterface, CommandRegistry
- **Controls**: User prompts, status indicators, startup banner, error messages, command feedback

### `ui/command-help.json`

**Affects**: Command help text and descriptions

- **Used by**: UIConfigManager, HelpCommand
- **Controls**: Command descriptions, help text, usage instructions

### `validation/config-validation.json`

**Affects**: Configuration validation rules and error messages

- **Used by**: ConfigurationValidator, ConfigurationChecker
- **Controls**: Validation rules, error messages, required fields, type checking

## Important Notes

- **No Fallbacks**: Unlike previous versions, configuration files are **required**. Missing files will cause startup failures.
- **Caching**: Configuration files are cached after first load for performance.
- **Validation**: All configuration files are validated against schemas on startup.
- **Hot Reload**: Use `ConfigurationLoader.reloadConfig()` to reload specific files during development.
