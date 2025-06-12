# Execute Script Tool

## Overview

The `execute_script` tool allows AI agents to execute JavaScript code in a sandboxed environment for performing calculations, text transformations, search aggregation, and other data processing tasks. The tool prioritizes security by implementing AI-powered safety assessment and running scripts as isolated child processes.

## Features

- **Sandboxed Execution**: Scripts run as separate Node.js child processes
- **AI-Powered Safety Assessment**: Uses fast AI model to analyze scripts for security risks
- **Read-Only Access**: Scripts can read files from the current directory but cannot modify them
- **Timeout Protection**: Configurable execution timeout prevents infinite loops
- **Comprehensive Output**: Returns stdout, stderr, execution time, and safety check results

## Security Features

### Blocked Operations

- File modification operations (write, append, create, delete)
- Process execution and system commands
- Network operations (HTTP, HTTPS, WebSocket)
- Dynamic code execution (eval, Function constructor)
- Global object manipulation
- Infinite loop patterns

### Allowed Operations

- File reading operations (fs.readFileSync, fs.existsSync, fs.statSync)
- Built-in Node.js modules (path, Math, JSON, console)
- Data processing and calculations
- Text transformations and string operations

## Usage

### Basic Calculation

```javascript
{
  "script": "console.log('Result:', Math.sqrt(16) + Math.pow(2, 3));"
}
```

### Text Processing

```javascript
{
  "script": "const text = 'Hello World'; console.log('Length:', text.length, 'Uppercase:', text.toUpperCase());"
}
```

### File Reading and Processing

```javascript
{
  "script": "const fs = require('fs'); const data = fs.readFileSync('data.txt', 'utf8'); console.log('Lines:', data.split('\n').length);"
}
```

### JSON Data Processing

```javascript
{
  "script": "const data = [{name: 'Alice', age: 30}, {name: 'Bob', age: 25}]; const avgAge = data.reduce((sum, p) => sum + p.age, 0) / data.length; console.log('Average age:', avgAge);"
}
```

## Parameters

### Required

- **script** (string): JavaScript code to execute

### Optional

- **timeout** (integer): Maximum execution time in milliseconds (1000-30000, default: 10000)

## Response Format

### Success Response

```json
{
    "success": true,
    "timestamp": "2025-06-02T20:21:59.490Z",
    "tool_name": "execute_script",
    "script": "console.log('Hello World');",
    "output": "Hello World\n",
    "stderr": "",
    "execution_time": 115,
    "safety_check": {
        "safe": true,
        "confidence": 1.0,
        "issues": [],
        "reasoning": "Script only performs safe mathematical calculations",
        "recommendations": [],
        "assessment_method": "ai_powered",
        "model_used": "gpt-4.1-nano",
        "tokens_used": 397
    },
    "exit_code": 0
}
```

### Error Response

```json
{
    "success": false,
    "timestamp": "2025-06-02T20:21:59.697Z",
    "tool_name": "execute_script",
    "error": "Script failed AI safety validation",
    "safety_assessment": {
        "safe": false,
        "confidence": 1.0,
        "issues": ["Uses fs.writeFileSync to modify a file"],
        "reasoning": "Script attempts to write to filesystem which is forbidden",
        "recommendations": ["Remove file writing operations"],
        "assessment_method": "ai_powered",
        "model_used": "gpt-4.1-nano",
        "tokens_used": 448
    },
    "script_preview": "fs.writeFileSync('test.txt', 'data');"
}
```

## Use Cases

1. **Mathematical Calculations**: Complex calculations that require multiple steps
2. **Text Processing**: String manipulation, parsing, and transformation
3. **Data Aggregation**: Processing arrays and objects, calculating statistics
4. **File Analysis**: Reading and analyzing file contents
5. **Format Conversion**: Converting between different data formats
6. **Search Operations**: Filtering and searching through data structures

## Limitations

- Scripts must be self-contained (no external parameters)
- Cannot modify files or execute system commands
- No network access
- Maximum execution time of 30 seconds
- Maximum script size of 50KB
- Cannot install or require external npm packages

## Safety Considerations

The tool implements multiple layers of security:

1. **AI Safety Assessment**: Uses fast AI model to analyze scripts for security violations
2. **Fallback Pattern Matching**: Basic pattern matching if AI assessment fails
3. **Process Isolation**: Runs scripts in separate child processes
4. **Timeout Protection**: Prevents long-running or infinite scripts
5. **File System Restrictions**: Blocks file modification operations
6. **Network Isolation**: Prevents network access
7. **Resource Limits**: Limits script size and execution time

This ensures that the tool can be safely used by AI agents without risking system security or stability.
