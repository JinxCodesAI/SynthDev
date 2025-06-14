import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';

/**
 * Command to execute a specific workflow
 */
export default class WorkflowCommand extends BaseCommand {
    constructor() {
        super('workflow', 'Execute a multi-agent workflow', ['wf']);
    }

    /**
     * Implementation of the workflow command
     * @param {string} args - Command arguments (workflow_name)
     * @param {Object} context - Execution context
     * @returns {Promise<boolean>} Command execution result
     */
    async implementation(args, context) {
        const logger = getLogger();
        const { workflowStateMachine, consoleInterface } = context;

        try {
            if (!workflowStateMachine) {
                logger.error('Workflow system not available');
                return true;
            }

            const workflowName = args.trim();
            if (!workflowName) {
                logger.user('❌ Usage: /workflow <workflow_name>');
                logger.user('💡 Use /workflows to see available workflows');
                return true;
            }

            // Check if workflow exists
            const availableWorkflows = workflowStateMachine.getAvailableWorkflows();
            if (!availableWorkflows.includes(workflowName)) {
                logger.error(`❌ Workflow '${workflowName}' not found`);
                logger.warn('💡 Use /workflows to see available workflows');
                return true;
            }

            // Get workflow metadata
            const metadata = await workflowStateMachine.getWorkflowMetadata(workflowName);
            if (!metadata) {
                logger.error(`❌ Failed to load workflow metadata: ${workflowName}`);
                return true;
            }

            // Display workflow information
            logger.user(`🔄 Workflow: ${workflowName}`);
            logger.user(`📝 Description: ${metadata.description}`);
            logger.raw('');

            // Prompt for input parameters
            const inputParams = await this._promptForInput(metadata.input, consoleInterface);
            if (inputParams === null) {
                logger.user('❌ Workflow execution cancelled');
                return true;
            }

            logger.info(`📥 Input: ${inputParams}`);
            logger.raw('');

            // Execute the workflow
            const result = await workflowStateMachine.executeWorkflow(workflowName, inputParams);

            logger.user('✅ Workflow execution completed');
            logger.info(`📤 Output: ${result}`);
            logger.raw('');

            return true;
        } catch (error) {
            logger.error(error, 'Error executing workflow');
            return false;
        }
    }

    /**
     * Prompt user for workflow input parameters
     * @private
     * @param {Object} inputDef - Input parameter definition
     * @param {Object} consoleInterface - Console interface for prompting
     * @returns {Promise<string|null>} User input or null if cancelled
     */
    async _promptForInput(inputDef, consoleInterface) {
        const logger = getLogger();

        // Display parameter information
        logger.user(`📋 Input Parameter: ${inputDef.name}`);
        logger.user(`📄 Description: ${inputDef.description}`);
        logger.user(`🔤 Type: ${inputDef.type}`);
        logger.user('');

        // Prompt for input using the console interface
        const userInput = await consoleInterface.promptForInput(`💭 Enter ${inputDef.name}: `);

        const trimmedAnswer = userInput.trim();
        if (!trimmedAnswer) {
            logger.error('❌ Input cannot be empty');
            return null;
        }

        // Basic type validation
        if (!this._validateInputType(trimmedAnswer, inputDef.type)) {
            logger.error(`❌ Invalid input type. Expected: ${inputDef.type}`);
            return null;
        }

        return trimmedAnswer;
    }

    /**
     * Validate input type
     * @private
     * @param {string} input - User input
     * @param {string} expectedType - Expected type
     * @returns {boolean} True if valid
     */
    _validateInputType(input, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof input === 'string';
            case 'number':
                return !isNaN(Number(input));
            case 'object':
                try {
                    JSON.parse(input);
                    return true;
                } catch {
                    return false;
                }
            case 'array':
                try {
                    const parsed = JSON.parse(input);
                    return Array.isArray(parsed);
                } catch {
                    return false;
                }
            default:
                return true; // Allow unknown types
        }
    }

    /**
     * Validate execution context
     * @param {Object} _context - Execution context
     * @returns {string|null} Error message or null if valid
     */
    validateContext(_context) {
        // No specific context validation needed for now
        return null;
    }
}
