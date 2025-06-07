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

import getTasks from '../../../src/tools/get_tasks/implementation.js';
import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import taskManager from '../../../src/tools/common/task-manager.js';

describe('Get Tasks Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear all tasks before each test
        taskManager.clearAllTasks();
    });

    describe('Parameter Validation', () => {
        it('should return error for missing task_ids parameter', async () => {
            const result = await getTasks({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('task_ids');
        });

        it('should return error for array with empty string', async () => {
            const result = await getTasks({ task_ids: [''] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('All provided task IDs are invalid');
        });

        it('should return error for array with whitespace-only string', async () => {
            const result = await getTasks({ task_ids: ['   '] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('All provided task IDs are invalid');
        });

        it('should return error for empty task_ids array', async () => {
            const result = await getTasks({ task_ids: [] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('At least one task ID must be provided');
        });

        it('should handle mixed valid and invalid task IDs', async () => {
            // Create one valid task
            const createResult = await editTasks({
                tasks: [{ title: 'Valid Task', target_role: 'developer' }],
            });
            const validTaskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [validTaskId, '', 'non-existent'] });

            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(1);
            expect(result.total_requested).toBe(3);
            expect(result.total_found).toBe(1);
            expect(result.not_found).toHaveLength(2);

            // Check successful task
            expect(result.tasks[0].title).toBe('Valid Task');

            // Check failed tasks
            expect(result.not_found[0].task_id).toBe('');
            expect(result.not_found[0].error).toContain('cannot be empty');
            expect(result.not_found[1].task_id).toBe('non-existent');
            expect(result.not_found[1].error).toContain('not found');
        });
    });

    describe('Single Task Retrieval', () => {
        it('should return error for non-existent task (string input)', async () => {
            const result = await getTasks({ task_ids: ['non-existent-id'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should return error for non-existent task (array input)', async () => {
            const result = await getTasks({ task_ids: ['non-existent-id'] });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should retrieve basic task information (string input)', async () => {
            // Create a task first
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        description: 'Test description',
                        status: 'in_progress',
                        target_role: 'developer',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

            expect(result.success).toBe(true);
            expect(result.task.id).toBe(taskId);
            expect(result.task.title).toBe('Test Task');
            expect(result.task.description).toBe('Test description');
            expect(result.task.status).toBe('in_progress');
            expect(result.task.target_role).toBe('developer');
            expect(result.task.parent).toBeNull();
        });

        it('should retrieve basic task information (array input)', async () => {
            // Create a task first
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task Array',
                        description: 'Test description',
                        status: 'in_progress',
                        target_role: 'developer',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

            expect(result.success).toBe(true);
            expect(result.task.id).toBe(taskId);
            expect(result.task.title).toBe('Test Task Array');
            expect(result.task.description).toBe('Test description');
            expect(result.task.status).toBe('in_progress');
            expect(result.task.target_role).toBe('developer');
            expect(result.task.parent).toBeNull();
        });

        it('should include metadata fields', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Test Task', target_role: 'tester' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

            expect(result.success).toBe(true);
            expect(result.task).toHaveProperty('has_children');
            expect(result.task).toHaveProperty('is_root_task');
            expect(result.task).toHaveProperty('status_display');
            expect(result.task).toHaveProperty('target_role');
            expect(result.task.has_children).toBe(false);
            expect(result.task.is_root_task).toBe(true);
            expect(result.task.target_role).toBe('tester');
        });

        it('should include status display information', async () => {
            const createResult = await editTasks({
                tasks: [
                    {
                        title: 'Test Task',
                        status: 'completed',
                        target_role: 'developer',
                        results: 'Task completed successfully',
                    },
                ],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

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
                tasks: [{ title: 'Parent Task', target_role: 'manager' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

            expect(result.success).toBe(true);
            expect(result.task).not.toHaveProperty('children');
            expect(result.task).not.toHaveProperty('children_count');
        });

        it('should include children when requested', async () => {
            // Create parent task
            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task', target_role: 'manager' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            // Create child tasks
            await editTasks({
                tasks: [
                    {
                        title: 'Child 1',
                        parent: parentId,
                        status: 'completed',
                        target_role: 'developer',
                        results: 'Child task completed successfully',
                    },
                    {
                        title: 'Child 2',
                        parent: parentId,
                        status: 'in_progress',
                        target_role: 'tester',
                    },
                ],
            });

            const result = await getTasks({
                task_ids: [parentId],
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
            expect(child1.target_role).toBe('developer');
            expect(child1.status_display.symbol).toBe('[x]');
            expect(child2).toBeDefined();
            expect(child2.status).toBe('in_progress');
            expect(child2.target_role).toBe('tester');
        });

        it('should show empty children array for task with no children', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Childless Task', target_role: 'developer' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({
                task_ids: [taskId],
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
                tasks: [{ title: 'Test Task', target_role: 'developer' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

            expect(result.success).toBe(true);
            expect(result.task).not.toHaveProperty('parent_chain');
            expect(result.task).not.toHaveProperty('hierarchy_level');
        });

        it('should include empty parent chain for root task', async () => {
            const createResult = await editTasks({
                tasks: [{ title: 'Root Task', target_role: 'manager' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({
                task_ids: [taskId],
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
                tasks: [
                    {
                        title: 'Grandparent',
                        status: 'completed',
                        target_role: 'manager',
                        results: 'Grandparent task completed successfully',
                    },
                ],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [
                    {
                        title: 'Parent',
                        parent: grandparentId,
                        status: 'in_progress',
                        target_role: 'lead',
                    },
                ],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            const childResult = await editTasks({
                tasks: [{ title: 'Child', parent: parentId, target_role: 'developer' }],
            });
            const childId = childResult.processed_tasks[0].task.id;

            const result = await getTasks({
                task_ids: [childId],
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
                tasks: [{ title: 'Grandparent', target_role: 'manager' }],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [{ title: 'Parent', parent: grandparentId, target_role: 'lead' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [{ title: 'Child', parent: parentId, target_role: 'developer' }],
            });

            const result = await getTasks({
                task_ids: [parentId],
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
                tasks: [{ title: 'Test Task', target_role: 'developer' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({ task_ids: [taskId] });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('task');
            expect(result.tool_name).toBe('get_tasks');
        });

        it('should include error details on failure', async () => {
            const result = await getTasks({ task_ids: ['non-existent'] });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result.success).toBe(false);
        });
    });

    describe('Batch Task Retrieval', () => {
        it('should retrieve multiple tasks successfully', async () => {
            // Create multiple tasks
            const createResult = await editTasks({
                tasks: [
                    { title: 'Task 1', description: 'First task', target_role: 'developer' },
                    { title: 'Task 2', description: 'Second task', target_role: 'tester' },
                    { title: 'Task 3', description: 'Third task', target_role: 'manager' },
                ],
            });

            const taskIds = createResult.processed_tasks.map(t => t.task.id);

            const result = await getTasks({ task_ids: taskIds });

            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(3);
            expect(result.total_requested).toBe(3);
            expect(result.total_found).toBe(3);
            expect(result).not.toHaveProperty('not_found');

            // Check each task
            const task1 = result.tasks.find(t => t.title === 'Task 1');
            const task2 = result.tasks.find(t => t.title === 'Task 2');
            const task3 = result.tasks.find(t => t.title === 'Task 3');

            expect(task1).toBeDefined();
            expect(task1.target_role).toBe('developer');
            expect(task2).toBeDefined();
            expect(task2.target_role).toBe('tester');
            expect(task3).toBeDefined();
            expect(task3.target_role).toBe('manager');
        });

        it('should handle mixed success and failure scenarios', async () => {
            // Create one task
            const createResult = await editTasks({
                tasks: [{ title: 'Existing Task', target_role: 'developer' }],
            });
            const existingTaskId = createResult.processed_tasks[0].task.id;

            const result = await getTasks({
                task_ids: [existingTaskId, 'non-existent-1', 'non-existent-2'],
            });

            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(1);
            expect(result.total_requested).toBe(3);
            expect(result.total_found).toBe(1);
            expect(result.not_found).toHaveLength(2);

            // Check successful task
            expect(result.tasks[0].title).toBe('Existing Task');
            expect(result.tasks[0].target_role).toBe('developer');

            // Check failed tasks
            expect(result.not_found[0].task_id).toBe('non-existent-1');
            expect(result.not_found[0].error).toContain('not found');
            expect(result.not_found[1].task_id).toBe('non-existent-2');
            expect(result.not_found[1].error).toContain('not found');
        });

        it('should handle all failed tasks', async () => {
            const result = await getTasks({
                task_ids: ['non-existent-1', 'non-existent-2', 'non-existent-3'],
            });

            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(0);
            expect(result.total_requested).toBe(3);
            expect(result.total_found).toBe(0);
            expect(result.not_found).toHaveLength(3);
        });

        it('should include children and parent chain for batch requests', async () => {
            // Create parent-child structure
            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task', target_role: 'manager' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            const childResult = await editTasks({
                tasks: [{ title: 'Child Task', parent: parentId, target_role: 'developer' }],
            });
            const childId = childResult.processed_tasks[0].task.id;

            const result = await getTasks({
                task_ids: [parentId, childId],
                include_children: true,
                include_parent_chain: true,
            });

            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(2);

            const parentTask = result.tasks.find(t => t.title === 'Parent Task');
            const childTask = result.tasks.find(t => t.title === 'Child Task');

            // Parent should have children, no parent chain
            expect(parentTask.children).toHaveLength(1);
            expect(parentTask.parent_chain).toHaveLength(0);
            expect(parentTask.has_children).toBe(true);
            expect(parentTask.is_root_task).toBe(true);

            // Child should have no children, parent chain
            expect(childTask.children).toHaveLength(0);
            expect(childTask.parent_chain).toHaveLength(1);
            expect(childTask.has_children).toBe(false);
            expect(childTask.is_root_task).toBe(false);
        });
    });
});
