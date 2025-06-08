# Configuration System

This directory contains external configuration files that allow users to customize Synth-Dev's behavior without modifying source code.

## Structure

```
config/
├── README.md                    # This file
├── roles/                       # AI role definitions
│   ├── roles.json              # Main role configurations
│   └── environment-template.json # Environment info template
├── tools/                       # Tool configuration overrides
│   ├── tool-messages.json      # Common tool messages
│   └── safety-patterns.json    # Security patterns for execute_script
├── ui/                         # User interface text
│   ├── console-messages.json   # Console interface messages
│   ├── command-help.json       # Command descriptions and help
│   └── startup-messages.json   # Application startup text
├── validation/                 # Validation rules and messages
│   ├── config-validation.json  # Configuration validation rules
│   └── error-messages.json     # Standard error messages
└── defaults/                   # Default configuration values
    ├── application.json        # Application defaults
    └── models.json             # Model-specific defaults
```

## Usage

1. **Roles**: Customize AI behavior by editing `roles/roles.json`
2. **Tools**: Override tool descriptions in `tools/tool-messages.json`
3. **UI**: Customize user-facing text in `ui/` files
4. **Validation**: Modify validation rules and error messages
5. **Defaults**: Change default values and limits

## Loading Order

1. Built-in defaults (fallback)
2. Configuration files (if present)
3. Environment variables (highest priority)
4. Command line arguments (override all)

## Backward Compatibility

All configuration files are optional. If a file is missing, the system falls back to hardcoded defaults, ensuring backward compatibility.
