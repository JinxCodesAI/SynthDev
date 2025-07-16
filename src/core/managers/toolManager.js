import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateToolDefinition } from '../../tools/common/tool-schema.js';
import { getLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Handles tool loading and execution with standardized validation and error handling
 */
class ToolManager {
    constructor() {
        this.tools = [];
        this.toolImplementations = new Map();
        this.toolDefinitions = new Map(); // Store full tool definitions including auto_run
        this.toolCategories = new Map(); // Store tools by category
        this.loadingErrors = []; // Track loading errors for diagnostics
        this.logger = getLogger();
    }

    async loadTools() {
        try {
            const toolsDir = join(__dirname, '../../tools');
            const toolDirs = readdirSync(toolsDir, { withFileTypes: true })
                .filter(
                    dirent =>
                        dirent.isDirectory() &&
                        !dirent.name.startsWith('.') &&
                        dirent.name !== 'common'
                )
                .map(dirent => dirent.name);

            this.logger.debug(`📁 Loading tools from: ${toolsDir}`);
            this.logger.debug(
                `📂 Found ${toolDirs.length} potential tool directories: ${toolDirs.join(', ')}`
            );

            this.loadingErrors = []; // Reset loading errors

            for (const toolDir of toolDirs) {
                await this._loadSingleTool(toolsDir, toolDir);
            }

            this.logger.debug(`🔧 Total tools loaded: ${this.tools.length}`);

            if (this.loadingErrors.length > 0) {
                this.logger.warn(`${this.loadingErrors.length} tools failed to load`);
                this.loadingErrors.forEach(error => {
                    this.logger.warn(`${error.tool}: ${error.message}`);
                });
            }

            this._logToolSummary();
            this.logger.debug('');
        } catch (error) {
            this.logger.warn('📁 No tools directory found or no tools available\n');
            throw new Error(`Tool loading failed: ${error.message}`);
        }
    }

    /**
     * Load a single tool with comprehensive validation
     * @param {string} toolsDir - Base tools directory
     * @param {string} toolDir - Specific tool directory name
     */
    async _loadSingleTool(toolsDir, toolDir) {
        try {
            const toolPath = join(toolsDir, toolDir);
            const definitionPath = join(toolPath, 'definition.json');
            const implementationPath = join(toolPath, 'implementation.js');

            // Check if definition.json file exists
            if (!existsSync(definitionPath)) {
                this.loadingErrors.push({
                    tool: toolDir,
                    message: 'definition.json not found',
                });
                return;
            }

            // Check if implementation.js file exists
            if (!existsSync(implementationPath)) {
                this.loadingErrors.push({
                    tool: toolDir,
                    message: 'implementation.js not found',
                });
                return;
            }

            // Load and parse definition
            let definition;
            try {
                const definitionContent = readFileSync(definitionPath, 'utf8');
                definition = JSON.parse(definitionContent);
            } catch (parseError) {
                this.loadingErrors.push({
                    tool: toolDir,
                    message: `Invalid JSON in definition.json: ${parseError.message}`,
                });
                return;
            }

            // Validate tool definition using the new schema validation
            const validation = validateToolDefinition(definition, toolDir);
            if (!validation.success) {
                this.loadingErrors.push({
                    tool: toolDir,
                    message: `Definition validation failed: ${validation.errors.join(', ')}`,
                });
                return;
            }

            // Log validation warnings if any
            if (validation.warnings.length > 0) {
                this.logger.warn(`Tool ${toolDir} warnings: ${validation.warnings.join(', ')}`);
            }

            // Load tool implementation
            let implementationModule;
            try {
                implementationModule = await import(`file://${implementationPath}`);
                if (
                    !implementationModule.default ||
                    typeof implementationModule.default !== 'function'
                ) {
                    this.loadingErrors.push({
                        tool: toolDir,
                        message: 'implementation.js must export a default function',
                    });
                    return;
                }
            } catch (importError) {
                this.loadingErrors.push({
                    tool: toolDir,
                    message: `Failed to import implementation.js: ${importError.message}`,
                });
                return;
            }

            // Add tool to collections
            this.tools.push(definition.schema);
            this.toolDefinitions.set(definition.name, definition);
            this.toolImplementations.set(definition.name, implementationModule.default);

            // Categorize tool
            const category = definition.category || 'utility';
            if (!this.toolCategories.has(category)) {
                this.toolCategories.set(category, []);
            }
            this.toolCategories.get(category).push(definition.name);

            this.logger.debug(
                `✅ Loaded tool: ${definition.name}${definition.category ? ` [${definition.category}]` : ''}${definition.version ? ` v${definition.version}` : ''}`
            );
        } catch (error) {
            this.loadingErrors.push({
                tool: toolDir,
                message: `Unexpected error: ${error.message}`,
            });
        }
    }

    /**
     * Log a summary of loaded tools by category
     */
    _logToolSummary() {
        if (this.toolCategories.size > 0) {
            this.logger.debug('\n📊 Tools by category:');
            for (const [category, tools] of this.toolCategories.entries()) {
                this.logger.debug(`   ${category}: ${tools.join(', ')}`);
            }
        }
    }

    getTools() {
        return this.tools;
    }

    getToolsCount() {
        return this.tools.length;
    }

    getToolDefinition(toolName) {
        return this.toolDefinitions.get(toolName);
    }

    /**
     * Get tools by category
     * @param {string} category - Category to filter by
     * @returns {Array} Array of tool names in the category
     */
    getToolsByCategory(category) {
        return this.toolCategories.get(category) || [];
    }

    /**
     * Get all available categories
     * @returns {Array} Array of category names
     */
    getCategories() {
        return Array.from(this.toolCategories.keys());
    }

    /**
     * Get loading errors for diagnostics
     * @returns {Array} Array of loading error objects
     */
    getLoadingErrors() {
        return this.loadingErrors;
    }

    /**
     * Check if a tool exists
     * @param {string} toolName - Name of the tool to check
     * @returns {boolean} True if tool exists
     */
    hasToolDefinition(toolName) {
        return this.toolDefinitions.has(toolName);
    }

    async executeToolCall(toolCall, consoleInterface, snapshotManager = null) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Check if tool exists
        if (!this.hasToolDefinition(toolName)) {
            const errorResponse = {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                    error: `Tool not found: ${toolName}`,
                    tool_name: toolName,
                    success: false,
                    timestamp: new Date().toISOString(),
                }),
            };
            consoleInterface.showToolResult(JSON.parse(errorResponse.content));
            return errorResponse;
        }

        // Get tool definition to check auto_run flag
        const toolDefinition = this.toolDefinitions.get(toolName);

        // Show tool execution info
        consoleInterface.showToolExecution(toolName, toolArgs);

        // Check if tool requires confirmation (auto_run: false)
        if (toolDefinition && toolDefinition.auto_run === false) {
            const confirmed = await consoleInterface.promptForConfirmation(
                `Tool "${toolName}" requires manual approval. Do you want to proceed?`
            );

            if (!confirmed) {
                consoleInterface.showToolCancelled(toolName);
                return {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        error: 'Tool execution cancelled by user',
                        tool_name: toolName,
                        cancelled: true,
                        success: false,
                        timestamp: new Date().toISOString(),
                    }),
                };
            }
        }

        // Check if tool modifies files and create snapshot if needed
        await this._handlePreExecutionSnapshot(toolName, toolArgs, snapshotManager);

        const implementation = this.toolImplementations.get(toolName);

        try {
            // Execute tool and get result
            const result = await implementation({ ...toolArgs, costsManager: this.costsManager });

            // Ensure result has standard fields
            const standardizedResult = {
                success: true,
                timestamp: new Date().toISOString(),
                tool_name: toolName,
                ...result,
            };

            consoleInterface.showToolResult(standardizedResult);

            return {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(standardizedResult),
            };
        } catch (executionError) {
            const errorResult = {
                error: `Tool execution failed: ${executionError.message}`,
                tool_name: toolName,
                success: false,
                timestamp: new Date().toISOString(),
                stack: executionError.stack,
            };

            consoleInterface.showToolResult(errorResult);

            return {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(errorResult),
            };
        }
    }

    /**
     * Handle pre-execution snapshot creation for file-modifying tools
     * @private
     * @param {string} toolName - Name of the tool being executed
     * @param {Object} toolArgs - Tool arguments
     * @param {Object} snapshotManager - Snapshot manager instance (optional)
     */
    async _handlePreExecutionSnapshot(toolName, toolArgs, snapshotManager) {
        // Skip if no snapshot manager provided
        if (!snapshotManager) {
            return;
        }

        // Check if tool modifies files
        if (!this._isFileModifyingTool(toolName)) {
            return;
        }

        try {
            // Extract file paths that will be modified
            const filePaths = this._extractFilePathsFromArgs(toolName, toolArgs);

            if (filePaths.length === 0) {
                return;
            }

            // Create snapshot with file modification context
            const instruction = `Pre-execution snapshot before ${toolName} on ${filePaths.join(', ')}`;

            // Only create snapshot if files exist and will be modified
            const existingFiles = new Map();
            for (const filePath of filePaths) {
                try {
                    const fs = await import('fs');
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        existingFiles.set(filePath, content);
                    }
                } catch (error) {
                    // File doesn't exist or can't be read - skip
                    continue;
                }
            }

            // Only create snapshot if we have files to backup
            if (existingFiles.size > 0) {
                await snapshotManager.createSnapshot(instruction, existingFiles, {
                    triggerType: 'tool_execution',
                    toolName,
                    filePaths,
                });
            }
        } catch (error) {
            // Log error but don't fail tool execution
            console.warn(`Failed to create pre-execution snapshot: ${error.message}`);
        }
    }

    /**
     * Check if a tool modifies files
     * @private
     * @param {string} toolName - Name of the tool
     * @returns {boolean} True if tool modifies files
     */
    _isFileModifyingTool(toolName) {
        //REVIEW: >>it needs to be smarter than that<<
        const fileModifyingTools = [
            'write_file',
            'edit_file',
            // Add more file-modifying tools as needed
        ];

        return fileModifyingTools.includes(toolName);
    }

    /**
     * Extract file paths from tool arguments
     * @private
     * @param {string} toolName - Name of the tool
     * @param {Object} toolArgs - Tool arguments
     * @returns {string[]} Array of file paths that will be modified
     */
    _extractFilePathsFromArgs(toolName, toolArgs) {
        //REVIEW: >>it should be a tool that knows if it is modyfying somethign and what, there<<
        //REVIEW: >>should be common interface<<
        const filePaths = [];

        switch (toolName) {
            case 'write_file':
            case 'edit_file':
                if (toolArgs.file_path) {
                    filePaths.push(toolArgs.file_path);
                }
                break;
            // Add more tools and their file path extraction logic as needed
        }

        return filePaths;
    }
}

export default ToolManager;
