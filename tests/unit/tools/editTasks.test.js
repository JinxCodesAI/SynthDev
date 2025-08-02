// tests/unit/tools/editTasks.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing the tool
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn().mockReturnValue({
        raw: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        user: vi.fn(),
        status: vi.fn(),
    }),
}));

// Mock SystemMessages
vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getCanCreateTasksFor: vi.fn(),
        getEnabledAgents: vi.fn(),
    },
}));

import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import taskManager from '../../../src/tools/common/task-manager.js';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

describe('Edit Tasks Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all tasks before each test
        taskManager.clearAllTasks();
    });

    describe('Parameter Validation', () => {
        it('should return error for missing tasks parameter', async () => {
            const result = await editTasks({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('tasks');
        });

        it('should return error for non-array tasks parameter', async () => {
            const result = await editTasks({ tasks: 'not an array' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('array');
        });

        it('should return error for empty tasks array', async () => {
            const result = await editTasks({ tasks: [] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('non-empty array');
        });

        it('should return error for non-object task', async () => {
            const result = await editTasks({ tasks: ['not an object'] });

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors[0].error).toContain('object');
        });
    });

    describe('Task Creation', () => {
        it('should create a new task with minimal data', async () => {
            const result = await editTasks({
                tasks: [{ title: 'Test Task', target_role: 'developer' }],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks).toHaveLength(1);
            expect(result.processed_tasks[0].action).toBe('created');
            expect(result.processed_tasks[0].task.title).toBe('Test Task');
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
            expect(result.processed_tasks[0].task.id).toBeDefined();
            expect(result.processed_tasks[0].task.status).toBe('not_started');
        });

        it('should create a new task with all fields', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Complete Task',
                        description: 'A detailed description',
                        status: 'in_progress',
                        target_role: 'developer',
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.title).toBe('Complete Task');
            expect(result.processed_tasks[0].task.description).toBe('A detailed description');
            expect(result.processed_tasks[0].task.status).toBe('in_progress');
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
        });

        it('should create multiple tasks', async () => {
            const result = await editTasks({
                tasks: [
                    { title: 'Task 1', target_role: 'developer' },
                    {
                        title: 'Task 2',
                        status: 'completed',
                        target_role: 'tester',
                        results: 'Task completed successfully',
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks).toHaveLength(2);
            expect(result.processed_tasks[0].task.title).toBe('Task 1');
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
            expect(result.processed_tasks[1].task.title).toBe('Task 2');
            expect(result.processed_tasks[1].task.target_role).toBe('tester');
            expect(result.processed_tasks[1].task.status).toBe('completed');
        });
    });

    describe('Task Updates', () => {
        it('should update an existing task', async () => {
            // First create a task
            const createResult = await editTasks({
                tasks: [{ title: 'Original Task', target_role: 'developer' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Then update it
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        title: 'Updated Task',
                        description: 'New description',
                    },
                ],
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.processed_tasks[0].action).toBe('updated');
            expect(updateResult.processed_tasks[0].task.title).toBe('Updated Task');
            expect(updateResult.processed_tasks[0].task.description).toBe('New description');
        });

        it('should update only provided fields', async () => {
            // Create a task with all fields
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Original Task',
                        description: 'Original description',
                        status: 'in_progress',
                        target_role: 'developer',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Update only the title
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        title: 'Updated Title',
                    },
                ],
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.processed_tasks[0].task.title).toBe('Updated Title');
            expect(updateResult.processed_tasks[0].task.description).toBe('Original description');
            expect(updateResult.processed_tasks[0].task.status).toBe('in_progress');
            expect(updateResult.processed_tasks[0].task.target_role).toBe('developer');
        });
    });

    describe('Field Validation', () => {
        it('should reject invalid field types', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 123, // Should be string
                        description: true, // Should be string
                        status: 'invalid_status',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject unknown fields', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        unknown_field: 'value',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors[0].error).toContain('Unknown fields');
        });

        it('should validate status values', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        status: 'invalid_status',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors[0].error).toContain('Invalid status');
        });
    });

    describe('Parent Relationships', () => {
        it('should create task with valid parent', async () => {
            // Create parent task
            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task', target_role: 'manager' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            // Create child task
            const childResult = await editTasks({
                tasks: [
                    {
                        title: 'Child Task',
                        parent: parentId,
                        target_role: 'developer',
                    },
                ],
            });

            expect(childResult.success).toBe(true);
            expect(childResult.processed_tasks[0].task.parent).toBe(parentId);
        });

        it('should reject non-existent parent', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Child Task',
                        parent: 'non-existent-id',
                        target_role: 'developer',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors[0].error).toContain('does not exist');
        });

        it('should reject self as parent', async () => {
            const taskId = 'test-id';
            const result = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        title: 'Self Parent Task',
                        parent: taskId,
                        target_role: 'developer',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors[0].error).toContain('cannot be its own parent');
        });
    });

    describe('Task List Output', () => {
        it('should include current task list in response', async () => {
            const result = await editTasks({
                tasks: [{ title: 'Test Task', target_role: 'developer' }],
            });

            expect(result.success).toBe(true);
            expect(result.current_task_list).toBeDefined();
            expect(Array.isArray(result.current_task_list)).toBe(true);
            expect(result.current_task_list).toHaveLength(1);
            expect(result.current_task_list[0].title).toBe('Test Task');
        });

        it('should show hierarchical structure in task list', async () => {
            // Create parent and child tasks
            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task', target_role: 'manager' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [
                    {
                        title: 'Child Task',
                        parent: parentId,
                        target_role: 'developer',
                    },
                ],
            });

            const listResult = await editTasks({
                tasks: [{ title: 'Another Task', target_role: 'tester' }],
            });

            expect(listResult.current_task_list).toHaveLength(3);
            // Check that child task has indentation
            const childTask = listResult.current_task_list.find(t =>
                t.title.includes('Child Task')
            );
            expect(childTask.title).toMatch(/^\s+Child Task/);
        });
    });

    describe('Target Role Validation', () => {
        it('should require target_role for new tasks', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        description: 'A task without target_role',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors[0].error).toContain('target_role is required for new tasks');
        });

        it('should accept valid target_role for new tasks', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
        });

        it('should reject non-string target_role', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 123,
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.errors[0].error).toContain('target_role must be a string');
        });

        it('should allow target_role updates for not_started tasks', async () => {
            // Create a task
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'not_started',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Update target_role
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        target_role: 'tester',
                    },
                ],
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.processed_tasks[0].task.target_role).toBe('tester');
        });

        it('should prevent target_role changes for in_progress tasks', async () => {
            // Create a task in progress
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'in_progress',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Try to update target_role
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        target_role: 'tester',
                    },
                ],
            });

            expect(updateResult.success).toBe(false);
            expect(updateResult.errors[0].error).toContain(
                'target_role cannot be changed for in_progress or completed tasks'
            );
        });

        it('should prevent target_role changes for completed tasks', async () => {
            // Create a completed task
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'completed',
                        results: 'Task completed successfully',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Try to update target_role
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        target_role: 'tester',
                    },
                ],
            });

            expect(updateResult.success).toBe(false);
            expect(updateResult.errors[0].error).toContain(
                'target_role cannot be changed for in_progress or completed tasks'
            );
        });

        it('should allow target_role changes for cancelled tasks', async () => {
            // Create a cancelled task
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'cancelled',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Update target_role
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        target_role: 'tester',
                    },
                ],
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.processed_tasks[0].task.target_role).toBe('tester');
        });

        it('should preserve target_role when updating other fields', async () => {
            // Create a task
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Original Task',
                        target_role: 'developer',
                        description: 'Original description',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            // Update only title
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        title: 'Updated Task',
                    },
                ],
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.processed_tasks[0].task.title).toBe('Updated Task');
            expect(updateResult.processed_tasks[0].task.target_role).toBe('developer');
            expect(updateResult.processed_tasks[0].task.description).toBe('Original description');
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields', async () => {
            const result = await editTasks({
                tasks: [{ title: 'Test Task' }],
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('processed_tasks');
            expect(result).toHaveProperty('current_task_list');
            expect(result.tool_name).toBe('edit_tasks');
        });

        it('should include error details on failure', async () => {
            const result = await editTasks({ tasks: ['invalid'] });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('errors');
            expect(result.success).toBe(false);
        });
    });

    describe('Results Field Validation', () => {
        it('should require results field when setting status to completed', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'completed',
                        // Missing results field
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Some tasks could not be processed');
            expect(result.errors[0].error).toContain(
                'results field is required when setting task status to completed'
            );
        });

        it('should reject empty results field when setting status to completed', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'completed',
                        results: '',
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Some tasks could not be processed');
            expect(result.errors[0].error).toContain(
                'results field is required when setting task status to completed'
            );
        });

        it('should accept valid results field when setting status to completed', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'completed',
                        results: 'Task completed successfully with all requirements met',
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.results).toBe(
                'Task completed successfully with all requirements met'
            );
        });

        it('should allow results field for non-completed tasks (optional)', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        status: 'in_progress',
                        results: 'Partial progress made',
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.results).toBe('Partial progress made');
        });

        it('should reject non-string results field', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                        results: 123, // Invalid type
                    },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Some tasks could not be processed');
            expect(result.errors[0].error).toContain('Task results must be a string');
        });
    });

    describe('Target Role Permission Validation', () => {
        beforeEach(() => {
            // Reset mocks before each test
            vi.clearAllMocks();
        });

        it('should allow task creation when user role creates tasks', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
                context: { currentRole: 'user' },
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
        });

        it('should allow task creation when no context is provided (backward compatibility)', async () => {
            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
        });

        it('should allow task creation when role has permission', async () => {
            SystemMessages.getCanCreateTasksFor.mockReturnValue(['developer', 'tester']);
            SystemMessages.getEnabledAgents.mockReturnValue(['architect']);

            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
                context: { currentRole: 'pm' },
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
            expect(SystemMessages.getCanCreateTasksFor).toHaveBeenCalledWith('pm');
        });

        it('should reject task creation when role lacks permission', async () => {
            SystemMessages.getCanCreateTasksFor.mockReturnValue(['tester']);
            SystemMessages.getEnabledAgents.mockReturnValue(['architect']);

            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
                context: { currentRole: 'pm' },
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Some tasks could not be processed');
            expect(result.errors[0].error).toContain(
                "Role 'pm' is not authorized to create tasks for 'developer'"
            );
            expect(result.errors[0].error).toContain('This role can create tasks for: [tester]');
            expect(result.errors[0].error).toContain('This role can communicate with: [architect]');
            expect(SystemMessages.getCanCreateTasksFor).toHaveBeenCalledWith('pm');
            expect(SystemMessages.getEnabledAgents).toHaveBeenCalledWith('pm');
        });

        it('should handle SystemMessages errors gracefully', async () => {
            SystemMessages.getCanCreateTasksFor.mockImplementation(() => {
                throw new Error('Role configuration error');
            });

            const result = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
                context: { currentRole: 'pm' },
            });

            // Should succeed despite the error (graceful fallback)
            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.target_role).toBe('developer');
        });

        it('should only validate permissions for new tasks, not updates', async () => {
            SystemMessages.getCanCreateTasksFor.mockReturnValue(['tester']);
            SystemMessages.getEnabledAgents.mockReturnValue(['architect']);

            // First create a task
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        target_role: 'developer',
                    },
                ],
                context: { currentRole: 'user' }, // User can create any task
            });
            expect(createResult.success).toBe(true);
            const taskId = createResult.processed_tasks[0].task.id;

            // Now try to update it with a role that doesn't have permission
            const updateResult = await editTasks({
                tasks: [
                    {
                        id: taskId,
                        title: 'Updated Task',
                    },
                ],
                context: { currentRole: 'pm' }, // PM can't create tasks for developer, but can update existing ones
            });

            expect(updateResult.success).toBe(true);
            expect(updateResult.processed_tasks[0].task.title).toBe('Updated Task');
            // SystemMessages should not be called for updates
            expect(SystemMessages.getCanCreateTasksFor).not.toHaveBeenCalled();
        });
    });
});
