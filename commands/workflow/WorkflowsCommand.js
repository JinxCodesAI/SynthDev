import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../logger.js';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Command to list available workflows
 */
export default class WorkflowsCommand extends BaseCommand {
    constructor() {
        super('workflows', 'List available multi-agent workflows', ['wfs']);
    }

    /**
     * Implementation of the workflows command
     * @param {string} _args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {Promise<boolean>} Command execution result
     */
    async implementation(_args, context) {
        const logger = getLogger();

        try {
            const workflowsPath = join(process.cwd(), 'config', 'workflows');

            if (!existsSync(workflowsPath)) {
                logger.info('📁 No workflows directory found');
                logger.info('💡 Create workflow configurations in config/workflows/');
                return true;
            }

            const workflowFiles = readdirSync(workflowsPath).filter(file => file.endsWith('.json'));

            if (workflowFiles.length === 0) {
                logger.info('📁 No workflow configurations found');
                logger.info('💡 Create .json workflow files in config/workflows/');
                return true;
            }

            logger.user('🔄 Available Workflows:');
            logger.raw('');

            for (const fileName of workflowFiles) {
                try {
                    const workflowPath = join(workflowsPath, fileName);
                    const workflowConfig = JSON.parse(readFileSync(workflowPath, 'utf8'));

                    const workflowName = workflowConfig.workflow_name;
                    if (!workflowName) {
                        logger.warn(`${fileName} (missing workflow_name property)`);
                        logger.raw('');
                        continue;
                    }

                    logger.info(`  📋 ${workflowName}`);
                    if (workflowConfig.description) {
                        logger.info(`     ${workflowConfig.description}`);
                    }
                    logger.raw('');
                } catch (error) {
                    logger.warn(`${fileName} (invalid configuration: ${error.message})`);
                    logger.raw('');
                }
            }

            logger.info('💡 Usage: /workflow <workflow_name>');
            logger.raw('');

            return true;
        } catch (error) {
            logger.error(error, 'Error listing workflows');
            return false;
        }
    }

    /**
     * Validate execution context
     * @param {Object} _context - Execution context
     * @returns {string|null} Error message or null if valid
     */
    validateContext(_context) {
        // No specific context validation needed
        return null;
    }
}
