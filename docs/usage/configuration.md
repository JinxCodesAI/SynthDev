# SynthDev Configuration Guide

## 🚀 Quick Start

1. **[Environment Variables](./configuration/environment-variables.md)** - Set up your API keys and basic settings
2. **[AI Providers](./configuration/providers.md)** - Configure your AI model providers
3. **[AI Roles](./configuration/roles.md)** - Customize AI behavior and personalities

## 📚 Complete Configuration Guide

### Core Configuration

- **[📖 Overview & Getting Started](./configuration/README.md)** - Configuration system overview and quick start
- **[⚙️ Environment Variables](./configuration/environment-variables.md)** - API keys, settings, and environment setup
- **[🤖 AI Providers](./configuration/providers.md)** - Model providers, pricing, and multi-model setup

### Feature Configuration

- **[🎭 AI Roles](./configuration/roles.md)** - AI behavior, personalities, and tool access control
- **[📸 Snapshots](./configuration/snapshots.md)** - Backup system, file filtering, and automatic snapshots
- **[🛠️ Tools and Safety](./configuration/tools.md)** - Tool behavior, security patterns, and safety checks
- **[🎨 User Interface](./configuration/ui.md)** - Console customization, messages, and themes

### Advanced Topics

- **[🔧 Advanced Configuration](./configuration/advanced.md)** - ConfigManager API, custom integrations, and performance
- **[🔍 Troubleshooting](./configuration/troubleshooting.md)** - Common issues, debugging, and solutions

## 🎯 Quick Configuration Examples

### Basic Setup

```env
# Required - Add to your .env file
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

### Multi-Model Setup

```env
# Base model for general tasks
SYNTHDEV_API_KEY=your_openai_key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1

# Smart model for complex reasoning
SYNTHDEV_SMART_API_KEY=your_anthropic_key
SYNTHDEV_SMART_MODEL=claude-sonnet-4-20250514
SYNTHDEV_SMART_BASE_URL=https://api.anthropic.com/v1
```

## 📋 Configuration Areas

SynthDev's configuration system is organized into several key areas:

### 🔧 **System Configuration**

- **Environment Variables**: API keys, model settings, global behavior
- **Application Defaults**: Core system settings and limits
- **Provider Definitions**: AI model specifications and pricing

### 🎭 **AI Behavior**

- **Roles**: AI personalities, system messages, and capabilities
- **Tool Access**: Per-role tool permissions and restrictions
- **Multi-file Organization**: Flexible role file structure

### 🛡️ **Safety & Security**

- **Safety Patterns**: Dangerous command detection
- **AI Safety Checks**: Intelligent code validation
- **Tool Restrictions**: Role-based access control

### 📸 **Data Management**

- **Snapshot System**: Automatic and manual backups
- **File Filtering**: Smart exclusion patterns
- **Storage Management**: Memory and disk usage control

### 🎨 **User Experience**

- **Console Interface**: Customizable prompts and messages
- **Command Help**: Interactive help system
- **Visual Themes**: Colors, formatting, and layout

## 🏗️ Configuration Architecture

```
src/config/
├── defaults/           # System defaults and provider definitions
├── roles/             # AI role definitions (multi-file support)
├── snapshots/         # Snapshot system configuration
├── tools/             # Tool behavior and safety patterns
├── ui/                # User interface customization
├── managers/          # Configuration management classes
└── validation/        # Configuration loading and validation
```

## 🚀 Getting Started

1. **Copy environment template**:

    ```bash
    cp .env.example .env
    ```

2. **Configure your API key**:

    ```env
    SYNTHDEV_API_KEY=your_api_key_here
    SYNTHDEV_BASE_MODEL=gpt-4.1-mini
    SYNTHDEV_BASE_URL=https://api.openai.com/v1
    ```

3. **Choose your configuration focus**:
    - New users: Start with [Environment Variables](./configuration/environment-variables.md)
    - Customization: Jump to [AI Roles](./configuration/roles.md)
    - Advanced users: See [Advanced Configuration](./configuration/advanced.md)

## 💡 Key Features

### 🔄 **Layered Configuration System**

Configuration priority (highest to lowest):

1. Command line arguments
2. Environment variables (`.env` file)
3. Configuration files (`src/config/`)
4. Built-in defaults

### 🎯 **Multi-Model Support**

- **Base Model**: General development tasks
- **Smart Model**: Complex reasoning and analysis
- **Fast Model**: Quick, simple operations

### 🔒 **Advanced Security**

- AI-powered safety checks
- Pattern-based threat detection
- Role-based tool restrictions
- Configurable security levels

### 📁 **Flexible Organization**

- Multi-file role definitions
- Hierarchical configuration structure
- Automatic file discovery
- Backward compatibility

## 🔗 Related Documentation

- **[Installation Guide](../installation.md)** - Set up SynthDev
- **[Usage Guide](../usage.md)** - Basic usage patterns
- **[API Reference](../api/)** - Detailed API documentation
- **[Examples](../examples/)** - Configuration examples and templates

## 🆘 Need Help?

- **Quick Issues**: Check [Troubleshooting](./configuration/troubleshooting.md)
- **Environment Setup**: See [Environment Variables](./configuration/environment-variables.md)
- **Advanced Usage**: Review [Advanced Configuration](./configuration/advanced.md)
- **Community**: Join discussions on GitHub

---

**Ready to configure SynthDev?** Start with the [📖 Configuration Overview](./configuration/README.md) or jump directly to [⚙️ Environment Variables](./configuration/environment-variables.md) to get up and running quickly.
