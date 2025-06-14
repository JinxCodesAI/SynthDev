# AI Role Configuration Guide

## Overview

Synth-Dev's AI role system provides specialized AI personas with distinct behaviors, tool access permissions, and few-shot prompting capabilities. Roles are configured in `config/roles/roles.json` and automatically loaded by the system.

## Role Configuration Structure

Each role is defined as a JSON object with the following properties:

```json
{
    "role_name": {
        "level": "base|smart|fast",
        "systemMessage": "Role instructions and behavior description",
        "excludedTools": ["tool1", "tool2"],
        "includedTools": ["tool3", "tool4"],
        "reminder": "Additional instructions during tool execution",
        "examples": [
            {
                "role": "user|assistant|function",
                "content": "Message content",
                "name": "function_name",
                "arguments": "{\"param\": \"value\"}"
            }
        ],
        "parsingTools": [
            {
                "type": "function",
                "function": {
                    "name": "tool_name",
                    "description": "Tool description",
                    "parameters": {
                        /* JSON Schema */
                    }
                }
            }
        ]
    }
}
```

## Configuration Properties

### Required Properties

#### `level` (string)

Determines which AI model to use for this role:

- `"base"`: Default model for general tasks
- `"smart"`: Advanced model for complex reasoning (architect role)
- `"fast"`: Lightweight model for quick tasks

#### `systemMessage` (string)

Core instructions that define the role's behavior, expertise, and responsibilities. This message is sent to the AI as the system prompt.

### Optional Properties

#### `excludedTools` (array) - **Mutually exclusive with `includedTools`**

List of tools this role cannot access. When present, all tools are available except those matching the exclusion patterns. Supports:

- **Exact matches**: `"read_file"`
- **Wildcards**: `"*file"` (matches read_file, write_file, edit_file)
- **Regular expressions**: `"/^execute_/"` (matches tools starting with "execute\_")

#### `includedTools` (array) - **Mutually exclusive with `excludedTools`**

List of tools this role can access. When present, only tools matching the inclusion patterns are available. Supports the same pattern matching as `excludedTools`:

- **Exact matches**: `"read_file"`
- **Wildcards**: `"*file"` (matches read_file, write_file, edit_file)
- **Regular expressions**: `"/^execute_/"` (matches tools starting with "execute\_")

**Important**: A role cannot have both `includedTools` and `excludedTools` properties. They are mutually exclusive. If neither is present, the role defaults to having no tools available (equivalent to `"includedTools": []`).

#### `reminder` (string)

Additional instructions shown to the AI during tool execution phases. Helps maintain role consistency during complex interactions.

#### `examples` (array)

Conversation examples for few-shot prompting. Each example is a message object with:

- `role`: Message sender (`"user"`, `"assistant"`, or `"function"`)
- `content`: Message content
- `name`: Function name (for function messages)
- `arguments`: Function arguments (for function messages)

#### `parsingTools` (array)

Special tools for structured output parsing. Used by roles that need to return formatted responses.

## Few-Shot Prompting

### What is Few-Shot Prompting?

Few-shot prompting provides the AI with examples of expected behavior patterns. When you switch to a role with examples, they are automatically added to the conversation context to guide responses.

### How It Works

1. **Role Selection**: When you use `/role role_name`, the system loads the role configuration
2. **Example Loading**: If the role has examples, they are automatically inserted after the system message
3. **Context Provision**: Examples provide context for how the AI should respond to similar inputs
4. **Behavior Guidance**: The AI uses examples to understand expected response patterns and formats

### Example Structure

```json
"examples": [
    {
        "role": "user",
        "content": "Please enhance this prompt: 'make the code better'"
    },
    {
        "role": "function",
        "name": "submit_enhanced_prompt",
        "content": "",
        "arguments": "{\"enhancement_needed\":true,\"enhanced_prompt\":\"Review the existing code and improve its quality by: optimizing performance, enhancing readability, adding proper error handling, and ensuring it follows best practices. Please specify which aspects need the most attention.\"}"
    },
    {
        "role": "user",
        "content": "Hi"
    },
    {
        "role": "function",
        "name": "submit_enhanced_prompt",
        "content": "Simple greeting, no enhancement needed",
        "arguments": "{\"enhancement_needed\":false}"
    }
]
```

### Benefits

- **Consistent Responses**: Examples ensure the AI responds in the expected format
- **Better Understanding**: Context helps the AI understand complex or specialized tasks
- **Quality Improvement**: Few-shot learning typically produces more accurate responses
- **Role Specialization**: Each role can have examples tailored to its specific purpose

## Built-in Roles

### Development Roles

#### `coder`

- **Purpose**: Software development and implementation
- **Level**: base
- **Tools**: Full access except time/calculation utilities (uses `excludedTools`)
- **Behavior**: Focuses on writing clean, maintainable code with proper error handling

#### `reviewer`

- **Purpose**: Code review and quality assurance
- **Level**: base
- **Tools**: Read-only access (no file modification, uses `excludedTools`)
- **Behavior**: Analyzes code quality, identifies bugs, checks against requirements

#### `architect`

- **Purpose**: System design and architecture planning
- **Level**: smart (uses advanced model)
- **Tools**: Read-only access for analysis (uses `excludedTools`)
- **Behavior**: Creates detailed implementation plans, analyzes existing architecture

#### `file_reader`

- **Purpose**: File reading and analysis only
- **Level**: fast
- **Tools**: Limited to read_file, list_directory, exact_search (uses `includedTools`)
- **Behavior**: Can only read and analyze files, cannot modify them

### Utility Roles

#### `prompt_enhancer`

- **Purpose**: Improving user prompts with AI assistance
- **Level**: fast
- **Tools**: Analysis tools only
- **Examples**: ✅ Includes few-shot examples for prompt enhancement patterns
- **Behavior**: Analyzes prompts and suggests improvements

#### `file_summarizer`

- **Purpose**: Analyzing and summarizing individual files
- **Level**: fast
- **Tools**: Limited to analysis tools
- **Behavior**: Provides concise technical summaries of file functionality

#### `codebase_explainer`

- **Purpose**: Explaining codebase functionality using indexed summaries
- **Level**: fast
- **Tools**: Analysis and search tools
- **Behavior**: Answers questions about codebase structure and functionality

## Creating Custom Roles

### Step 1: Define Role Configuration

Add your role to `config/roles/roles.json`:

```json
{
    "my_custom_role": {
        "level": "base",
        "systemMessage": "You are a specialized assistant for...",
        "excludedTools": ["execute_terminal"],
        "reminder": "Remember to follow security guidelines",
        "examples": [
            {
                "role": "user",
                "content": "Example input"
            },
            {
                "role": "assistant",
                "content": "Example response showing expected behavior"
            }
        ]
    },
    "read_only_role": {
        "level": "fast",
        "systemMessage": "You can only read and analyze files, not modify them.",
        "includedTools": ["read_file", "list_directory", "exact_search"],
        "reminder": "Remember you can only read files, never modify them"
    }
}
```

### Step 2: Design Examples (Optional)

If your role benefits from few-shot prompting:

1. **Identify Patterns**: What types of inputs will this role handle?
2. **Create Examples**: Show ideal input/output pairs
3. **Include Edge Cases**: Handle common variations or special cases
4. **Test Behavior**: Verify examples produce desired AI behavior

### Step 3: Test the Role

```bash
/role my_custom_role
# Test various inputs to verify behavior
```

## Best Practices

### System Message Design

- **Be Specific**: Clearly define the role's purpose and responsibilities
- **Include Context**: Explain what tools are available and how to use them
- **Set Expectations**: Define the quality and format of expected outputs
- **Provide Guidelines**: Include any constraints or special requirements

### Example Design

- **Quality Over Quantity**: A few high-quality examples are better than many poor ones
- **Representative Cases**: Include examples that cover the main use cases
- **Show Format**: Demonstrate the expected response structure and style
- **Handle Edge Cases**: Include examples for unusual or boundary conditions

### Tool Exclusion

- **Security First**: Exclude dangerous tools for roles that don't need them
- **Role Appropriate**: Only include tools relevant to the role's purpose
- **Use Patterns**: Leverage wildcards and regex for flexible exclusions

## Advanced Features

### Pattern Matching in Tool Filtering

Both `excludedTools` and `includedTools` support the same pattern matching syntax:

```json
"excludedTools": [
    "exact_tool_name",     // Exact match
    "*file",               // Wildcard: matches any tool ending with "file"
    "execute_*",           // Wildcard: matches any tool starting with "execute_"
    "/^dangerous_/i"       // Regex: case-insensitive match for tools starting with "dangerous_"
]
```

```json
"includedTools": [
    "read_file",           // Exact match: only allow read_file
    "*search*",            // Wildcard: allow any tool containing "search"
    "/^analyze_/"          // Regex: allow tools starting with "analyze_"
]
```

### Tool Filtering Logic

- **With `excludedTools`**: All tools are available except those matching exclusion patterns
- **With `includedTools`**: Only tools matching inclusion patterns are available
- **With neither**: No tools are available (default behavior)
- **With both**: Configuration error - they are mutually exclusive

### Function Examples

For roles that use parsing tools or structured output:

```json
"examples": [
    {
        "role": "user",
        "content": "Process this data"
    },
    {
        "role": "function",
        "name": "process_data",
        "arguments": "{\"data\": \"processed_value\", \"status\": \"success\"}",
        "content": "Data processed successfully"
    }
]
```

## Troubleshooting

### Role Not Loading

- Check JSON syntax in `config/roles/roles.json`
- Verify role name doesn't conflict with existing roles
- Ensure all required properties are present

### Examples Not Working

- Verify example structure matches expected format
- Check that `role` field uses valid values (`user`, `assistant`, `function`)
- Ensure JSON is properly formatted

### Tool Filtering Issues

- Test filtering patterns with `/tools` command
- Verify wildcard and regex syntax
- Check for typos in tool names
- Ensure `includedTools` and `excludedTools` are not both present in the same role

## Configuration File Location

The role configuration file is located at:

```
config/roles/roles.json
```

Changes to this file are automatically loaded when switching roles or restarting the application.

## Implementation Details

### How Few-Shot Prompting Works Internally

1. **Role Loading**: When `SystemMessages.getExamples(role)` is called, examples are loaded from the role configuration
2. **Message Insertion**: Examples are inserted immediately after the system message in the conversation
3. **Context Preservation**: Examples remain in context throughout the conversation
4. **Role Switching**: When switching roles, previous examples are removed and new ones are added
5. **API Transparency**: Examples appear as regular conversation messages to the AI API

### Message Flow

```
Conversation Structure:
1. System Message (role instructions)
2. Example Messages (few-shot context)
3. User Messages (actual conversation)
4. Assistant Responses
```

### Example Processing

The system processes examples as follows:

```javascript
// Example from configuration
{
    "role": "user",
    "content": "Example input",
    "name": "optional_function_name",
    "arguments": "optional_function_args"
}

// Processed message added to conversation
{
    "role": "user",
    "content": "Example input"
    // name and arguments added only if present
}
```

## Integration with Other Systems

### Model Selection

- Role `level` determines which AI model is used
- Smart roles automatically use the configured smart model
- Fast roles use lightweight models for quick responses

### Tool Filtering

- `excludedTools` patterns are evaluated when loading tools
- Pattern matching supports exact strings, wildcards, and regex
- Tool filtering is applied before sending tools to the AI

### Conversation Management

- Examples are tracked separately from user messages
- Conversation clearing preserves system message and examples
- Snapshot system includes examples in saved state

## Migration Guide

### From Old systemMessages.js Format

If you have roles defined in the old `systemMessages.js` format:

**Old Format:**

```javascript
coder: {
    level: 'base',
    systemMessage: 'You are a coder...',
    excludedTools: ['tool1'],
    reminder: 'Remember...'
}
```

**New Format:**

```json
{
    "coder": {
        "level": "base",
        "systemMessage": "You are a coder...",
        "excludedTools": ["tool1"],
        "reminder": "Remember...",
        "examples": []
    }
}
```

### Adding Examples to Existing Roles

To add few-shot prompting to an existing role:

1. **Identify Use Cases**: What inputs does this role typically handle?
2. **Create Example Pairs**: For each use case, create user input + expected response
3. **Add to Configuration**: Insert examples array in role definition
4. **Test Behavior**: Verify the AI responds as expected with the new examples

## Performance Considerations

### Token Usage

- Examples consume tokens in every API call
- Keep examples concise but informative
- Consider the cumulative token cost for roles with many examples

### Memory Management

- Examples are loaded once per role switch
- Previous examples are properly cleaned up when switching roles
- No memory leaks from accumulated examples

### API Efficiency

- Examples are sent as regular messages (no special API features required)
- Compatible with all OpenAI-compatible APIs
- No additional API calls needed for few-shot functionality

## Security Considerations

### Example Content

- Examples are sent to the AI API as part of the conversation
- Avoid including sensitive information in examples
- Examples should demonstrate safe, appropriate behavior

### Tool Access Control

- Use `excludedTools` to restrict dangerous tools for specific roles
- Pattern matching allows flexible but secure tool filtering
- Regular expressions enable complex exclusion rules

## Future Enhancements

### Planned Features

- Dynamic example selection based on context
- Example templates with variable substitution
- Role inheritance and composition
- Performance analytics for different example sets

### Extensibility

- The role system is designed to be easily extended
- New properties can be added to role configurations
- Custom processing logic can be added to SystemMessages class

## Related Documentation

- [Main README](README.md) - General application overview
- [Tool Creation Guidelines](ToolCreationGuidelines.md) - Creating new tools
- [Configuration Migration Plan](CONFIGURATION_MIGRATION_PLAN.md) - Configuration system details
- [ConfigManager Documentation](ConfigManager.md) - Configuration management

## Support

For questions about role configuration or few-shot prompting:

1. Check this documentation for common patterns
2. Review existing role configurations in `config/roles/roles.json`
3. Test changes incrementally with simple examples
4. Report issues or request features via GitHub Issues
