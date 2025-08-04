# SynthDev Configuration Guide

SynthDev is designed to be maximally configurable, allowing users to customize every aspect of the system to their specific needs. This comprehensive guide covers all configuration options available in SynthDev.

## Quick Start

1. **Environment Setup**: Copy `.env.example` to `.env` and configure your API keys
2. **Choose Your Provider**: Configure AI model providers in your `.env` file
3. **Customize Roles**: Modify AI behavior through role configurations
4. **Configure Tools**: Set up tool safety and behavior settings
5. **Adjust UI**: Customize the user interface to your preferences

## Configuration System Overview

SynthDev uses a layered configuration system with clear priority order:

1. **Built-in defaults** (lowest priority)
2. **Configuration files** (`src/config/` directory)
3. **Environment variables** (`.env` file)
4. **Command line arguments** (highest priority)

## Configuration Aspects

### 🤖 [AI Providers](./providers.md)

Configure AI model providers, API endpoints, and model-specific settings:

- OpenAI, Anthropic, Google, XAI, OpenRouter support
- Multi-model setup (base, smart, fast models)
- Provider-specific parameters and pricing
- Custom provider configuration

### 🎭 [AI Roles](./roles.md)

Define AI behavior, personalities, and capabilities:

- System messages and instructions
- Tool access control per role
- Multi-file role organization
- Few-shot prompting examples
- Role groups and hierarchies

### 📸 [Snapshots](./snapshots.md)

Configure the advanced snapshot system:

- Manual and automatic snapshot creation
- File filtering and exclusion patterns
- Storage and memory management
- Backup and restore behavior
- Performance optimization

### 🛠️ [Tools and Safety](./tools.md)

Control tool behavior and security:

- Tool safety patterns and validation
- Execution limits and timeouts
- Security pattern matching
- Tool-specific configurations
- AI safety checks

### 🎨 [User Interface](./ui.md)

Customize the console interface:

- Startup messages and banners
- Command prompts and feedback
- Color schemes and formatting
- Help text and descriptions
- Status indicators

### ⚙️ [Environment Variables](./environment-variables.md)

Configure core system settings:

- API keys and endpoints
- Global behavior settings
- Verbosity and debugging
- Performance tuning
- Development options

### 🔧 [Advanced Configuration](./advanced.md)

Deep customization options:

- ConfigManager API usage
- Custom configuration loading
- Validation and error handling
- Hot reloading configurations
- Integration patterns

### 🔍 [Troubleshooting](./troubleshooting.md)

Common configuration issues and solutions:

- API key problems
- Model configuration errors
- File permission issues
- Performance optimization
- Debug techniques

## Configuration Files Structure

```
src/config/
├── defaults/                    # Application defaults
│   ├── application.json         # Core settings and limits
│   ├── providers.json          # AI provider definitions
│   └── environment-template.json # Environment info template
├── roles/                       # AI role definitions
│   ├── core.json               # Core system roles
│   ├── agentic/                # Agentic workflow roles
│   ├── specialized/            # Specialized roles
│   └── internal/               # Internal system roles
├── snapshots/                   # Snapshot system config
│   ├── snapshot-defaults.json  # Core snapshot settings
│   ├── auto-snapshot-defaults.json # Automatic snapshots
│   ├── file-filters.json      # File filtering patterns
│   └── snapshot-messages.json # UI messages
├── tools/                       # Tool configuration
│   ├── tool-messages.json      # Tool descriptions and errors
│   └── safety-patterns.json    # Security patterns
├── ui/                         # User interface text
│   ├── console-messages.json   # Console messages
│   └── command-help.json       # Command help text
└── validation/                 # Configuration validation
    ├── configurationLoader.js  # Configuration loading
    ├── configurationValidator.js # Validation logic
    └── config-validation.json  # Validation rules
```

## Key Features

### 🔄 **Hot Reloading**

Most configuration changes can be applied without restarting:

```javascript
// Reload specific configuration
ConfigurationLoader.reloadConfig('roles/my-roles.json');

// Reload all configurations
await configManager.reloadConfiguration();
```

### 🎯 **Multi-File Support**

Organize configurations across multiple files:

- Roles can be split across multiple JSON files
- Automatic discovery and merging
- Group-based organization
- Backward compatibility maintained

### ✅ **Validation**

All configurations are validated on startup:

- Schema validation for all config files
- Type checking and required fields
- Clear error messages for issues
- Fallback to safe defaults when possible

### 🚀 **Performance**

Optimized for production use:

- Configuration caching
- Lazy loading of optional configs
- Memory-efficient storage
- Fast startup times

## Best Practices

1. **Environment Separation**: Use different `.env` files for different environments
2. **Security**: Never commit `.env` files to version control
3. **Validation**: Always test configuration changes in development first
4. **Documentation**: Document custom configuration options
5. **Backup**: Keep backups of working configurations
6. **Monitoring**: Use verbosity levels to monitor configuration loading

## Getting Help

- Check the [Troubleshooting Guide](./troubleshooting.md) for common issues
- Review configuration file examples in `src/config/`
- Use verbosity level 3+ to see detailed configuration loading
- Examine the ConfigManager API for programmatic access

---

**Next Steps**: Choose a configuration aspect from the list above to dive deeper into customizing SynthDev for your needs.
