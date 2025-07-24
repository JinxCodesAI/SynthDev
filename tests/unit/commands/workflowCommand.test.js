import { describe, it, expect, beforeEach, vi } from 'vitest';
import WorkflowCommand from '../../../src/commands/workflow/WorkflowCommand.js';

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
});
