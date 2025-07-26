// tests/unit/tools/getTask.test.js
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

import getTask from '../../../src/tools/get_task/implementation.js';
import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import taskManager from '../../../src/tools/common/task-manager.js';

describe('Get Task Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all tasks before each test
        taskManager.clearAllTasks();
    });

    describe('Parameter Validation', () => {
        it('should return error for missing task_id parameter', async () => {
            const result = await getTask({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('task_id');
        });

        it('should return error for empty task_id', async () => {
            const result = await getTask({ task_id: '' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('cannot be empty');
        });

        it('should return error for whitespace-only task_id', async () => {
            const result = await getTask({ task_id: '   ' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('cannot be empty');
        });

        it('should return error for non-string task_id', async () => {
            const result = await getTask({ task_id: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('string');
        });
    });

    describe('Task Retrieval', () => {
        it('should return error for non-existent task', async () => {
            const result = await getTask({ task_id: 'non-existent-id' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should retrieve basic task information', async () => {
            // Create a task first
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        description: 'Test description',
                        status: 'in_progress',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({ task_id: taskId });

            expect(result.success).toBe(true);
            expect(result.task.id).toBe(taskId);
            expect(result.task.title).toBe('Test Task');
            expect(result.task.description).toBe('Test description');
            expect(result.task.status).toBe('in_progress');
            expect(result.task.parent).toBeNull();
        });

        it('should include metadata fields', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Test Task' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({ task_id: taskId });

            expect(result.success).toBe(true);
            expect(result.task).toHaveProperty('has_children');
            expect(result.task).toHaveProperty('is_root_task');
            expect(result.task).toHaveProperty('status_display');
            expect(result.task.has_children).toBe(false);
            expect(result.task.is_root_task).toBe(true);
        });

        it('should include status display information', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Test Task', status: 'completed' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({ task_id: taskId });

            expect(result.success).toBe(true);
            expect(result.task.status_display).toHaveProperty('symbol');
            expect(result.task.status_display).toHaveProperty('label');
            expect(result.task.status_display).toHaveProperty('color');
            expect(result.task.status_display.symbol).toBe('[x]');
            expect(result.task.status_display.label).toBe('Completed');
        });
    });

    describe('Children Information', () => {
        it('should not include children by default', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Parent Task' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({ task_id: taskId });

            expect(result.success).toBe(true);
            expect(result.task).not.toHaveProperty('children');
            expect(result.task).not.toHaveProperty('children_count');
        });

        it('should include children when requested', async () => {
            // Create parent task
            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            // Create child tasks
            await editTasks({
                tasks: [
                    { title: 'Child 1', parent: parentId, status: 'completed' },
                    { title: 'Child 2', parent: parentId, status: 'in_progress' },
                ],
            });

            const result = await getTask({
                task_id: parentId,
                include_children: true,
            });

            expect(result.success).toBe(true);
            expect(result.task).toHaveProperty('children');
            expect(result.task).toHaveProperty('children_count');
            expect(result.task.children).toHaveLength(2);
            expect(result.task.children_count).toBe(2);
            expect(result.task.has_children).toBe(true);

            // Check child information
            const child1 = result.task.children.find(c => c.title === 'Child 1');
            const child2 = result.task.children.find(c => c.title === 'Child 2');

            expect(child1).toBeDefined();
            expect(child1.status).toBe('completed');
            expect(child1.status_display.symbol).toBe('[x]');
            expect(child2).toBeDefined();
            expect(child2.status).toBe('in_progress');
        });

        it('should show empty children array for task with no children', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Childless Task' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({
                task_id: taskId,
                include_children: true,
            });

            expect(result.success).toBe(true);
            expect(result.task.children).toEqual([]);
            expect(result.task.children_count).toBe(0);
            expect(result.task.has_children).toBe(false);
        });
    });

    describe('Parent Chain Information', () => {
        it('should not include parent chain by default', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Test Task' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({ task_id: taskId });

            expect(result.success).toBe(true);
            expect(result.task).not.toHaveProperty('parent_chain');
            expect(result.task).not.toHaveProperty('hierarchy_level');
        });

        it('should include empty parent chain for root task', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Root Task' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({
                task_id: taskId,
                include_parent_chain: true,
            });

            expect(result.success).toBe(true);
            expect(result.task.parent_chain).toEqual([]);
            expect(result.task.hierarchy_level).toBe(0);
            expect(result.task.is_root_task).toBe(true);
        });

        it('should include parent chain for nested task', async () => {
            // Create grandparent -> parent -> child structure
            const grandparentResult = await editTasks({
                tasks: [{ title: 'Grandparent', status: 'completed' }],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [{ title: 'Parent', parent: grandparentId, status: 'in_progress' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            const childResult = await editTasks({
                tasks: [{ title: 'Child', parent: parentId }],
            });
            const childId = childResult.processed_tasks[0].task.id;

            const result = await getTask({
                task_id: childId,
                include_parent_chain: true,
            });

            expect(result.success).toBe(true);
            expect(result.task.parent_chain).toHaveLength(2);
            expect(result.task.hierarchy_level).toBe(2);
            expect(result.task.is_root_task).toBe(false);

            // Check parent chain order (should be from root to immediate parent)
            expect(result.task.parent_chain[0].title).toBe('Grandparent');
            expect(result.task.parent_chain[0].status).toBe('completed');
            expect(result.task.parent_chain[1].title).toBe('Parent');
            expect(result.task.parent_chain[1].status).toBe('in_progress');
        });
    });

    describe('Combined Options', () => {
        it('should include both children and parent chain when requested', async () => {
            // Create a middle task with parent and children
            const grandparentResult = await editTasks({
                tasks: [{ title: 'Grandparent' }],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [{ title: 'Parent', parent: grandparentId }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [{ title: 'Child', parent: parentId }],
            });

            const result = await getTask({
                task_id: parentId,
                include_children: true,
                include_parent_chain: true,
            });

            expect(result.success).toBe(true);
            expect(result.task).toHaveProperty('children');
            expect(result.task).toHaveProperty('parent_chain');
            expect(result.task.children).toHaveLength(1);
            expect(result.task.parent_chain).toHaveLength(1);
            expect(result.task.hierarchy_level).toBe(1);
            expect(result.task.has_children).toBe(true);
            expect(result.task.is_root_task).toBe(false);
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Test Task' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTask({ task_id: taskId });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('task');
            expect(result.tool_name).toBe('get_task');
        });

        it('should include error details on failure', async () => {
            const result = await getTask({ task_id: 'non-existent' });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result.success).toBe(false);
        });
    });
});
