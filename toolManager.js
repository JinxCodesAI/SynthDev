import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateToolDefinition } from './tools/common/tool-schema.js';
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
            const toolsDir = join(__dirname, 'tools');
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

        // Handle file backup if tool requires it
        if (toolDefinition && toolDefinition.requires_backup && snapshotManager) {
            await this._handleFileBackup(toolName, toolArgs, snapshotManager);
        }

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

            // Handle Git commit if tool modifies files and we're in Git mode
            if (toolDefinition && toolDefinition.requires_backup && snapshotManager) {
                await this._handlePostExecutionGitCommit(toolName, toolArgs, snapshotManager);
            }

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
     * Handles file backup before tool execution
     * @param {string} toolName - Name of the tool being executed
     * @param {Object} toolArgs - Arguments passed to the tool
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     */
    async _handleFileBackup(toolName, toolArgs, snapshotManager) {
        const toolDefinition = this.toolDefinitions.get(toolName);

        if (!toolDefinition || !toolDefinition.backup_resource_path_property_name) {
            return; // No backup property defined
        }

        const pathPropertyName = toolDefinition.backup_resource_path_property_name;
        const filePath = toolArgs[pathPropertyName];

        this.logger.debug(
            `Handling file backup for tool ${toolName} with file path ${filePath}`,
            'File Backup'
        );

        if (filePath) {
            await snapshotManager.backupFileIfNeeded(filePath);
        }
    }

    /**
     * Handles Git commit after tool execution if in Git mode
     * @param {string} toolName - Name of the tool that was executed
     * @param {Object} toolArgs - Arguments passed to the tool
     * @param {SnapshotManager} snapshotManager - Snapshot manager instance
     */
    async _handlePostExecutionGitCommit(toolName, toolArgs, snapshotManager) {
        const gitStatus = snapshotManager.getGitStatus();

        // Only commit if we're in Git mode and have a current snapshot
        if (!gitStatus.gitMode || !snapshotManager.getCurrentSnapshot()) {
            return;
        }

        const currentSnapshot = snapshotManager.getCurrentSnapshot();
        const modifiedFiles = Array.from(currentSnapshot.modifiedFiles);

        // Only commit if there are modified files
        if (modifiedFiles.length > 0) {
            try {
                const gitUtils = snapshotManager.gitUtils;

                // First, check Git status to see what actually changed
                const statusResult = await gitUtils.getStatus();
                if (!statusResult.success) {
                    this.logger.warn(
                        `Git status check failed: ${statusResult.error}`,
                        'Git auto-commit'
                    );
                    return;
                }

                this.logger.debug(
                    `Git status before commit: ${statusResult.status}`,
                    'Git auto-commit'
                );

                if (!statusResult.hasChanges) {
                    this.logger.debug(
                        'No Git changes detected, skipping commit',
                        'Git auto-commit'
                    );
                    return;
                }

                // Add the modified files to Git staging area
                const addResult = await gitUtils.addFiles(modifiedFiles);

                if (!addResult.success) {
                    this.logger.warn(`Git add failed: ${addResult.error}`, 'Git auto-commit');
                    return;
                }

                // Check status again after adding files
                const statusAfterAdd = await gitUtils.getStatus();
                if (statusAfterAdd.success) {
                    this.logger.debug(
                        `Git status after add: ${statusAfterAdd.status}`,
                        'Git auto-commit'
                    );
                }

                // Then commit the changes
                const commitResult = await snapshotManager.commitChangesToGit(modifiedFiles);
                if (!commitResult.success) {
                    // Show full error message with proper formatting
                    this.logger.warn('Git commit failed:', 'Git auto-commit');
                    const errorLines = commitResult.error.split('\n');
                    errorLines.forEach(line => {
                        if (line.trim()) {
                            this.logger.warn(`  ${line}`, '');
                        }
                    });
                }
            } catch (error) {
                this.logger.warn(`Git commit error: ${error.message}`, 'Git auto-commit');
                if (error.stack) {
                    this.logger.debug(`Stack trace: ${error.stack}`);
                }
            }
        }
    }
}

export default ToolManager;
