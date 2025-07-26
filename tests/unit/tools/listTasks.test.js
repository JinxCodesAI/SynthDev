// tests/unit/tools/listTasks.test.js
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

import listTasks from '../../../src/tools/list_tasks/implementation.js';
import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import taskManager from '../../../src/tools/common/task-manager.js';

describe('List Tasks Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all tasks before each test
        taskManager.clearAllTasks();
    });

    describe('Empty Task List', () => {
        it('should return empty list when no tasks exist', async () => {
            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(0);
            expect(result.total_tasks).toBe(0);
            expect(result.tasks).toEqual([]);
        });
    });

    describe('Basic Task Listing', () => {
        it('should list single task', async () => {
            // Create a task first
            await editTasks({
                tasks: [{ title: 'Test Task', status: 'in_progress' }],
            });

            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(1);
            expect(result.total_tasks).toBe(1);
            expect(result.tasks).toHaveLength(1);
            expect(result.tasks[0].title).toBe('Test Task');
            expect(result.tasks[0].status).toBe('in_progress');
            expect(result.tasks[0].level).toBe(0);
        });

        it('should list multiple tasks', async () => {
            // Create multiple tasks
            await editTasks({
                tasks: [
                    { title: 'Task 1', status: 'not_started' },
                    { title: 'Task 2', status: 'completed' },
                    { title: 'Task 3', status: 'in_progress' },
                ],
            });

            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(3);
            expect(result.total_tasks).toBe(3);
            expect(result.tasks).toHaveLength(3);
        });
    });

    describe('Format Parameter', () => {
        beforeEach(async () => {
            // Create a test task with description
            await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        description: 'Test description',
                        status: 'in_progress',
                    },
                ],
            });
        });

        it('should use short format by default', async () => {
            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.format).toBe('short');
            expect(result.tasks[0].display).toContain('[/] Test Task');
            expect(result.tasks[0].display).toContain('...');
            expect(result.tasks[0]).not.toHaveProperty('description');
        });

        it('should use short format when explicitly specified', async () => {
            const result = await listTasks({ format: 'short' });

            expect(result.success).toBe(true);
            expect(result.format).toBe('short');
            expect(result.tasks[0]).not.toHaveProperty('description');
        });

        it('should use detailed format when specified', async () => {
            const result = await listTasks({ format: 'detailed' });

            expect(result.success).toBe(true);
            expect(result.format).toBe('detailed');
            expect(result.tasks[0]).toHaveProperty('description');
            expect(result.tasks[0]).toHaveProperty('parent');
            expect(result.tasks[0].description).toBe('Test description');
            expect(result.tasks[0].display).toContain('Test description');
        });

        it('should reject invalid format', async () => {
            const result = await listTasks({ format: 'invalid' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid format');
        });
    });

    describe('Status Filter', () => {
        beforeEach(async () => {
            // Create tasks with different statuses
            await editTasks({
                tasks: [
                    { title: 'Not Started Task', status: 'not_started' },
                    { title: 'In Progress Task', status: 'in_progress' },
                    { title: 'Completed Task', status: 'completed' },
                    { title: 'Cancelled Task', status: 'cancelled' },
                ],
            });
        });

        it('should list all tasks when no filter is applied', async () => {
            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(4);
            expect(result.status_filter).toBe('all');
        });

        it('should filter by not_started status', async () => {
            const result = await listTasks({ status_filter: 'not_started' });

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(1);
            expect(result.status_filter).toBe('not_started');
            expect(result.tasks[0].title).toBe('Not Started Task');
            expect(result.tasks[0].status).toBe('not_started');
        });

        it('should filter by in_progress status', async () => {
            const result = await listTasks({ status_filter: 'in_progress' });

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(1);
            expect(result.tasks[0].title).toBe('In Progress Task');
        });

        it('should filter by completed status', async () => {
            const result = await listTasks({ status_filter: 'completed' });

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(1);
            expect(result.tasks[0].title).toBe('Completed Task');
        });

        it('should filter by cancelled status', async () => {
            const result = await listTasks({ status_filter: 'cancelled' });

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(1);
            expect(result.tasks[0].title).toBe('Cancelled Task');
        });

        it('should return empty list when no tasks match filter', async () => {
            // Clear tasks and create only one type
            taskManager.clearAllTasks();
            await editTasks({
                tasks: [{ title: 'Only Task', status: 'completed' }],
            });

            const result = await listTasks({ status_filter: 'in_progress' });

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(0);
            expect(result.total_tasks).toBe(1);
            expect(result.tasks).toEqual([]);
        });

        it('should reject invalid status filter', async () => {
            const result = await listTasks({ status_filter: 'invalid_status' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid status filter');
        });
    });

    describe('Hierarchical Display', () => {
        it('should show hierarchical structure with indentation', async () => {
            // Create parent task
            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            // Create child tasks
            await editTasks({
                tasks: [
                    { title: 'Child Task 1', parent: parentId },
                    { title: 'Child Task 2', parent: parentId },
                ],
            });

            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(3);

            // Find parent and children
            const parentTask = result.tasks.find(t => t.title === 'Parent Task');
            const child1 = result.tasks.find(t => t.title.includes('Child Task 1'));
            const child2 = result.tasks.find(t => t.title.includes('Child Task 2'));

            expect(parentTask.level).toBe(0);
            expect(child1.level).toBe(1);
            expect(child2.level).toBe(1);

            // Check indentation in display
            expect(parentTask.display).not.toMatch(/^\s/);
            expect(child1.display).toMatch(/^\s+/);
            expect(child2.display).toMatch(/^\s+/);
        });

        it('should show nested hierarchy with multiple levels', async () => {
            // Create grandparent -> parent -> child structure
            const grandparentResult = await editTasks({
                tasks: [{ title: 'Grandparent Task' }],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task', parent: grandparentId }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [{ title: 'Child Task', parent: parentId }],
            });

            const result = await listTasks({});

            expect(result.success).toBe(true);
            expect(result.task_count).toBe(3);

            const grandparent = result.tasks.find(t => t.title === 'Grandparent Task');
            const parent = result.tasks.find(t => t.title.includes('Parent Task'));
            const child = result.tasks.find(t => t.title.includes('Child Task'));

            expect(grandparent.level).toBe(0);
            expect(parent.level).toBe(1);
            expect(child.level).toBe(2);
        });
    });

    describe('Status Symbols', () => {
        it('should display correct status symbols', async () => {
            await editTasks({
                tasks: [
                    { title: 'Not Started', status: 'not_started' },
                    { title: 'In Progress', status: 'in_progress' },
                    { title: 'Completed', status: 'completed' },
                    { title: 'Cancelled', status: 'cancelled' },
                ],
            });

            const result = await listTasks({});

            expect(result.success).toBe(true);

            const notStarted = result.tasks.find(t => t.title === 'Not Started');
            const inProgress = result.tasks.find(t => t.title === 'In Progress');
            const completed = result.tasks.find(t => t.title === 'Completed');
            const cancelled = result.tasks.find(t => t.title === 'Cancelled');

            expect(notStarted.display).toContain('[ ]');
            expect(inProgress.display).toContain('[/]');
            expect(completed.display).toContain('[x]');
            expect(cancelled.display).toContain('[-]');
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields', async () => {
            const result = await listTasks({});

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('task_count');
            expect(result).toHaveProperty('total_tasks');
            expect(result).toHaveProperty('format');
            expect(result).toHaveProperty('status_filter');
            expect(result).toHaveProperty('tasks');
            expect(result.tool_name).toBe('list_tasks');
        });

        it('should include error details on failure', async () => {
            const result = await listTasks({ format: 'invalid' });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result.success).toBe(false);
        });
    });
});
