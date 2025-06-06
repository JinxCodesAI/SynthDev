# Synth-Dev Documentation

A Node.js console application that provides an AI-powered coding assistant with support for custom tools and function calling. Compatible with OpenAI compatible AI providers and their APIs.

## Features

- Integration with AI provider APIs with configurable models
- **Verbosity Control**: 6-level verbosity system (0-5) for controlling console output detail
- **Centralized Logging**: All output goes through a unified logging system
- **Tool Execution Monitoring**: Detailed tool execution logging with argument compression
- **HTTP Request Logging**: Complete API request/response logging at highest verbosity level

## Verbosity Levels

Control the amount of output with the `VERBOSITY_LEVEL` environment variable (0-5):

- **Level 0**: Only user messages and errors
- **Level 1**: + Status messages (🔄 Enhancing prompt..., 🧠 AI thinking...)
- **Level 2**: + Compressed tool arguments (default)
- **Level 3**: + Uncompressed tool arguments and debug messages
- **Level 4**: + Tool execution results
- **Level 5**: + Complete HTTP request/response logging

Set in your `.env` file:
```env
VERBOSITY_LEVEL=2
```

3. **Get your API key:**
   - Visit your AI provider's platform to obtain your API key.

## Usage

Start the application:
```bash
npm start
```

Or run in development mode with auto-reload:
```bash
npm run dev
```

## Safety Features

The application includes built-in safety mechanisms to prevent infinite loops and excessive resource usage:

- **Tool Call Limits**: Each user interaction is limited to a maximum number of tool calls (default: 50, configurable via `MAX_TOOL_CALLS` environment variable)
- **Automatic Reset**: The tool call counter resets at the start of each new user interaction
- **Clear Error Messages**: If the limit is exceeded, the application provides a clear error message explaining the issue

This ensures that complex multi-round tool calling scenarios can execute safely without running indefinitely.

## User Prompt Enhancement

The application includes an optional **User Prompt Enhancement** feature that can improve your prompts before they are processed by the AI. This feature uses a fast AI model to make your prompts more clear, specific, and effective while preserving your original intent.

### How It Works

1. **Type your prompt** and press ENTER
2. If enhancement is enabled, the system shows "🔄 Enhancing prompt..."
3. **Review the enhanced prompt** presented to you
4. **Choose your action:**
   - Press ENTER to use the enhanced prompt
   - Type modifications and press ENTER to use your edited version
   - Type "original" to use your original prompt instead

### Configuration

Enable prompt enhancement by setting the environment variable:

```bash
ENABLE_PROMPT_ENHANCEMENT=true
```

**Default:** OFF (disabled) to maintain backward compatibility

### Benefits

- **Clearer Communication:** Makes vague requests more specific
- **Better Results:** Enhanced prompts typically produce more accurate AI responses
- **Learning Tool:** See how your prompts can be improved over time
- **Full Control:** You always have the final say on what gets processed

### Requirements

- Requires a configured fast AI model (uses `FAST_MODEL` configuration)
- Falls back to base model if fast model is not configured
- Gracefully handles failures by using your original prompt

## Existing Tools

This application includes the following existing tools in the `tools` directory:

- **calculate**: A powerful mathematical calculator that evaluates complex mathematical expressions including arithmetic operations, trigonometric functions, logarithms, exponential functions, and more. Supports precision control and security validation.
- **edit_file**: A tool to safely edit file content by inserting or deleting specified fragments between boundary strings within files. It validates boundaries before editing.
- **get_time**: A comprehensive time and date utility that performs current time retrieval, timezone conversions, date formatting, arithmetic operations (add/subtract), and difference calculations with multiple output formats.
- **get_weather**: Provides current weather conditions for any specified location worldwide with detailed weather data including temperature, humidity, and conditions. Supports Celsius and Fahrenheit units.
- **list_directory**: Recursively lists directory contents with filtering and metadata collection including file types, sizes, timestamps, and hierarchical views.
- **read_file**: Safely reads the complete contents of text-based files with error handling and supports various text file types.
- **write_file**: Safely creates or overwrites files with text content, automatic directory creation, and supports various file types with detailed error handling.

These tools form the core of the application's extensible functionality for interacting with files, performing calculations, and retrieving external data.

## Creating New Tools

To create a new custom tool for the AI Coder application, follow this comprehensive guide:

### Tool Structure

Each tool consists of two required files in its own directory:

```
tools/
└── my_tool_name/
    ├── definition.json     # Tool schema and metadata
    └── implementation.js   # Tool logic and execution
```

### Step-by-Step Creation Process

#### 1. Create Tool Directory

Create a new directory within the `tools` folder. The directory name becomes your tool's identifier:

```bash
mkdir tools/my_new_tool
```

#### 2. Create definition.json

This file defines the tool's interface, parameters, and behavior:

```json
{
  "name": "my_new_tool",
  "description": "Brief description of what the tool does",
  "auto_run": false,
  "requires_backup": true,
  "backup_resource_path_property_name": "param_name",
  "schema": {
    "type": "function",
    "function": {
      "name": "my_new_tool",
      "description": "Detailed description for the AI model explaining the tool's purpose, parameters, constraints, and expected behavior. Be very specific about parameter formats and expected values.",
      "parameters": {
        "type": "object",
        "properties": {
          "param_name": {
            "type": "string",
            "description": "Clear description of this parameter including expected format, constraints, and examples"
          }
        },
        "required": ["param_name"]
      },
      "response_format": {
        "description": "Describe the exact JSON structure returned by the tool, including success/error cases"
      }
    }
  }
}
```

**Key Fields Explained:**
- `auto_run`: If `true`, tool executes automatically; if `false`, requires user approval
- `description` (function level): This is what the AI sees - be extremely detailed and specific
- `parameters.properties`: Define each parameter with clear constraints and expected formats
- `response_format`: Helps AI understand what to expect from the tool

#### 3. Create implementation.js

This file contains the actual tool logic:

```javascript
/**
 * Tool implementation
 * Detailed description of what this tool does
 */

import { /* required imports */ } from 'module';

export default async function myNewTool(params) {
    // Extract and validate parameters
    const { param_name } = params;
    
    // Validate inputs
    if (!param_name || typeof param_name !== 'string') {
        return {
            error: 'param_name is required and must be a string',
            success: false,
            timestamp: new Date().toISOString()
        };
    }
    
    try {
        // Your tool logic here
        const result = processData(param_name);
        
        return {
            success: true,
            timestamp: new Date().toISOString(),
            result: result,
            // Include other relevant data
        };
    } catch (error) {
        return {
            error: `Unexpected error: ${error.message}`,
            success: false,
            timestamp: new Date().toISOString()
        };
    }
}
```

### Execution Environment & Constraints

#### Runtime Environment
- **Node.js**: Tools run in the same Node.js process as the main application
- **ES Modules**: Use ES6 import/export syntax
- **Async/Await**: All tool functions must be async and return a Promise
- **File System Access**: Limited to current working directory and subdirectories
- **Network Access**: Available for HTTP/HTTPS requests
- **Process Access**: Can spawn child processes but should be used carefully

#### Security Constraints
- **Path Traversal**: Cannot access files outside the project directory (no `../` escaping)
- **File Permissions**: Respect system file permissions
- **Memory Usage**: Be mindful of memory consumption for large operations
- **Timeout**: Long-running operations should include progress feedback

#### Parameter Guidelines
- **Validation**: Always validate all input parameters
- **Type Safety**: Check parameter types and ranges
- **Error Handling**: Return consistent error objects with descriptive messages
- **Documentation**: Parameter descriptions should include examples and constraints

#### Response Format Standards
All tools should return consistent JSON objects:

**Success Response:**
```json
{
  "success": true,
  "timestamp": "2025-01-01T12:00:00.000Z",
  // ... tool-specific data
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Descriptive error message",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Best Practices

#### 1. Clear Parameter Descriptions
Be extremely specific in parameter descriptions. The AI model relies on these to understand how to use your tool correctly:

```json
{
  "file_path": {
    "type": "string",
    "description": "Relative path to the target file, starting from project root. Must use forward slashes (/). Example: 'src/components/Button.jsx' or 'config.json'. Cannot contain '..' or absolute paths for security."
  }
}
```

#### 2. Robust Error Handling
Handle all possible error cases and provide actionable error messages:

```javascript
// Check file existence
if (!existsSync(filePath)) {
    return {
        error: `File '${filePath}' does not exist. Please check the path and try again.`,
        success: false,
        timestamp: new Date().toISOString()
    };
}
```

#### 3. Input Validation
Validate all inputs thoroughly:

```javascript
// Validate required string parameter
if (!param || typeof param !== 'string' || param.trim().length === 0) {
    return {
        error: 'Parameter must be a non-empty string',
        success: false,
        timestamp: new Date().toISOString()
    };
}
```

#### 4. Consistent Naming
- Use snake_case for parameter names
- Use descriptive, unambiguous names
- Match parameter names between definition.json and implementation.js

### Testing Your Tool

After creating your tool, test it thoroughly:

1. **Parameter Validation**: Test with invalid/missing parameters
2. **Edge Cases**: Test boundary conditions and unusual inputs
3. **Error Scenarios**: Verify error handling works correctly
4. **Success Paths**: Ensure normal operation works as expected

### Auto-Discovery

The application automatically discovers and loads all tools from the `tools` directory. Once you've created your tool files, restart the application to load the new tool.

### Example: Simple Calculator Tool

See the `tools/calculate` directory for a complete example of a well-implemented tool with proper validation, error handling, and documentation.

