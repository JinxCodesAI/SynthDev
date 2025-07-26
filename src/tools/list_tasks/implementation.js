/**
 * List Tasks tool implementation
 * Lists all tasks in the in-memory task management system
 */

import { BaseTool } from '../common/base-tool.js';
import taskManager from '../common/task-manager.js';

class ListTasksTool extends BaseTool {
    constructor() {
        super('list_tasks', 'List all tasks in the in-memory task management system');

        // Define parameter validation
        this.parameterTypes = {
            format: 'string',
            status_filter: 'string',
        };
    }

    async implementation(params) {
        const { format = 'detailed', status_filter } = params;

        // Validate format parameter
        const validFormats = ['short', 'detailed'];
        if (!validFormats.includes(format)) {
            return this.createErrorResponse(
                `Invalid format: ${format}. Valid formats: ${validFormats.join(', ')}`,
                { provided_format: format }
            );
        }

        // Validate status_filter parameter
        const validStatuses = ['not_started', 'in_progress', 'completed', 'cancelled'];
        if (status_filter && !validStatuses.includes(status_filter)) {
            return this.createErrorResponse(
                `Invalid status filter: ${status_filter}. Valid statuses: ${validStatuses.join(', ')}`,
                { provided_status_filter: status_filter }
            );
        }

        try {
            // Get all tasks in hierarchical format
            let tasks = taskManager.getTasksHierarchy();

            // Apply status filter if provided
            if (status_filter) {
                tasks = tasks.filter(task => task.status === status_filter);
            }

            // Format tasks based on requested format
            const formattedTasks = tasks.map(task => {
                const baseTask = {
                    id: task.id,
                    title: task.title,
                    status: task.status,
                    level: task.level,
                    display: `${task.indent}[${this.getStatusSymbol(task.status)}] ${task.title} (${task.id.substring(0, 8)}...)`,
                };

                if (format === 'detailed') {
                    baseTask.description = task.description;
                    baseTask.parent = task.parent;
                    baseTask.display = `${task.indent}[${this.getStatusSymbol(task.status)}] ${task.title}`;
                    if (task.description) {
                        baseTask.display += ` - ${task.description}`;
                    }
                    baseTask.display += ` (ID: ${task.id.substring(0, 8)}...)`;
                    if (task.parent) {
                        baseTask.display += ` (Parent: ${task.parent.substring(0, 8)}...)`;
                    }
                }

                return baseTask;
            });

            return this.createSuccessResponse({
                task_count: formattedTasks.length,
                total_tasks: taskManager.getTaskCount(),
                format,
                status_filter: status_filter || 'all',
                tasks: formattedTasks,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to list tasks: ${error.message}`, {
                stack: error.stack,
            });
        }
    }

    /**
     * Get status symbol for display
     * @param {string} status - Task status
     * @returns {string} Status symbol
     */
    getStatusSymbol(status) {
        const symbols = {
            not_started: ' ',
            in_progress: '/',
            completed: 'x',
            cancelled: '-',
        };
        return symbols[status] || '?';
    }
}

// Create and export the tool instance
const listTasksTool = new ListTasksTool();

export default async function listTasks(params) {
    return await listTasksTool.execute(params);
}
