import { describe, it, expect, beforeEach, vi } from 'vitest';
import WorkflowToolImplementation from '../../../tools/workflow_tool/implementation.js';

describe('WorkflowTool', () => {
    let workflowTool;
    let mockContext;

    beforeEach(() => {
        workflowTool = new WorkflowToolImplementation();

        mockContext = {
            config: {
                features: {
                    enableWorkflows: false,
                },
            },
            configManager: {
                getConfig: vi.fn(() => ({
                    features: {
                        enableWorkflows: false,
                    },
                })),
            },
            toolManager: {},
            snapshotManager: {},
            consoleInterface: {},
            costsManager: {},
            commandRegistry: {
                register: vi.fn(),
            },
        };
    });

    describe('Initialization', () => {
        it('should initialize with disabled state', () => {
            expect(workflowTool.isInitialized).toBe(false);
            expect(workflowTool.isEnabled).toBe(false);
        });

        it('should not initialize when workflows are disabled in config', async () => {
            await workflowTool.initialize(mockContext);

            expect(workflowTool.isInitialized).toBe(false);
            expect(workflowTool.isEnabled).toBe(false);
        });

        it('should initialize when workflows are enabled in config', async () => {
            // Mock workflow system components
            const mockWorkflowStateMachine = {
                loadWorkflowConfigs: vi.fn(),
            };

            // Mock the WorkflowStateMachine import
            vi.doMock('../../../workflow/WorkflowStateMachine.js', () => ({
                default: vi.fn(() => mockWorkflowStateMachine),
            }));

            mockContext.config.features.enableWorkflows = true;

            await workflowTool.initialize(mockContext);

            expect(workflowTool.isInitialized).toBe(true);
            expect(workflowTool.isEnabled).toBe(true);
        });
    });

    describe('Execute Actions', () => {
        it('should handle enable action', async () => {
            const result = await workflowTool.execute({ action: 'enable' }, mockContext);

            expect(result).toContain('Failed to enable workflow system');
            expect(result).toContain('features.enableWorkflows is set to true');
        });

        it('should handle disable action when already disabled', async () => {
            const result = await workflowTool.execute({ action: 'disable' }, mockContext);

            expect(result).toContain('Workflow system is already disabled');
        });

        it('should handle list action when disabled', async () => {
            const result = await workflowTool.execute({ action: 'list' }, mockContext);

            expect(result).toContain('Workflow system is disabled');
            expect(result).toContain('Use action "enable" to activate it');
        });

        it('should handle info action when disabled', async () => {
            const result = await workflowTool.execute(
                {
                    action: 'info',
                    workflow_name: 'test_workflow',
                },
                mockContext
            );

            expect(result).toContain('Workflow system is disabled');
        });

        it('should handle execute action when disabled', async () => {
            const result = await workflowTool.execute(
                {
                    action: 'execute',
                    workflow_name: 'test_workflow',
                    input_params: 'test input',
                },
                mockContext
            );

            expect(result).toContain('Workflow system is disabled');
        });

        it('should validate required parameters', async () => {
            const result1 = await workflowTool.execute(
                {
                    action: 'info',
                },
                mockContext
            );
            expect(result1).toContain('workflow_name is required for info action');

            const result2 = await workflowTool.execute(
                {
                    action: 'execute',
                    workflow_name: 'test',
                },
                mockContext
            );
            expect(result2).toContain('input_params is required for execute action');
        });

        it('should handle unknown actions', async () => {
            const result = await workflowTool.execute(
                {
                    action: 'unknown',
                },
                mockContext
            );

            expect(result).toContain('Unknown action: unknown');
            expect(result).toContain('Available actions: list, info, execute, enable, disable');
        });
    });

    describe('Utility Methods', () => {
        it('should return empty workflows when not initialized', () => {
            const workflows = workflowTool.getAvailableWorkflows();
            expect(workflows).toEqual([]);
        });

        it('should throw error when getting metadata without initialization', async () => {
            await expect(workflowTool.getWorkflowMetadata('test')).rejects.toThrow(
                'Workflow system not initialized'
            );
        });

        it('should throw error when executing workflow without initialization', async () => {
            await expect(workflowTool.executeWorkflow('test', 'input')).rejects.toThrow(
                'Workflow system not initialized'
            );
        });

        it('should return null state machine when not initialized', () => {
            const stateMachine = workflowTool.getStateMachine();
            expect(stateMachine).toBeNull();
        });

        it('should return false for isWorkflowEnabled when not initialized', () => {
            const isEnabled = workflowTool.isWorkflowEnabled();
            expect(isEnabled).toBe(false);
        });
    });

    describe('Shutdown', () => {
        it('should shutdown cleanly', async () => {
            await workflowTool.shutdown();

            expect(workflowTool.isInitialized).toBe(false);
            expect(workflowTool.isEnabled).toBe(false);
            expect(workflowTool.workflowStateMachine).toBeNull();
        });
    });
});
