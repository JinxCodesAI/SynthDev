# Migration & Updates Guide

This guide covers upgrading SynthDev, migrating configurations, and handling breaking changes between versions.

## Version Migration

### Current Version Information

Check your current version:

```bash
# For global installations
synth-dev --version

# For local installations
npm run version

# Check git commit
git log --oneline -1
```

### Backup Before Migration

Always backup your configuration before upgrading:

```bash
# Backup configuration files
cp -r config/ config-backup/
cp .env .env.backup

# Backup conversation snapshots
cp -r .snapshots/ .snapshots-backup/

# Backup codebase index
cp -r .index/ .index-backup/
```

## Configuration System Migration

### From systemMessages.js to JSON Configuration

**Migration completed in v2.0**

If you have custom roles in the old format, migrate them:

**Old Format (systemMessages.js):**

```javascript
export const roles = {
    custom_role: {
        level: 'base',
        systemMessage: 'You are a custom assistant...',
        excludedTools: ['execute_terminal'],
        reminder: 'Remember to be helpful',
    },
};
```

**New Format (config/roles/roles.json):**

```json
{
    "custom_role": {
        "level": "base",
        "systemMessage": "You are a custom assistant...",
        "excludedTools": ["execute_terminal"],
        "reminder": "Remember to be helpful",
        "examples": []
    }
}
```

### Environment Variable Changes

#### v1.x to v2.x Migration

**Old Environment Variables:**

```env
OPENAI_API_KEY=your_key
MODEL=gpt-4
BASE_URL=https://api.openai.com/v1
```

**New Environment Variables:**

```env
API_KEY=your_key
BASE_MODEL=gpt-4
BASE_URL=https://api.openai.com/v1
```

#### Multi-Model Configuration

**New in v2.x:**

```env
# Base Model (Required)
API_KEY=your_base_key
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1

# Smart Model (Optional)
SMART_API_KEY=your_smart_key
SMART_MODEL=gpt-4.1-mini
SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (Optional)
FAST_API_KEY=your_fast_key
FAST_MODEL=gpt-4.1-nano
FAST_BASE_URL=https://api.openai.com/v1
```

## Tool System Migration

### Tool Definition Changes

#### v1.x to v2.x

**Old Tool Structure:**

```
tools/
└── tool_name.js    # Single file with embedded definition
```

**New Tool Structure:**

```
tools/
└── tool_name/
    ├── definition.json     # Separate schema file
    └── implementation.js   # Implementation only
```

#### Migration Steps

1. **Create Tool Directory:**

```bash
mkdir tools/your_tool
```

2. **Extract Definition:**

```javascript
// Old: Embedded in implementation
export const definition = { /* schema */ };
export default function implementation() { /* logic */ }

// New: Separate files
// definition.json
{
    "name": "your_tool",
    "description": "Tool description",
    "schema": { /* schema */ }
}

// implementation.js
export default function yourTool(params) { /* logic */ }
```

3. **Update Imports:**

```javascript
// Old: Direct tool imports
import { toolFunction } from './tools/tool_name.js';

// New: Tool manager handles loading
const result = await toolManager.executeTool('tool_name', params);
```

## Command System Migration

### Command Structure Changes

#### v1.x to v2.x

**Old Command Structure:**

```javascript
// Single file with mixed concerns
export function helpCommand(args, context) {
    // Implementation mixed with metadata
}
```

**New Command Structure:**

```javascript
// Class-based with clear separation
import { BaseCommand } from '../base/BaseCommand.js';

export class HelpCommand extends BaseCommand {
    constructor() {
        super('help', 'Show available commands');
    }

    getRequiredDependencies() {
        return ['toolManager', 'commandRegistry'];
    }

    async implementation(args, context) {
        // Clean implementation
    }
}
```

## API Changes

### ConfigManager API

#### v1.x to v2.x

**Old Direct Environment Access:**

```javascript
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.MODEL || 'gpt-3.5-turbo';
```

**New ConfigManager API:**

```javascript
import ConfigManager from './configManager.js';

const config = ConfigManager.getInstance();
const baseModel = config.getModel('base');
const apiKey = baseModel.apiKey;
const model = baseModel.baseModel;
```

### Tool Manager API

#### v1.x to v2.x

**Old Direct Tool Calls:**

```javascript
import readFile from './tools/read_file.js';
const result = await readFile({ file_path: 'test.txt' });
```

**New Tool Manager API:**

```javascript
const result = await toolManager.executeTool('read_file', {
    file_path: 'test.txt',
});
```

## Breaking Changes

### v2.0 Breaking Changes

1. **Configuration System Overhaul**

    - All hardcoded configurations moved to JSON files
    - Environment variable names changed
    - No fallback to hardcoded values

2. **Tool System Restructure**

    - Tools must use new directory structure
    - Definition and implementation separated
    - Tool discovery mechanism changed

3. **Command System Refactor**

    - Commands must extend BaseCommand class
    - Dependency injection required
    - Registration mechanism changed

4. **API Client Changes**
    - Callback system for event handling
    - Multi-model support required
    - Cost tracking integration mandatory

### Migration Checklist

- [ ] Backup existing configuration
- [ ] Update environment variables
- [ ] Migrate custom roles to JSON format
- [ ] Update custom tools to new structure
- [ ] Update custom commands to class-based format
- [ ] Test all functionality after migration
- [ ] Update any custom scripts or integrations

## Upgrade Procedures

### Standard Upgrade

1. **Backup Current Installation:**

```bash
cp -r . ../synthdev-backup
```

2. **Pull Latest Changes:**

```bash
git pull origin main
npm install
```

3. **Update Configuration:**

```bash
# Compare with new example
diff .env config.example.env
# Update as needed
```

4. **Test Installation:**

```bash
npm start
/help
/tools
```

### Docker Upgrade

1. **Backup Configuration:**

```bash
cp .env .env.backup
```

2. **Rebuild Container:**

```bash
./docker-run.sh clean
./docker-run.sh setup
```

3. **Restore Configuration:**

```bash
# Edit .env with your settings
```

4. **Test Upgrade:**

```bash
./docker-run.sh run
```

### Global Installation Upgrade

1. **Uninstall Previous Version:**

```bash
npm uninstall -g synth-dev
```

2. **Install New Version:**

```bash
cd /path/to/synthdev
git pull origin main
npm install -g .
```

3. **Verify Installation:**

```bash
synth-dev --version
```

## Troubleshooting Migration Issues

### Configuration Errors

**Error: Configuration file not found**

```
Solution: Ensure all required config files exist in config/ directory
Check: ls -la config/roles/roles.json
```

**Error: Invalid configuration format**

```
Solution: Validate JSON syntax
Check: cat config/roles/roles.json | jq .
```

### Tool Loading Errors

**Error: Tool definition not found**

```
Solution: Ensure tools follow new directory structure
Check: ls -la tools/your_tool/definition.json
```

**Error: Tool implementation missing**

```
Solution: Verify implementation.js exists and exports default function
Check: node -e "import('./tools/your_tool/implementation.js').then(console.log)"
```

### Environment Variable Issues

**Error: API_KEY is required**

```
Solution: Update environment variable names
Old: OPENAI_API_KEY
New: API_KEY
```

**Error: Invalid model configuration**

```
Solution: Check model names and URLs
Verify: API provider supports specified model
```

## Rollback Procedures

### Emergency Rollback

If migration fails, rollback to previous version:

1. **Stop Application:**

```bash
# Kill any running instances
pkill -f synth-dev
```

2. **Restore Backup:**

```bash
rm -rf config/
cp -r config-backup/ config/
cp .env.backup .env
```

3. **Revert Code:**

```bash
git checkout previous-working-commit
npm install
```

4. **Test Rollback:**

```bash
npm start
```

### Partial Rollback

For specific component issues:

1. **Rollback Configuration Only:**

```bash
cp config-backup/roles/roles.json config/roles/
```

2. **Rollback Environment Only:**

```bash
cp .env.backup .env
```

3. **Rollback Specific Tools:**

```bash
cp -r tools-backup/your_tool/ tools/
```

## Future Migration Planning

### Preparing for Updates

1. **Keep Backups Current:**

    - Regular configuration backups
    - Document custom modifications
    - Version control custom tools/commands

2. **Monitor Release Notes:**

    - Check GitHub releases for breaking changes
    - Review migration guides before upgrading
    - Test upgrades in development environment first

3. **Maintain Compatibility:**
    - Follow documented APIs
    - Avoid modifying core files
    - Use extension points for customization

### Best Practices

1. **Test Before Production:**

    - Always test upgrades in isolated environment
    - Verify all custom tools and commands work
    - Check configuration compatibility

2. **Document Changes:**

    - Keep record of custom modifications
    - Document configuration changes
    - Maintain upgrade log

3. **Gradual Migration:**
    - Migrate components incrementally
    - Test each component after migration
    - Keep rollback plan ready

---

_For specific configuration details, see [Configuration Guide](configuration.md)_
_For tool migration, see [Tool Development](tool-development.md)_
