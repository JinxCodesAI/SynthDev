# Tool System Documentation

This document describes the standardized tool system that provides a unified interface and promotes reusable code components across all tool implementations.

## Overview

The tool system has been redesigned with standardization and abstraction in mind. Key improvements include:

- **Unified Base Classes**: Abstract base classes for different tool types
- **Standardized Response Formats**: Consistent response structure across all tools
- **Enhanced Validation**: Comprehensive parameter and schema validation
- **Tool Categories**: Organized tool discovery and management
- **Automated Generation**: Templates and generators for creating new tools
- **Comprehensive Error Handling**: Standardized error reporting and handling

## Architecture

### Base Classes

The system provides three main base classes in `tools/common/base-tool.js`:

#### 1. BaseTool

The foundational class for all tools providing:

- Standardized response creation (`createSuccessResponse`, `createErrorResponse`)
- Parameter validation (`validateRequiredParams`, `validateParameterTypes`)
- Path security validation (`validateAndResolvePath`)
- Error handling wrapper (`execute`)

#### 2. FileBaseTool (extends BaseTool)

Specialized for file system operations:

- File size validation (`validateFileSize`)
- File system error handling (`handleFileSystemError`)
- Common file operation patterns

#### 3. CommandBaseTool (extends BaseTool)

Specialized for command execution:

- Command validation (`validateCommand`)
- Standardized command responses (`createCommandResponse`)

### Tool Structure

Each tool consists of two files:

```
tools/
  tool_name/
    definition.json    # Tool metadata and schema
    implementation.js  # Tool logic and execution
```

### Standard Response Format

All tools return responses in this format:

```json
{
  "success": true|false,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "tool_name": "tool_name",
  "...": "additional response data",
  "error": "error message (if success=false)"
}
```

## Tool Definition Schema

Tool definitions follow a standardized schema defined in `tools/common/tool-schema.js`:

```json
{
  "name": "tool_name",
  "description": "Tool description",
  "auto_run": true|false,
  "requires_backup": true|false,
  "backup_resource_path_property_name": "property_name",
  "category": "file|command|utility|search|calculation",
  "version": "1.0.0",
  "tags": ["tag1", "tag2"],
  "schema": {
    "type": "function",
    "function": {
      "name": "tool_name",
      "description": "Detailed tool description",
      "parameters": {
        "type": "object",
        "properties": {
          "param_name": {
            "type": "string",
            "description": "Parameter description"
          }
        },
        "required": ["param_name"]
      },
      "response_format": {
        "description": "Response format description"
      }
    }
  }
}
```

## Creating New Tools

1. Create tool directory: `tools/my_tool/`
2. Create `definition.json` using the schema
3. Create `implementation.js` extending appropriate base class

Example implementation:

```javascript
import { FileBaseTool } from '../common/base-tool.js';

class MyTool extends FileBaseTool {
    constructor() {
        super('my_tool', 'Tool description');
        this.requiredParams = ['file_path'];
        this.parameterTypes = { file_path: 'string' };
    }

    async implementation(params) {
        const { file_path } = params;

        // Validate file path
        const pathValidation = this.validateAndResolvePath(file_path);
        if (pathValidation.error) {
            return pathValidation.error;
        }

        try {
            // Tool logic here
            return this.createSuccessResponse({
                message: 'Success',
                file_path,
            });
        } catch (error) {
            return this.createErrorResponse(error.message);
        }
    }
}

const myTool = new MyTool();
export default async function myTool(params) {
    return await myTool.execute(params);
}
```

## Tool Categories

Tools are organized into categories for better discovery:

- **file**: File system operations (read, write, list, etc.)
- **command**: Terminal/command execution
- **execution**: Script and code execution in sandboxed environments
- **utility**: General utility functions
- **search**: Search and filtering operations
- **calculation**: Mathematical and computational tools

## Enhanced Features

### Tool Discovery

The ToolManager now provides enhanced discovery features:

```javascript
// Get tools by category
const fileTools = toolManager.getToolsByCategory('file');

// Get all categories
const categories = toolManager.getCategories();

// Check if tool exists
const exists = toolManager.hasToolDefinition('read_file');

// Get loading errors for diagnostics
const errors = toolManager.getLoadingErrors();
```

### Validation

Comprehensive validation at multiple levels:

1. **Schema Validation**: Tool definitions are validated against the standard schema
2. **Parameter Validation**: Runtime parameter validation with type checking
3. **Security Validation**: Path traversal prevention and access controls
4. **Business Logic Validation**: Tool-specific validation rules

### Error Handling

Standardized error handling provides:

- Consistent error response format
- Detailed error messages with context
- Error categorization (validation, filesystem, execution, etc.)
- Stack traces for debugging

## Migration Guide

### Updating Existing Tools

1. **Update definition.json**:

    - Add new required fields: `category`, `version`, `author`, `tags`
    - Update response_format description to include new standard fields

2. **Update implementation.js**:

    - Import appropriate base class
    - Extend base class instead of direct implementation
    - Use standardized response methods
    - Remove custom validation code (use base class methods)

3. **Test the tool**:
    - Ensure all functionality still works
    - Check that responses follow new format
    - Verify parameter validation works correctly

### Example Migration

**Before** (old pattern):

```javascript
export default async function readFile(params) {
    if (!params.file_path) {
        return {
            error: 'file_path required',
            success: false,
            timestamp: new Date().toISOString(),
        };
    }
    // ... implementation
}
```

**After** (new pattern):

```javascript
import { FileBaseTool } from '../common/base-tool.js';

class ReadFileTool extends FileBaseTool {
    constructor() {
        super('read_file', 'Read file contents');
        this.requiredParams = ['file_path'];
    }

    async implementation(params) {
        // Base class handles validation automatically
        // ... implementation using this.createSuccessResponse()
    }
}
```

## Common Utilities

The `tools/common/` directory provides shared utilities:

- **base-tool.js**: Base classes and common functionality
- **tool-schema.js**: Schema validation and tool definition templates
- **tool-generator.js**: Tool generation utilities
- **fs_utils.js**: Enhanced file system utilities

## Best Practices

1. **Use Base Classes**: Always extend appropriate base class
2. **Standardize Responses**: Use `createSuccessResponse()` and `createErrorResponse()`
3. **Validate Parameters**: Define `requiredParams` and `parameterTypes`
4. **Handle Errors**: Use base class error handling methods
5. **Document Thoroughly**: Provide clear descriptions and examples
6. **Test Extensively**: Test all parameter combinations and error cases
7. **Follow Naming**: Use snake_case for tool names and parameters

## Troubleshooting

### Common Issues

1. **Tool Not Loading**:

    - Check definition.json syntax
    - Ensure all required fields are present
    - Verify implementation.js exports default function

2. **Validation Errors**:

    - Check parameter types match schema
    - Ensure required parameters are provided
    - Verify schema structure is correct

3. **Import Errors**:
    - Check relative import paths
    - Ensure base classes are properly imported
    - Verify Node.js module syntax

### Debug Tips

- Check `toolManager.getLoadingErrors()` for detailed error information
- Use console logging in tool implementation for debugging
- Validate tool definitions using `validateToolDefinition()`
- Test tools individually before integrating

## Future Enhancements

Planned improvements include:

- **Plugin System**: Dynamic tool loading and unloading
- **Tool Versioning**: Support for multiple tool versions
- **Performance Monitoring**: Tool execution metrics and optimization
- **Enhanced Security**: Additional security controls and sandboxing
- **Tool Dependencies**: Support for tool dependencies and composition
