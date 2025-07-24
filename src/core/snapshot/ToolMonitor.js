/**
 * Tool Monitor for Phase 2 - Automatic Snapshot Creation
 * Monitors tool execution based on tool declarations to determine if snapshots should be created
 */

import { getLogger } from '../managers/logger.js';

export class ToolMonitor {
    constructor(toolManager, config = {}) {
        this.toolManager = toolManager;
        this.config = {
            // Tool declarations configuration
            defaultModifiesFiles: false,
            warnOnMissingDeclaration: true,
            cacheDeclarations: true,
            ...config,
        };

        this.logger = getLogger();

        // Cache for tool declarations to improve performance
        this.declarationCache = new Map();

        // Built-in tool classifications based on analysis of existing tools
        this.builtInClassifications = {
            // File-modifying tools
            write_file: { modifiesFiles: true, fileTargets: ['file_path'] },
            edit_file: { modifiesFiles: true, fileTargets: ['file_path'] },

            // Potentially file-modifying tools (depends on command/script content)
            execute_terminal: { modifiesFiles: 'conditional', fileTargets: [] },
            execute_script: { modifiesFiles: 'conditional', fileTargets: [] },

            // Read-only tools
            read_file: { modifiesFiles: false, fileTargets: ['file_path'] },
            list_directory: { modifiesFiles: false, fileTargets: ['path'] },
            exact_search: { modifiesFiles: false, fileTargets: ['path'] },
            explain_codebase: { modifiesFiles: false, fileTargets: [] },
            calculate: { modifiesFiles: false, fileTargets: [] },
            get_time: { modifiesFiles: false, fileTargets: [] },
        };

        this.logger.debug('ToolMonitor initialized', {
            config: this.config,
            builtInTools: Object.keys(this.builtInClassifications).length,
        });
    }

    /**
     * Determine if a tool should trigger snapshot creation
     * @param {string} toolName - Name of the tool
     * @param {Object} toolDefinition - Tool definition from ToolManager
     * @returns {boolean} Whether the tool should create a snapshot
     */
    shouldCreateSnapshot(toolName, toolDefinition = null) {
        try {
            // Check cache first for performance
            if (this.config.cacheDeclarations && this.declarationCache.has(toolName)) {
                const cached = this.declarationCache.get(toolName);
                this.logger.debug(`Using cached classification for ${toolName}`, cached);
                return cached.modifiesFiles === true;
            }

            // Get tool definition if not provided
            if (!toolDefinition && this.toolManager) {
                toolDefinition = this.toolManager.getToolDefinition(toolName);
            }

            // Determine if tool modifies files
            const classification = this.classifyTool(toolName, toolDefinition);

            // Cache the result
            if (this.config.cacheDeclarations) {
                this.declarationCache.set(toolName, classification);
            }

            const shouldCreate = classification.modifiesFiles === true;

            this.logger.debug(`Tool classification for ${toolName}`, {
                modifiesFiles: classification.modifiesFiles,
                shouldCreateSnapshot: shouldCreate,
                source: classification.source,
            });

            return shouldCreate;
        } catch (error) {
            this.logger.warn(`Error determining snapshot requirement for tool ${toolName}`, error);
            // Default to creating snapshot for safety
            return true;
        }
    }

    /**
     * Check if a tool modifies files
     * @param {string} toolName - Name of the tool
     * @param {Object} toolDefinition - Tool definition
     * @returns {boolean|string} True if modifies files, false if read-only, 'conditional' if depends on arguments
     */
    modifiesFiles(toolName, toolDefinition = null) {
        const classification = this.classifyTool(toolName, toolDefinition);
        return classification.modifiesFiles;
    }

    /**
     * Classify a tool based on built-in knowledge and tool definition
     * @param {string} toolName - Name of the tool
     * @param {Object} toolDefinition - Tool definition
     * @returns {Object} Classification result
     */
    classifyTool(toolName, toolDefinition = null) {
        // Check built-in classifications first
        if (this.builtInClassifications[toolName]) {
            return {
                ...this.builtInClassifications[toolName],
                source: 'built-in',
            };
        }

        // Check tool definition for explicit declaration
        if (toolDefinition && typeof toolDefinition.modifiesFiles === 'boolean') {
            return {
                modifiesFiles: toolDefinition.modifiesFiles,
                fileTargets: toolDefinition.fileTargets || [],
                source: 'tool-definition',
            };
        }

        // Analyze tool definition for clues
        if (toolDefinition) {
            const analysisResult = this.analyzeToolDefinition(toolDefinition);
            if (analysisResult.confidence > 0.5) {
                // Lower threshold for better analysis coverage
                return {
                    modifiesFiles: analysisResult.modifiesFiles,
                    fileTargets: analysisResult.fileTargets,
                    source: 'analysis',
                    confidence: analysisResult.confidence,
                };
            }
        }

        // Warn about missing declaration
        if (this.config.warnOnMissingDeclaration) {
            this.logger.warn(
                `Tool ${toolName} missing file modification declaration, defaulting to ${this.config.defaultModifiesFiles}`
            );
        }

        // Use default
        return {
            modifiesFiles: this.config.defaultModifiesFiles,
            fileTargets: [],
            source: 'default',
        };
    }

    /**
     * Analyze tool definition to infer if it modifies files
     * @param {Object} toolDefinition - Tool definition
     * @returns {Object} Analysis result with confidence score
     */
    analyzeToolDefinition(toolDefinition) {
        let confidence = 0;
        let modifiesFiles = false;
        const fileTargets = [];

        // Check description and name for keywords
        const text =
            `${toolDefinition.name || ''} ${toolDefinition.description || ''}`.toLowerCase();

        // File-modifying keywords
        const modifyingKeywords = [
            'write',
            'edit',
            'create',
            'update',
            'modify',
            'save',
            'delete',
            'remove',
            'overwrite',
            'append',
            'insert',
            'replace',
            'generate',
        ];

        // Read-only keywords
        const readOnlyKeywords = [
            'read',
            'list',
            'show',
            'display',
            'view',
            'search',
            'find',
            'get',
            'explain',
            'analyze',
            'calculate',
            'check',
        ];

        // Count keyword matches
        const modifyingMatches = modifyingKeywords.filter(keyword => text.includes(keyword));
        const readOnlyMatches = readOnlyKeywords.filter(keyword => text.includes(keyword));

        if (modifyingMatches.length > 0) {
            modifiesFiles = true;
            confidence = Math.min(0.9, 0.5 + modifyingMatches.length * 0.1);
        } else if (readOnlyMatches.length > 0) {
            modifiesFiles = false;
            confidence = Math.min(0.9, 0.5 + readOnlyMatches.length * 0.1);
        }

        // Check parameters for file paths
        if (
            toolDefinition.schema &&
            toolDefinition.schema.function &&
            toolDefinition.schema.function.parameters
        ) {
            const params = toolDefinition.schema.function.parameters.properties || {};

            for (const [paramName, paramDef] of Object.entries(params)) {
                if (paramName.includes('path') || paramName.includes('file')) {
                    fileTargets.push(paramName);
                    if (
                        paramDef.description &&
                        paramDef.description.toLowerCase().includes('write')
                    ) {
                        modifiesFiles = true;
                        confidence = Math.max(confidence, 0.8);
                    }
                }
            }
        }

        return {
            modifiesFiles,
            fileTargets,
            confidence,
            modifyingKeywords: modifyingMatches,
            readOnlyKeywords: readOnlyMatches,
        };
    }

    /**
     * Get tool metadata for snapshot creation
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @returns {Object} Tool metadata
     */
    getToolMetadata(toolName, args = {}) {
        const classification = this.classifyTool(toolName);
        const fileTargets = this.extractFileTargets(toolName, args);

        return {
            toolName,
            classification: classification.modifiesFiles,
            fileTargets,
            arguments: args,
            timestamp: Date.now(),
        };
    }

    /**
     * Extract file targets from tool arguments
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @returns {Array} Array of file paths that might be affected
     */
    extractFileTargets(toolName, args = {}) {
        const classification = this.classifyTool(toolName);
        const targets = [];

        // Extract based on known file target parameters
        for (const targetParam of classification.fileTargets) {
            if (args[targetParam]) {
                targets.push(args[targetParam]);
            }
        }

        // Special handling for specific tools
        switch (toolName) {
            case 'execute_terminal':
                // Try to extract file paths from terminal commands
                if (args.command) {
                    const filePaths = this.extractFilePathsFromCommand(args.command);
                    targets.push(...filePaths);
                }
                break;

            case 'execute_script':
                // Try to extract file paths from script content
                if (args.script) {
                    const filePaths = this.extractFilePathsFromScript(args.script);
                    targets.push(...filePaths);
                }
                break;
        }

        return targets;
    }

    /**
     * Extract potential file paths from terminal command
     * @param {string} command - Terminal command
     * @returns {Array} Potential file paths
     */
    extractFilePathsFromCommand(command) {
        const paths = [];

        // Simple pattern matching for common file operations
        const fileOperationPatterns = [
            /(?:cp|mv|rm|touch|mkdir|cat|echo.*>)\s+([^\s]+)/g,
            /([^\s]+\.[a-zA-Z]{1,4})/g, // Files with extensions
        ];

        for (const pattern of fileOperationPatterns) {
            let match;
            while ((match = pattern.exec(command)) !== null) {
                if (match[1] && !match[1].startsWith('-')) {
                    paths.push(match[1]);
                }
            }
        }

        return paths;
    }

    /**
     * Extract potential file paths from script content
     * @param {string} script - JavaScript script content
     * @returns {Array} Potential file paths
     */
    extractFilePathsFromScript(script) {
        const paths = [];

        // Pattern for file operations in JavaScript
        const fileOperationPatterns = [
            /fs\.writeFileSync\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /fs\.readFileSync\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /require\s*\(\s*['"`]([^'"`]+\.[a-zA-Z]+)['"`]/g,
        ];

        for (const pattern of fileOperationPatterns) {
            let match;
            while ((match = pattern.exec(script)) !== null) {
                if (match[1]) {
                    paths.push(match[1]);
                }
            }
        }

        return paths;
    }

    /**
     * Validate tool declaration in definition.json
     * @param {Object} toolDefinition - Tool definition
     * @returns {Object} Validation result
     */
    validateToolDeclaration(toolDefinition) {
        const errors = [];
        const warnings = [];

        if (!toolDefinition.name) {
            errors.push('Tool definition must have a name');
        }

        // Check if modifiesFiles is explicitly declared
        if (typeof toolDefinition.modifiesFiles !== 'boolean') {
            warnings.push(
                'Tool definition should explicitly declare modifiesFiles boolean property'
            );
        }

        // Check if fileTargets is provided for file-modifying tools
        if (toolDefinition.modifiesFiles && !toolDefinition.fileTargets) {
            warnings.push('File-modifying tools should declare fileTargets array');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Warn about missing declaration
     * @param {string} toolName - Tool name
     */
    warnAboutMissingDeclaration(toolName) {
        this.logger.warn(
            `Tool ${toolName} does not declare file modification behavior. ` +
                'Consider adding "modifiesFiles": true/false to its definition.json'
        );
    }

    /**
     * Get tool declaration
     * @param {string} toolName - Tool name
     * @returns {Object} Tool declaration
     */
    getToolDeclaration(toolName) {
        return this.classifyTool(toolName);
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Clear cache when configuration changes
        this.declarationCache.clear();

        this.logger.debug('ToolMonitor configuration updated', { config: this.config });
    }

    /**
     * Get tool classification statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const builtInCount = Object.keys(this.builtInClassifications).length;
        const cachedCount = this.declarationCache.size;

        const modifyingTools = Object.entries(this.builtInClassifications)
            .filter(([, classification]) => classification.modifiesFiles === true)
            .map(([name]) => name);

        const readOnlyTools = Object.entries(this.builtInClassifications)
            .filter(([, classification]) => classification.modifiesFiles === false)
            .map(([name]) => name);

        return {
            builtInClassifications: builtInCount,
            cachedClassifications: cachedCount,
            modifyingTools,
            readOnlyTools,
            conditionalTools: Object.entries(this.builtInClassifications)
                .filter(([, classification]) => classification.modifiesFiles === 'conditional')
                .map(([name]) => name),
        };
    }
}

export default ToolMonitor;
