# AI Roles & Few-Shot Prompting Guide

This guide covers SynthDev's AI role system and few-shot prompting capabilities, which provide specialized AI personas with distinct behaviors and learning examples.

## Overview

SynthDev's AI role system enables:

- **Specialized AI Personas**: Different roles for different tasks
- **Tool Access Control**: Role-based permissions for tools
- **Few-Shot Learning**: Examples that guide AI behavior
- **Multi-Model Support**: Different complexity levels for different roles

## Role System Basics

### Switching Roles

```bash
# List available roles
/roles

# Switch to a specific role
/role coder
/role reviewer
/role architect
```

### Built-in Roles

#### Development Roles

**coder**

- **Purpose**: Software development and implementation
- **Level**: base
- **Tools**: Full access except time/calculation utilities
- **Behavior**: Focuses on writing clean, maintainable code

**reviewer**

- **Purpose**: Code review and quality assurance
- **Level**: base
- **Tools**: Read-only access (no file modification)
- **Behavior**: Analyzes code quality, identifies bugs

**architect**

- **Purpose**: System design and architecture planning
- **Level**: smart (uses advanced model)
- **Tools**: Read-only access for analysis
- **Behavior**: Creates detailed implementation plans

**file_reader**

- **Purpose**: File reading and analysis only
- **Level**: fast
- **Tools**: Limited to read_file, list_directory, exact_search
- **Behavior**: Can only read and analyze files

#### Utility Roles

**prompt_enhancer**

- **Purpose**: Improving user prompts with AI assistance
- **Level**: fast
- **Tools**: Analysis tools only
- **Examples**: ✅ Includes few-shot examples
- **Behavior**: Analyzes prompts and suggests improvements

**file_summarizer**

- **Purpose**: Analyzing and summarizing individual files
- **Level**: fast
- **Tools**: Limited to analysis tools
- **Behavior**: Provides concise technical summaries

**codebase_explainer**

- **Purpose**: Explaining codebase functionality using indexed summaries
- **Level**: fast
- **Tools**: Analysis and search tools
- **Behavior**: Answers questions about codebase structure

**command_generator**

- **Purpose**: Converting natural language to terminal commands
- **Level**: fast
- **Tools**: No tools (generates commands only)
- **Behavior**: Creates safe, accurate terminal commands

**directory_summarizer**

- **Purpose**: Analyzing and summarizing directory structures
- **Level**: fast
- **Tools**: Limited to analysis tools
- **Behavior**: Provides directory organization insights

**file_summarizer**

- **Purpose**: Analyzing and summarizing individual files in a codebase
- **Level**: fast
- **Tools**: Highly restricted (excludes most file operations)
- **Behavior**: Provides concise technical summaries of file contents

**dude**

- **Purpose**: General-purpose helpful assistant
- **Level**: fast
- **Tools**: All tools available
- **Behavior**: Can help with a wide range of tasks

#### **Additional Specialized Roles**

**basic_assistant** (from core-roles.json)

- **Purpose**: Basic AI assistant for general questions and tasks
- **Level**: fast
- **Tools**: Limited set excluding file modifications and terminal
- **Behavior**: Helpful and concise responses

**research_assistant** (from core-roles.json)

- **Purpose**: Information gathering and analysis specialist
- **Level**: base
- **Tools**: Read-only tools (read_file, list_directory, exact_search, explain_codebase)
- **Behavior**: Thorough research and detailed analysis

**test_writer** (from specialized/testing-roles.json)

- **Purpose**: Specialized test writing assistant
- **Level**: base
- **Tools**: Most tools available except terminal execution
- **Behavior**: Creates comprehensive, well-structured tests

**qa_specialist** (from specialized/testing-roles.json)

- **Purpose**: Quality assurance and bug detection specialist
- **Level**: base
- **Tools**: Read-only tools for code analysis
- **Behavior**: Focuses on finding bugs and testing edge cases

## Few-Shot Prompting

### What is Few-Shot Prompting?

Few-shot prompting provides the AI with examples of expected behavior patterns. When you switch to a role with examples, they are automatically added to the conversation context to guide responses.

### How It Works

1. **Role Selection**: Use `/role role_name` to load the role
2. **Example Loading**: Examples are automatically inserted after the system message
3. **Context Provision**: Examples provide context for expected response patterns
4. **Behavior Guidance**: AI uses examples to understand format and approach

### Example: Prompt Enhancer Role

The `prompt_enhancer` role demonstrates few-shot prompting:

```json
{
    "prompt_enhancer": {
        "level": "fast",
        "systemMessage": "You are a prompt enhancement assistant...",
        "examples": [
            {
                "role": "user",
                "content": "make the code better"
            },
            {
                "role": "function",
                "name": "submit_enhanced_prompt",
                "arguments": "{\"enhancement_needed\":true,\"enhanced_prompt\":\"Review the existing code and improve its quality by: optimizing performance, enhancing readability, adding proper error handling, and ensuring it follows best practices. Please specify which aspects need the most attention.\"}"
            },
            {
                "role": "user",
                "content": "Hi"
            },
            {
                "role": "function",
                "name": "submit_enhanced_prompt",
                "arguments": "{\"enhancement_needed\":false}"
            }
        ]
    }
}
```

### Benefits of Few-Shot Prompting

- **Consistent Responses**: Examples ensure AI responds in expected format
- **Better Understanding**: Context helps AI understand complex tasks
- **Quality Improvement**: Few-shot learning produces more accurate responses
- **Role Specialization**: Each role can have examples tailored to its purpose

## Role Configuration

### Configuration Structure

Roles can be defined in multiple files within the `config/roles/` directory:

#### **Multi-File Role System**

SynthDev supports organizing roles across multiple JSON files:

- **`config/roles/roles.json`** - Main role definitions (legacy support)
- **`config/roles/core-roles.json`** - Core system roles
- **`config/roles/specialized/testing-roles.json`** - Testing-specific roles
- **Any `.json` file** in `config/roles/` and subdirectories

All JSON files are automatically loaded and merged. If roles have the same name, later files override earlier ones.

#### **Basic Role Structure**

Example role definition:

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
        ]
    }
}
```

### Required Properties

#### level (string)

Determines which AI model to use:

- `"base"`: Default model for general tasks
- `"smart"`: Advanced model for complex reasoning
- `"fast"`: Lightweight model for quick tasks

#### systemMessage (string)

Core instructions that define the role's behavior, expertise, and responsibilities.

### Optional Properties

#### Tool Access Control

**excludedTools** (mutually exclusive with includedTools)

```json
"excludedTools": [
    "exact_tool_name",     // Exact match
    "*file",               // Wildcard: matches tools ending with "file"
    "execute_*",           // Wildcard: matches tools starting with "execute_"
    "/^dangerous_/i"       // Regex: case-insensitive match
]
```

**includedTools** (mutually exclusive with excludedTools)

```json
"includedTools": [
    "read_file",           // Only allow specific tools
    "*search*",            // Wildcard patterns
    "/^analyze_/"          // Regex patterns
]
```

#### reminder (string)

Additional instructions shown during tool execution phases.

#### examples (array)

Conversation examples for few-shot prompting. Each example has:

- `role`: Message sender (`"user"`, `"assistant"`, or `"function"`)
- `content`: Message content
- `name`: Function name (for function messages)
- `arguments`: Function arguments (for function messages)

## Creating Custom Roles

### Step 1: Define Role Configuration

Add to `config/roles/roles.json`:

````json
{
    "my_custom_role": {
        "level": "base",
        "systemMessage": "You are a specialized assistant for database operations. You help users write SQL queries, optimize database performance, and design database schemas.",
        "excludedTools": ["execute_terminal", "write_file"],
        "reminder": "Always validate SQL syntax before suggesting queries",
        "examples": [
            {
                "role": "user",
                "content": "Help me write a query to find all users"
            },
            {
                "role": "assistant",
                "content": "I'll help you write a SQL query. To find all users, you can use:\n\n```sql\nSELECT * FROM users;\n```\n\nIf you want to be more specific and only select certain columns:\n\n```sql\nSELECT id, username, email, created_at FROM users;\n```"
            }
        ]
    }
}
````

### Step 2: Design Examples (Optional)

For effective few-shot prompting:

1. **Identify Patterns**: What types of inputs will this role handle?
2. **Create Examples**: Show ideal input/output pairs
3. **Include Edge Cases**: Handle common variations
4. **Test Behavior**: Verify examples produce desired AI behavior

### Step 3: Test the Role

```bash
/role my_custom_role
# Test various inputs to verify behavior
```

## Advanced Features

### Pattern Matching in Tool Filtering

Both `excludedTools` and `includedTools` support:

```json
"excludedTools": [
    "exact_tool_name",     // Exact match
    "*file",               // Wildcard: any tool ending with "file"
    "execute_*",           // Wildcard: any tool starting with "execute_"
    "/^dangerous_/i"       // Regex: case-insensitive match for "dangerous_"
]
```

### Tool Filtering Logic

- **With excludedTools**: All tools available except those matching patterns
- **With includedTools**: Only tools matching patterns are available
- **With neither**: No tools available (default behavior)
- **With both**: Configuration error - they are mutually exclusive

### Function Examples for Structured Output

For roles using parsing tools:

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

## Best Practices

### System Message Design

- **Be Specific**: Clearly define the role's purpose and responsibilities
- **Include Context**: Explain available tools and how to use them
- **Set Expectations**: Define quality and format of expected outputs
- **Provide Guidelines**: Include constraints or special requirements

### Example Design

- **Quality Over Quantity**: Few high-quality examples beat many poor ones
- **Representative Cases**: Cover main use cases
- **Show Format**: Demonstrate expected response structure
- **Handle Edge Cases**: Include examples for boundary conditions

### Tool Access Control

- **Security First**: Exclude dangerous tools for roles that don't need them
- **Role Appropriate**: Only include tools relevant to the role's purpose
- **Use Patterns**: Leverage wildcards and regex for flexible exclusions

## Testing Your Roles

### Basic Testing

```bash
# Switch to your role
/role my_custom_role

# Test typical inputs
Help me with a database query

# Test edge cases
Hi there

# Verify tool access
/tools
```

### Validation Checklist

- [ ] Role loads without errors
- [ ] System message is appropriate
- [ ] Tool filtering works as expected
- [ ] Examples guide behavior correctly
- [ ] AI responds in expected format
- [ ] Edge cases are handled properly

## Troubleshooting

### Role Not Loading

- Check JSON syntax in `config/roles/roles.json`
- Verify role name doesn't conflict with existing roles
- Ensure all required properties are present

### Examples Not Working

- Verify example structure matches expected format
- Check that `role` field uses valid values
- Ensure JSON is properly formatted

### Tool Filtering Issues

- Test filtering patterns with `/tools` command
- Verify wildcard and regex syntax
- Check for typos in tool names
- Ensure `includedTools` and `excludedTools` aren't both present

---

_For configuration details, see [Configuration Guide](configuration.md)_
_For creating custom tools, see [Tool Development](tool-development.md)_
