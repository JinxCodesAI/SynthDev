# Configuration Troubleshooting

This guide helps you diagnose and resolve common configuration issues in SynthDev. Use this reference when encountering problems with environment variables, configuration files, or system behavior.

## Quick Diagnostics

### Check Configuration Status

```bash
# Enable verbose logging to see configuration loading
SYNTHDEV_VERBOSITY_LEVEL=3 synthdev

# Check if configuration files exist
ls -la src/config/
ls -la src/config/roles/
ls -la src/config/snapshots/

# Validate JSON syntax
jq . src/config/roles/core.json
jq . src/config/defaults/application.json
```

### Environment Variable Check

```bash
# Check if required variables are set
echo $SYNTHDEV_API_KEY
echo $SYNTHDEV_BASE_MODEL
echo $SYNTHDEV_BASE_URL

# Show all SynthDev environment variables
env | grep SYNTHDEV
```

## Common Issues and Solutions

### API Key and Authentication

#### Missing API Key

**Error**: `Configuration error: SYNTHDEV_API_KEY is required`

**Solution**:

```bash
# Add API key to .env file
echo "SYNTHDEV_API_KEY=your_api_key_here" >> .env

# Or set environment variable
export SYNTHDEV_API_KEY=your_api_key_here
```

#### Invalid API Key Format

**Error**: `Authentication failed: Invalid API key format`

**Solutions**:

- **OpenAI**: Keys start with `sk-`
- **Anthropic**: Keys start with `sk-ant-`
- **Google**: Keys are typically 39 characters
- **XAI**: Keys start with `xai-`

```bash
# Check key format
echo $SYNTHDEV_API_KEY | head -c 10
```

#### API Key Permissions

**Error**: `403 Forbidden` or `Insufficient permissions`

**Solutions**:

1. Verify API key has correct permissions
2. Check billing status and usage limits
3. Ensure key is for the correct organization
4. Try a different model if current one requires special access

### Model Configuration

#### Invalid Model Name

**Error**: `Model not found: invalid-model-name`

**Solution**:

```bash
# Check available models in providers.json
jq '.providers[].models[].name' src/config/defaults/providers.json

# Common valid models:
# OpenAI: gpt-4.1-mini, gpt-4.1, gpt-4o-mini
# Anthropic: claude-sonnet-4-20250514, claude-3-5-haiku-20241022
# Google: gemini-2.5-flash, gemini-2.5-pro
```

#### URL Format Issues

**Error**: `Invalid SYNTHDEV_BASE_URL format`

**Solution**:

```bash
# Ensure URL includes protocol
SYNTHDEV_BASE_URL=https://api.openai.com/v1  # ✅ Correct
SYNTHDEV_BASE_URL=api.openai.com/v1          # ❌ Missing protocol

# Common correct URLs:
# OpenAI: https://api.openai.com/v1
# Anthropic: https://api.anthropic.com/v1
# Google: https://generativelanguage.googleapis.com/v1beta/openai/
# OpenRouter: https://openrouter.ai/api/v1
```

### Configuration File Issues

#### Missing Configuration Files

**Error**: `Failed to load required configuration: file not found`

**Solution**:

```bash
# Check if all required files exist
find src/config -name "*.json" -type f

# Restore missing files from backup or repository
git checkout HEAD -- src/config/

# Or copy from examples if available
cp src/config/examples/roles.json src/config/roles/
```

#### JSON Syntax Errors

**Error**: `Unexpected token in JSON at position X`

**Solution**:

```bash
# Validate JSON syntax
jq . src/config/roles/core.json

# Common JSON issues:
# - Missing commas between objects
# - Trailing commas (not allowed in JSON)
# - Unescaped quotes in strings
# - Missing closing brackets/braces

# Fix example:
# ❌ { "role": "test", }  # Trailing comma
# ✅ { "role": "test" }   # Correct
```

#### File Permissions

**Error**: `EACCES: permission denied`

**Solution**:

```bash
# Fix file permissions
chmod 644 src/config/**/*.json
chmod 755 src/config/

# Check current permissions
ls -la src/config/
```

### Role Configuration Issues

#### Role Not Found

**Error**: `Role 'my-role' not found`

**Solutions**:

1. Check role name spelling
2. Verify role file is in correct location
3. Check JSON syntax in role file

```bash
# List available roles
grep -r "\".*\":" src/config/roles/ | grep -v "_"

# Check specific role file
jq 'keys' src/config/roles/core.json
```

#### Tool Access Issues

**Error**: `Tool 'execute_script' not available for role 'restricted-role'`

**Solution**:

```json
// Check role configuration
{
    "restricted-role": {
        "excludedTools": ["execute_script"], // Remove this line
        // or use includedTools instead
        "includedTools": ["read_file", "write_file", "execute_script"]
    }
}
```

### Environment Variable Issues

#### Tool Call Limit Errors

**Error**: `SYNTHDEV_MAX_TOOL_CALLS must be between 1 and 200`

**Solution**:

```bash
# Set valid value
export SYNTHDEV_MAX_TOOL_CALLS=50

# Or in .env file
echo "SYNTHDEV_MAX_TOOL_CALLS=50" >> .env
```

#### Verbosity Level Issues

**Error**: `Invalid verbosity level: X`

**Solution**:

```bash
# Valid range is 0-5
export SYNTHDEV_VERBOSITY_LEVEL=2

# Levels:
# 0: Silent
# 1: Basic status
# 2: Standard (default)
# 3: Detailed
# 4: Verbose
# 5: Debug
```

### Snapshot Configuration Issues

#### Memory Limit Exceeded

**Error**: `Snapshot memory limit exceeded`

**Solution**:

```json
// Increase memory limit in snapshot-defaults.json
{
    "storage": {
        "maxMemoryMB": 200, // Increase from 100
        "maxSnapshots": 30 // Or reduce snapshot count
    }
}
```

#### File Filtering Issues

**Error**: `No files included in snapshot`

**Solution**:

```json
// Check exclusion patterns in file-filters.json
{
    "customExclusions": [
        // Remove overly broad patterns
        // "**/*"  // This would exclude everything!
        "node_modules/**",
        ".git/**"
    ]
}
```

### Provider-Specific Issues

#### OpenAI Issues

```bash
# Check OpenAI status
curl -H "Authorization: Bearer $SYNTHDEV_API_KEY" \
     https://api.openai.com/v1/models

# Common issues:
# - Rate limiting: Wait and retry
# - Billing: Check account status
# - Model access: Some models require special access
```

#### Anthropic Issues

```bash
# Check Anthropic API
curl -H "x-api-key: $SYNTHDEV_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     https://api.anthropic.com/v1/messages

# Common issues:
# - API version header required
# - Different authentication header (x-api-key)
```

#### Google AI Issues

```bash
# Check Google AI API
curl -H "Authorization: Bearer $SYNTHDEV_API_KEY" \
     https://generativelanguage.googleapis.com/v1beta/models

# Common issues:
# - API key format different from others
# - Requires specific base URL path
```

## Debug Techniques

### Enable Debug Logging

```bash
# Maximum verbosity
export SYNTHDEV_VERBOSITY_LEVEL=5
export DEBUG=true

# Run with debug output
synthdev --verbose
```

### Configuration Validation

```javascript
// Test configuration loading
node -e "
const ConfigManager = require('./src/config/managers/configManager.js');
const config = ConfigManager.getInstance();
config.initialize().then(() => {
  console.log('Configuration loaded successfully');
  console.log('Base model:', config.getModel('base'));
}).catch(err => {
  console.error('Configuration error:', err.message);
});
"
```

### Check File Loading

```bash
# Check which configuration files are being loaded
grep -r "Loaded.*from" logs/ | grep config

# Check for configuration errors
grep -r "Failed to load" logs/ | grep config
```

## Performance Issues

### Slow Startup

**Symptoms**: SynthDev takes long time to start

**Solutions**:

1. Reduce number of role files
2. Simplify complex role configurations
3. Check file system performance
4. Disable unnecessary features

```bash
# Profile startup time
time synthdev --help

# Check file access times
strace -e trace=openat synthdev 2>&1 | grep config
```

### Memory Usage

**Symptoms**: High memory consumption

**Solutions**:

1. Reduce snapshot memory limits
2. Limit role configuration size
3. Clear configuration cache periodically

```json
// Optimize memory usage
{
    "storage": {
        "maxMemoryMB": 50,
        "maxSnapshots": 20
    }
}
```

## Recovery Procedures

### Reset to Defaults

```bash
# Backup current configuration
cp -r src/config src/config.backup

# Reset to repository defaults
git checkout HEAD -- src/config/

# Or restore from clean installation
```

### Minimal Configuration

```bash
# Create minimal .env for testing
cat > .env.minimal << EOF
SYNTHDEV_API_KEY=your_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=3
EOF

# Test with minimal config
mv .env .env.backup
mv .env.minimal .env
synthdev --help
```

### Configuration Validation Script

```bash
#!/bin/bash
# validate-config.sh

echo "Validating SynthDev configuration..."

# Check environment variables
if [ -z "$SYNTHDEV_API_KEY" ]; then
  echo "❌ SYNTHDEV_API_KEY not set"
  exit 1
fi

# Check configuration files
for file in src/config/defaults/application.json src/config/roles/core.json; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    exit 1
  fi

  if ! jq . "$file" > /dev/null 2>&1; then
    echo "❌ Invalid JSON: $file"
    exit 1
  fi
done

echo "✅ Configuration validation passed"
```

## Getting Help

### Log Analysis

```bash
# Check recent errors
tail -n 100 logs/synthdev.log | grep -i error

# Check configuration loading
grep "configuration" logs/synthdev.log

# Check API calls
grep -i "api\|http" logs/synthdev.log
```

### System Information

```bash
# Gather system info for support
echo "SynthDev Version: $(synthdev --version)"
echo "Node.js Version: $(node --version)"
echo "OS: $(uname -a)"
echo "Config files:"
find src/config -name "*.json" -exec wc -l {} \;
```

### Community Resources

- Check GitHub issues for similar problems
- Review documentation for recent changes
- Join community discussions for help
- Report bugs with detailed error messages

## Prevention

### Best Practices

1. **Version control**: Keep configuration files in git
2. **Validation**: Test configuration changes in development
3. **Backups**: Regular backups of working configurations
4. **Monitoring**: Watch for configuration-related errors
5. **Documentation**: Document custom configurations

### Regular Maintenance

```bash
# Weekly configuration health check
./scripts/validate-config.sh

# Monthly cleanup
find logs/ -name "*.log" -mtime +30 -delete

# Quarterly review
git log --oneline src/config/ | head -20
```
