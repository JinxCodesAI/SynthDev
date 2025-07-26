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

import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import taskManager from '../../../src/tools/common/task-manager.js';

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
                tasks: [{ title: 'Test Task' }],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks).toHaveLength(1);
            expect(result.processed_tasks[0].action).toBe('created');
            expect(result.processed_tasks[0].task.title).toBe('Test Task');
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
                    },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks[0].task.title).toBe('Complete Task');
            expect(result.processed_tasks[0].task.description).toBe('A detailed description');
            expect(result.processed_tasks[0].task.status).toBe('in_progress');
        });

        it('should create multiple tasks', async () => {
            const result = await editTasks({
                tasks: [{ title: 'Task 1' }, { title: 'Task 2', status: 'completed' }],
            });

            expect(result.success).toBe(true);
            expect(result.processed_tasks).toHaveLength(2);
            expect(result.processed_tasks[0].task.title).toBe('Task 1');
            expect(result.processed_tasks[1].task.title).toBe('Task 2');
            expect(result.processed_tasks[1].task.status).toBe('completed');
        });
    });

    describe('Task Updates', () => {
        it('should update an existing task', async () => {
            // First create a task
            const createResult = await editTasks({
                tasks: [{ title: 'Original Task' }],
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
                tasks: [{ title: 'Parent Task' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            // Create child task
            const childResult = await editTasks({
                tasks: [
                    {
                        title: 'Child Task',
                        parent: parentId,
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
                tasks: [{ title: 'Test Task' }],
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
                tasks: [{ title: 'Parent Task' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [
                    {
                        title: 'Child Task',
                        parent: parentId,
                    },
                ],
            });

            const listResult = await editTasks({
                tasks: [{ title: 'Another Task' }],
            });

            expect(listResult.current_task_list).toHaveLength(3);
            // Check that child task has indentation
            const childTask = listResult.current_task_list.find(t =>
                t.title.includes('Child Task')
            );
            expect(childTask.title).toMatch(/^\s+Child Task/);
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
});
