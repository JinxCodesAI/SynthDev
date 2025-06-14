import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkflowStateMachine from '../../../workflow/WorkflowStateMachine.js';
import WorkflowConfig from '../../../workflow/WorkflowConfig.js';
import WorkflowAgent from '../../../workflow/WorkflowAgent.js';
import WorkflowContext from '../../../workflow/WorkflowContext.js';

// Mock dependencies
vi.mock('../../../workflow/WorkflowConfig.js');
vi.mock('../../../workflow/WorkflowAgent.js');
vi.mock('../../../workflow/WorkflowContext.js');
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

describe('WorkflowStateMachine', () => {
    let stateMachine;
    let mockWorkflowConfig;
    let mockWorkflowAgent;
    let mockWorkflowContext;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock WorkflowConfig
        mockWorkflowConfig = {
            load: vi.fn(),
            getConfig: vi.fn(),
            getWorkflowName: vi.fn().mockReturnValue('test_workflow'),
            getScriptModule: vi.fn().mockReturnValue({
                initializeRequest: vi.fn(),
                alwaysTrue: vi.fn().mockReturnValue(true),
                shouldContinue: vi.fn().mockReturnValue(true),
                shouldStop: vi.fn().mockReturnValue(false),
            }),
        };
        vi.mocked(WorkflowConfig).mockImplementation(() => mockWorkflowConfig);

        // Mock WorkflowAgent
        mockWorkflowAgent = {
            sendMessage: vi.fn().mockResolvedValue('Agent response'),
            getToolCalls: vi.fn().mockReturnValue([]),
            getParsingToolCalls: vi.fn().mockReturnValue([]),
            getLastRawResponse: vi.fn().mockReturnValue({
                choices: [{ message: { content: 'Test response' } }],
            }),
        };
        vi.mocked(WorkflowAgent).mockImplementation(() => mockWorkflowAgent);

        // Mock WorkflowContext
        mockWorkflowContext = {
            addMessage: vi.fn(),
            getMessages: vi.fn().mockReturnValue([]),
            clearMessages: vi.fn(),
        };
        vi.mocked(WorkflowContext).mockImplementation(() => mockWorkflowContext);

        stateMachine = new WorkflowStateMachine();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with empty state', () => {
            expect(stateMachine.workflowConfigs).toBeInstanceOf(Map);
            expect(stateMachine.contexts).toBeInstanceOf(Map);
            expect(stateMachine.agents).toBeInstanceOf(Map);
            expect(stateMachine.commonData).toEqual({});
            expect(stateMachine.scriptContext).toBeDefined();
            expect(stateMachine.scriptContext.common_data).toBe(stateMachine.commonData);
        });
    });

    describe('loadWorkflow', () => {
        it('should load workflow configuration successfully', async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(mockConfig);

            const result = await stateMachine.loadWorkflow('./test-config.json');

            expect(result).toBe(mockConfig);
            expect(stateMachine.workflowConfigs.has('test_workflow')).toBe(true);
            expect(mockWorkflowConfig.load).toHaveBeenCalled();
        });

        it('should throw error if workflow loading fails', async () => {
            mockWorkflowConfig.load.mockRejectedValue(new Error('Load failed'));

            await expect(stateMachine.loadWorkflow('./test-config.json')).rejects.toThrow(
                'Load failed'
            );
        });
    });

    describe('executeWorkflow', () => {
        beforeEach(async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [
                    {
                        name: 'start',
                        action: { script: 'initializeRequest' },
                        transition: [{ target: 'stop', condition: 'alwaysTrue' }],
                    },
                    { name: 'stop' },
                ],
            };

            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(mockConfig);
            await stateMachine.loadWorkflow('./test-config.json');
        });

        it('should execute simple workflow successfully', async () => {
            const result = await stateMachine.executeWorkflow('test_workflow', 'test input');

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.workflow_name).toBe('test_workflow');
            expect(result.final_state).toBe('stop');
        });

        it('should handle workflow execution errors', async () => {
            // Make script function throw error
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.initializeRequest.mockImplementation(() => {
                throw new Error('Script error');
            });

            const result = await stateMachine.executeWorkflow('test_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script error');
        });

        it('should return error for unknown workflow', async () => {
            const result = await stateMachine.executeWorkflow('unknown_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Workflow not found: unknown_workflow');
            expect(result.workflow_name).toBe('unknown_workflow');
        });
    });

    describe('script execution', () => {
        beforeEach(async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(mockConfig);
            await stateMachine.loadWorkflow('./test-config.json');
        });

        it('should execute script functions from module', () => {
            const scriptModule = mockWorkflowConfig.getScriptModule();
            const testFunction = vi.fn().mockReturnValue('test result');
            scriptModule.testFunction = testFunction;

            const result = stateMachine._executeScript('testFunction', mockWorkflowConfig);

            expect(testFunction).toHaveBeenCalled();
            expect(result).toBe('test result');
        });

        it('should execute inline scripts for backward compatibility', () => {
            stateMachine._executeScript('common_data.test = "value"');

            expect(stateMachine.commonData.test).toBe('value');
        });

        it('should handle script execution errors', () => {
            expect(() => {
                stateMachine._executeScript('throw new Error("test error")');
            }).toThrow('test error');
        });

        it('should evaluate function conditions', () => {
            const scriptModule = mockWorkflowConfig.getScriptModule();
            const conditionFunction = vi.fn().mockReturnValue(true);
            scriptModule.testCondition = conditionFunction;

            const result = stateMachine._evaluateCondition('testCondition', {}, mockWorkflowConfig);

            expect(conditionFunction).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should evaluate simple conditions', () => {
            expect(stateMachine._evaluateCondition('true')).toBe(true);
            expect(stateMachine._evaluateCondition('false')).toBe(false);
        });

        it('should handle condition evaluation errors gracefully', () => {
            const result = stateMachine._evaluateCondition('invalid.condition.expression');
            expect(result).toBe(false);
        });
    });

    describe('context management', () => {
        it('should create and manage workflow contexts', () => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [{ role: 'system', content: 'Test message' }],
                max_length: 1000,
            };

            // Directly create context as done in _initializeWorkflow
            const context = new WorkflowContext(contextConfig);
            stateMachine.contexts.set(contextConfig.name, context);

            expect(WorkflowContext).toHaveBeenCalledWith(contextConfig);
            expect(stateMachine.contexts.get('test_context')).toBe(context);
        });

        it('should get existing context', () => {
            stateMachine.contexts.set('test_context', mockWorkflowContext);

            const context = stateMachine.getContext('test_context');

            expect(context).toBe(mockWorkflowContext);
        });

        it('should return null for non-existent context', () => {
            const context = stateMachine.getContext('non_existent');

            expect(context).toBeNull();
        });
    });

    describe('agent management', () => {
        it('should create and manage workflow agents', () => {
            const agentConfig = {
                agent_role: 'customer', // Use valid role
                context: 'test_context',
                role: 'assistant',
                model: 'gpt-4',
            };

            stateMachine.contexts.set('test_context', mockWorkflowContext);

            // Directly create agent as done in _initializeWorkflow
            const agent = new WorkflowAgent(
                agentConfig,
                mockWorkflowContext,
                stateMachine.config,
                stateMachine.toolManager,
                stateMachine.snapshotManager,
                stateMachine.costsManager
            );
            stateMachine.agents.set(agentConfig.agent_role, agent);

            expect(WorkflowAgent).toHaveBeenCalledWith(
                agentConfig,
                mockWorkflowContext,
                stateMachine.config,
                stateMachine.toolManager,
                stateMachine.snapshotManager,
                stateMachine.costsManager
            );
            expect(stateMachine.agents.get('customer')).toBe(agent);
        });

        it('should get existing agent', () => {
            stateMachine.agents.set('test_agent', mockWorkflowAgent);

            const agent = stateMachine.getAgent('test_agent');

            expect(agent).toBe(mockWorkflowAgent);
        });

        it('should return null for non-existent agent', () => {
            const agent = stateMachine.getAgent('non_existent');

            expect(agent).toBeNull();
        });
    });

    describe('state transitions', () => {
        it('should determine next state based on transitions', () => {
            const state = {
                transition: [
                    { target: 'state1', condition: 'false' },
                    { target: 'state2', condition: 'true' },
                    { target: 'state3', condition: 'true' },
                ],
            };

            const executionContext = {
                config: { workflow_name: 'test_workflow' },
            };

            const nextState = stateMachine._getNextState(state, {}, executionContext);

            expect(nextState).toBe('state2');
        });

        it('should return stop if no transitions match', () => {
            const state = {
                transition: [{ target: 'state1', condition: 'false' }],
            };

            const executionContext = {
                config: { workflow_name: 'test_workflow' },
            };

            const nextState = stateMachine._getNextState(state, {}, executionContext);

            expect(nextState).toBe('stop');
        });

        it('should return stop if no transitions defined', () => {
            const state = {};
            const executionContext = {
                config: { workflow_name: 'test_workflow' },
            };

            const nextState = stateMachine._getNextState(state, {}, executionContext);

            expect(nextState).toBe('stop');
        });
    });

    describe('script context management', () => {
        it('should update script context with latest data', () => {
            stateMachine.commonData.test = 'value';
            stateMachine.lastRawResponse = { test: 'response' };

            stateMachine._updateScriptContext();

            expect(stateMachine.scriptContext.common_data).toBe(stateMachine.commonData);
            expect(stateMachine.scriptContext.last_response).toBe(stateMachine.lastRawResponse);
            expect(stateMachine.scriptContext.workflow_contexts).toBe(stateMachine.contexts);
        });
    });

    describe('statistics', () => {
        it('should return workflow execution statistics', () => {
            stateMachine.workflowConfigs.set('workflow1', {});
            stateMachine.contexts.set('context1', {});
            stateMachine.agents.set('agent1', {});
            stateMachine.commonData = { key1: 'value1', key2: 'value2' };

            const stats = stateMachine.getStats();

            expect(stats).toEqual({
                loadedWorkflows: 1,
                activeContexts: 1,
                activeAgents: 1,
                commonDataKeys: 2,
            });
        });
    });

    describe('function reference detection', () => {
        it('should detect valid function references', () => {
            expect(stateMachine._isScriptFunctionReference('functionName')).toBe(true);
            expect(stateMachine._isScriptFunctionReference('camelCaseFunction')).toBe(true);
            expect(stateMachine._isScriptFunctionReference('function_with_underscores')).toBe(true);
            expect(stateMachine._isScriptFunctionReference('$validFunction')).toBe(true);
            expect(stateMachine._isScriptFunctionReference('_privateFunction')).toBe(true);
        });

        it('should reject invalid function references', () => {
            expect(stateMachine._isScriptFunctionReference('function with spaces')).toBe(false);
            expect(stateMachine._isScriptFunctionReference('function.property')).toBe(false);
            expect(stateMachine._isScriptFunctionReference('function()')).toBe(false);
            expect(stateMachine._isScriptFunctionReference('function + operator')).toBe(false);
            expect(stateMachine._isScriptFunctionReference('function;')).toBe(false);
            expect(stateMachine._isScriptFunctionReference('')).toBe(false);
            expect(stateMachine._isScriptFunctionReference('123invalid')).toBe(false);
        });
    });
});
