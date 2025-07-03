import WorkflowStateMachine from '../../workflow/WorkflowStateMachine.js';
import WorkflowsCommand from '../../commands/workflow/WorkflowsCommand.js';
import WorkflowCommand from '../../commands/workflow/WorkflowCommand.js';
import { getLogger } from '../../logger.js';

/**
 * Workflow Tool Implementation - Encapsulates all multi-agent workflow functionality
 *
 * This tool contains the complete workflow system that was previously integrated
 * directly into the main application. It can be easily enabled/disabled through
 * configuration.
 *
 * Features:
 * - Multi-agent workflow execution
 * - State machine orchestration
 * - Workflow configuration management
 * - Command integration (/workflow, /workflows)
 */
export default class WorkflowToolImplementation {
    constructor() {
        this.workflowStateMachine = null;
        this.workflowsCommand = null;
        this.workflowCommand = null;
        this.logger = getLogger();
        this.isInitialized = false;
        this.isEnabled = false;
    }

    /**
     * Initialize the workflow system
     * @param {Object} context - Application context
     */
    async initialize(context) {
        try {
            if (this.isInitialized) {
                return;
            }

            // Check if workflows are enabled in configuration
            const config = context.config || context.configManager?.getConfig();
            if (config?.features?.enableWorkflows !== true) {
                this.logger.debug('🔄 Workflow system disabled in configuration');
                return;
            }

            const {
                toolManager,
                snapshotManager,
                consoleInterface,
                costsManager,
                commandRegistry,
            } = context;

            // Initialize workflow state machine
            this.workflowStateMachine = new WorkflowStateMachine(
                config,
                toolManager,
                snapshotManager,
                consoleInterface,
                costsManager
            );

            // Load workflow configurations
            await this.workflowStateMachine.loadWorkflowConfigs();

            // Initialize workflow commands
            this.workflowsCommand = new WorkflowsCommand();
            this.workflowCommand = new WorkflowCommand();

            // Register workflow commands if command registry is available
            if (commandRegistry) {
                commandRegistry.register(this.workflowsCommand);
                commandRegistry.register(this.workflowCommand);
                this.logger.info('✅ Workflow commands registered');
            }

            this.isInitialized = true;
            this.isEnabled = true;
            this.logger.info('✅ Workflow system initialized and enabled');
        } catch (error) {
            this.logger.error(error, 'Failed to initialize workflow system');
            throw error;
        }
    }

    /**
     * Execute the tool
     * @param {Object} params - Tool parameters
     * @param {Object} context - Execution context
     * @returns {Promise<string>} Tool execution result
     */
    async execute(params, context) {
        try {
            const { action, workflow_name, input_params } = params;

            // Validate parameters first
            if (action === 'info' && !workflow_name) {
                throw new Error('workflow_name is required for info action');
            }
            if (action === 'execute') {
                if (!workflow_name) {
                    throw new Error('workflow_name is required for execute action');
                }
                if (!input_params) {
                    throw new Error('input_params is required for execute action');
                }
            }
            if (!['list', 'execute', 'info', 'enable', 'disable'].includes(action)) {
                throw new Error(
                    `Unknown action: ${action}. Available actions: list, info, execute, enable, disable`
                );
            }

            // Handle enable/disable actions first
            if (action === 'enable') {
                return await this._enableWorkflowSystem(context);
            }

            if (action === 'disable') {
                return await this._disableWorkflowSystem();
            }

            // For other actions, ensure workflow system is initialized
            if (!this.isInitialized || !this.isEnabled) {
                await this.initialize(context);

                if (!this.isEnabled) {
                    return '❌ Workflow system is disabled. Use action "enable" to activate it, or set features.enableWorkflows to true in configuration.';
                }
            }

            switch (action) {
                case 'list':
                    return await this._listWorkflows();

                case 'info':
                    return await this._getWorkflowInfo(workflow_name);

                case 'execute':
                    return await this._executeWorkflow(workflow_name, input_params);

                default:
                    // This should never be reached due to validation above
                    throw new Error(
                        `Unknown action: ${action}. Available actions: list, info, execute, enable, disable`
                    );
            }
        } catch (error) {
            this.logger.error(error, 'Workflow tool execution failed');
            return `❌ Error: ${error.message}`;
        }
    }

    /**
     * Enable the workflow system
     * @param {Object} context - Execution context
     * @returns {Promise<string>} Result message
     */
    async _enableWorkflowSystem(context) {
        try {
            if (this.isEnabled) {
                return '✅ Workflow system is already enabled';
            }

            await this.initialize(context);

            if (this.isEnabled) {
                return (
                    '✅ Workflow system enabled successfully\n\n' +
                    '🔄 Available commands:\n' +
                    '   - /workflows - List available workflows\n' +
                    '   - /workflow <name> - Execute a workflow\n\n' +
                    '💡 Use workflow_tool with action "list" to see available workflows'
                );
            } else {
                return '❌ Failed to enable workflow system. Check that features.enableWorkflows is set to true in configuration.';
            }
        } catch (error) {
            return `❌ Failed to enable workflow system: ${error.message}`;
        }
    }

    /**
     * Disable the workflow system
     * @returns {Promise<string>} Result message
     */
    async _disableWorkflowSystem() {
        try {
            if (!this.isEnabled) {
                return '✅ Workflow system is already disabled';
            }

            await this.shutdown();
            return '✅ Workflow system disabled successfully';
        } catch (error) {
            return `❌ Failed to disable workflow system: ${error.message}`;
        }
    }

    /**
     * List available workflows
     * @returns {Promise<string>} Formatted list of workflows
     */
    async _listWorkflows() {
        const workflows = this.workflowStateMachine.getAvailableWorkflows();

        if (workflows.length === 0) {
            return (
                '📁 No workflows found. Create workflow configurations in config/workflows/\n\n' +
                '💡 Example workflow structure:\n' +
                '   config/workflows/my_workflow.json\n' +
                '   config/workflows/my_workflow/script.js'
            );
        }

        let result = `📋 **Available Workflows** (${workflows.length}):\n\n`;

        for (const workflowName of workflows) {
            try {
                const metadata = await this.workflowStateMachine.getWorkflowMetadata(workflowName);
                result += `🔄 **${workflowName}**\n`;
                result += `   📝 ${metadata.description}\n`;
                result += `   📊 ${metadata.stateCount} states, ${metadata.agentCount} agents\n\n`;
            } catch (error) {
                result += `🔄 **${workflowName}** (metadata unavailable)\n\n`;
            }
        }

        result += '💡 Use workflow_tool with action "execute" to run a workflow\n';
        result += '💡 Use /workflow <name> command for interactive execution';

        return result;
    }

    /**
     * Get workflow information
     * @param {string} workflowName - Name of the workflow
     * @returns {Promise<string>} Formatted workflow information
     */
    async _getWorkflowInfo(workflowName) {
        const metadata = await this.workflowStateMachine.getWorkflowMetadata(workflowName);

        if (!metadata) {
            return (
                `❌ Workflow '${workflowName}' not found\n\n` +
                '💡 Use workflow_tool with action "list" to see available workflows'
            );
        }

        let result = `🔄 **Workflow: ${metadata.name}**\n\n`;
        result += `📝 **Description:** ${metadata.description}\n\n`;
        result += '📊 **Statistics:**\n';
        result += `   - States: ${metadata.stateCount}\n`;
        result += `   - Agents: ${metadata.agentCount}\n`;
        result += `   - Contexts: ${metadata.contextCount}\n\n`;
        result += `📥 **Input:** ${metadata.input.name} (${metadata.input.type})\n`;
        result += `   ${metadata.input.description}\n\n`;
        result += `📤 **Output:** ${metadata.output.name} (${metadata.output.type})\n`;
        result += `   ${metadata.output.description}\n\n`;
        result += '💡 Use workflow_tool with action "execute" to run this workflow';

        return result;
    }

    /**
     * Execute a workflow
     * @param {string} workflowName - Name of the workflow
     * @param {string} inputParams - Input parameters
     * @returns {Promise<string>} Workflow execution result
     */
    async _executeWorkflow(workflowName, inputParams) {
        this.logger.info(`🔄 Executing workflow: ${workflowName}`);

        const result = await this.workflowStateMachine.executeWorkflow(workflowName, inputParams);

        let output = '✅ **Workflow Execution Completed**\n\n';
        output += `🔄 **Workflow:** ${workflowName}\n`;
        output += `📥 **Input:** ${inputParams}\n`;
        output += `📤 **Output:** ${JSON.stringify(result, null, 2)}\n`;

        return output;
    }

    /**
     * Get available workflows
     * @returns {Array<string>} List of available workflow names
     */
    getAvailableWorkflows() {
        if (!this.workflowStateMachine) {
            return [];
        }
        return this.workflowStateMachine.getAvailableWorkflows();
    }

    /**
     * Get workflow metadata
     * @param {string} workflowName - Name of the workflow
     * @returns {Promise<Object>} Workflow metadata
     */
    async getWorkflowMetadata(workflowName) {
        if (!this.workflowStateMachine) {
            throw new Error('Workflow system not initialized');
        }
        return await this.workflowStateMachine.getWorkflowMetadata(workflowName);
    }

    /**
     * Execute a workflow
     * @param {string} workflowName - Name of the workflow to execute
     * @param {string} inputParams - Input parameters for the workflow
     * @returns {Promise<Object>} Workflow execution result
     */
    async executeWorkflow(workflowName, inputParams) {
        if (!this.workflowStateMachine) {
            throw new Error('Workflow system not initialized');
        }
        return await this.workflowStateMachine.executeWorkflow(workflowName, inputParams);
    }

    /**
     * Get workflow state machine instance
     * @returns {WorkflowStateMachine} The workflow state machine
     */
    getStateMachine() {
        return this.workflowStateMachine;
    }

    /**
     * Check if workflow system is enabled and initialized
     * @returns {boolean} True if workflow system is ready
     */
    isWorkflowEnabled() {
        return this.isInitialized && this.isEnabled && this.workflowStateMachine !== null;
    }

    /**
     * Shutdown the workflow system
     */
    async shutdown() {
        if (this.workflowStateMachine) {
            // Perform any necessary cleanup
            this.workflowStateMachine = null;
        }
        this.isInitialized = false;
        this.isEnabled = false;
        this.logger.info('🔄 Workflow system shutdown');
    }
}
