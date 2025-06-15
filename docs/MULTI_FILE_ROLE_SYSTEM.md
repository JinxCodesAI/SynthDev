# Multi-File Role System

## Overview

The role loading system has been enhanced to support loading AI roles from multiple JSON files within the `config/roles` directory and its subdirectories. This provides better organization and modularity for role definitions.

## Key Features

### 1. Multi-File Support

- Load roles from ALL JSON files in `config/roles/` directory
- Recursive scanning of subdirectories
- Automatic merging of role definitions from multiple files

### 2. Backward Compatibility

- Legacy `roles.json` file is still supported
- Existing role configurations continue to work unchanged
- Gradual migration path available

### 3. Flexible Organization

- Organize roles by category (e.g., `core-roles.json`, `specialized-roles.json`)
- Use subdirectories for better structure (e.g., `specialized/testing-roles.json`)
- Split large role files into smaller, manageable pieces

## Directory Structure

```
config/
├── defaults/
│   ├── application.json
│   └── environment-template.json    # Moved from roles/
├── roles/                           # Multi-file role loading
│   ├── roles.json                  # Legacy file (optional)
│   ├── core-roles.json             # Core system roles
│   ├── specialized-roles.json      # Specialized roles
│   └── custom/                     # Custom subdirectories
│       ├── my-roles.json           # Custom role definitions
│       └── team-roles.json         # Team-specific roles
└── ...
```

## Migration Guide

### From Single File to Multi-File

1. **Keep existing `roles.json`** - No immediate changes required
2. **Create new role files** - Add new JSON files for new roles
3. **Gradually split roles** - Move roles from `roles.json` to categorized files
4. **Remove `roles.json`** - Once all roles are moved (optional)

### Environment Template Migration

The `environment-template.json` file has been moved:

- **Old location**: `config/roles/environment-template.json`
- **New location**: `config/defaults/environment-template.json`
- **Backward compatibility**: Old location still works with deprecation warning

## Example Role Files

### `config/roles/core-roles.json`

```json
{
    "basic_assistant": {
        "level": "fast",
        "systemMessage": "You are a basic AI assistant...",
        "excludedTools": ["edit_file", "write_file", "execute_terminal"],
        "reminder": "Keep responses helpful and concise."
    },
    "research_assistant": {
        "level": "base",
        "systemMessage": "You are a research assistant...",
        "includedTools": ["read_file", "list_directory", "exact_search"],
        "reminder": "Focus on thorough research and analysis."
    }
}
```

### `config/roles/specialized/testing-roles.json`

```json
{
    "test_writer": {
        "level": "base",
        "systemMessage": "You are a specialized test writing assistant...",
        "excludedTools": ["execute_terminal"],
        "reminder": "Write thorough tests with good coverage."
    },
    "qa_specialist": {
        "level": "base",
        "systemMessage": "You are a Quality Assurance specialist...",
        "includedTools": ["read_file", "list_directory", "exact_search"],
        "reminder": "Focus on quality assurance and bug detection."
    }
}
```

## Technical Implementation

### Loading Process

1. Scan `config/roles/` directory recursively for JSON files
2. Load legacy `roles.json` first (if present)
3. Load all other JSON files in alphabetical order
4. Merge role definitions (later files override earlier ones for duplicate role names)
5. Cache merged configuration for performance

### Configuration Validation

- All JSON files must be valid JSON
- Role definitions must follow the standard role schema
- Duplicate role names will show warnings (last loaded wins)
- At least one role must be defined across all files

### Performance Considerations

- Role configurations are cached after first load
- Use `SystemMessages.reloadRoles()` to refresh cache during development
- Minimal performance impact compared to single-file loading

## Best Practices

### File Organization

- Use descriptive filenames (e.g., `core-roles.json`, `specialized-roles.json`)
- Group related roles in the same file
- Use subdirectories for logical separation
- Keep individual files under 50 roles for maintainability

### Role Naming

- Use consistent naming conventions across files
- Avoid duplicate role names across files
- Consider prefixing roles by category if needed

### Development Workflow

- Test role changes with `SystemMessages.reloadRoles()`
- Validate JSON syntax before committing
- Use the `/roles` command to verify loaded roles
- Run tests to ensure role configurations are valid

## Troubleshooting

### Common Issues

1. **Invalid JSON**: Check file syntax with a JSON validator
2. **No roles loaded**: Ensure at least one valid JSON file exists in `config/roles/`
3. **Missing roles**: Check file permissions and directory structure
4. **Duplicate warnings**: Review role names across multiple files

### Debugging

- Use `SystemMessages.getAvailableRoles()` to see all loaded roles
- Check console for loading warnings and errors
- Verify file paths and permissions
- Test with minimal role configurations first

## Benefits

### For Developers

- Better code organization and maintainability
- Easier collaboration on role definitions
- Reduced merge conflicts in version control
- Modular role management

### For Teams

- Separate role files for different team members
- Category-based role organization
- Easier role sharing and reuse
- Better documentation possibilities

### For System Administration

- Granular role management
- Easier backup and restore of specific role categories
- Better audit trails for role changes
- Simplified deployment of role updates
