# Few-Shot Prompting Example

This document demonstrates how few-shot prompting works in Synth-Dev using the `prompt_enhancer` role as an example.

## What is Few-Shot Prompting?

Few-shot prompting is a technique where you provide the AI with examples of expected behavior before asking it to perform a task. This helps the AI understand the desired response format, style, and approach.

## Example: Prompt Enhancer Role

The `prompt_enhancer` role includes built-in examples that demonstrate how to analyze and improve user prompts.

### Role Configuration

```json
{
    "prompt_enhancer": {
        "level": "fast",
        "systemMessage": "You are a prompt enhancement assistant specialized in improving user prompts...",
        "examples": [
            {
                "role": "user",
                "content": "review @e:\\AI\\projects\\synth-dev\\systemMessages.js @e:\\AI\\projects\\synth-dev\\config\\roles\\roles.json I want to make \"excludedTools\" more flexible I want to be able to use wildcards and ideally regular expressions like \"*file\" excluding all 3 \"read_file\" \"write_file\" \"edit_file\""
            },
            {
                "role": "function",
                "name": "submit_enhanced_prompt",
                "content": "",
                "arguments": "{\"enhancement_needed\":true,\"enhanced_prompt\":\"Review the systemMessages.js file and the config/roles/roles.json configuration file to understand how the \\\"excludedTools\\\" feature currently works. I want to enhance the excludedTools functionality to support pattern matching instead of just exact tool name matches. \\n\\n Specifically, I want to implement: \\n\\n- Wildcard support using * (e.g., \\\"*file\\\" matches \\\"read_file\\\", \\\"write_file\\\")\\n- Regular expression support with /pattern/flags syntax\\n- Maintain backward compatibility with existing exact string matches \\n\\n Please analyze the current implementation, create a detailed plan for enhancing the excludedTools pattern matching, and implement the changes while preserving the existing functionality for roles that use exact tool names.\"}"
            },
            {
                "role": "user",
                "content": "Hi"
            },
            {
                "role": "function",
                "name": "submit_enhanced_prompt",
                "content": "User, just said hi, no enhancement needed",
                "arguments": "{\"enhancement_needed\":false}"
            }
        ]
    }
}
```

## How It Works

### 1. Role Activation

When you switch to the prompt_enhancer role:

```bash
/role prompt_enhancer
```

The system automatically:

1. Loads the role's system message
2. Inserts the examples into the conversation context
3. Switches to the appropriate model (fast model for this role)

### 2. Context Structure

The conversation context becomes:

```
1. System Message: "You are a prompt enhancement assistant..."
2. Example 1 (User): Complex prompt needing enhancement
3. Example 1 (Function): Enhanced version with detailed improvements
4. Example 2 (User): Simple greeting
5. Example 2 (Function): Recognition that no enhancement is needed
6. [Your actual conversation starts here]
```

### 3. Behavior Demonstration

The examples show the AI:

**Example 1 demonstrates:**

- How to analyze a vague, technical request
- How to break down requirements into specific tasks
- How to add technical context and implementation details
- How to structure an enhanced prompt with clear sections

**Example 2 demonstrates:**

- How to recognize when enhancement isn't needed
- How to handle simple inputs appropriately
- How to set `enhancement_needed` to false for basic interactions

## Benefits in Practice

### Before Few-Shot Prompting

Without examples, the prompt enhancer might:

- Be inconsistent in response format
- Miss important technical details
- Over-enhance simple prompts
- Under-enhance complex requests

### After Few-Shot Prompting

With examples, the prompt enhancer:

- ✅ Consistently uses the correct function format
- ✅ Provides detailed technical enhancements when needed
- ✅ Recognizes when prompts don't need improvement
- ✅ Maintains consistent quality and structure

## Testing the Feature

### 1. Switch to the Role

```bash
/role prompt_enhancer
```

### 2. Test with a Vague Prompt

Input:

```
make the code better
```

Expected behavior: The AI should enhance this vague prompt with specific improvements, following the pattern shown in the examples.

### 3. Test with a Clear Prompt

Input:

```
Hello, how are you?
```

Expected behavior: The AI should recognize this doesn't need enhancement and set `enhancement_needed` to false.

## Creating Your Own Examples

### 1. Identify Patterns

For your custom role, identify:

- What types of inputs will it receive?
- What should the ideal responses look like?
- What common mistakes should be avoided?

### 2. Create Representative Examples

```json
"examples": [
    {
        "role": "user",
        "content": "Typical input your role will handle"
    },
    {
        "role": "assistant",
        "content": "Ideal response showing expected behavior"
    },
    {
        "role": "user",
        "content": "Edge case or special situation"
    },
    {
        "role": "assistant",
        "content": "How to handle the edge case appropriately"
    }
]
```

### 3. Test and Refine

- Test your role with various inputs
- Observe if the AI follows the example patterns
- Refine examples based on actual behavior
- Add more examples for uncovered cases

## Best Practices

### Example Quality

- **Be Specific**: Show exact formats and structures
- **Cover Edge Cases**: Include examples for unusual inputs
- **Show Variety**: Demonstrate different types of responses
- **Keep Concise**: Don't make examples unnecessarily long

### Example Quantity

- **Start Small**: Begin with 2-4 high-quality examples
- **Add Gradually**: Add more examples as you identify gaps
- **Monitor Tokens**: Remember examples consume tokens in every API call

### Testing

- **Systematic Testing**: Test with inputs similar to your examples
- **Edge Case Testing**: Try inputs that differ from examples
- **Consistency Check**: Verify the AI maintains consistent behavior

## Technical Implementation

The few-shot prompting system:

1. **Loads Examples**: `SystemMessages.getExamples(role)` retrieves examples
2. **Inserts Context**: Examples are added after the system message
3. **Maintains State**: Examples persist throughout the conversation
4. **Handles Switching**: Previous examples are removed when changing roles
5. **API Transparency**: Examples appear as regular messages to the AI

This creates a seamless experience where the AI has the context it needs without requiring special API features or complex prompt engineering.

## Related Documentation

- [Role Configuration Guide](RoleConfiguration.md) - Complete role configuration reference
- [Main README](README.md) - General application overview
- [Configuration README](../config/README.md) - Configuration system details
