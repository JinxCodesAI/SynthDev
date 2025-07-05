# Configuration Guide

This guide covers all configuration options for SynthDev, including environment variables, configuration files, and customization options.

## Configuration System Overview

SynthDev uses a layered configuration system with clear priority order:

```
Configuration Hierarchy (lowest to highest priority):
1. Built-in defaults (src/config/defaults/)
2. Configuration files (src/config/)
3. Environment variables (.env file)
4. Command line arguments
```

## Environment Configuration

### Required Configuration

The minimum configuration needed to run SynthDev:

```env
# Base Model (Required)
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

### Multi-Model Setup

SynthDev supports three model tiers for different use cases and multiple AI providers:

#### Supported Providers

SynthDev includes built-in support for:

- **XAI**: Grok models (grok-3-mini-beta)
- **OpenAI**: GPT-4.1 series, GPT-4o series, o4-mini
- **Google**: Gemini 2.5 Flash and Pro models
- **OpenRouter**: Access to multiple providers through OpenRouter API
- **Anthropic**: Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku

#### Multi-Tier Configuration

```env
# Base Model (Required) - Default model for most operations
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1

# Smart Model (Optional) - For complex reasoning tasks (architect role)
SYNTHDEV_SMART_API_KEY=your_smart_api_key
SYNTHDEV_SMART_MODEL=gpt-4.1-mini
SYNTHDEV_SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (Optional) - For quick tasks and simple operations
SYNTHDEV_FAST_API_KEY=your_fast_api_key
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
SYNTHDEV_FAST_BASE_URL=https://api.openai.com/v1
```

#### Provider-Specific Examples

**XAI Configuration:**

```env
SYNTHDEV_API_KEY=your_xai_api_key
SYNTHDEV_BASE_MODEL=grok-3-mini-beta
SYNTHDEV_BASE_URL=https://api.x.ai/v1
```

**Google Configuration:**

```env
SYNTHDEV_API_KEY=your_google_api_key
SYNTHDEV_BASE_MODEL=gemini-2.5-flash
SYNTHDEV_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

**Anthropic Configuration:**

```env
SYNTHDEV_API_KEY=your_anthropic_api_key
SYNTHDEV_BASE_MODEL=claude-sonnet-4-20250514
SYNTHDEV_BASE_URL=https://api.anthropic.com/v1/
```

**OpenRouter Configuration:**

```env
SYNTHDEV_API_KEY=your_openrouter_api_key
SYNTHDEV_BASE_MODEL=google/gemini-2.5-flash
SYNTHDEV_BASE_URL=https://openrouter.ai/api/v1
```

### Application Settings

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

- **0**: Only information directly affecting the user
- **1**: Short messages like "🔄 Enhancing prompt..."
- **2**: Compressed tool arguments (default)
- **3**: Uncompressed arguments but no tool results
- **4**: Both arguments and tool results
- **5**: Every HTTP request and response

## Interactive Configuration

### Configuration Wizard

SynthDev includes an interactive configuration wizard:

```bash
# Auto-starts if no .env file exists
npm start

# Or manually start the wizard
/configure
```

The wizard provides:

- **Provider Selection**: Choose from OpenAI, Google, etc.
- **Model Configuration**: Set models for base/smart/fast tiers
- **API Key Management**: Secure API key input
- **Settings Configuration**: Verbosity, tool limits, etc.
- **Validation**: Real-time configuration validation

### Wizard Features

1. **Completeness Check**: Validates required configuration
2. **Provider Templates**: Pre-configured settings for popular providers
3. **Configuration Copy**: Copy base settings to smart/fast models
4. **Live Validation**: Immediate feedback on configuration errors
5. **Safe Saving**: Backup existing configuration before changes

## Configuration Files

### File Structure

```
src/config/
├── defaults/                    # Application defaults
│   ├── application.json         # Core settings and limits
│   └── environment-template.json # Environment info template
├── roles/                       # AI role definitions
│   ├── roles.json              # Main role configurations
│   ├── core-roles.json         # Core system roles
│   ├── specialized-roles.json  # Specialized roles
│   └── custom/                 # Custom role subdirectories
├── tools/                       # Tool configuration
│   ├── tool-messages.json      # Tool descriptions and messages
│   └── safety-patterns.json    # Security patterns
├── ui/                         # User interface text
│   ├── console-messages.json   # Console interface messages
│   └── command-help.json       # Command descriptions
├── validation/                 # Configuration validation
│   └── config-validation.json  # Validation rules
└── workflows/                  # Workflow definitions
    └── *.json                  # Workflow configuration files
```

### Core Configuration Files

#### `defaults/application.json`

Defines default application behavior:

```json
{
    "models": {
        "base": {
            "model": "gpt-4.1-mini",
            "baseUrl": "https://api.openai.com/v1"
        },
        "smart": { "model": null, "baseUrl": null },
        "fast": { "model": null, "baseUrl": null }
    },
    "global_settings": {
        "maxToolCalls": 50,
        "enablePromptEnhancement": false,
        "verbosityLevel": 2
    },
    "ui_settings": {
        "defaultRole": "dude",
        "showStartupBanner": true,
        "enableColors": true,
        "promptPrefix": "💭 You: "
    },
    "tool_settings": {
        "autoRun": true,
        "requiresBackup": false,
        "defaultEncoding": "utf8",
        "maxFileSize": 10485760,
        "defaultTimeout": 10000
    },
    "safety": {
        "enableAISafetyCheck": true,
        "fallbackToPatternMatching": true,
        "maxScriptSize": 50000,
        "scriptTimeout": {
            "min": 1000,
            "max": 30000,
            "default": 10000
        }
    }
}
```

#### `roles/` Directory

AI role definitions with multi-file support:

```json
{
    "coder": {
        "level": "base",
        "systemMessage": "You are a skilled software developer...",
        "excludedTools": [],
        "reminderMessage": "Focus on clean, maintainable code.",
        "examples": [
            {
                "user": "Create a function to calculate factorial",
                "assistant": "I'll create a factorial function for you..."
            }
        ]
    },
    "architect": {
        "level": "smart",
        "systemMessage": "You are a software architect...",
        "excludedTools": ["execute_script"],
        "reminderMessage": "Consider scalability and maintainability."
    }
}
```

**Role Configuration Options:**

- `level`: Model tier to use (base/smart/fast)
- `systemMessage`: AI persona definition and behavior instructions
- `excludedTools`: Tools not available to this role
- `reminderMessage`: Additional context for the AI
- `examples`: Few-shot learning examples for better AI behavior
- `parsingOnly`: If true, role can only use parsing tools (no file operations)
- `parsingTools`: Array of parsing tools available to this role

#### Parsing Tools and Role Behavior

Some roles are configured with `parsingOnly: true` and specific `parsingTools`. These roles are designed for analysis and structured output without file modification capabilities:

```json
{
    "file_summarizer": {
        "level": "base",
        "systemMessage": "You are a file analysis specialist...",
        "parsingOnly": true,
        "parsingTools": ["parse_code_structure", "parse_dependencies"],
        "excludedTools": ["write_file", "edit_file", "execute_script"]
    }
}
```

**Parsing Tools vs Regular Tools:**

- **Regular Tools**: Can perform file operations, execute code, modify system state
- **Parsing Tools**: Extract structured information, analyze content, provide insights
- **parsingOnly Roles**: Limited to analysis and information extraction only

#### Role Examples from Core Configuration

**Development Roles:**

```json
{
    "coder": {
        "level": "base",
        "systemMessage": "You are a skilled software developer focused on writing clean, efficient, and well-documented code...",
        "reminderMessage": "Always consider code quality, maintainability, and best practices."
    },
    "architect": {
        "level": "smart",
        "systemMessage": "You are a software architect with deep expertise in system design...",
        "excludedTools": ["execute_script"],
        "reminderMessage": "Focus on scalability, maintainability, and architectural patterns."
    }
}
```

**Analysis Roles:**

```json
{
    "codebase_explainer": {
        "level": "base",
        "systemMessage": "You are a codebase analysis expert...",
        "parsingOnly": true,
        "parsingTools": ["parse_code_structure", "analyze_dependencies"],
        "excludedTools": ["write_file", "edit_file", "execute_script"]
    }
}
```

#### `tools/tool-messages.json`

Tool descriptions and error messages:

```json
{
    "descriptions": {
        "read_file": "Read and display the contents of a file",
        "write_file": "Create or overwrite a file with new content"
    },
    "errors": {
        "file_not_found": "File not found: {path}",
        "permission_denied": "Permission denied: {path}"
    },
    "validation": {
        "invalid_path": "Invalid file path provided",
        "file_too_large": "File size exceeds maximum limit"
    }
}
```

#### `tools/safety-patterns.json`

Security patterns for code execution:

```json
{
    "ai_safety_prompt": "Analyze this code for security risks...",
    "dangerous_patterns": [
        {
            "pattern": "rm -rf",
            "description": "Recursive file deletion",
            "severity": "high"
        }
    ],
    "error_messages": {
        "dangerous_code_detected": "Dangerous code pattern detected: {pattern}",
        "ai_safety_check_failed": "AI safety check failed: {reason}"
    }
}
```

## Configuration Management

### ConfigManager

The main configuration orchestrator:

```javascript
import { ConfigManager } from './src/core/managers/configManager.js';

const config = ConfigManager.getInstance();
await config.initialize();

// Access configuration
const baseModel = config.getModel('base');
const settings = config.getConfig().global;
```

### Configuration Loading

Configuration files are loaded and cached:

1. **Discovery**: Automatic file discovery in config directories
2. **Loading**: JSON parsing with error handling
3. **Merging**: Multi-file configurations are merged
4. **Validation**: Schema validation and type checking
5. **Caching**: Results cached for performance

### Hot Reload

For development, configuration can be reloaded:

```javascript
import { getConfigurationLoader } from './src/config/managers/configurationLoader.js';

const loader = getConfigurationLoader();
await loader.reloadConfig('roles');
```

## Validation

### Configuration Validation

The system validates configuration on startup:

- **Required Fields**: Ensures essential configuration is present
- **URL Validation**: Validates URL formats for all endpoints
- **Range Validation**: Ensures numeric values are within valid ranges
- **Type Validation**: Converts strings to appropriate types
- **Model Validation**: Checks model name formats

### Validation Rules

Defined in `validation/config-validation.json`:

```json
{
    "api_key_patterns": {
        "openai": "^sk-[a-zA-Z0-9]{48}$",
        "google": "^[a-zA-Z0-9_-]{39}$"
    },
    "url_validation": {
        "allowed_protocols": ["http", "https"],
        "required_paths": ["/v1"]
    },
    "limits": {
        "max_tool_calls": { "min": 1, "max": 200 },
        "verbosity_level": { "min": 0, "max": 5 }
    },
    "required_fields": {
        "base_config": ["apiKey", "baseModel", "baseUrl"]
    }
}
```

### Error Handling

Configuration errors are handled gracefully:

- **Startup Errors**: Clear error messages with resolution steps
- **Validation Errors**: Specific field-level error reporting
- **Missing Files**: Automatic fallback to defaults where possible
- **Recovery**: Configuration wizard auto-starts for incomplete config

## Advanced Configuration

### Custom Providers

You can add custom AI providers by extending the `src/config/defaults/providers.json` file:

```json
{
    "providers": [
        {
            "name": "Custom Provider",
            "models": [
                {
                    "name": "custom-model-1",
                    "contextSize": 128000,
                    "maxResponseSize": 32000,
                    "inputPricePerMillionTokens": 1.0,
                    "outputPricePerMillionTokens": 3.0,
                    "cachedPricePerMillionTokens": 0.25,
                    "reasoning": false
                }
            ],
            "baseUrl": "https://api.custom.com/v1"
        }
    ]
}
```

#### Provider Configuration Fields

- **name**: Display name for the provider
- **baseUrl**: API endpoint URL
- **models**: Array of supported models with:
    - **name**: Model identifier
    - **contextSize**: Maximum context window in tokens
    - **maxResponseSize**: Maximum response length in tokens
    - **inputPricePerMillionTokens**: Cost per million input tokens
    - **outputPricePerMillionTokens**: Cost per million output tokens
    - **cachedPricePerMillionTokens**: Cost per million cached tokens
    - **reasoning**: Whether the model supports reasoning (optional)

#### Using Custom Providers

After adding a custom provider:

1. **Update Configuration**: Add the provider to `providers.json`
2. **Set Environment Variables**: Use the custom model in your `.env` file
3. **Restart Application**: Reload to pick up the new provider
4. **Use Configuration Wizard**: The new provider will appear in the wizard

Example usage:

```env
SYNTHDEV_API_KEY=your_custom_api_key
SYNTHDEV_BASE_MODEL=custom-model-1
SYNTHDEV_BASE_URL=https://api.custom.com/v1
```

### Role Groups

Organize roles into groups:

```json
{
    "groups": {
        "testing": {
            "test_writer": {
                /* role config */
            },
            "qa_specialist": {
                /* role config */
            }
        }
    }
}
```

### Environment-Specific Configuration

Use different configurations per environment:

```env
NODE_ENV=development
SYNTHDEV_VERBOSITY_LEVEL=5  # Verbose for development

NODE_ENV=production
SYNTHDEV_VERBOSITY_LEVEL=1  # Quiet for production
```

## Troubleshooting

### Common Issues

1. **Missing API Key**: Use `/configure` to set up credentials
2. **Invalid URL**: Check URL format and protocol
3. **Model Not Found**: Verify model name with provider
4. **Permission Errors**: Check file permissions for config directory

### Debug Configuration

Enable debug mode for configuration issues:

```env
DEBUG=true
SYNTHDEV_VERBOSITY_LEVEL=5
```

### Configuration Reset

Reset configuration to defaults:

```bash
# Delete .env file
rm .env

# Restart application (wizard will auto-start)
npm start
```

---

_For role-specific configuration details, see the ADRs in the ADRs/ directory._
