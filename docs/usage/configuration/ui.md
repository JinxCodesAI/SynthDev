# User Interface Configuration

SynthDev's user interface is highly customizable, allowing you to personalize the console experience, messages, prompts, and visual elements. All UI text and behavior can be configured through external configuration files.

## UI Configuration Overview

### Configuration Files
- **`src/config/ui/console-messages.json`**: Console interface messages and prompts
- **`src/config/ui/command-help.json`**: Command descriptions and help text
- **`src/config/defaults/application.json`**: UI defaults and preferences

### Customizable Elements
- Startup banners and messages
- User prompts and input formatting
- Status indicators and progress messages
- Error messages and warnings
- Command help and descriptions
- Color schemes and formatting

## Console Messages Configuration

### Structure
**File**: `src/config/ui/console-messages.json`

```json
{
  "startup": {
    "title": "🎯 SynthDev AI Assistant",
    "subtitle": "Ready to help with your development tasks",
    "version": "Version {version}",
    "loading": "Loading configuration...",
    "ready": "✅ Ready! Type your request or 'help' for commands"
  },
  "prompts": {
    "user_input": "💭 You: ",
    "confirmation": "Proceed? (y/n): ",
    "role_selection": "Select role [{roles}]: ",
    "continue": "Press Enter to continue..."
  },
  "status": {
    "thinking": "🧠 AI thinking...",
    "processing": "🔄 Processing...",
    "executing": "⚡ Executing tool: {tool}",
    "completed": "✅ Completed",
    "error": "❌ Error: {message}"
  },
  "feedback": {
    "success": "✅ {message}",
    "warning": "⚠️  {message}",
    "info": "ℹ️  {message}",
    "error": "❌ {message}"
  }
}
```

### Customizing Messages

#### Startup Experience
```json
{
  "startup": {
    "title": "🚀 My Custom Dev Assistant",
    "subtitle": "Powered by SynthDev - Your AI Development Partner",
    "ascii_art": [
      "  ____             _   _     ____             ",
      " / ___| _   _ _ __ | |_| |__ |  _ \\  _____   __",
      " \\___ \\| | | | '_ \\| __| '_ \\| | | |/ _ \\ \\ / /",
      "  ___) | |_| | | | | |_| | | | |_| |  __/\\ V / ",
      " |____/ \\__, |_| |_|\\__|_| |_|____/ \\___| \\_/  ",
      "        |___/                                 "
    ],
    "welcome_message": "Welcome to your personalized development environment!",
    "tips": [
      "💡 Tip: Use 'help' to see available commands",
      "💡 Tip: Try different roles with '/role <name>'",
      "💡 Tip: Use '/snapshot' to save your work"
    ]
  }
}
```

#### Custom Prompts
```json
{
  "prompts": {
    "user_input": "🎯 Your request: ",
    "confirmation": "Continue with this action? [Y/n]: ",
    "role_selection": "Choose your AI assistant [{roles}]: ",
    "model_selection": "Select model [{models}]: ",
    "save_confirmation": "Save changes? [Y/n]: "
  }
}
```

#### Status Indicators
```json
{
  "status": {
    "thinking": "🤔 Analyzing your request...",
    "processing": "⚙️  Processing request...",
    "executing": "🔧 Running {tool}...",
    "waiting": "⏳ Waiting for response...",
    "completed": "🎉 Task completed successfully!",
    "cancelled": "🚫 Operation cancelled",
    "timeout": "⏰ Operation timed out"
  }
}
```

## Command Help Configuration

### Structure
**File**: `src/config/ui/command-help.json`

```json
{
  "help": {
    "title": "SynthDev Commands",
    "description": "Available commands and their usage",
    "commands": {
      "help": {
        "description": "Show this help message",
        "usage": "help [command]",
        "examples": ["help", "help role"]
      },
      "role": {
        "description": "Switch AI role or list available roles",
        "usage": "role [role_name]",
        "examples": ["role", "role developer", "role tester"]
      },
      "snapshot": {
        "description": "Create or manage project snapshots",
        "usage": "snapshot [create|list|restore] [name]",
        "examples": ["snapshot create", "snapshot list", "snapshot restore backup-1"]
      }
    }
  },
  "cli_help": {
    "usage": "synthdev [options] [prompt]",
    "description": "AI-powered development assistant",
    "options": {
      "--role": "Specify AI role to use",
      "--model": "Override default model",
      "--verbose": "Enable verbose output",
      "--config": "Specify config file path"
    }
  }
}
```

### Custom Commands
```json
{
  "help": {
    "commands": {
      "deploy": {
        "description": "Deploy application to specified environment",
        "usage": "deploy <environment> [options]",
        "examples": ["deploy staging", "deploy production --dry-run"],
        "options": {
          "--dry-run": "Show what would be deployed without executing",
          "--force": "Force deployment even with warnings"
        }
      },
      "test": {
        "description": "Run tests with various options",
        "usage": "test [type] [pattern]",
        "examples": ["test", "test unit", "test integration user*"],
        "aliases": ["t", "tests"]
      }
    }
  }
}
```

## Application UI Settings

### Structure
**File**: `src/config/defaults/application.json`

```json
{
  "ui_settings": {
    "defaultRole": "dude",
    "showStartupBanner": true,
    "enableColors": true,
    "promptPrefix": "💭 You: ",
    "maxOutputLines": 1000,
    "truncateOutput": true,
    "showTimestamps": false,
    "animateProgress": true
  }
}
```

### UI Preferences
```json
{
  "ui_settings": {
    "theme": "dark",
    "colorScheme": {
      "primary": "#00ff88",
      "secondary": "#0088ff",
      "success": "#00ff00",
      "warning": "#ffaa00",
      "error": "#ff0000",
      "info": "#00aaff"
    },
    "formatting": {
      "codeBlocks": true,
      "syntax_highlighting": true,
      "lineNumbers": false,
      "wordWrap": true
    },
    "behavior": {
      "autoScroll": true,
      "confirmDestructive": true,
      "showProgress": true,
      "clearOnStart": false
    }
  }
}
```

## Advanced UI Customization

### Dynamic Messages
```json
{
  "dynamic": {
    "greeting": {
      "morning": "🌅 Good morning! Ready to code?",
      "afternoon": "☀️ Good afternoon! Let's build something great!",
      "evening": "🌙 Good evening! Time for some late-night coding?",
      "night": "🌃 Burning the midnight oil? I'm here to help!"
    },
    "role_specific": {
      "developer": {
        "welcome": "👨‍💻 Developer mode activated. Let's write some code!",
        "prompt": "🔧 Dev: "
      },
      "tester": {
        "welcome": "🧪 Testing mode activated. Let's ensure quality!",
        "prompt": "🔍 Test: "
      }
    }
  }
}
```

### Contextual Messages
```json
{
  "contextual": {
    "git_status": {
      "clean": "📝 Working directory clean",
      "modified": "📝 {count} files modified",
      "staged": "📋 {count} files staged",
      "conflicts": "⚠️ {count} merge conflicts"
    },
    "project_type": {
      "javascript": "🟨 JavaScript project detected",
      "python": "🐍 Python project detected",
      "rust": "🦀 Rust project detected",
      "unknown": "📁 Project type unknown"
    }
  }
}
```

### Interactive Elements
```json
{
  "interactive": {
    "menus": {
      "role_selection": {
        "title": "Select AI Role",
        "options": [
          "1. Developer - Code assistance and debugging",
          "2. Tester - Quality assurance and testing",
          "3. Reviewer - Code review and best practices",
          "4. Custom - Define your own role"
        ],
        "prompt": "Enter your choice (1-4): "
      }
    },
    "confirmations": {
      "destructive": {
        "title": "⚠️ Destructive Operation",
        "message": "This action cannot be undone. Are you sure?",
        "options": ["Yes, proceed", "No, cancel"],
        "default": "No, cancel"
      }
    }
  }
}
```

## Localization Support

### Multi-Language Messages
```json
{
  "localization": {
    "default_language": "en",
    "supported_languages": ["en", "es", "fr", "de"],
    "messages": {
      "en": {
        "startup.title": "🎯 SynthDev AI Assistant",
        "prompts.user_input": "💭 You: "
      },
      "es": {
        "startup.title": "🎯 Asistente IA SynthDev",
        "prompts.user_input": "💭 Tú: "
      },
      "fr": {
        "startup.title": "🎯 Assistant IA SynthDev",
        "prompts.user_input": "💭 Vous: "
      }
    }
  }
}
```

## Accessibility Features

### Screen Reader Support
```json
{
  "accessibility": {
    "screen_reader": {
      "enabled": true,
      "announce_status": true,
      "describe_progress": true,
      "alt_text": {
        "thinking": "AI is processing your request",
        "executing": "Executing tool operation",
        "completed": "Operation completed successfully"
      }
    },
    "visual": {
      "high_contrast": false,
      "large_text": false,
      "reduce_motion": false
    }
  }
}
```

### Keyboard Navigation
```json
{
  "keyboard": {
    "shortcuts": {
      "help": "F1",
      "cancel": "Ctrl+C",
      "clear": "Ctrl+L",
      "history": "Ctrl+R"
    },
    "navigation": {
      "tab_completion": true,
      "arrow_history": true,
      "vim_mode": false
    }
  }
}
```

## Performance and Display

### Output Management
```json
{
  "output": {
    "buffering": {
      "enabled": true,
      "buffer_size": 1000,
      "flush_interval": 100
    },
    "formatting": {
      "max_line_length": 120,
      "indent_size": 2,
      "preserve_whitespace": true
    },
    "truncation": {
      "enabled": true,
      "max_lines": 1000,
      "truncate_message": "... (output truncated, {hidden} lines hidden)"
    }
  }
}
```

### Progress Indicators
```json
{
  "progress": {
    "spinners": {
      "default": ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      "dots": ["⠋", "⠙", "⠚", "⠞", "⠖", "⠦", "⠴", "⠲", "⠳", "⠓"],
      "bars": ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
    },
    "progress_bars": {
      "style": "bar",
      "width": 40,
      "complete_char": "█",
      "incomplete_char": "░"
    }
  }
}
```

## Best Practices

### Message Design
1. **Clear and concise**: Keep messages brief but informative
2. **Consistent tone**: Maintain consistent voice across all messages
3. **Visual hierarchy**: Use emojis and formatting to create clear hierarchy
4. **User-friendly**: Write for your target audience's technical level

### Customization Strategy
1. **Start with defaults**: Begin with provided messages and customize gradually
2. **Brand consistency**: Align messages with your organization's voice
3. **User feedback**: Gather feedback on message clarity and usefulness
4. **Regular updates**: Keep messages current with feature changes

### Performance Considerations
1. **Message length**: Keep messages reasonably short for performance
2. **Dynamic content**: Use parameters for dynamic content rather than multiple messages
3. **Caching**: Leverage message caching for frequently displayed content
4. **Lazy loading**: Load complex UI elements only when needed

## Troubleshooting

### Common Issues
- **Messages not updating**: Check file syntax and restart application
- **Encoding issues**: Ensure UTF-8 encoding for special characters
- **Missing parameters**: Verify parameter substitution syntax
- **Layout problems**: Check terminal width and message length

### Debug Configuration
```json
{
  "debug": {
    "log_message_loading": true,
    "show_message_keys": false,
    "validate_parameters": true,
    "fallback_to_keys": true
  }
}
```

## Next Steps

- [Advanced Configuration](./advanced.md) - Programmatic UI customization
- [Environment Variables](./environment-variables.md) - UI-related environment settings
- [Troubleshooting](./troubleshooting.md) - Common UI configuration issues
