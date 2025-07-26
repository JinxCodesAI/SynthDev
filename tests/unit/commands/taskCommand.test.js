// tests/unit/commands/taskCommand.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing the command
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

// Mock the tool implementations
vi.mock('../../../src/tools/edit_tasks/implementation.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../../src/tools/list_tasks/implementation.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../../src/tools/get_task/implementation.js', () => ({
    default: vi.fn(),
}));

import { TaskCommand } from '../../../src/commands/task/TaskCommand.js';
import editTasks from '../../../src/tools/edit_tasks/implementation.js';
import listTasks from '../../../src/tools/list_tasks/implementation.js';
import getTask from '../../../src/tools/get_task/implementation.js';

describe('TaskCommand', () => {
    let command;
    let mockContext;

    beforeEach(() => {
        command = new TaskCommand();
        mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                showError: vi.fn(),
            },
        };

        // Clear all mocks
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct name and description', () => {
            expect(command.name).toBe('task');
            expect(command.description).toContain('Manage tasks');
            expect(command.aliases).toEqual(['tasks', 't']);
        });

        it('should have all required subcommands', () => {
            expect(command.subcommands).toHaveProperty('list');
            expect(command.subcommands).toHaveProperty('add');
            expect(command.subcommands).toHaveProperty('remove');
            expect(command.subcommands).toHaveProperty('edit');
            expect(command.subcommands).toHaveProperty('help');
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const deps = command.getRequiredDependencies();
            expect(deps).toContain('consoleInterface');
        });
    });

    describe('parseArguments', () => {
        it('should parse subcommand and arguments', () => {
            const result = command.parseArguments('list --format=detailed');
            expect(result.subcommand).toBe('list');
            expect(result.subArgs).toBe('--format=detailed');
        });

        it('should handle empty arguments', () => {
            const result = command.parseArguments('');
            expect(result.subcommand).toBe('');
            expect(result.subArgs).toBe('');
        });

        it('should handle single subcommand', () => {
            const result = command.parseArguments('help');
            expect(result.subcommand).toBe('help');
            expect(result.subArgs).toBe('');
        });
    });

    describe('parseListOptions', () => {
        it('should parse format option', () => {
            const options = command.parseListOptions('--format=detailed');
            expect(options.format).toBe('detailed');
        });

        it('should parse status filter option', () => {
            const options = command.parseListOptions('--status=in_progress');
            expect(options.status_filter).toBe('in_progress');
        });

        it('should parse multiple options', () => {
            const options = command.parseListOptions('--format=detailed --status=completed');
            expect(options.format).toBe('detailed');
            expect(options.status_filter).toBe('completed');
        });

        it('should return default options for empty args', () => {
            const options = command.parseListOptions('');
            expect(options.format).toBe('short');
            expect(options.status_filter).toBeUndefined();
        });
    });

    describe('isTaskId', () => {
        it('should recognize full UUID', () => {
            expect(command.isTaskId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });

        it('should recognize partial UUID', () => {
            expect(command.isTaskId('a1b2c3d4-e5f6-7890')).toBe(true);
        });

        it('should recognize short ID', () => {
            expect(command.isTaskId('a1b2c3d4')).toBe(true);
        });

        it('should reject non-UUID strings', () => {
            expect(command.isTaskId('list')).toBe(false);
            expect(command.isTaskId('help')).toBe(false);
            expect(command.isTaskId('not-a-uuid')).toBe(false);
        });
    });

    describe('implementation', () => {
        it('should show help when no subcommand provided', async () => {
            const result = await command.implementation('', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Management Commands')
            );
            expect(result).toBe('help');
        });

        it('should show help when help subcommand provided', async () => {
            const result = await command.implementation('help', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Management Commands')
            );
            expect(result).toBe('help');
        });

        it('should handle task ID lookup', async () => {
            getTask.mockResolvedValue({
                success: true,
                task: {
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    title: 'Test Task',
                    status_display: { symbol: '[ ]', label: 'Not Started' },
                    is_root_task: true,
                    has_children: false,
                },
            });

            const result = await command.implementation('a1b2c3d4', mockContext);

            expect(getTask).toHaveBeenCalledWith({
                task_id: 'a1b2c3d4',
                include_children: true,
                include_parent_chain: true,
            });
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Details')
            );
        });

        it('should handle unknown subcommand', async () => {
            const result = await command.implementation('unknown', mockContext);

            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Unknown subcommand: unknown'
            );
            expect(result).toBe('error');
        });

        it('should handle errors gracefully', async () => {
            listTasks.mockRejectedValue(new Error('Tool error'));

            const result = await command.implementation('list', mockContext);

            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                expect.stringContaining('Failed to list tasks')
            );
            expect(result).toBe('error');
        });
    });

    describe('handleList', () => {
        it('should list tasks successfully', async () => {
            listTasks.mockResolvedValue({
                success: true,
                task_count: 2,
                total_tasks: 2,
                status_filter: 'all',
                tasks: [
                    { display: '[ ] Task 1 (a1b2c3d4...)' },
                    { display: '  [/] Child Task (e5f67890...)' },
                ],
            });

            const result = await command.handleList('', mockContext);

            expect(listTasks).toHaveBeenCalledWith({
                format: 'short',
            });
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task List (2 tasks)')
            );
            expect(result.success).toBe(true);
        });

        it('should handle empty task list', async () => {
            listTasks.mockResolvedValue({
                success: true,
                task_count: 0,
                total_tasks: 0,
                tasks: [],
            });

            const result = await command.handleList('', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '📝 No tasks found.'
            );
            expect(result).toBe('empty');
        });

        it('should handle tool errors', async () => {
            listTasks.mockResolvedValue({
                success: false,
                error: 'Tool failed',
            });

            const result = await command.handleList('', mockContext);

            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Failed to list tasks: Tool failed'
            );
            expect(result).toBe('error');
        });

        it('should pass options to tool', async () => {
            listTasks.mockResolvedValue({
                success: true,
                task_count: 1,
                tasks: [],
            });

            await command.handleList('--format=detailed --status=completed', mockContext);

            expect(listTasks).toHaveBeenCalledWith({
                format: 'detailed',
                status_filter: 'completed',
            });
        });
    });

    describe('handleGetTask', () => {
        it('should get task successfully', async () => {
            const mockTask = {
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                title: 'Test Task',
                description: 'Test description',
                status_display: { symbol: '[ ]', label: 'Not Started' },
                is_root_task: true,
                has_children: false,
                parent_chain: [],
                children: [],
            };

            getTask.mockResolvedValue({
                success: true,
                task: mockTask,
            });

            const result = await command.handleGetTask('a1b2c3d4', mockContext);

            expect(getTask).toHaveBeenCalledWith({
                task_id: 'a1b2c3d4',
                include_children: true,
                include_parent_chain: true,
            });
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task Details')
            );
            expect(result.success).toBe(true);
        });

        it('should handle task not found', async () => {
            getTask.mockResolvedValue({
                success: false,
                error: 'Task with ID nonexistent not found',
            });

            const result = await command.handleGetTask('nonexistent', mockContext);

            expect(mockContext.consoleInterface.showError).toHaveBeenCalledWith(
                'Task not found: Task with ID nonexistent not found'
            );
            expect(result).toBe('error');
        });

        it('should display parent chain', async () => {
            const mockTask = {
                id: 'child-id',
                title: 'Child Task',
                status_display: { symbol: '[/]', label: 'In Progress' },
                parent_chain: [
                    { title: 'Parent Task', status_display: { symbol: '[ ]' }, id: 'parent-id' },
                ],
                children: [],
                is_root_task: false,
                has_children: false,
            };

            getTask.mockResolvedValue({
                success: true,
                task: mockTask,
            });

            await command.handleGetTask('child-id', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Parent Chain')
            );
        });

        it('should display children', async () => {
            const mockTask = {
                id: 'parent-id',
                title: 'Parent Task',
                status_display: { symbol: '[ ]', label: 'Not Started' },
                parent_chain: [],
                children: [
                    { title: 'Child Task', status_display: { symbol: '[/]' }, id: 'child-id' },
                ],
                is_root_task: true,
                has_children: true,
            };

            getTask.mockResolvedValue({
                success: true,
                task: mockTask,
            });

            await command.handleGetTask('parent-id', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Child Tasks')
            );
        });
    });

    describe('placeholder subcommands', () => {
        it('should show coming soon message for add', async () => {
            const result = await command.handleAdd('', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '🚧 Task creation feature coming soon!'
            );
            expect(result).toBe('placeholder');
        });

        it('should show coming soon message for remove', async () => {
            const result = await command.handleRemove('', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '🚧 Task removal feature coming soon!'
            );
            expect(result).toBe('placeholder');
        });

        it('should show coming soon message for edit', async () => {
            const result = await command.handleEdit('', mockContext);

            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '🚧 Task editing feature coming soon!'
            );
            expect(result).toBe('placeholder');
        });
    });

    describe('getUsage', () => {
        it('should return usage string', () => {
            const usage = command.getUsage();
            expect(usage).toBe('/task <list|add|edit|remove|help|task-id> [args]');
        });
    });
});
