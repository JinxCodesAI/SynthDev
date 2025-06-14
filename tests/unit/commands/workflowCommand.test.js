import { describe, it, expect, beforeEach, vi } from 'vitest';
import WorkflowCommand from '../../../commands/workflow/WorkflowCommand.js';

describe('WorkflowCommand', () => {
    let workflowCommand;
    let mockContext;
    let mockWorkflowStateMachine;
    let mockConsoleInterface;

    beforeEach(() => {
        workflowCommand = new WorkflowCommand();

        mockConsoleInterface = {
            promptForInput: vi.fn(),
        };

        mockWorkflowStateMachine = {
            getAvailableWorkflows: vi.fn(),
            getWorkflowMetadata: vi.fn(),
            executeWorkflow: vi.fn(),
        };

        mockContext = {
            workflowStateMachine: mockWorkflowStateMachine,
            consoleInterface: mockConsoleInterface,
        };
    });

    describe('_promptForInput', () => {
        it('should use consoleInterface.promptForInput instead of creating new readline interface', async () => {
            const inputDef = {
                name: 'test_param',
                description: 'Test parameter',
                type: 'string',
            };

            mockConsoleInterface.promptForInput.mockResolvedValue('test input value');

            const result = await workflowCommand._promptForInput(inputDef, mockConsoleInterface);

            expect(mockConsoleInterface.promptForInput).toHaveBeenCalledWith(
                '💭 Enter test_param: '
            );
            expect(result).toBe('test input value');
        });

        it('should return null for empty input', async () => {
            const inputDef = {
                name: 'test_param',
                description: 'Test parameter',
                type: 'string',
            };

            mockConsoleInterface.promptForInput.mockResolvedValue('   '); // whitespace only

            const result = await workflowCommand._promptForInput(inputDef, mockConsoleInterface);

            expect(result).toBeNull();
        });

        it('should validate input type', async () => {
            const inputDef = {
                name: 'test_param',
                description: 'Test parameter',
                type: 'number',
            };

            mockConsoleInterface.promptForInput.mockResolvedValue('not a number');

            const result = await workflowCommand._promptForInput(inputDef, mockConsoleInterface);

            expect(result).toBeNull();
        });

        it('should accept valid number input', async () => {
            const inputDef = {
                name: 'test_param',
                description: 'Test parameter',
                type: 'number',
            };

            mockConsoleInterface.promptForInput.mockResolvedValue('42');

            const result = await workflowCommand._promptForInput(inputDef, mockConsoleInterface);

            expect(result).toBe('42');
        });
    });

    describe('_validateInputType', () => {
        it('should validate string type', () => {
            expect(workflowCommand._validateInputType('test', 'string')).toBe(true);
        });

        it('should validate number type', () => {
            expect(workflowCommand._validateInputType('42', 'number')).toBe(true);
            expect(workflowCommand._validateInputType('3.14', 'number')).toBe(true);
            expect(workflowCommand._validateInputType('not a number', 'number')).toBe(false);
        });

        it('should validate object type', () => {
            expect(workflowCommand._validateInputType('{"key": "value"}', 'object')).toBe(true);
            expect(workflowCommand._validateInputType('invalid json', 'object')).toBe(false);
        });

        it('should validate array type', () => {
            expect(workflowCommand._validateInputType('[1, 2, 3]', 'array')).toBe(true);
            expect(workflowCommand._validateInputType('{"key": "value"}', 'array')).toBe(false);
            expect(workflowCommand._validateInputType('invalid json', 'array')).toBe(false);
        });

        it('should allow unknown types', () => {
            expect(workflowCommand._validateInputType('anything', 'unknown_type')).toBe(true);
        });
    });
});
