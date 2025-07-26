/**
 * Task Command Implementation
 * Provides user interface for task management following ADR-002 patterns
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../core/managers/logger.js';
import editTasks from '../../tools/edit_tasks/implementation.js';
import listTasks from '../../tools/list_tasks/implementation.js';
import getTask from '../../tools/get_task/implementation.js';

export class TaskCommand extends BaseCommand {
    constructor() {
        super('task', 'Manage tasks with hierarchical organization and status tracking', [
            'tasks',
            't',
        ]);

        this.logger = getLogger();

        // Subcommands
        this.subcommands = {
            list: this.handleList.bind(this),
            add: this.handleAdd.bind(this),
            remove: this.handleRemove.bind(this),
            edit: this.handleEdit.bind(this),
            help: this.handleHelp.bind(this),
        };
    }

    /**
     * Get required dependencies for the command
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['consoleInterface', ...super.getRequiredDependencies()];
    }

    /**
     * Main command execution handler
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Command result
     */
    async implementation(args, context) {
        try {
            // Parse arguments
            const { subcommand, subArgs } = this.parseArguments(args);

            // Handle help or no subcommand
            if (!subcommand || subcommand === 'help') {
                return await this.handleHelp(subArgs, context);
            }

            // Check if it's a task ID (UUID-like pattern)
            if (this.isTaskId(subcommand)) {
                return await this.handleGetTask(subcommand, context);
            }

            // Route to appropriate subcommand handler
            const handler = this.subcommands[subcommand];
            if (!handler) {
                const { consoleInterface } = context;
                consoleInterface.showError(`Unknown subcommand: ${subcommand}`);
                consoleInterface.showMessage('Use /task help to see available commands.');
                return 'error';
            }

            return await handler(subArgs, context);
        } catch (error) {
            this.logger.error(error, 'Task command execution failed');
            context.consoleInterface.showError(`Command failed: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle task listing
     * @param {string} args - List arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} List result
     */
    async handleList(args, context) {
        const { consoleInterface } = context;

        try {
            // Parse list options
            const options = this.parseListOptions(args);

            // Call list_tasks tool directly
            const result = await listTasks(options);

            if (!result.success) {
                consoleInterface.showError(`Failed to list tasks: ${result.error}`);
                return 'error';
            }

            // Display results
            if (result.task_count === 0) {
                consoleInterface.showMessage('📝 No tasks found.');
                consoleInterface.showMessage('💡 Use /task add to create your first task.');
                return 'empty';
            }

            consoleInterface.showMessage(`\n📋 Task List (${result.task_count} tasks):`);
            consoleInterface.showMessage('─'.repeat(60));

            for (const task of result.tasks) {
                consoleInterface.showMessage(task.display);
            }

            // Show summary
            if (result.status_filter !== 'all') {
                consoleInterface.showMessage(`\n🔍 Filtered by status: ${result.status_filter}`);
                consoleInterface.showMessage(
                    `📊 Showing ${result.task_count} of ${result.total_tasks} total tasks`
                );
            }

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to list tasks');
            consoleInterface.showError(`Failed to list tasks: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle getting a specific task by ID
     * @param {string} taskId - Task ID (can be partial)
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Get task result
     */
    async handleGetTask(taskId, context) {
        const { consoleInterface } = context;

        try {
            // First try exact match
            let result = await getTask({
                task_id: taskId,
                include_children: true,
                include_parent_chain: true,
            });

            // If not found and it's a short ID, try to find matching task
            if (!result.success && taskId.length >= 8) {
                const listResult = await listTasks({});
                if (listResult.success) {
                    const matchingTask = listResult.tasks.find(task => task.id.startsWith(taskId));

                    if (matchingTask) {
                        result = await getTask({
                            task_id: matchingTask.id,
                            include_children: true,
                            include_parent_chain: true,
                        });
                    }
                }
            }

            if (!result.success) {
                consoleInterface.showError(`Task not found: ${result.error}`);
                consoleInterface.showMessage('💡 Use /task list to see available tasks.');
                return 'error';
            }

            const task = result.task;

            // Display task details
            consoleInterface.showMessage('\n📋 Task Details:');
            consoleInterface.showMessage('─'.repeat(50));
            consoleInterface.showMessage(`📍 ID: ${task.id}`);
            consoleInterface.showMessage(`📝 Title: ${task.title}`);
            consoleInterface.showMessage(
                `${task.status_display.symbol} Status: ${task.status_display.label}`
            );

            if (task.description) {
                consoleInterface.showMessage(`📄 Description: ${task.description}`);
            }

            // Show parent chain if exists
            if (task.parent_chain && task.parent_chain.length > 0) {
                consoleInterface.showMessage('\n🔗 Parent Chain:');
                task.parent_chain.forEach((parent, index) => {
                    const indent = '  '.repeat(index);
                    consoleInterface.showMessage(
                        `${indent}${parent.status_display.symbol} ${parent.title} (${parent.id.substring(0, 8)}...)`
                    );
                });
                consoleInterface.showMessage(
                    `${'  '.repeat(task.parent_chain.length)}└─ ${task.title} (current)`
                );
            }

            // Show children if exists
            if (task.children && task.children.length > 0) {
                consoleInterface.showMessage('\n👥 Child Tasks:');
                task.children.forEach(child => {
                    consoleInterface.showMessage(
                        `  ${child.status_display.symbol} ${child.title} (${child.id.substring(0, 8)}...)`
                    );
                });
            }

            // Show metadata
            consoleInterface.showMessage('\n📊 Metadata:');
            consoleInterface.showMessage(`🏠 Root task: ${task.is_root_task ? 'Yes' : 'No'}`);
            consoleInterface.showMessage(`👥 Has children: ${task.has_children ? 'Yes' : 'No'}`);
            if (task.hierarchy_level !== undefined) {
                consoleInterface.showMessage(`📏 Hierarchy level: ${task.hierarchy_level}`);
            }

            return result;
        } catch (error) {
            this.logger.error(error, 'Failed to get task');
            consoleInterface.showError(`Failed to get task: ${error.message}`);
            return 'error';
        }
    }

    /**
     * Handle task addition (placeholder)
     * @param {string} args - Add arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Add result
     */
    async handleAdd(args, context) {
        const { consoleInterface } = context;

        consoleInterface.showMessage('🚧 Task creation feature coming soon!');
        consoleInterface.showMessage('');
        consoleInterface.showMessage('This feature will allow you to:');
        consoleInterface.showMessage('  • Create new tasks with titles and descriptions');
        consoleInterface.showMessage('  • Set parent-child relationships');
        consoleInterface.showMessage('  • Assign initial status');
        consoleInterface.showMessage('  • Batch create multiple tasks');
        consoleInterface.showMessage('');
        consoleInterface.showMessage(
            '💡 For now, tasks can be created programmatically using the edit_tasks tool.'
        );

        return 'placeholder';
    }

    /**
     * Handle task removal (placeholder)
     * @param {string} args - Remove arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Remove result
     */
    async handleRemove(args, context) {
        const { consoleInterface } = context;

        consoleInterface.showMessage('🚧 Task removal feature coming soon!');
        consoleInterface.showMessage('');
        consoleInterface.showMessage('This feature will allow you to:');
        consoleInterface.showMessage('  • Delete individual tasks');
        consoleInterface.showMessage('  • Remove task hierarchies (parent and all children)');
        consoleInterface.showMessage('  • Bulk delete tasks by status or criteria');
        consoleInterface.showMessage('  • Safe deletion with confirmation prompts');
        consoleInterface.showMessage('');
        consoleInterface.showMessage(
            '💡 Tasks are currently stored in memory and reset on application restart.'
        );

        return 'placeholder';
    }

    /**
     * Handle task editing (placeholder)
     * @param {string} args - Edit arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Edit result
     */
    async handleEdit(args, context) {
        const { consoleInterface } = context;

        consoleInterface.showMessage('🚧 Task editing feature coming soon!');
        consoleInterface.showMessage('');
        consoleInterface.showMessage('This feature will allow you to:');
        consoleInterface.showMessage('  • Update task titles and descriptions');
        consoleInterface.showMessage(
            '  • Change task status (not_started, in_progress, completed, cancelled)'
        );
        consoleInterface.showMessage('  • Modify parent-child relationships');
        consoleInterface.showMessage('  • Interactive editing with prompts');
        consoleInterface.showMessage('');
        consoleInterface.showMessage(
            '💡 For now, tasks can be edited programmatically using the edit_tasks tool.'
        );

        return 'placeholder';
    }

    /**
     * Handle help display
     * @param {string} args - Help arguments
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Help result
     */
    async handleHelp(args, context) {
        const { consoleInterface } = context;

        consoleInterface.showMessage('\n📋 Task Management Commands:');
        consoleInterface.showMessage('─'.repeat(60));

        // Show commands
        consoleInterface.showMessage(
            '📝 /task list [options]          - List all tasks in hierarchical format'
        );
        consoleInterface.showMessage(
            '🔍 /task <task-id>               - Show detailed information for a specific task'
        );
        consoleInterface.showMessage(
            '➕ /task add [args]              - Add new tasks (coming soon)'
        );
        consoleInterface.showMessage(
            '✏️  /task edit <task-id> [args]   - Edit existing tasks (coming soon)'
        );
        consoleInterface.showMessage(
            '🗑️  /task remove <task-id>        - Remove tasks (coming soon)'
        );
        consoleInterface.showMessage('❓ /task help                    - Show this help message');

        // Show examples
        consoleInterface.showMessage('\n💡 Examples:');
        consoleInterface.showMessage('   /task list                           - List all tasks');
        consoleInterface.showMessage(
            '   /task list --format=detailed         - List tasks with full details'
        );
        consoleInterface.showMessage(
            '   /task list --status=in_progress      - List only in-progress tasks'
        );
        consoleInterface.showMessage(
            '   /task a1b2c3d4                       - Show details for task with ID a1b2c3d4'
        );

        // Show notes
        consoleInterface.showMessage('\n📝 Notes:');
        consoleInterface.showMessage(
            '   • Tasks are organized in hierarchical parent-child relationships'
        );
        consoleInterface.showMessage(
            '   • Status symbols: [ ] not_started, [/] in_progress, [x] completed, [-] cancelled'
        );
        consoleInterface.showMessage(
            '   • Task IDs are UUIDs - you can use the first 8 characters for convenience'
        );
        consoleInterface.showMessage(
            '   • Tasks are currently stored in memory and reset on application restart'
        );

        // Show aliases
        consoleInterface.showMessage('\n🔗 Aliases:');
        consoleInterface.showMessage('   /tasks, /t                           - Same as /task');

        return 'help';
    }

    /**
     * Parse command arguments
     * @param {string} args - Raw arguments
     * @returns {Object} Parsed arguments
     */
    parseArguments(args) {
        const trimmed = args.trim();
        const parts = trimmed.split(/\s+/);

        return {
            subcommand: parts[0] || '',
            subArgs: parts.slice(1).join(' '),
        };
    }

    /**
     * Parse list options from arguments
     * @param {string} args - List arguments
     * @returns {Object} List options
     */
    parseListOptions(args) {
        const options = {
            format: 'short',
        };

        if (!args) {
            return options;
        }

        // Parse flags
        const parts = args.split(/\s+/);
        for (const part of parts) {
            if (part.startsWith('--format=')) {
                options.format = part.split('=')[1];
            } else if (part.startsWith('--status=')) {
                options.status_filter = part.split('=')[1];
            }
        }

        return options;
    }

    /**
     * Check if a string looks like a task ID (UUID pattern)
     * @param {string} str - String to check
     * @returns {boolean} True if it looks like a task ID
     */
    isTaskId(str) {
        // Check for UUID pattern (full or partial)
        const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){0,3}(-[0-9a-f]{12})?$/i;
        const shortIdPattern = /^[0-9a-f]{8,}$/i;

        // Also check if it's not a known subcommand
        const knownSubcommands = ['list', 'add', 'remove', 'edit', 'help'];
        if (knownSubcommands.includes(str.toLowerCase())) {
            return false;
        }

        return uuidPattern.test(str) || shortIdPattern.test(str);
    }

    /**
     * Get usage information
     * @returns {string} Usage text
     */
    getUsage() {
        return '/task <list|add|edit|remove|help|task-id> [args]';
    }
}

export default TaskCommand;
