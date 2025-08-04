# Tools and Safety Configuration

SynthDev's tool system provides AI agents with capabilities to interact with files, execute code, and perform system operations. The configuration system ensures these tools operate safely and efficiently while providing extensive customization options.

## Tool Configuration Overview

### Configuration Files
- **`src/config/tools/tool-messages.json`**: Tool descriptions, error messages, and validation text
- **`src/config/tools/safety-patterns.json`**: Security patterns and AI safety checks
- **`src/config/defaults/application.json`**: Tool defaults and limits

### Safety Layers
1. **Pattern matching**: Detect dangerous commands and code
2. **AI safety checks**: Use AI to evaluate code safety
3. **Execution limits**: Timeouts, file size limits, and resource constraints
4. **Permission controls**: Role-based tool access restrictions

## Tool Messages Configuration

### Structure
**File**: `src/config/tools/tool-messages.json`

```json
{
  "common_errors": {
    "file_not_found": "File not found: {filename}",
    "permission_denied": "Permission denied: {operation}",
    "invalid_syntax": "Invalid syntax in {context}: {details}",
    "timeout_exceeded": "Operation timed out after {timeout}ms",
    "size_limit_exceeded": "File size exceeds limit of {limit} bytes"
  },
  "tool_descriptions": {
    "read_file": "Read the contents of a file",
    "write_file": "Write content to a file",
    "execute_script": "Execute a script with safety validation",
    "list_directory": "List files and directories"
  },
  "validation_messages": {
    "script_validation": "Validating script for safety...",
    "file_check": "Checking file permissions...",
    "size_validation": "Validating file size..."
  }
}
```

### Customizing Messages
```json
{
  "common_errors": {
    "custom_error": "Your custom error message with {parameter}",
    "database_error": "Database operation failed: {query}"
  },
  "tool_descriptions": {
    "custom_tool": "Description of your custom tool functionality"
  }
}
```

## Safety Patterns Configuration

### Structure
**File**: `src/config/tools/safety-patterns.json`

```json
{
  "ai_safety_prompt": "Analyze this script for safety: {script}\n\nCheck for:\n- Destructive operations\n- Network access\n- System modifications\n- Data exfiltration\n\nRespond with SAFE or UNSAFE and explanation.",
  "dangerous_patterns": [
    {
      "pattern": "rm -rf",
      "reason": "Dangerous file deletion command",
      "severity": "high"
    },
    {
      "pattern": "format c:",
      "reason": "System format command",
      "severity": "critical"
    },
    {
      "pattern": "dd if=",
      "reason": "Low-level disk operations",
      "severity": "high"
    }
  ],
  "error_messages": {
    "unsafe_script": "Script contains potentially dangerous operations: {reasons}",
    "pattern_match": "Dangerous pattern detected: {pattern}",
    "ai_safety_failed": "AI safety check failed: {reason}"
  }
}
```

### Pattern Types

#### Command Patterns
```json
{
  "dangerous_patterns": [
    {
      "pattern": "sudo rm",
      "reason": "Privileged file deletion",
      "severity": "critical",
      "type": "command"
    },
    {
      "pattern": "chmod 777",
      "reason": "Overly permissive file permissions",
      "severity": "medium",
      "type": "command"
    }
  ]
}
```

#### Code Patterns
```json
{
  "dangerous_patterns": [
    {
      "pattern": "eval\\(",
      "reason": "Dynamic code execution",
      "severity": "high",
      "type": "code",
      "language": "javascript"
    },
    {
      "pattern": "exec\\(",
      "reason": "System command execution",
      "severity": "high",
      "type": "code",
      "language": "python"
    }
  ]
}
```

#### Network Patterns
```json
{
  "dangerous_patterns": [
    {
      "pattern": "curl.*\\|.*sh",
      "reason": "Download and execute script",
      "severity": "critical",
      "type": "network"
    },
    {
      "pattern": "wget.*-O.*\\|",
      "reason": "Download and pipe to command",
      "severity": "high",
      "type": "network"
    }
  ]
}
```

## Tool Defaults Configuration

### Application Settings
**File**: `src/config/defaults/application.json`

```json
{
  "tool_settings": {
    "autoRun": true,
    "defaultEncoding": "utf8",
    "modifiesFiles": false,
    "maxFileSize": 10485760,
    "defaultTimeout": 10000
  },
  "safety": {
    "enableAISafetyCheck": true,
    "fallbackToPatternMatching": true,
    "maxScriptSize": 50000,
    "scriptTimeout": {
      "min": 1000,
      "max": 30000,
      "default": 10000
    }
  }
}
```

### Tool-Specific Settings
```json
{
  "tool_settings": {
    "execute_script": {
      "timeout": 15000,
      "maxOutputSize": 1048576,
      "allowedExtensions": [".py", ".js", ".sh"],
      "workingDirectory": "/tmp/synthdev"
    },
    "read_file": {
      "maxFileSize": 5242880,
      "allowedExtensions": ["*"],
      "encoding": "utf8"
    },
    "write_file": {
      "maxFileSize": 10485760,
      "createDirectories": true,
      "backupOriginal": false
    }
  }
}
```

## Safety Configuration

### AI Safety Checks

#### Custom Safety Prompts
```json
{
  "ai_safety_prompt": "You are a security expert. Analyze this {language} script:\n\n{script}\n\nEvaluate for:\n1. File system operations\n2. Network requests\n3. System commands\n4. Privilege escalation\n5. Data access patterns\n\nRespond with:\n- SAFE: Brief explanation\n- UNSAFE: Specific risks identified",
  "safety_timeout": 10000,
  "safety_model": "smart"
}
```

#### Language-Specific Prompts
```json
{
  "language_prompts": {
    "python": "Analyze this Python script for security risks...",
    "javascript": "Review this JavaScript code for potential vulnerabilities...",
    "bash": "Examine this shell script for dangerous operations..."
  }
}
```

### Pattern Matching

#### Severity Levels
```json
{
  "severity_actions": {
    "low": "warn",
    "medium": "confirm",
    "high": "block",
    "critical": "block_and_log"
  }
}
```

#### Context-Aware Patterns
```json
{
  "contextual_patterns": {
    "development": {
      "allowed_patterns": ["npm install", "pip install"],
      "blocked_patterns": ["rm -rf node_modules"]
    },
    "production": {
      "allowed_patterns": [],
      "blocked_patterns": ["*"]
    }
  }
}
```

## Tool Access Control

### Role-Based Restrictions
Configure tool access per role in role definitions:

```json
{
  "developer": {
    "excludedTools": ["execute_terminal"],
    "includedTools": ["read_file", "write_file", "execute_script"]
  },
  "security_auditor": {
    "excludedTools": ["write_file", "execute_*"],
    "includedTools": ["read_file", "analyze_*"]
  }
}
```

### Dynamic Tool Control
```json
{
  "conditional_access": {
    "execute_script": {
      "conditions": {
        "file_extension": [".py", ".js"],
        "max_size": 10000,
        "safe_patterns_only": true
      }
    }
  }
}
```

## Advanced Safety Features

### Sandboxing Configuration
```json
{
  "sandboxing": {
    "enabled": true,
    "container_type": "docker",
    "resource_limits": {
      "memory": "512m",
      "cpu": "0.5",
      "disk": "100m"
    },
    "network_access": false,
    "file_system_access": "restricted"
  }
}
```

### Audit Logging
```json
{
  "audit": {
    "log_all_tool_calls": true,
    "log_safety_checks": true,
    "log_blocked_operations": true,
    "log_file": "logs/tool-audit.log",
    "retention_days": 30
  }
}
```

### Rate Limiting
```json
{
  "rate_limiting": {
    "enabled": true,
    "limits": {
      "execute_script": {
        "per_minute": 10,
        "per_hour": 100
      },
      "write_file": {
        "per_minute": 50,
        "per_hour": 1000
      }
    }
  }
}
```

## Custom Tool Development

### Tool Registration
```json
{
  "custom_tools": {
    "my_custom_tool": {
      "description": "Custom tool for specific operations",
      "safety_level": "medium",
      "required_permissions": ["file_read", "network_access"],
      "timeout": 5000
    }
  }
}
```

### Safety Integration
```javascript
// Custom tool with safety checks
class MyCustomTool {
  async execute(params) {
    // Get safety configuration
    const safetyConfig = getToolConfigManager().getSafetyConfig();
    
    // Perform safety checks
    if (safetyConfig.enableAISafetyCheck) {
      const safetyResult = await this.checkSafety(params);
      if (!safetyResult.safe) {
        throw new Error(`Safety check failed: ${safetyResult.reason}`);
      }
    }
    
    // Execute tool logic
    return this.performOperation(params);
  }
}
```

## Performance Optimization

### Caching Configuration
```json
{
  "caching": {
    "safety_checks": {
      "enabled": true,
      "ttl": 300000,
      "max_entries": 1000
    },
    "file_metadata": {
      "enabled": true,
      "ttl": 60000
    }
  }
}
```

### Parallel Processing
```json
{
  "performance": {
    "parallel_safety_checks": true,
    "max_concurrent_tools": 5,
    "tool_queue_size": 100,
    "timeout_buffer": 1000
  }
}
```

## Monitoring and Metrics

### Tool Usage Metrics
```json
{
  "metrics": {
    "collect_usage_stats": true,
    "collect_performance_stats": true,
    "collect_safety_stats": true,
    "report_interval": 60000
  }
}
```

### Health Checks
```json
{
  "health_checks": {
    "tool_availability": true,
    "safety_system_status": true,
    "resource_usage": true,
    "check_interval": 30000
  }
}
```

## Best Practices

### Security
1. **Enable AI safety checks**: Always use AI-based safety validation
2. **Pattern matching fallback**: Maintain pattern-based checks as backup
3. **Principle of least privilege**: Only grant necessary tool access
4. **Regular updates**: Keep safety patterns current with new threats

### Performance
1. **Appropriate timeouts**: Balance safety with responsiveness
2. **Resource limits**: Set realistic limits for your environment
3. **Caching**: Enable caching for repeated operations
4. **Monitoring**: Track tool performance and usage

### Maintenance
1. **Regular audits**: Review tool usage and safety logs
2. **Pattern updates**: Keep dangerous patterns current
3. **Configuration validation**: Test configuration changes thoroughly
4. **Documentation**: Document custom tools and safety rules

## Troubleshooting

### Common Issues
- **Tools blocked unexpectedly**: Check safety patterns and role permissions
- **Slow tool execution**: Review timeout settings and AI safety checks
- **Safety check failures**: Verify AI model availability and prompts
- **Permission errors**: Check file system permissions and tool access

### Debug Configuration
```json
{
  "debug": {
    "log_safety_decisions": true,
    "log_pattern_matches": true,
    "log_tool_execution": true,
    "verbose_error_messages": true
  }
}
```

## Next Steps

- [AI Roles](./roles.md) - Configure role-based tool access
- [Snapshots](./snapshots.md) - Configure snapshots for tool-triggered backups
- [Troubleshooting](./troubleshooting.md) - Common tool configuration issues
