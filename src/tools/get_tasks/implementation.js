/**
 * Get Tasks tool implementation
 * Retrieves detailed information about one or more tasks by their IDs
 */

import { BaseTool } from '../common/base-tool.js';
import taskManager from '../common/task-manager.js';

class GetTasksTool extends BaseTool {
    constructor() {
        super('get_tasks', 'Get detailed information about one or more tasks by their IDs');

        // Define parameter validation
        this.requiredParams = ['task_ids'];
        this.parameterTypes = {
            task_ids: 'array',
            include_children: 'boolean',
            include_parent_chain: 'boolean',
        };
    }

    async implementation(params) {
        const { task_ids, include_children = false, include_parent_chain = false } = params;

        // task_ids should always be an array now
        const taskIdsArray = task_ids;
        const isSingleRequest = task_ids.length === 1;

        // Validate task_ids
        if (!task_ids || task_ids.length === 0) {
            return this.createErrorResponse('At least one task ID must be provided', {
                provided_task_ids: task_ids,
            });
        }

        // Validate individual task IDs but don't fail the entire request
        const validTaskIds = [];
        const invalidTaskIds = [];

        for (const taskId of taskIdsArray) {
            if (!taskId || (typeof taskId === 'string' && taskId.trim() === '')) {
                invalidTaskIds.push({
                    task_id: taskId,
                    error: 'Task ID cannot be empty',
                });
            } else {
                validTaskIds.push(taskId);
            }
        }

        // If all task IDs are invalid, return error
        if (validTaskIds.length === 0) {
            return this.createErrorResponse('All provided task IDs are invalid', {
                provided_task_ids: task_ids,
                invalid_task_ids: invalidTaskIds,
            });
        }

        try {
            const results = [];
            const notFound = [...invalidTaskIds]; // Start with invalid task IDs

            // Process each valid task ID
            for (const taskId of validTaskIds) {
                try {
                    const result = taskManager.getTask(taskId);

                    if (!result.success) {
                        notFound.push({
                            task_id: taskId,
                            error: result.error,
                        });
                        continue;
                    }

                    const task = { ...result.task };

                    // Add children information if requested
                    if (include_children) {
                        task.children = this.getTaskChildren(taskId);
                        task.children_count = task.children.length;
                    }

                    // Add parent chain information if requested
                    if (include_parent_chain) {
                        task.parent_chain = this.getParentChain(taskId);
                        task.hierarchy_level = task.parent_chain.length;
                    }

                    // Add additional metadata
                    task.has_children = this.hasChildren(taskId);
                    task.is_root_task = !task.parent;

                    // Add status information
                    task.status_display = this.getStatusDisplay(task.status);

                    results.push(task);
                } catch (taskError) {
                    notFound.push({
                        task_id: taskId,
                        error: `Failed to process task: ${taskError.message}`,
                    });
                }
            }

            // For single requests, return the task directly if found, or error if not found
            if (isSingleRequest) {
                if (results.length === 1 && notFound.length === 0) {
                    return this.createSuccessResponse({
                        task: results[0],
                    });
                } else if (results.length === 0 && notFound.length === 1) {
                    return this.createErrorResponse(notFound[0].error, {
                        task_id: taskIdsArray[0],
                    });
                }
                // If we have mixed results for a single request, something went wrong
                // This shouldn't happen since we only have one task ID, but handle it gracefully
                if (results.length === 0) {
                    return this.createErrorResponse(notFound[0].error, {
                        task_id: taskIdsArray[0],
                    });
                } else {
                    return this.createSuccessResponse({
                        task: results[0],
                    });
                }
            }

            // For batch requests, return array with metadata
            const responseData = {
                tasks: results,
                total_requested: taskIdsArray.length,
                total_found: results.length,
            };

            if (notFound.length > 0) {
                responseData.not_found = notFound;
            }

            return this.createSuccessResponse(responseData);
        } catch (error) {
            return this.createErrorResponse(`Failed to get tasks: ${error.message}`, {
                task_ids: task_ids,
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
            target_role: child.target_role,
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
const getTasksTool = new GetTasksTool();

export default async function getTasks(params) {
    return await getTasksTool.execute(params);
}
