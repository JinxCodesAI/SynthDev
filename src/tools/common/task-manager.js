/**
 * Task Manager - In-memory task storage and management
 * Provides centralized task management functionality for task-related tools
 */

import { randomUUID } from 'crypto';

/**
 * Task data structure:
 * {
 *   id: string (UUID),
 *   title: string,
 *   description: string,
 *   parent: string | null (parent task ID),
 *   status: string ('not_started', 'in_progress', 'completed', 'cancelled'),
 *   target_role: string (role of agent that should pickup the task),
 *   results: string | null (what has been produced in scope of this task)
 * }
 */

class TaskManager {
    constructor() {
        this.tasks = new Map(); // Map<string, Task>
        this.task_counter = 1;
        this.validStatuses = ['not_started', 'in_progress', 'completed', 'cancelled'];
    }

    /**
     * Create a new task or update an existing one
     * @param {Object} taskData - Task data
     * @param {string} [taskData.id] - Task ID (generated if not provided)
     * @param {string} taskData.title - Task title
     * @param {string} [taskData.description] - Task description
     * @param {string} [taskData.parent] - Parent task ID
     * @param {string} [taskData.status] - Task status
     * @param {string} [taskData.target_role] - Role of agent that should pickup the task
     * @param {string} [taskData.results] - What has been produced in scope of this task
     * @returns {Object} Result with success/error and task data
     */
    createOrUpdateTask(taskData) {
        try {
            const { id, title, description, parent, status, target_role, results } = taskData;

            // Validate required fields for new tasks
            if (!id && !title) {
                return {
                    success: false,
                    error: 'Title is required for new tasks',
                };
            }

            // Generate ID for new tasks
            const taskId = id || `task-${this.task_counter++}`;
            const isNewTask = !this.tasks.has(taskId);

            // Get existing task or create new one
            const existingTask = this.tasks.get(taskId) || {};

            // Build updated task (only update provided fields)
            const updatedTask = {
                id: taskId,
                title: title !== undefined ? title : existingTask.title,
                description:
                    description !== undefined ? description : existingTask.description || '',
                parent: parent !== undefined ? parent : existingTask.parent || null,
                status: status !== undefined ? status : existingTask.status || 'not_started',
                target_role:
                    target_role !== undefined ? target_role : existingTask.target_role || null,
                results: results !== undefined ? results : existingTask.results || null,
            };

            // Validate status
            if (!this.validStatuses.includes(updatedTask.status)) {
                return {
                    success: false,
                    error: `Invalid status: ${updatedTask.status}. Valid statuses: ${this.validStatuses.join(', ')}`,
                };
            }

            // Validate parent relationship
            if (updatedTask.parent) {
                if (updatedTask.parent === taskId) {
                    return {
                        success: false,
                        error: 'Task cannot be its own parent',
                    };
                }

                if (!this.tasks.has(updatedTask.parent)) {
                    return {
                        success: false,
                        error: `Parent task with ID ${updatedTask.parent} does not exist`,
                    };
                }

                // Check for circular dependencies
                if (this.wouldCreateCircularDependency(taskId, updatedTask.parent)) {
                    return {
                        success: false,
                        error: 'Cannot create circular parent-child relationship',
                    };
                }
            }

            // Store the task
            this.tasks.set(taskId, updatedTask);

            return {
                success: true,
                task: updatedTask,
                isNewTask,
            };
        } catch (error) {
            return {
                success: false,
                error: `Task operation failed: ${error.message}`,
            };
        }
    }

    /**
     * Get a task by ID
     * @param {string} taskId - Task ID
     * @returns {Object} Result with success/error and task data
     */
    getTask(taskId) {
        if (!taskId) {
            return {
                success: false,
                error: 'Task ID is required',
            };
        }

        const task = this.tasks.get(taskId);
        if (!task) {
            return {
                success: false,
                error: `Task with ID ${taskId} not found`,
            };
        }

        return {
            success: true,
            task,
        };
    }

    /**
     * Get all tasks
     * @returns {Array} Array of all tasks
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }

    /**
     * Get tasks in hierarchical format for display
     * @returns {Array} Array of tasks with hierarchy information
     */
    getTasksHierarchy() {
        const allTasks = this.getAllTasks();
        const rootTasks = allTasks.filter(task => !task.parent);
        const result = [];

        const addTaskWithChildren = (task, level = 0) => {
            result.push({
                ...task,
                level,
                indent: '  '.repeat(level),
            });

            // Find and add children
            const children = allTasks.filter(t => t.parent === task.id);
            children.forEach(child => addTaskWithChildren(child, level + 1));
        };

        rootTasks.forEach(task => addTaskWithChildren(task));
        return result;
    }

    /**
     * Delete a task and all its children
     * @param {string} taskId - Task ID to delete
     * @returns {Object} Result with success/error and deleted task count
     */
    deleteTask(taskId) {
        if (!this.tasks.has(taskId)) {
            return {
                success: false,
                error: `Task with ID ${taskId} not found`,
            };
        }

        const deletedTasks = [];
        const toDelete = [taskId];

        // Find all children recursively
        while (toDelete.length > 0) {
            const currentId = toDelete.pop();
            const task = this.tasks.get(currentId);

            if (task) {
                deletedTasks.push(task);
                this.tasks.delete(currentId);

                // Find children of current task
                const children = this.getAllTasks().filter(t => t.parent === currentId);
                children.forEach(child => toDelete.push(child.id));
            }
        }

        return {
            success: true,
            deletedCount: deletedTasks.length,
            deletedTasks,
        };
    }

    /**
     * Check if adding a parent would create a circular dependency
     * @param {string} taskId - Task ID
     * @param {string} parentId - Proposed parent ID
     * @returns {boolean} True if circular dependency would be created
     */
    wouldCreateCircularDependency(taskId, parentId) {
        let currentParent = parentId;
        const visited = new Set();

        while (currentParent) {
            if (currentParent === taskId) {
                return true; // Circular dependency found
            }

            if (visited.has(currentParent)) {
                return false; // Already checked this path
            }

            visited.add(currentParent);
            const parentTask = this.tasks.get(currentParent);
            currentParent = parentTask ? parentTask.parent : null;
        }

        return false;
    }

    /**
     * Clear all tasks (useful for testing)
     */
    clearAllTasks() {
        this.tasks.clear();
    }

    /**
     * Get task count
     * @returns {number} Number of tasks
     */
    getTaskCount() {
        return this.tasks.size;
    }
}

// Create singleton instance
const taskManager = new TaskManager();

export default taskManager;
export { TaskManager };
