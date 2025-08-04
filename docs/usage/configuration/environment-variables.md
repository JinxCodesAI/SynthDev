# Environment Variables Configuration

Environment variables provide the primary way to configure SynthDev's core behavior, API connections, and runtime settings. They are loaded from your `.env` file and take precedence over configuration files.

## Quick Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your preferred text editor:
   ```bash
   nano .env  # or vim, code, etc.
   ```

3. Configure at minimum the required variables (see below)

## Required Configuration

### Base Model (Required)
Every SynthDev installation requires at least one AI model configured:

```env
# Base Model - Always Required
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

## Multi-Model Setup

SynthDev supports up to three model tiers for different use cases:

### Smart Model (Optional)
For complex reasoning tasks:
```env
SYNTHDEV_SMART_API_KEY=your_smart_api_key
SYNTHDEV_SMART_MODEL=gpt-4.1
SYNTHDEV_SMART_BASE_URL=https://api.openai.com/v1
```

### Fast Model (Optional)
For quick, simple tasks:
```env
SYNTHDEV_FAST_API_KEY=your_fast_api_key
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
SYNTHDEV_FAST_BASE_URL=https://api.openai.com/v1
```

## Application Settings

### Tool Execution
```env
# Maximum number of tool calls per conversation
SYNTHDEV_MAX_TOOL_CALLS=50              # Range: 1-200, Default: 50

# Enable AI prompt enhancement
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false # true/false, Default: false
```

### Output Control
```env
# Control output verbosity
SYNTHDEV_VERBOSITY_LEVEL=2              # Range: 0-5, Default: 2
```

### Development Settings
```env
# Environment mode
NODE_ENV=development                    # development/production/test

# Debug mode
DEBUG=false                            # true/false, Default: false
```

## Verbosity Levels

Control how much information SynthDev displays:

| Level | Description | What You See |
|-------|-------------|--------------|
| **0** | Silent | Only user messages and critical errors |
| **1** | Basic | + Status messages (🔄 Enhancing prompt..., 🧠 AI thinking...) |
| **2** | Standard | + Compressed tool arguments (default) |
| **3** | Detailed | + Uncompressed tool arguments and debug messages |
| **4** | Verbose | + Tool execution results |
| **5** | Debug | + Complete HTTP request/response logging |

**Recommendation**: Use level 2 for normal use, level 3+ for troubleshooting.

## Provider Configuration

See [AI Providers Configuration](./providers.md) for detailed provider setup instructions.

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
DEBUG=true
SYNTHDEV_VERBOSITY_LEVEL=3
SYNTHDEV_MAX_TOOL_CALLS=100
```

### Production
```env
NODE_ENV=production
DEBUG=false
SYNTHDEV_VERBOSITY_LEVEL=1
SYNTHDEV_MAX_TOOL_CALLS=50
```

### Testing
```env
NODE_ENV=test
DEBUG=false
SYNTHDEV_VERBOSITY_LEVEL=0
SYNTHDEV_MAX_TOOL_CALLS=10
```

## Security Best Practices

### API Key Management
- **Never commit** `.env` files to version control
- Use different API keys for different environments
- Rotate API keys regularly
- Use environment-specific key restrictions when available

### File Permissions
```bash
# Secure your .env file
chmod 600 .env
```

### Environment Separation
```bash
# Use different files for different environments
.env.development
.env.production
.env.test
```

## Variable Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SYNTHDEV_API_KEY` | string | *required* | API key for base model |
| `SYNTHDEV_BASE_MODEL` | string | gpt-4.1-mini | Base model name |
| `SYNTHDEV_BASE_URL` | string | https://api.openai.com/v1 | Base model API URL |
| `SYNTHDEV_SMART_API_KEY` | string | *optional* | API key for smart model |
| `SYNTHDEV_SMART_MODEL` | string | *optional* | Smart model name |
| `SYNTHDEV_SMART_BASE_URL` | string | *optional* | Smart model API URL |
| `SYNTHDEV_FAST_API_KEY` | string | *optional* | API key for fast model |
| `SYNTHDEV_FAST_MODEL` | string | *optional* | Fast model name |
| `SYNTHDEV_FAST_BASE_URL` | string | *optional* | Fast model API URL |
| `SYNTHDEV_MAX_TOOL_CALLS` | number | 50 | Maximum tool calls (1-200) |
| `SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT` | boolean | false | Enable prompt enhancement |
| `SYNTHDEV_VERBOSITY_LEVEL` | number | 2 | Output verbosity (0-5) |
| `NODE_ENV` | string | development | Environment mode |
| `DEBUG` | boolean | false | Debug mode |

## Validation

SynthDev validates all environment variables on startup:

- **Required variables** must be present
- **URLs** must be valid HTTP/HTTPS endpoints
- **Numbers** must be within specified ranges
- **Booleans** must be 'true' or 'false'

Invalid configurations will prevent SynthDev from starting with clear error messages.

## Next Steps

- [Configure AI Providers](./providers.md) - Detailed provider setup
- [Troubleshooting](./troubleshooting.md) - Common environment variable issues
- [Advanced Configuration](./advanced.md) - Programmatic configuration access
