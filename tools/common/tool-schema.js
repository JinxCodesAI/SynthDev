/**
 * Tool Definition Schema and Validation
 * Provides standardized schema validation for tool definitions
 */

/**
 * Standard tool definition schema
 */
export const TOOL_DEFINITION_SCHEMA = {
    name: { type: 'string', required: true },
    description: { type: 'string', required: true },
    auto_run: { type: 'boolean', required: true },
    requires_backup: { type: 'boolean', required: true },
    backup_resource_path_property_name: { type: 'string', required: true },
    category: { type: 'string', required: false, enum: ['file', 'command', 'utility', 'search', 'calculation'] },
    version: { type: 'string', required: false, default: '1.0.0' },
    author: { type: 'string', required: false },
    tags: { type: 'array', required: false, items: { type: 'string' } },
    schema: {
        type: 'object',
        required: true,
        properties: {
            type: { type: 'string', required: true, enum: ['function'] },
            function: {
                type: 'object',
                required: true,
                properties: {
                    name: { type: 'string', required: true },
                    description: { type: 'string', required: true },
                    parameters: {
                        type: 'object',
                        required: true,
                        properties: {
                            type: { type: 'string', required: true, enum: ['object'] },
                            properties: { type: 'object', required: true },
                            required: { type: 'array', required: false, items: { type: 'string' } }
                        }
                    },
                    response_format: {
                        type: 'object',
                        required: false,
                        properties: {
                            description: { type: 'string', required: true }
                        }
                    }
                }
            }
        }
    }
};

/**
 * Validate a tool definition against the schema
 * @param {Object} definition - Tool definition to validate
 * @param {string} toolName - Tool name for error reporting
 * @returns {Object} Validation result with success flag and errors
 */
export function validateToolDefinition(definition, toolName = 'unknown') {
    const errors = [];
    const warnings = [];

    try {
        // Check if definition is an object
        if (!definition || typeof definition !== 'object') {
            return {
                success: false,
                errors: ['Tool definition must be a valid object'],
                warnings: []
            };
        }

        // Validate each field in the schema
        validateObject(definition, TOOL_DEFINITION_SCHEMA, '', errors, warnings);

        // Additional business logic validations
        validateBusinessRules(definition, errors, warnings);

        return {
            success: errors.length === 0,
            errors,
            warnings
        };
    } catch (error) {
        return {
            success: false,
            errors: [`Validation error: ${error.message}`],
            warnings: []
        };
    }
}

/**
 * Recursively validate an object against a schema
 * @param {Object} obj - Object to validate
 * @param {Object} schema - Schema to validate against
 * @param {string} path - Current validation path (for error reporting)
 * @param {Array} errors - Array to collect errors
 * @param {Array} warnings - Array to collect warnings
 */
function validateObject(obj, schema, path, errors, warnings) {
    // Check required fields
    for (const [key, fieldSchema] of Object.entries(schema)) {
        const fieldPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        // Check if required field is missing
        if (fieldSchema.required && (value === undefined || value === null)) {
            errors.push(`Missing required field: ${fieldPath}`);
            continue;
        }

        // Skip validation if field is not present and not required
        if (value === undefined || value === null) {
            continue;
        }

        // Validate field type
        if (fieldSchema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== fieldSchema.type) {
                errors.push(`Field ${fieldPath} must be of type ${fieldSchema.type}, got ${actualType}`);
                continue;
            }
        }

        // Validate enum values
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(`Field ${fieldPath} must be one of: ${fieldSchema.enum.join(', ')}, got ${value}`);
        }

        // Validate array items
        if (fieldSchema.type === 'array' && fieldSchema.items) {
            value.forEach((item, index) => {
                const itemPath = `${fieldPath}[${index}]`;
                if (fieldSchema.items.type) {
                    const itemType = Array.isArray(item) ? 'array' : typeof item;
                    if (itemType !== fieldSchema.items.type) {
                        errors.push(`Array item ${itemPath} must be of type ${fieldSchema.items.type}, got ${itemType}`);
                    }
                }
            });
        }

        // Recursively validate nested objects
        if (fieldSchema.type === 'object' && fieldSchema.properties) {
            validateObject(value, fieldSchema.properties, fieldPath, errors, warnings);
        }
    }

    // Check for unexpected fields (warnings only)
    for (const key of Object.keys(obj)) {
        if (!schema[key]) {
            const fieldPath = path ? `${path}.${key}` : key;
            warnings.push(`Unexpected field: ${fieldPath}`);
        }
    }
}

/**
 * Validate business rules for tool definitions
 * @param {Object} definition - Tool definition
 * @param {Array} errors - Array to collect errors
 * @param {Array} warnings - Array to collect warnings
 */
function validateBusinessRules(definition, errors, warnings) {
    // Validate backup configuration
    if (definition.requires_backup && !definition.backup_resource_path_property_name) {
        errors.push("'backup_resource_path_property_name' must be specified when 'requires_backup' is true");
    }

    if (!definition.requires_backup && definition.backup_resource_path_property_name && definition.backup_resource_path_property_name !== "") {
        warnings.push("'backup_resource_path_property_name' is specified but 'requires_backup' is false");
    }

    // Validate schema function name matches definition name
    if (definition.schema && definition.schema.function && definition.schema.function.name !== definition.name) {
        errors.push(`Schema function name '${definition.schema.function.name}' does not match definition name '${definition.name}'`);
    }

    // Validate parameters structure
    if (definition.schema && definition.schema.function && definition.schema.function.parameters) {
        const params = definition.schema.function.parameters;
        if (params.type !== 'object') {
            errors.push("Function parameters must be of type 'object'");
        }

        if (!params.properties || typeof params.properties !== 'object') {
            errors.push("Function parameters must have a 'properties' object");
        }

        // Validate required parameters exist in properties
        if (params.required && Array.isArray(params.required)) {
            for (const requiredParam of params.required) {
                if (!params.properties || !params.properties[requiredParam]) {
                    errors.push(`Required parameter '${requiredParam}' is not defined in properties`);
                }
            }
        }
    }
}

/**
 * Create a standardized tool definition template
 * @param {Object} options - Tool configuration options
 * @returns {Object} Standard tool definition template
 */
export function createToolDefinitionTemplate(options = {}) {
    const {
        name,
        description,
        auto_run = true,
        requires_backup = false,
        backup_resource_path_property_name = "",
        category = "utility",
        version = "1.0.0",
        author = "",
        tags = [],
        parameters = {},
        required = [],
        response_description = "Tool execution result with success status and relevant data"
    } = options;

    if (!name || !description) {
        throw new Error('Tool name and description are required');
    }

    return {
        name,
        description,
        auto_run,
        requires_backup,
        backup_resource_path_property_name,
        category,
        version,
        author,
        tags,
        schema: {
            type: "function",
            function: {
                name,
                description,
                parameters: {
                    type: "object",
                    properties: parameters,
                    required
                },
                response_format: {
                    description: response_description
                }
            }
        }
    };
}

/**
 * Standardized parameter types for common tool parameters
 */
export const STANDARD_PARAMETERS = {
    file_path: {
        type: "string",
        description: "Relative path to the file, starting from the current working directory. Supports forward slashes (/) and backslashes (\\) as path separators for cross-platform compatibility. Path must be relative and cannot access files outside the project directory for security."
    },
    content: {
        type: "string",
        description: "Content to write to the file as a UTF-8 string. Can include text, code, configuration data, or any text-based content."
    },
    encoding: {
        type: "string",
        description: "Character encoding to use when reading/writing the file. Common options: 'utf8' for standard text files, 'ascii' for basic ASCII text, 'base64' for binary representation.",
        enum: ["utf8", "ascii", "base64", "hex", "latin1"],
        default: "utf8"
    },
    command: {
        type: "string",
        description: "The terminal command to execute, including any arguments. Example: 'ls -la', 'npm install', 'node script.js'."
    },
    directory_path: {
        type: "string",
        description: "Relative path to the directory to list, starting from the current working directory. Use '.' for current directory or a relative path like 'src/components'."
    },
    overwrite: {
        type: "boolean",
        description: "Whether to overwrite the file if it already exists. Set to false to prevent accidental overwrites.",
        default: true
    },
    create_directories: {
        type: "boolean",
        description: "Whether to automatically create parent directories if they don't exist.",
        default: true
    }
}; 