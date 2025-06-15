# Configuration Guide

This guide covers all configuration options for SynthDev, including environment variables, configuration files, and customization options.

## Configuration System Overview

SynthDev uses a layered configuration system:

1. **Built-in defaults** (lowest priority)
2. **Configuration files** (`config/` directory)
3. **Environment variables** (`.env` file)
4. **Command line arguments** (highest priority)

## Environment Configuration

### Core Settings (.env file)

#### Required Configuration

```env
# Base Model (Required)
API_KEY=your_api_key_here
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1
```

#### Multi-Model Setup

```env
# Smart Model (for complex reasoning)
SMART_API_KEY=your_smart_api_key
SMART_MODEL=gpt-4.1-mini
SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (for quick tasks)
FAST_API_KEY=your_fast_api_key
FAST_MODEL=gpt-4.1-nano
FAST_BASE_URL=https://api.openai.com/v1
```

#### Application Settings

```env
# Tool Execution
MAX_TOOL_CALLS=50              # Range: 1-200
ENABLE_PROMPT_ENHANCEMENT=false # true/false

# Output Control
VERBOSITY_LEVEL=2              # Range: 0-5

# Development
NODE_ENV=development           # development/production/test
DEBUG=false                    # true/false
```

### Verbosity Levels

Control output detail with `VERBOSITY_LEVEL`:

- **Level 0**: Only user messages and errors
- **Level 1**: + Status messages (🔄 Enhancing prompt..., 🧠 AI thinking...)
- **Level 2**: + Compressed tool arguments (default)
- **Level 3**: + Uncompressed tool arguments and debug messages
- **Level 4**: + Tool execution results
- **Level 5**: + Complete HTTP request/response logging

### API Provider Examples

#### OpenAI

```env
API_KEY=sk-your-openai-key
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1
```

#### Anthropic Claude

```env
API_KEY=sk-ant-your-anthropic-key
BASE_MODEL=claude-3-haiku-20240307
BASE_URL=https://api.anthropic.com/v1
```

#### Google AI

```env
API_KEY=your-google-ai-key
BASE_MODEL=gemini-1.5-flash
BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

#### Local/Custom Provider

```env
API_KEY=your-local-key
BASE_MODEL=your-model-name
BASE_URL=http://localhost:8080/v1
```

## Configuration Files

### Directory Structure

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

### AI Roles Configuration

Edit `config/roles/roles.json` to customize AI behavior:

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

Edit `config/ui/console-messages.json`:

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

Edit `config/tools/safety-patterns.json`:

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

## ConfigManager API

### Basic Usage

```javascript
import ConfigManager from './configManager.js';

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

## Validation

### Configuration Validation

The system validates configuration on startup:

- **Required fields**: Ensures `API_KEY` is provided
- **URL validation**: Validates URL formats for all base URLs
- **Range validation**: Ensures `MAX_TOOL_CALLS` is between 1-200
- **Type validation**: Converts strings to appropriate types

### Error Handling

```javascript
try {
    const config = ConfigManager.getInstance();
} catch (error) {
    console.error('Configuration error:', error.message);
    // Handle configuration errors appropriately
}
```

## Environment-Specific Configuration

### Development Environment

```env
NODE_ENV=development
DEBUG=true
VERBOSITY_LEVEL=3
ENABLE_PROMPT_ENHANCEMENT=true
```

### Production Environment

```env
NODE_ENV=production
DEBUG=false
VERBOSITY_LEVEL=1
ENABLE_PROMPT_ENHANCEMENT=false
MAX_TOOL_CALLS=30
```

### Testing Environment

```env
NODE_ENV=test
DEBUG=false
VERBOSITY_LEVEL=0
API_KEY=test-key-for-mocking
```

## Advanced Configuration

### Custom Model Configurations

For specialized use cases:

```env
# Research Model
RESEARCH_API_KEY=your_research_key
RESEARCH_MODEL=gpt-4-research
RESEARCH_BASE_URL=https://api.research.com/v1

# Code Model
CODE_API_KEY=your_code_key
CODE_MODEL=codex-advanced
CODE_BASE_URL=https://api.code.com/v1
```

### Performance Tuning

```env
# Reduce API calls
MAX_TOOL_CALLS=20
ENABLE_PROMPT_ENHANCEMENT=false

# Increase output for debugging
VERBOSITY_LEVEL=5
DEBUG=true

# Optimize for speed
FAST_MODEL=gpt-3.5-turbo
```

## Migration from Old Configuration

### From systemMessages.js

**Old format:**

```javascript
coder: {
    level: 'base',
    systemMessage: 'You are a coder...',
    excludedTools: ['tool1']
}
```

**New format:**

```json
{
    "coder": {
        "level": "base",
        "systemMessage": "You are a coder...",
        "excludedTools": ["tool1"]
    }
}
```

### From Direct Environment Access

**Old way:**

```javascript
const apiKey = process.env.API_KEY;
const maxCalls = parseInt(process.env.MAX_TOOL_CALLS) || 50;
```

**New way:**

```javascript
const config = ConfigManager.getInstance();
const apiKey = config.getModel('base').apiKey;
const maxCalls = config.getConfig().global.maxToolCalls;
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
Configuration error: API_KEY is required
```

**Solution**: Add `API_KEY=your_key` to `.env` file

#### Invalid URL Format

```
Configuration error: Invalid BASE_URL format
```

**Solution**: Ensure URL includes protocol (http:// or https://)

#### Tool Call Limit Out of Range

```
Configuration error: MAX_TOOL_CALLS must be between 1 and 200
```

**Solution**: Set `MAX_TOOL_CALLS` to a value between 1-200

---

_For role-specific configuration, see [AI Roles & Few-Shot Prompting](roles-and-prompting.md)_
