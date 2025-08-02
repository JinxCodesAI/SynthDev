# SynthDev Configuration Guide

This guide covers all configuration options for SynthDev, including environment variables, configuration files, and customization options based on the actual implementation.

## Configuration System Overview

SynthDev uses a layered configuration system with clear priority order:

1. **Built-in defaults** (lowest priority)
2. **Configuration files** (`src/config/` directory)
3. **Environment variables** (`.env` file)
4. **Command line arguments** (highest priority)

## Environment Configuration

### Core Settings (.env file)

#### Required Configuration

```env
# Base Model (Required)
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

#### Multi-Model Setup

```env
# Smart Model (for complex reasoning)
SYNTHDEV_SMART_API_KEY=your_smart_api_key
SYNTHDEV_SMART_MODEL=gpt-4.1-mini
SYNTHDEV_SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (for quick tasks)
SYNTHDEV_FAST_API_KEY=your_fast_api_key
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
SYNTHDEV_FAST_BASE_URL=https://api.openai.com/v1
```

#### Application Settings

```env
# Tool Execution
SYNTHDEV_MAX_TOOL_CALLS=50              # Range: 1-200
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false # true/false

# Output Control
SYNTHDEV_VERBOSITY_LEVEL=2              # Range: 0-5

# Development
NODE_ENV=development           # development/production/test
DEBUG=false                    # true/false
```

### Verbosity Levels

Control output detail with `SYNTHDEV_VERBOSITY_LEVEL`:

- **Level 0**: Only user messages and errors
- **Level 1**: + Status messages (🔄 Enhancing prompt..., 🧠 AI thinking...)
- **Level 2**: + Compressed tool arguments (default)
- **Level 3**: + Uncompressed tool arguments and debug messages
- **Level 4**: + Tool execution results
- **Level 5**: + Complete HTTP request/response logging

### API Provider Examples

#### OpenAI

```env
SYNTHDEV_API_KEY=sk-your-openai-key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

#### Anthropic Claude

```env
SYNTHDEV_API_KEY=sk-ant-your-anthropic-key
SYNTHDEV_BASE_MODEL=claude-3-haiku-20240307
SYNTHDEV_BASE_URL=https://api.anthropic.com/v1
```

#### Google AI

```env
SYNTHDEV_API_KEY=your-google-ai-key
SYNTHDEV_BASE_MODEL=gemini-1.5-flash
SYNTHDEV_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

#### Local/Custom Provider

```env
SYNTHDEV_API_KEY=your-local-key
SYNTHDEV_BASE_MODEL=your-model-name
SYNTHDEV_BASE_URL=http://localhost:8080/v1
```

## Configuration Files

### Directory Structure

```
src/config/
├── managers/                    # Configuration managers
│   ├── configManager.js        # Main configuration orchestrator
│   ├── toolConfigManager.js    # Tool-specific configuration
│   └── uiConfigManager.js      # UI configuration
├── validation/                  # Configuration validation
│   ├── configurationChecker.js # Config validation
│   ├── configurationLoader.js  # File loading and caching
│   ├── configurationValidator.js # Validation logic
│   └── config-validation.json  # Validation rules
├── defaults/                    # Default configurations
│   └── application.json        # Application defaults
├── roles/                       # AI role definitions (multi-file support)
│   ├── roles.json              # Main role configurations (legacy)
│   ├── core-roles.json         # Core system roles
│   ├── specialized/            # Specialized role subdirectories
│   │   └── testing-roles.json  # Testing-specific roles
│   └── environment-template.json # Environment info template
├── tools/                       # Tool configuration
│   ├── tool-messages.json      # Common tool messages
│   └── safety-patterns.json    # Security patterns
├── ui/                         # User interface text
│   ├── console-messages.json   # Console interface messages
│   └── command-help.json       # Command descriptions
├── snapshots/                   # Snapshot system configuration
│   ├── snapshot-defaults.json  # Core snapshot settings
│   ├── auto-snapshot-defaults.json # Phase 2 automatic snapshot settings
│   ├── file-filters.json      # File filtering patterns
│   └── snapshot-messages.json # User interface messages for snapshots
```

### AI Roles Configuration

SynthDev supports multi-file role configuration. You can organize roles across multiple JSON files in the `src/config/roles/` directory and subdirectories.

#### Multi-File Organization

Create role files anywhere in the roles directory:

- `src/config/roles/roles.json` (main/legacy file)
- `src/config/roles/core-roles.json` (core system roles)
- `src/config/roles/specialized/testing-roles.json` (specialized roles)
- `src/config/roles/custom/my-roles.json` (your custom roles)

#### Role Definition Example

Edit any JSON file in `src/config/roles/` to customize AI behavior:

```json
{
    "custom_role": {
        "level": "base",
        "systemMessage": "You are a specialized assistant for...",
        "excludedTools": ["execute_terminal"],
        "reminder": "Remember to follow security guidelines",
        "examples": [
            {
                "role": "user",
                "content": "Example input"
            },
            {
                "role": "assistant",
                "content": "Example response"
            }
        ]
    }
}
```

#### Role Properties

- **level**: Model level (`base`, `smart`, `fast`)
- **systemMessage**: Core instructions for the AI role
- **excludedTools**: Tools this role cannot access (supports wildcards and regex)
- **includedTools**: Tools this role can access (mutually exclusive with excludedTools)
- **reminder**: Additional instructions during tool execution
- **examples**: Conversation examples for few-shot prompting
- **parsingTools**: Special tools for structured output (parsing only)

#### Tool Filtering Patterns

```json
"excludedTools": [
    "exact_tool_name",     // Exact match
    "*file",               // Wildcard: matches any tool ending with "file"
    "execute_*",           // Wildcard: matches any tool starting with "execute_"
    "/^dangerous_/i"       // Regex: case-insensitive match
]
```

### UI Customization

Edit `src/config/ui/console-messages.json`:

```json
{
    "startup": {
        "title": "🎯 My Custom Dev Assistant",
        "subtitle": "Ready to help with your development tasks"
    },
    "prompts": {
        "user_input": "You: ",
        "confirmation": "Proceed? (y/n): "
    }
}
```

### Tool Safety Configuration

Edit `src/config/tools/safety-patterns.json`:

```json
{
    "dangerous_patterns": [
        {
            "pattern": "rm -rf",
            "reason": "Dangerous file deletion command"
        },
        {
            "pattern": "format c:",
            "reason": "System format command"
        }
    ]
}
```

### Snapshot System Configuration

SynthDev includes an advanced snapshot system with both manual and automatic snapshot creation.

#### Core Snapshot Configuration

Edit `src/config/snapshots/snapshot-defaults.json`:

```json
{
    "fileFiltering": {
        "customExclusions": [],
        "maxFileSize": 10485760,
        "binaryFileHandling": "exclude",
        "followSymlinks": false,
        "caseSensitive": false
    },
    "storage": {
        "type": "memory",
        "maxSnapshots": 50,
        "maxMemoryMB": 100,
        "persistToDisk": false
    },
    "backup": {
        "preservePermissions": true,
        "validateChecksums": true,
        "maxConcurrentFiles": 10,
        "encoding": "utf8"
    },
    "behavior": {
        "autoCleanup": true,
        "cleanupThreshold": 40,
        "confirmRestore": true,
        "showPreview": true
    }
}
```

#### Automatic Snapshot Configuration (Phase 2)

Edit `src/config/snapshots/auto-snapshot-defaults.json`:

```json
{
    "autoSnapshot": {
        "enabled": false,
        "createOnToolExecution": false
    },
    "toolDeclarations": {
        "defaultModifiesFiles": false,
        "write_file": { "modifiesFiles": true },
        "edit_file": { "modifiesFiles": true },
        "execute_terminal": { "modifiesFiles": "conditional" },
        "execute_script": { "modifiesFiles": "conditional" }
    },
    "triggerRules": {
        "maxSnapshotsPerSession": 20,
        "cooldownPeriod": 5000,
        "enableSessionLimits": true
    },
    "fileChangeDetection": {
        "enableMonitoring": true,
        "captureFileStates": true,
        "detectChangesAfterExecution": false
    },
    "initialSnapshot": {
        "enabled": true,
        "description": "Initial project state on startup",
        "skipIfRecentExists": true,
        "recentThreshold": 300000
    },
    "integration": {
        "nonIntrusive": true,
        "wrapToolExecution": true,
        "preserveOriginalBehavior": true
    }
}
```

#### File Filtering Configuration

Edit `src/config/snapshots/file-filters.json`:

```json
{
    "defaultPatterns": {
        "general": [
            "node_modules/**",
            ".git/**",
            "dist/**",
            "build/**",
            "coverage/**",
            "*.log",
            "*.tmp",
            ".DS_Store",
            "Thumbs.db"
        ],
        "development": [".vscode/**", ".idea/**", "*.swp", "*.swo", "*~"]
    },
    "languageSpecific": {
        "javascript": [
            "npm-debug.log*",
            "yarn-debug.log*",
            "yarn-error.log*",
            ".npm",
            ".yarn-integrity"
        ],
        "python": ["__pycache__/**", "*.pyc", "*.pyo", ".pytest_cache/**", ".mypy_cache/**"]
    }
}
```

#### Snapshot Configuration Options

- **fileFiltering**: Control which files are included in snapshots
- **storage**: Configure memory limits and cleanup behavior
- **autoSnapshot**: Enable/disable automatic snapshot creation
- **toolDeclarations**: Define which tools trigger snapshot creation
- **triggerRules**: Set limits and cooldown periods for automatic snapshots
- **initialSnapshot**: Configure startup snapshots

## ConfigManager API

### Basic Usage

```javascript
import ConfigManager from './src/config/managers/configManager.js';

// Get singleton instance
const config = ConfigManager.getInstance();

// Access model configurations
const baseModel = config.getModel('base');
const smartModel = config.getModel('smart');
const fastModel = config.getModel('fast');

// Access global settings
const globalConfig = config.getConfig().global;
```

### Model Configuration Access

```javascript
// Base model (always available)
const base = config.getModel('base');
console.log(base.apiKey, base.baseModel, base.baseUrl);

// Smart model (check availability first)
if (config.hasSmartModelConfig()) {
    const smart = config.getModel('smart');
    console.log(smart.model);
}

// Fast model (check availability first)
if (config.hasFastModelConfig()) {
    const fast = config.getModel('fast');
    console.log(fast.model);
}
```

### Global Settings

```javascript
const global = config.getConfig().global;
console.log(global.maxToolCalls); // Number: 1-200
console.log(global.environment); // String: development/production/test
console.log(global.debug); // Boolean
```

## Best Practices

1. **Use ConfigManager**: Always use `ConfigManager.getInstance()` instead of direct `process.env`
2. **Environment Separation**: Use different `.env` files for different environments
3. **Security**: Never commit `.env` files to version control
4. **Validation**: Always wrap ConfigManager usage in try-catch blocks
5. **Documentation**: Document custom configuration options

## Troubleshooting

### Common Configuration Issues

#### Missing API Key

```
Configuration error: SYNTHDEV_API_KEY is required
```

**Solution**: Add `SYNTHDEV_API_KEY=your_key` to `.env` file

#### Invalid URL Format

```
Configuration error: Invalid SYNTHDEV_BASE_URL format
```

**Solution**: Ensure URL includes protocol (http:// or https://)

#### Tool Call Limit Out of Range

```
Configuration error: SYNTHDEV_MAX_TOOL_CALLS must be between 1 and 200
```

**Solution**: Set `SYNTHDEV_MAX_TOOL_CALLS` to a value between 1-200

---
