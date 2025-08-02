/**
 * Edit Tasks tool implementation
 * Creates or edits tasks in the in-memory task management system
 */

import { BaseTool } from '../common/base-tool.js';
import taskManager from '../common/task-manager.js';
import SystemMessages from '../../core/ai/systemMessages.js';

class EditTasksTool extends BaseTool {
    constructor() {
        super('edit_tasks', 'Create or edit tasks in the in-memory task management system');

        // Define parameter validation
        this.requiredParams = ['tasks'];
        this.parameterTypes = {
            tasks: 'array',
        };
    }

    async implementation(params) {
        const { tasks } = params;

        // Validate tasks array
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return this.createErrorResponse('Tasks parameter must be a non-empty array', {
                provided_tasks: tasks,
            });
        }

        const processedTasks = [];
        const errors = [];

        // Process each task
        for (let i = 0; i < tasks.length; i++) {
            const taskData = tasks[i];

            // Validate task object
            if (!taskData || typeof taskData !== 'object') {
                errors.push({
                    index: i,
                    error: 'Task must be an object',
                    taskData,
                });
                continue;
            }

            // Validate task fields
            const validationError = this.validateTaskData(taskData, i);
            if (validationError) {
                errors.push(validationError);
                continue;
            }

            // Create or update the task
            const result = taskManager.createOrUpdateTask(taskData);

            if (result.success) {
                processedTasks.push({
                    index: i,
                    action: result.isNewTask ? 'created' : 'updated',
                    task: result.task,
                });
            } else {
                errors.push({
                    index: i,
                    error: result.error,
                    taskData,
                });
            }
        }

        // If there were errors, return them
        if (errors.length > 0) {
            return this.createErrorResponse('Some tasks could not be processed', {
                errors,
                processed_tasks: processedTasks,
                current_task_list: this.formatTaskList(),
            });
        }

        // Return success with current task list
        return this.createSuccessResponse({
            processed_tasks: processedTasks,
            current_task_list: this.formatTaskList(),
        });
    }

    /**
     * Validate task data structure
     * @param {Object} taskData - Task data to validate
     * @param {number} index - Index in the tasks array
     * @returns {Object|null} Error object if validation fails, null if valid
     */
    validateTaskData(taskData, index) {
        const { id, title, description, parent, status, target_role, results } = taskData;

        // Check for unknown fields
        const allowedFields = [
            'id',
            'title',
            'description',
            'parent',
            'status',
            'target_role',
            'results',
        ];
        const providedFields = Object.keys(taskData);
        const unknownFields = providedFields.filter(field => !allowedFields.includes(field));

        if (unknownFields.length > 0) {
            return {
                index,
                error: `Unknown fields: ${unknownFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`,
                taskData,
            };
        }

        // Validate field types
        if (id !== undefined && typeof id !== 'string') {
            return {
                index,
                error: 'Task ID must be a string',
                taskData,
            };
        }

        if (title !== undefined && typeof title !== 'string') {
            return {
                index,
                error: 'Task title must be a string',
                taskData,
            };
        }

        if (description !== undefined && typeof description !== 'string') {
            return {
                index,
                error: 'Task description must be a string',
                taskData,
            };
        }

        if (parent !== undefined && typeof parent !== 'string') {
            return {
                index,
                error: 'Task parent must be a string',
                taskData,
            };
        }

        if (status !== undefined && typeof status !== 'string') {
            return {
                index,
                error: 'Task status must be a string',
                taskData,
            };
        }

        if (target_role !== undefined && typeof target_role !== 'string') {
            return {
                index,
                error: 'Task target_role must be a string',
                taskData,
            };
        }

        if (results !== undefined && typeof results !== 'string') {
            return {
                index,
                error: 'Task results must be a string',
                taskData,
            };
        }

        // Validate status values
        const validStatuses = ['not_started', 'in_progress', 'completed', 'cancelled'];
        if (status !== undefined && !validStatuses.includes(status)) {
            return {
                index,
                error: `Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}`,
                taskData,
            };
        }

        // Validate target_role requirements based on task status and whether it's a new task
        const isNewTask = !id || !taskManager.getTask(id).success;

        if (isNewTask && !target_role) {
            return {
                index,
                error: 'target_role is required for new tasks',
                taskData,
            };
        }

        // For existing tasks that are in_progress or completed, don't allow target_role changes
        if (!isNewTask && target_role !== undefined) {
            const existingTask = taskManager.getTask(id);
            if (existingTask.success) {
                const currentStatus = existingTask.task.status;
                if (currentStatus === 'in_progress' || currentStatus === 'completed') {
                    return {
                        index,
                        error: 'target_role cannot be changed for in_progress or completed tasks',
                        taskData,
                    };
                }
            }
        }

        // Validate results requirements - required when changing status to completed
        if (status === 'completed' && (!results || results.trim() === '')) {
            return {
                index,
                error: 'results field is required when setting task status to completed',
                taskData,
            };
        }

        // Validate target_role permissions for new tasks
        if (isNewTask && target_role) {
            const validationError = this.validateTargetRolePermissions(
                target_role,
                index,
                taskData
            );
            if (validationError) {
                return validationError;
            }
        }

        return null;
    }

    /**
     * Validate that the current role can create tasks for the specified target_role
     * @param {string} target_role - The target role for the task
     * @param {number} index - Index in the tasks array
     * @param {Object} taskData - Task data being validated
     * @returns {Object|null} Error object if validation fails, null if valid
     */
    validateTargetRolePermissions(target_role, index, taskData) {
        // Get current role from context
        const currentRole = this.context?.currentRole;

        if (!currentRole) {
            // If no current role is available, allow the operation (for backward compatibility)
            return null;
        }

        // Skip validation for 'user' role (users can create tasks for any role)
        if (currentRole === 'user') {
            return null;
        }

        try {
            // Get the roles that the current role can create tasks for
            const canCreateTasksFor = SystemMessages.getCanCreateTasksFor(currentRole);
            const enabledAgents = SystemMessages.getEnabledAgents(currentRole);

            // Check if target_role is in the can_create_tasks_for list
            if (!canCreateTasksFor.includes(target_role)) {
                return {
                    index,
                    error:
                        `Role '${currentRole}' is not authorized to create tasks for '${target_role}'. ` +
                        `This role can create tasks for: [${canCreateTasksFor.join(', ')}]. ` +
                        `This role can communicate with: [${enabledAgents.join(', ')}]. ` +
                        'Please assign the task to an authorized role or communicate with an available agent.',
                    taskData,
                };
            }

            return null;
        } catch (error) {
            // If there's an error getting role configuration, log it but don't block the operation
            console.warn(
                `Warning: Could not validate target_role permissions for role '${currentRole}': ${error.message}`
            );
            return null;
        }
    }

    /**
     * Format task list for display
     * @returns {Array} Formatted task list with hierarchy
     */
    formatTaskList() {
        const hierarchy = taskManager.getTasksHierarchy();

        return hierarchy.map(task => ({
            id: task.id,
            title: `${task.indent}${task.title}`,
            status: task.status,
            level: task.level,
        }));
    }
}

// Create and export the tool instance
const editTasksTool = new EditTasksTool();

export default async function editTasks(params) {
    return await editTasksTool.execute(params);
}
