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
config/
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
├── validation/                 # Validation rules
│   └── config-validation.json  # Configuration validation
└── defaults/                   # Default values
    └── application.json        # Application defaults
```

### AI Roles Configuration

SynthDev supports multi-file role configuration. You can organize roles across multiple JSON files in the `config/roles/` directory and subdirectories.

#### **Multi-File Organization**

Create role files anywhere in the roles directory:

- `config/roles/roles.json` (main/legacy file)
- `config/roles/core-roles.json` (core system roles)
- `config/roles/specialized/testing-roles.json` (specialized roles)
- `config/roles/custom/my-roles.json` (your custom roles)

#### **Role Definition Example**

Edit any JSON file in `config/roles/` to customize AI behavior:

### Multi-Agent Workflows Configuration

Configure complex multi-agent workflows in `config/workflows/`:

#### **Workflow Structure**

```
config/workflows/
├── my_workflow.json          # Workflow configuration
└── my_workflow/              # Workflow scripts directory
    └── script.js             # Custom JavaScript functions
```

#### **Basic Workflow Configuration**

Create `config/workflows/example_workflow.json`:

```json
{
    "workflow_name": "example_workflow",
    "description": "Example multi-agent workflow",
    "input": {
        "name": "user_request",
        "type": "string",
        "description": "User's initial request"
    },
    "output": {
        "name": "final_result",
        "type": "string",
        "description": "Final workflow result"
    },
    "variables": {
        "max_iterations": 5
    },
    "contexts": [
        {
            "name": "shared_context",
            "starting_messages": [],
            "max_length": 30000
        }
    ],
    "agents": [
        {
            "agent_role": "coder",
            "context": "shared_context",
            "role": "assistant"
        },
        {
            "agent_role": "reviewer",
            "context": "shared_context",
            "role": "user"
        }
    ],
    "states": [
        {
            "name": "start",
            "agent": "coder",
            "pre_handler": "setupRequest",
            "post_handler": "captureResponse",
            "transition_handler": "moveToReview"
        },
        {
            "name": "stop",
            "input": "common_data.final_result"
        }
    ]
}
```

#### **Workflow Script Functions**

Create `config/workflows/example_workflow/script.js`:

```javascript
export default {
    // Pre-handler: Setup before API call
    setupRequest() {
        const context = this.workflow_contexts.get('shared_context');
        context.addMessage({
            role: 'user',
            content: this.input,
        });
    },

    // Post-handler: Process API response
    captureResponse() {
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (responseContent) {
            this.common_data.coder_response = responseContent;
        }
    },

    // Transition-handler: Decide next state
    moveToReview() {
        return 'review_state';
    },
};
```

#### **Workflow Execution**

```bash
# List available workflows
/workflows

# Execute workflow
/workflow example_workflow
```

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

- **Required fields**: Ensures `SYNTHDEV_API_KEY` is provided
- **URL validation**: Validates URL formats for all base URLs
- **Range validation**: Ensures `SYNTHDEV_MAX_TOOL_CALLS` is between 1-200
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
SYNTHDEV_VERBOSITY_LEVEL=3
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=true
```

### Production Environment

```env
NODE_ENV=production
DEBUG=false
SYNTHDEV_VERBOSITY_LEVEL=1
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
SYNTHDEV_MAX_TOOL_CALLS=30
```

### Testing Environment

```env
NODE_ENV=test
DEBUG=false
SYNTHDEV_VERBOSITY_LEVEL=0
SYNTHDEV_API_KEY=test-key-for-mocking
```

## Advanced Configuration

### Custom Model Configurations

For specialized use cases:

```env
# Research Model
SYNTHDEV_RESEARCH_API_KEY=your_research_key
SYNTHDEV_RESEARCH_MODEL=gpt-4-research
SYNTHDEV_RESEARCH_BASE_URL=https://api.research.com/v1

# Code Model
SYNTHDEV_CODE_API_KEY=your_code_key
SYNTHDEV_CODE_MODEL=codex-advanced
SYNTHDEV_CODE_BASE_URL=https://api.code.com/v1
```

### Performance Tuning

```env
# Reduce API calls
SYNTHDEV_MAX_TOOL_CALLS=20
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false

# Increase output for debugging
SYNTHDEV_VERBOSITY_LEVEL=5
DEBUG=true

# Optimize for speed
SYNTHDEV_FAST_MODEL=gpt-3.5-turbo
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
const apiKey = process.env.SYNTHDEV_API_KEY;
const maxCalls = parseInt(process.env.SYNTHDEV_MAX_TOOL_CALLS) || 50;
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

_For role-specific configuration, see [AI Roles & Few-Shot Prompting](roles-and-prompting.md)_
