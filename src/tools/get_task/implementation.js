/**
 * Get Task tool implementation
 * Retrieves detailed information about a single task by ID
 */

import { BaseTool } from '../common/base-tool.js';
import taskManager from '../common/task-manager.js';

class GetTaskTool extends BaseTool {
    constructor() {
        super('get_task', 'Get detailed information about a single task by its ID');

        // Define parameter validation
        this.requiredParams = ['task_id'];
        this.parameterTypes = {
            task_id: 'string',
            include_children: 'boolean',
            include_parent_chain: 'boolean',
        };
    }

    async implementation(params) {
        const { task_id, include_children = false, include_parent_chain = false } = params;

        // Validate task_id
        if (!task_id || task_id.trim() === '') {
            return this.createErrorResponse('Task ID cannot be empty', {
                provided_task_id: task_id,
            });
        }

        try {
            // Get the task
            const result = taskManager.getTask(task_id);

            if (!result.success) {
                return this.createErrorResponse(result.error, {
                    task_id,
                });
            }

            const task = { ...result.task };

            // Add children information if requested
            if (include_children) {
                task.children = this.getTaskChildren(task_id);
                task.children_count = task.children.length;
            }

            // Add parent chain information if requested
            if (include_parent_chain) {
                task.parent_chain = this.getParentChain(task_id);
                task.hierarchy_level = task.parent_chain.length;
            }

            // Add additional metadata
            task.has_children = this.hasChildren(task_id);
            task.is_root_task = !task.parent;

            // Add status information
            task.status_display = this.getStatusDisplay(task.status);

            return this.createSuccessResponse({
                task,
            });
        } catch (error) {
            return this.createErrorResponse(`Failed to get task: ${error.message}`, {
                task_id,
                stack: error.stack,
            });
        }
    }

    /**
     * Get direct children of a task
     * @param {string} taskId - Parent task ID
     * @returns {Array} Array of child tasks with basic information
     */
    getTaskChildren(taskId) {
        const allTasks = taskManager.getAllTasks();
        const children = allTasks.filter(task => task.parent === taskId);

        return children.map(child => ({
            id: child.id,
            title: child.title,
            status: child.status,
            status_display: this.getStatusDisplay(child.status),
            has_children: this.hasChildren(child.id),
        }));
    }

    /**
     * Get the parent chain from root to the given task
     * @param {string} taskId - Task ID
     * @returns {Array} Array of parent tasks from root to immediate parent
     */
    getParentChain(taskId) {
        const chain = [];
        const task = taskManager.getTask(taskId);

        if (!task.success || !task.task.parent) {
            return chain;
        }

        let currentParentId = task.task.parent;

        while (currentParentId) {
            const parentResult = taskManager.getTask(currentParentId);
            if (!parentResult.success) {
                break;
            }

            const parent = parentResult.task;
            chain.unshift({
                id: parent.id,
                title: parent.title,
                status: parent.status,
                status_display: this.getStatusDisplay(parent.status),
            });

            currentParentId = parent.parent;
        }

        return chain;
    }

    /**
     * Check if a task has children
     * @param {string} taskId - Task ID
     * @returns {boolean} True if task has children
     */
    hasChildren(taskId) {
        const allTasks = taskManager.getAllTasks();
        return allTasks.some(task => task.parent === taskId);
    }

    /**
     * Get display format for status
     * @param {string} status - Task status
     * @returns {Object} Status display information
     */
    getStatusDisplay(status) {
        const statusInfo = {
            not_started: {
                symbol: '[ ]',
                label: 'Not Started',
                color: 'gray',
            },
            in_progress: {
                symbol: '[/]',
                label: 'In Progress',
                color: 'yellow',
            },
            completed: {
                symbol: '[x]',
                label: 'Completed',
                color: 'green',
            },
            cancelled: {
                symbol: '[-]',
                label: 'Cancelled',
                color: 'red',
            },
        };

        return (
            statusInfo[status] || {
                symbol: '[?]',
                label: 'Unknown',
                color: 'gray',
            }
        );
    }
}

// Create and export the tool instance
const getTaskTool = new GetTaskTool();

export default async function getTask(params) {
    return await getTaskTool.execute(params);
}
