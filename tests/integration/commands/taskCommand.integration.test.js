// tests/integration/commands/taskCommand.integration.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing
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

import { TaskCommand } from '../../../src/commands/task/TaskCommand.js';
import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import listTasks from '../../../src/tools/list_tasks/implementation.js';
import getTask from '../../../src/tools/get_task/implementation.js';
import taskManager from '../../../src/tools/common/task-manager.js';

describe('TaskCommand Integration', () => {
    let command;
    let mockContext;

    beforeEach(() => {
        command = new TaskCommand();

        // Clear all tasks before each test
        taskManager.clearAllTasks();

        // Create mock context with real tool manager functionality
        mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                showError: vi.fn(),
            },
            toolManager: {
                executeTool: vi.fn().mockImplementation(async (toolName, params) => {
                    // Route to actual tool implementations
                    switch (toolName) {
                        case 'edit_tasks':
                            return await editTasks(params);
                        case 'list_tasks':
                            return await listTasks(params);
                        case 'get_task':
                            return await getTask(params);
                        default:
                            throw new Error(`Unknown tool: ${toolName}`);
                    }
                }),
            },
        };
    });

    describe('Full workflow integration', () => {
        it('should handle complete task management workflow', async () => {
            // Step 1: Create some tasks using edit_tasks tool
            await editTasks({
                tasks: [
                    {
                        title: 'Parent Task',
                        description: 'Main project task',
                        status: 'in_progress',
                        target_role: 'manager',
                    },
                    { title: 'Another Root Task', status: 'not_started', target_role: 'developer' },
                ],
            });

            // Get the parent task ID for creating children
            const listResult = await listTasks({});
            const parentTask = listResult.tasks.find(t => t.title === 'Parent Task');
            const parentId = parentTask.id;

            // Create child tasks
            await editTasks({
                tasks: [
                    {
                        title: 'Child Task 1',
                        parent: parentId,
                        status: 'completed',
                        target_role: 'developer',
                    },
                    {
                        title: 'Child Task 2',
                        parent: parentId,
                        status: 'not_started',
                        target_role: 'tester',
                    },
                ],
            });

            // Step 2: Test /task list command
            const listCommandResult = await command.implementation('list', mockContext);

            expect(listCommandResult.success).toBe(true);
            expect(listCommandResult.task_count).toBe(4);
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task List (4 tasks)')
            );

            // Step 3: Test /task list with filters
            vi.clearAllMocks();
            const filteredListResult = await command.implementation(
                'list --status=completed',
                mockContext
            );

            expect(filteredListResult.success).toBe(true);
            expect(filteredListResult.task_count).toBe(1);
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task List (1 tasks)')
            );

            // Step 4: Test /task [id] command
            vi.clearAllMocks();
            const taskDetailResult = await command.implementation(parentId, mockContext);

            expect(taskDetailResult.success).toBe(true);
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Details')
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Parent Task')
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Child Tasks')
            );

            // Step 5: Test /task [id] with short ID
            vi.clearAllMocks();
            const shortId = parentId.substring(0, 8);
            const shortIdResult = await command.implementation(shortId, mockContext);

            expect(shortIdResult.success).toBe(true);
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Details')
            );
        });

        it('should handle empty task list gracefully', async () => {
            // Test list command with no tasks
            const result = await command.implementation('list', mockContext);

            expect(result).toBe('empty');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '📝 No tasks found.'
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '💡 Use /task add to create your first task.'
            );
        });

        it('should handle non-existent task ID gracefully', async () => {
            const result = await command.implementation(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                mockContext
            );

            expect(result).toBe('error');
            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                expect.stringContaining('Task not found')
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '💡 Use /task list to see available tasks.'
            );
        });

        it('should display hierarchical structure correctly', async () => {
            // Create a 3-level hierarchy
            const grandparentResult = await editTasks({
                tasks: [{ title: 'Grandparent Task', target_role: 'manager' }],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [{ title: 'Parent Task', parent: grandparentId, target_role: 'lead' }],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [{ title: 'Child Task', parent: parentId, target_role: 'developer' }],
            });

            // Test list command shows hierarchy
            const listResult = await command.implementation('list', mockContext);

            expect(listResult.success).toBe(true);
            expect(listResult.task_count).toBe(3);

            // Check that indentation is shown in the display
            const tasks = listResult.tasks;
            const grandparent = tasks.find(t => t.title === 'Grandparent Task');
            const parent = tasks.find(t => t.title.includes('Parent Task'));
            const child = tasks.find(t => t.title.includes('Child Task'));

            expect(grandparent.level).toBe(0);
            expect(parent.level).toBe(1);
            expect(child.level).toBe(2);

            // Parent and child should have indentation in their display
            expect(parent.display).toMatch(/^\s+/);
            expect(child.display).toMatch(/^\s{4,}/); // More indentation for child
        });

        it('should show parent chain and children in task details', async () => {
            // Create hierarchy
            const grandparentResult = await editTasks({
                tasks: [{ title: 'Grandparent Task', status: 'completed', target_role: 'manager' }],
            });
            const grandparentId = grandparentResult.processed_tasks[0].task.id;

            const parentResult = await editTasks({
                tasks: [
                    {
                        title: 'Parent Task',
                        parent: grandparentId,
                        status: 'in_progress',
                        target_role: 'lead',
                    },
                ],
            });
            const parentId = parentResult.processed_tasks[0].task.id;

            await editTasks({
                tasks: [
                    {
                        title: 'Child Task 1',
                        parent: parentId,
                        status: 'not_started',
                        target_role: 'developer',
                    },
                    {
                        title: 'Child Task 2',
                        parent: parentId,
                        status: 'completed',
                        target_role: 'tester',
                    },
                ],
            });

            // Get details for the parent task
            const result = await command.implementation(parentId, mockContext);

            expect(result.success).toBe(true);

            // Should show parent chain
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Parent Chain')
            );

            // Should show children
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Child Tasks')
            );

            // Should show metadata
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Root task: No')
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Has children: Yes')
            );
        });

        it('should handle different status filters correctly', async () => {
            // Create tasks with different statuses
            await editTasks({
                tasks: [
                    { title: 'Not Started Task', status: 'not_started', target_role: 'developer' },
                    { title: 'In Progress Task', status: 'in_progress', target_role: 'tester' },
                    { title: 'Completed Task', status: 'completed', target_role: 'reviewer' },
                    { title: 'Cancelled Task', status: 'cancelled', target_role: 'manager' },
                ],
            });

            // Test each status filter
            const statuses = ['not_started', 'in_progress', 'completed', 'cancelled'];

            for (const status of statuses) {
                vi.clearAllMocks();
                const result = await command.implementation(`list --status=${status}`, mockContext);

                expect(result.success).toBe(true);
                expect(result.task_count).toBe(1);
                expect(result.status_filter).toBe(status);
                expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                    expect.stringContaining(`Filtered by status: ${status}`)
                );
            }
        });

        it('should display correct status symbols', async () => {
            await editTasks({
                tasks: [
                    { title: 'Not Started', status: 'not_started', target_role: 'developer' },
                    { title: 'In Progress', status: 'in_progress', target_role: 'tester' },
                    { title: 'Completed', status: 'completed', target_role: 'reviewer' },
                    { title: 'Cancelled', status: 'cancelled', target_role: 'manager' },
                ],
            });

            const result = await command.implementation('list', mockContext);

            expect(result.success).toBe(true);

            const tasks = result.tasks;
            const notStarted = tasks.find(t => t.title === 'Not Started');
            const inProgress = tasks.find(t => t.title === 'In Progress');
            const completed = tasks.find(t => t.title === 'Completed');
            const cancelled = tasks.find(t => t.title === 'Cancelled');

            expect(notStarted.display).toContain('[ ]');
            expect(inProgress.display).toContain('[/]');
            expect(completed.display).toContain('[x]');
            expect(cancelled.display).toContain('[-]');
        });
    });

    describe('Command routing', () => {
        it('should route to help when no arguments provided', async () => {
            const result = await command.implementation('', mockContext);

            expect(result).toBe('help');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Management Commands')
            );
        });

        it('should route to task details when UUID provided', async () => {
            // Create a task first
            const createResult = await editTasks({
                tasks: [{ title: 'Test Task', target_role: 'developer' }],
            });
            const taskId = createResult.processed_tasks[0].task.id;

            const result = await command.implementation(taskId, mockContext);

            expect(result.success).toBe(true);
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Details')
            );
        });

        it('should route to subcommands correctly', async () => {
            // Test list subcommand
            let result = await command.implementation('list', mockContext);
            expect(result).toBe('empty'); // No tasks created

            // Test placeholder subcommands
            result = await command.implementation('add', mockContext);
            expect(result).toBe('placeholder');

            result = await command.implementation('edit', mockContext);
            expect(result).toBe('placeholder');

            result = await command.implementation('remove', mockContext);
            expect(result).toBe('placeholder');
        });
    });
});
