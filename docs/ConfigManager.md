# ConfigManager Documentation

## Overview

The `ConfigManager` class is a singleton that centralizes all application configuration management. It loads environment variables from `.env` files, validates them, and provides a clean API for accessing configuration values throughout the application.

## Features

- **Singleton Pattern**: Ensures only one instance exists across the application
- **Environment Variable Loading**: Automatically loads and parses environment variables
- **Configuration Validation**: Validates required settings and formats
- **Type Safety**: Provides proper type conversion (e.g., string to boolean/number)
- **Organized Access**: Groups configuration by purpose (base, smart, fast models)
- **Error Handling**: Clear error messages for missing or invalid configuration

## Usage

### Basic Usage

```javascript
import ConfigManager from './configManager.js';

// Get the singleton instance
const config = ConfigManager.getInstance();

// Access model configurations
const baseModel = config.getModel('base');
const smartModel = config.getModel('smart');
const fastModel = config.getModel('fast');

// Access global settings
const globalConfig = config.getConfig().global;
```

### In Class Constructors

```javascript
class MyService {
    constructor() {
        this.config = ConfigManager.getInstance();
        const baseModel = this.config.getModel('base');
        this.apiKey = baseModel.apiKey;
        this.maxRetries = this.config.getConfig().global.maxToolCalls;
    }
}
```

## Configuration Sections

### Base Model Configuration (Required)

- `getModel('base')` returns:
    - `apiKey` - API key (required)
    - `baseModel` - Model name (default: default-model)
    - `baseUrl` - Provider base URL (default: https://api.example.com/v1)

### Smart Model Configuration (Optional)

- `getModel('smart')` returns:
    - `apiKey` - Smart model API key (fallback to base API key)
    - `model` - Smart model name (fallback to base model)
    - `baseUrl` - Smart model base URL (fallback to base URL)
- `hasSmartModelConfig()` - Check if smart model is configured

### Fast Model Configuration (Optional)

- `getModel('fast')` returns:
    - `apiKey` - Fast model API key (fallback to base API key)
    - `model` - Fast model name (fallback to base model)
    - `baseUrl` - Fast model base URL (fallback to base URL)
- `hasFastModelConfig()` - Check if fast model is configured

### Global Settings

- `getConfig().global` returns:
    - `maxToolCalls` - Maximum tool calls per interaction (1-200)
    - `environment` - Application environment (development/production/test)
    - `debug` - Debug mode flag

### Utility Methods

- `getConfig()` - Get complete configuration object
- `hasSmartModelConfig()` - Check if smart model is configured
- `hasFastModelConfig()` - Check if fast model is configured

## Environment Variables

### Required Variables

```bash

```

### Optional Variables

````bash
# Base Model Configuration (defaults in configManager.js)
# BASE_MODEL=default-model
# BASE_URL=https://api.example.com/v1

# Smart Model Configuration (defaults in configManager.js)
# SMART_API_KEY=your_smart_model_api_key
# SMART_MODEL=smart-model
# SMART_BASE_URL=https://api.example.com/v1

# Fast Model Configuration (defaults in configManager.js)
# FAST_API_KEY=your_fast_model_api_key
# FAST_MODEL=fast-model
# FAST_BASE_URL=https://api.example.com/v1

# Global Settings


## Setup Instructions

1. **Copy the template**:
   ```bash
   cp env.template .env
````

2. **Configure your API keys**:
   Edit `.env` and add your actual API keys

3. **Import and use**:
    ```javascript
    import ConfigManager from './configManager.js';
    const config = ConfigManager.getInstance();
    ```

## Validation

The ConfigManager validates configuration on startup:

- **Required fields**: Ensures `API_KEY` is provided
- **URL validation**: Validates URL formats for all base URLs
- **Range validation**: Ensures `MAX_TOOL_CALLS` is between 1-200
- **Type validation**: Converts strings to appropriate types (boolean, number)

## Error Handling

If configuration validation fails, the ConfigManager throws a descriptive error:

```javascript
try {
    const config = ConfigManager.getInstance();
} catch (error) {
    console.error('Configuration error:', error.message);
    // Handle configuration errors appropriately
}
```

## Best Practices

1. **Single Instance**: Always use `ConfigManager.getInstance()` to get the singleton
2. **Early Initialization**: Initialize ConfigManager at application startup
3. **Error Handling**: Always wrap ConfigManager usage in try-catch blocks
4. **Environment Separation**: Use different `.env` files for different environments
5. **Security**: Never commit `.env` files to version control

## Migration from Direct `process.env` Usage

### Before (Direct Environment Access)

```javascript
// ❌ Old way - direct environment variable access
const apiKey = process.env.API_KEY;
const maxCalls = parseInt(process.env.MAX_TOOL_CALLS) || 50;
const baseUrl = process.env.BASE_URL || 'https://api.example.com/v1';
```

### After (ConfigManager)

```javascript
// ✅ New way - using ConfigManager
const config = ConfigManager.getInstance();
const baseModel = config.getModel('base');
const apiKey = baseModel.apiKey;
const maxCalls = config.getConfig().global.maxToolCalls;
const baseUrl = baseModel.baseUrl;
```

## Examples

### Basic Model Access

```javascript
const config = ConfigManager.getInstance();

// Use base model
const base = config.getModel('base');
console.log(`Using base model: ${base.baseModel} with ${base.baseUrl}`);

// Use smart model if available
if (config.hasSmartModelConfig()) {
    const smart = config.getModel('smart');
    console.log(`Smart model: ${smart.model}`);
}

// Use fast model if available
if (config.hasFastModelConfig()) {
    const fast = config.getModel('fast');
    console.log(`Fast model: ${fast.model}`);
}
```
