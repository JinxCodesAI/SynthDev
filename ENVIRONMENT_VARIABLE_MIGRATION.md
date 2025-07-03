# Environment Variable Migration to SYNTHDEV\_ Prefix

## Overview

All environment variables in SynthDev have been updated to use the `SYNTHDEV_` prefix to avoid conflicts with other applications and provide better namespace isolation.

## Changed Environment Variables

| Old Name                    | New Name                             |
| --------------------------- | ------------------------------------ |
| `API_KEY`                   | `SYNTHDEV_API_KEY`                   |
| `BASE_MODEL`                | `SYNTHDEV_BASE_MODEL`                |
| `BASE_URL`                  | `SYNTHDEV_BASE_URL`                  |
| `SMART_API_KEY`             | `SYNTHDEV_SMART_API_KEY`             |
| `SMART_MODEL`               | `SYNTHDEV_SMART_MODEL`               |
| `SMART_BASE_URL`            | `SYNTHDEV_SMART_BASE_URL`            |
| `FAST_API_KEY`              | `SYNTHDEV_FAST_API_KEY`              |
| `FAST_MODEL`                | `SYNTHDEV_FAST_MODEL`                |
| `FAST_BASE_URL`             | `SYNTHDEV_FAST_BASE_URL`             |
| `MAX_TOOL_CALLS`            | `SYNTHDEV_MAX_TOOL_CALLS`            |
| `ENABLE_PROMPT_ENHANCEMENT` | `SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT` |
| `VERBOSITY_LEVEL`           | `SYNTHDEV_VERBOSITY_LEVEL`           |

## Files Updated

### Configuration Files

- `config.example.env` - Updated all environment variable names
- `config.example.openrouter.env` - Updated all environment variable names

### Code Files

- `configManager.js` - Updated all `process.env` references

### Docker Configuration

- `docker-compose.yaml` - Updated environment variable mappings for both production and development services

### Documentation Files

- `README.md` - Updated configuration examples
- `docs/README.md` - Updated configuration examples
- `docs/installation.md` - Updated all environment variable references and examples
- `docs/configuration.md` - Updated all environment variable references and examples
- `docs/testing.md` - Updated test environment variable examples

### Test Files

- `tests/unit/core/configManager.test.js` - Updated test environment variable mocks
- `tests/e2e/grocery-store-workflow.test.js` - Updated test environment variables
- `tests/e2e/fixtures/config-validation.json` - Updated error messages and validation references

## Migration Guide for Users

### For Existing Users

If you have an existing `.env` file, you need to update your environment variable names:

**Old `.env` file:**

```env
API_KEY=your_api_key_here
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1
SMART_API_KEY=your_smart_api_key
SMART_MODEL=gpt-4.1-mini
SMART_BASE_URL=https://api.openai.com/v1
FAST_API_KEY=your_fast_api_key
FAST_MODEL=gpt-4.1-nano
FAST_BASE_URL=https://api.openai.com/v1
MAX_TOOL_CALLS=50
ENABLE_PROMPT_ENHANCEMENT=false
VERBOSITY_LEVEL=2
```

**New `.env` file:**

```env
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_SMART_API_KEY=your_smart_api_key
SYNTHDEV_SMART_MODEL=gpt-4.1-mini
SYNTHDEV_SMART_BASE_URL=https://api.openai.com/v1
SYNTHDEV_FAST_API_KEY=your_fast_api_key
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
SYNTHDEV_FAST_BASE_URL=https://api.openai.com/v1
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
SYNTHDEV_VERBOSITY_LEVEL=2
```

### For New Users

Simply copy `config.example.env` to `.env` and update the values. All environment variables now use the `SYNTHDEV_` prefix by default.

## Benefits

1. **Namespace Isolation**: Prevents conflicts with other applications that might use similar environment variable names
2. **Clear Ownership**: Makes it immediately clear which environment variables belong to SynthDev
3. **Better Organization**: Groups all SynthDev-related configuration under a common prefix
4. **Future-Proofing**: Provides a consistent naming convention for any new environment variables

## Backward Compatibility

⚠️ **Breaking Change**: This is a breaking change. The old environment variable names are no longer supported. Users must update their `.env` files to use the new names.

## Testing

All tests have been updated and are passing with the new environment variable names. The test suite includes:

- Unit tests for ConfigManager
- Integration tests for workflow execution
- End-to-end tests for complete workflow scenarios

## Verification

To verify the migration was successful:

1. All tests pass: `npm test`
2. Configuration loads correctly with new environment variables
3. Docker containers start successfully with updated environment mappings
4. Documentation examples use the new variable names consistently
