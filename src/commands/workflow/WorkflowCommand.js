import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../core/managers/logger.js';

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
        const { config, app } = context; // Added config and app to context

        try {
            const workflowName = args.trim();
            if (!workflowName) {
                logger.user('❌ Usage: /workflow <workflow_name>');
                logger.user('💡 Use /workflows to see available workflows');
                return true;
            }

            // Set the application mode
            config.setConfig('ui.currentMode', `workflow:${workflowName}`);

            // Set app state for active workflow
            app.isWorkflowActive = true;
            app.activeWorkflow = app.workflowStateMachine;
            app.registerActiveWorkflow(app.activeWorkflow); // Register the active workflow

            // Start the workflow
            await app.activeWorkflow.start(workflowName);

            return true;
        } catch (error) {
            logger.error(error, 'Error executing workflow');
            return false;
        }
    }

    // Removed _promptForInput and _validateInputType methods as per the plan

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
