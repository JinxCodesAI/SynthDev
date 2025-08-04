# Advanced Configuration

This guide covers advanced configuration techniques, programmatic access to the configuration system, custom integrations, and deep customization options for power users and developers.

## ConfigManager API

### Basic Usage

```javascript
import ConfigManager from './src/config/managers/configManager.js';

// Get singleton instance
const config = ConfigManager.getInstance();

// Initialize and validate (required)
await config.initialize();

// Access configurations
const baseModel = config.getModel('base');
const globalSettings = config.getConfig().global;
```

### Model Configuration Access

```javascript
// Check model availability
if (config.hasSmartModelConfig()) {
    const smartModel = config.getModel('smart');
    console.log(`Smart model: ${smartModel.model}`);
}

// Get all available models
const models = {
    base: config.getModel('base'),
    smart: config.hasSmartModelConfig() ? config.getModel('smart') : null,
    fast: config.hasFastModelConfig() ? config.getModel('fast') : null,
};

// Access provider information
const providers = config.getProvidersConfig();
```

### Configuration Reloading

```javascript
// Reload all configurations
await config.reloadConfiguration();

// Reload specific configuration files
const loader = getConfigurationLoader();
loader.reloadConfig('roles/my-roles.json');
loader.clearCache(); // Clear all cached configs
```

## Configuration Managers

### ToolConfigManager

```javascript
import { getToolConfigManager } from './src/config/managers/toolConfigManager.js';

const toolConfig = getToolConfigManager();

// Get safety patterns
const safetyPrompt = toolConfig.getSafetyPrompt(scriptContent);
const dangerousPatterns = toolConfig.getDangerousPatterns();

// Get tool messages
const errorMessage = toolConfig.getErrorMessage('file_not_found', { filename: 'test.js' });
const toolDescription = toolConfig.getToolDescription('execute_script');

// Validate scripts
const isScriptSafe = await toolConfig.validateScript(scriptContent);
```

### UIConfigManager

```javascript
import { getUIConfigManager } from './src/config/managers/uiConfigManager.js';

const uiConfig = getUIConfigManager();

// Get UI messages
const startupTitle = uiConfig.getMessage('startup.title');
const userPrompt = uiConfig.getMessage('prompts.user_input');

// Get command help
const helpText = uiConfig.getCommandHelp('snapshot');
const allCommands = uiConfig.getCommandHelp();

// Get startup configuration
const startupMessages = uiConfig.getStartupMessages();
```

### SnapshotConfigManager

```javascript
import { getSnapshotConfigManager } from './src/config/managers/snapshotConfigManager.js';

const snapshotConfig = getSnapshotConfigManager();

// Get snapshot configuration
const config = snapshotConfig.getConfig();
const fileFilters = snapshotConfig.getFileFilters();

// Check file exclusions
const isExcluded = snapshotConfig.isFileExcluded('/path/to/file.js');
const exclusionPatterns = snapshotConfig.getExclusionPatterns();
```

## Custom Configuration Loading

### ConfigurationLoader API

```javascript
import { getConfigurationLoader } from './src/config/validation/configurationLoader.js';

const loader = getConfigurationLoader();

// Load custom configuration
const customConfig = loader.loadConfig('custom/my-config.json', defaultValues, true);

// Load multiple configurations
const configs = loader.loadConfigs([
    { path: 'custom/config1.json', required: true },
    { path: 'custom/config2.json', default: {}, required: false },
]);

// Scan for configuration files
const jsonFiles = loader.scanDirectoryForJsonFiles('custom');

// Check if configuration exists
if (loader.configExists('custom/optional-config.json')) {
    const optionalConfig = loader.loadConfig('custom/optional-config.json');
}
```

### Role Loading

```javascript
// Load roles from custom directory
const roleData = loader.loadRolesFromDirectory('custom-roles');
const { roles, roleGroups } = roleData;

// Access loaded roles
const myRole = roles['custom.my_role'];
const globalRoles = roleGroups['global'];
```

## Custom Validation

### Configuration Validation

```javascript
import { getConfigurationValidator } from './src/config/validation/configurationValidator.js';

const validator = getConfigurationValidator();

// Validate configuration object
const validationResult = validator.validateConfig(configObject, 'roles');
if (!validationResult.valid) {
    console.error('Validation errors:', validationResult.errors);
}

// Custom validation rules
const customRules = {
    type: 'object',
    properties: {
        customField: { type: 'string', minLength: 1 },
    },
    required: ['customField'],
};

const result = validator.validateAgainstSchema(data, customRules);
```

### Schema Extension

```javascript
// Extend validation schema
const extendedSchema = {
    ...baseSchema,
    properties: {
        ...baseSchema.properties,
        customProperty: {
            type: 'string',
            enum: ['option1', 'option2', 'option3'],
        },
    },
};
```

## Environment Integration

### Custom Environment Variables

```javascript
// Access environment with fallbacks
const customSetting =
    process.env.SYNTHDEV_CUSTOM_SETTING || config.getConfig().custom?.setting || 'default_value';

// Validate custom environment variables
const requiredEnvVars = ['CUSTOM_API_KEY', 'CUSTOM_ENDPOINT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
```

### Dynamic Configuration

```javascript
// Load configuration based on environment
const envConfig =
    process.env.NODE_ENV === 'production'
        ? loader.loadConfig('environments/production.json')
        : loader.loadConfig('environments/development.json');

// Merge with base configuration
const finalConfig = {
    ...baseConfig,
    ...envConfig,
    // Environment-specific overrides
    logging: {
        ...baseConfig.logging,
        level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    },
};
```

## Plugin System Integration

### Configuration Plugins

```javascript
class ConfigurationPlugin {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
    }

    // Load plugin-specific configuration
    loadConfig() {
        const loader = getConfigurationLoader();
        return loader.loadConfig(`plugins/${this.name}.json`, this.getDefaults());
    }

    // Provide default configuration
    getDefaults() {
        return {
            enabled: true,
            settings: {},
        };
    }

    // Validate plugin configuration
    validateConfig(config) {
        // Custom validation logic
        return { valid: true, errors: [] };
    }
}

// Register plugin
const myPlugin = new ConfigurationPlugin('my-plugin', { version: '1.0.0' });
const pluginConfig = myPlugin.loadConfig();
```

### Dynamic Tool Registration

```javascript
// Register custom tools with configuration
class CustomToolRegistry {
    constructor() {
        this.tools = new Map();
        this.config = getToolConfigManager();
    }

    registerTool(name, toolClass, config = {}) {
        // Load tool-specific configuration
        const toolConfig = {
            ...this.getDefaultToolConfig(),
            ...config,
            ...this.loadToolConfig(name),
        };

        // Validate tool configuration
        this.validateToolConfig(toolConfig);

        // Register tool
        this.tools.set(name, {
            class: toolClass,
            config: toolConfig,
        });
    }

    loadToolConfig(toolName) {
        const loader = getConfigurationLoader();
        try {
            return loader.loadConfig(`tools/custom/${toolName}.json`);
        } catch (error) {
            return {};
        }
    }
}
```

## Performance Optimization

### Configuration Caching

```javascript
class ConfigurationCache {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map();
        this.defaultTTL = 300000; // 5 minutes
    }

    get(key, loader, ttl = this.defaultTTL) {
        const now = Date.now();

        // Check if cached and not expired
        if (this.cache.has(key) && this.ttl.get(key) > now) {
            return this.cache.get(key);
        }

        // Load fresh configuration
        const config = loader();
        this.cache.set(key, config);
        this.ttl.set(key, now + ttl);

        return config;
    }

    invalidate(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
    }

    clear() {
        this.cache.clear();
        this.ttl.clear();
    }
}

// Usage
const configCache = new ConfigurationCache();
const cachedConfig = configCache.get('roles', () => loader.loadRolesFromDirectory('roles'));
```

### Lazy Loading

```javascript
class LazyConfigurationManager {
    constructor() {
        this.configs = new Map();
        this.loaders = new Map();
    }

    registerLoader(key, loaderFunction) {
        this.loaders.set(key, loaderFunction);
    }

    getConfig(key) {
        if (!this.configs.has(key)) {
            const loader = this.loaders.get(key);
            if (!loader) {
                throw new Error(`No loader registered for config: ${key}`);
            }
            this.configs.set(key, loader());
        }
        return this.configs.get(key);
    }
}

// Usage
const lazyConfig = new LazyConfigurationManager();
lazyConfig.registerLoader('heavy-config', () => loader.loadConfig('heavy/expensive-config.json'));

// Config is only loaded when first accessed
const heavyConfig = lazyConfig.getConfig('heavy-config');
```

## Configuration Monitoring

### Change Detection

```javascript
import { watch } from 'fs';

class ConfigurationWatcher {
    constructor(configManager) {
        this.configManager = configManager;
        this.watchers = new Map();
    }

    watchFile(filePath, callback) {
        const watcher = watch(filePath, (eventType, filename) => {
            if (eventType === 'change') {
                console.log(`Configuration file changed: ${filename}`);
                callback(filePath);
            }
        });

        this.watchers.set(filePath, watcher);
    }

    watchConfigDirectory() {
        const configDir = loader.getConfigDir();
        this.watchFile(configDir, async changedPath => {
            // Reload configuration
            await this.configManager.reloadConfiguration();
            console.log('Configuration reloaded due to file change');
        });
    }

    stopWatching() {
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
    }
}
```

### Configuration Metrics

```javascript
class ConfigurationMetrics {
    constructor() {
        this.metrics = {
            loadTimes: new Map(),
            accessCounts: new Map(),
            errorCounts: new Map(),
        };
    }

    recordLoadTime(configKey, duration) {
        if (!this.metrics.loadTimes.has(configKey)) {
            this.metrics.loadTimes.set(configKey, []);
        }
        this.metrics.loadTimes.get(configKey).push(duration);
    }

    recordAccess(configKey) {
        const count = this.metrics.accessCounts.get(configKey) || 0;
        this.metrics.accessCounts.set(configKey, count + 1);
    }

    recordError(configKey, error) {
        const count = this.metrics.errorCounts.get(configKey) || 0;
        this.metrics.errorCounts.set(configKey, count + 1);
    }

    getReport() {
        return {
            averageLoadTimes: this.calculateAverageLoadTimes(),
            mostAccessedConfigs: this.getMostAccessed(),
            errorRates: this.calculateErrorRates(),
        };
    }
}
```

## Testing Configuration

### Configuration Testing

```javascript
import { jest } from '@jest/globals';

describe('Configuration System', () => {
    let configManager;
    let mockLoader;

    beforeEach(() => {
        // Mock configuration loader
        mockLoader = {
            loadConfig: jest.fn(),
            loadRolesFromDirectory: jest.fn(),
            configExists: jest.fn(),
        };

        configManager = new ConfigManager({}, mockLoader);
    });

    test('should load base configuration', async () => {
        mockLoader.loadConfig.mockReturnValue({
            models: { base: { model: 'test-model' } },
        });

        await configManager.initialize();
        const baseModel = configManager.getModel('base');

        expect(baseModel.model).toBe('test-model');
    });

    test('should handle missing configuration gracefully', () => {
        mockLoader.loadConfig.mockImplementation(() => {
            throw new Error('Config not found');
        });

        expect(() => configManager.initialize()).not.toThrow();
    });
});
```

### Integration Testing

```javascript
describe('Configuration Integration', () => {
    test('should load real configuration files', async () => {
        const configManager = ConfigManager.getInstance();
        await configManager.initialize();

        // Test that all required configurations are loaded
        expect(configManager.getModel('base')).toBeDefined();
        expect(configManager.getConfig().global).toBeDefined();
    });

    test('should validate configuration schemas', () => {
        const validator = getConfigurationValidator();
        const testConfig = {
            /* test configuration */
        };

        const result = validator.validateConfig(testConfig, 'roles');
        expect(result.valid).toBe(true);
    });
});
```

## Best Practices

### Configuration Architecture

1. **Separation of concerns**: Keep different configuration aspects in separate files
2. **Layered approach**: Use environment variables for deployment-specific settings
3. **Validation**: Always validate configurations on load
4. **Caching**: Cache expensive configuration operations
5. **Monitoring**: Track configuration usage and performance

### Error Handling

1. **Graceful degradation**: Provide sensible defaults when configurations are missing
2. **Clear error messages**: Make configuration errors easy to understand and fix
3. **Validation feedback**: Provide specific validation error messages
4. **Recovery mechanisms**: Allow configuration reload without restart

### Performance

1. **Lazy loading**: Only load configurations when needed
2. **Caching strategies**: Cache frequently accessed configurations
3. **Change detection**: Only reload when configurations actually change
4. **Batch operations**: Group related configuration operations

## Next Steps

- [Troubleshooting](./troubleshooting.md) - Debug configuration issues
- [Environment Variables](./environment-variables.md) - Environment-specific settings
- [API Documentation](../api/) - Detailed API reference for configuration classes
