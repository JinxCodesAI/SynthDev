# Verbosity System

The AI Coder Console Application now includes a comprehensive verbosity system that allows users to control the amount of output displayed during operation.

## Verbosity Levels

The system supports 6 verbosity levels (0-5), each building upon the previous level:

### Level 0 - User Only

- Only information directly affecting the user is visible
- User messages from AI
- Error messages (always visible regardless of level)

### Level 1 - Status Messages

- All Level 0 output
- Short status messages like:
    - 🔄 Enhancing prompt...
    - 🧠 AI Coder is thinking...
    - 🔧 Executing tools...
- Warning messages

### Level 2 - Compressed Tool Arguments (Default)

- All Level 1 output
- Tool execution information with compressed arguments
- Arguments longer than 50 characters are truncated with "..."
- Objects with more than 3 properties show sample + count
- Arrays with more than 3 items show first 3 + count
- Info messages

### Level 3 - Uncompressed Arguments

- All Level 2 output
- Tool execution with full, uncompressed arguments
- Debug messages
- Tool results are NOT shown at this level

### Level 4 - Tool Results

- All Level 3 output
- Tool execution results are displayed

### Level 5 - HTTP Requests/Responses

- All Level 4 output
- Complete HTTP request and response logging
- Detailed API call information with timestamps

## Configuration

### Environment Variable

Set the verbosity level using the `VERBOSITY_LEVEL` environment variable:

```bash
export VERBOSITY_LEVEL=2
```

### .env File

Add to your `.env` file:

```env
VERBOSITY_LEVEL=2
```

### Valid Values

- `0` - User only
- `1` - Status messages
- `2` - Compressed tool arguments (default)
- `3` - Uncompressed arguments
- `4` - Tool results
- `5` - HTTP requests/responses

## Implementation

### Centralized Logging

All console output is now centralized through the `logger.js` module, eliminating scattered `console.log` statements throughout the codebase.

### Logger Methods

- `logger.user(message, prefix)` - Level 0: User messages
- `logger.status(message)` - Level 1: Status messages
- `logger.toolExecution(toolName, args)` - Level 2: Compressed tool execution
- `logger.toolExecutionDetailed(toolName, args)` - Level 3: Detailed tool execution
- `logger.toolResult(result)` - Level 4: Tool results
- `logger.httpRequest(method, url, request, response)` - Level 5: HTTP logging
- `logger.info(message)` - Level 2+: Info messages
- `logger.warn(message, context)` - Level 1+: Warnings
- `logger.debug(message, data)` - Level 3+: Debug messages
- `logger.error(error, context)` - Always visible: Errors
- `logger.raw(...args)` - Always visible: Raw console output (use sparingly for spacing/formatting only)

### Integration

The logger is automatically initialized when the application starts and respects the configured verbosity level. All major components have been updated to use the centralized logging system:

- `consoleInterface.js` - UI interactions
- `aiAPIClient.js` - API communications
- `app.js` - Main application flow
- Command implementations
- Tool implementations

## Benefits

1. **Cleaner Output**: Users can choose their preferred level of detail
2. **Better Debugging**: Higher levels provide more detailed information for troubleshooting
3. **Centralized Control**: All logging goes through one system
4. **Consistent Format**: Standardized output formatting across the application
5. **Performance**: Lower verbosity levels reduce output overhead

## Examples

### Level 0 Output

```
🤖 AI Coder: Your file has been created successfully.
```

### Level 2 Output (Default)

```
🤖 AI Coder: Your file has been created successfully.
🔧 Executing tool: write_file
📝 Arguments: { file_path: '/path/to/very/long/filename/that/gets/truncated...', content: 'File content that is also truncated if too long...' }
```

### Level 5 Output

```
🤖 AI Coder: Your file has been created successfully.
🔧 Executing tool: write_file
📝 Arguments: { file_path: '/full/path/to/file.txt', content: 'Complete file content here', options: { encoding: 'utf8' } }
✅ Tool result: { success: true, message: 'File written successfully', bytes_written: 1024 }

🌐 HTTP POST Request [2023-12-06T12:34:56.789Z]
📍 URL: https://api.openai.com/v1/chat/completions
📤 Request: {
  "model": "gpt-4",
  "messages": [...],
  "tools": [...]
}
📥 Response: {
  "id": "chatcmpl-123",
  "choices": [...],
  "usage": {...}
}
────────────────────────────────────────────────────────────────────────────────
```
