# Workflow Functionality Management

This document explains how workflow functionality has been hidden in a tool and how to easily re-enable it when needed.

## Current Status

✅ **Workflow functionality is currently HIDDEN** and disabled by default.

The complete workflow system (multi-agent orchestration, state machines, workflow execution) has been moved to a tool called `workflow_tool` for better modularity and optional usage.

## What Was Changed

### 1. Core Application Changes

- **app.js**: Workflow imports and initialization commented out
- **commandHandler.js**: Workflow state machine removed from context
- **commands/base/CommandRegistrySetup.js**: Workflow commands unregistered
- **config/defaults/application.json**: Added `features.enableWorkflows: false`

### 2. Workflow Tool Created

- **tools/workflow_tool/**: New tool containing all workflow functionality
- **tools/workflow_tool/definition.json**: Tool definition
- **tools/workflow_tool/implementation.js**: Complete workflow system implementation

### 3. Commands Updated

- **commands/workflow/WorkflowCommand.js**: Shows helpful message when disabled
- **commands/workflow/WorkflowsCommand.js**: Shows helpful message when disabled

## How to Use Workflows (3 Options)

### Option 1: Enable via Workflow Tool (Temporary)

```
Use the workflow_tool with action "enable"
```

This enables workflows for the current session only.

### Option 2: Enable via Configuration (Persistent)

Edit `config/defaults/application.json`:

```json
{
    "features": {
        "enableWorkflows": true
    }
}
```

Then restart the application.

### Option 3: Use Workflow Tool Directly

```
# List workflows
workflow_tool with action "list"

# Get workflow info
workflow_tool with action "info", workflow_name "grocery_store_test"

# Execute workflow
workflow_tool with action "execute", workflow_name "grocery_store_test", input_params "your input"
```

## Easy Re-enabling Script

For development purposes, use the provided script:

```bash
# Enable workflow functionality completely
node scripts/enable-workflows.js enable

# Disable workflow functionality completely
node scripts/enable-workflows.js disable
```

This script automatically:

- Updates configuration
- Uncomments/comments workflow code
- Registers/unregisters workflow commands
- Provides restart instructions

## Files Involved

### Core Files (Modified)

- `app.js` - Main application initialization
- `commandHandler.js` - Command execution context
- `commands/base/CommandRegistrySetup.js` - Command registration
- `config/defaults/application.json` - Feature flags

### Workflow Files (Preserved)

- `workflow/` - All workflow implementation files (unchanged)
- `commands/workflow/` - Workflow commands (updated with helpful messages)
- `config/workflows/` - Workflow configurations (unchanged)
- `docs/workflows.md` - Workflow documentation (updated)

### New Files

- `tools/workflow_tool/` - Workflow tool implementation
- `scripts/enable-workflows.js` - Easy enable/disable script
- `WORKFLOW_HIDING.md` - This documentation

## Benefits of This Approach

1. **Modularity**: Workflow functionality is self-contained in a tool
2. **Optional**: Can be enabled/disabled as needed
3. **Preserved**: All workflow code and configurations remain intact
4. **Flexible**: Multiple ways to enable (tool, config, script)
5. **Reversible**: Easy to fully restore workflow integration

## Testing

The workflow functionality can be tested in multiple ways:

1. **Unit Tests**: Existing workflow tests should still pass when enabled
2. **Integration Tests**: Workflow integration tests work with tool enabled
3. **E2E Tests**: End-to-end workflow tests function normally when enabled

## Troubleshooting

### Workflow Commands Not Working

- Check if `features.enableWorkflows` is `true` in configuration
- Restart the application after configuration changes
- Use the workflow_tool directly as an alternative

### Workflow Tool Not Available

- Ensure the tool is properly loaded by the tool manager
- Check tool loading logs for any errors
- Verify `tools/workflow_tool/` directory structure

### Script Errors

- Ensure you're running the script from the project root
- Check file permissions for the script
- Verify all target files exist and are writable

## Future Considerations

This approach allows for:

- Easy removal of workflow functionality if not needed
- Gradual migration to tool-based architecture
- Better separation of concerns
- Optional feature management
- Cleaner core application code

The workflow system remains fully functional and can be restored to its original integration at any time using the provided tools and scripts.
