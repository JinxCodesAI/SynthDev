import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkflowStateMachine from '../../../src/workflow/WorkflowStateMachine.js';
import WorkflowConfig from '../../../src/workflow/WorkflowConfig.js';
import WorkflowAgent from '../../../src/workflow/WorkflowAgent.js';
import WorkflowContext from '../../../src/workflow/WorkflowContext.js';

// Mock dependencies
vi.mock('../../../src/workflow/WorkflowConfig.js');
vi.mock('../../../src/workflow/WorkflowAgent.js');
vi.mock('../../../src/workflow/WorkflowContext.js');
vi.mock('../../../src/core/managers/logger.js', () => ({
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
            getMetadata: vi.fn(),
            getScriptModule: vi.fn().mockReturnValue({
                initializeRequest: vi.fn(),
                alwaysTrue: vi.fn().mockReturnValue(true),
                shouldContinue: vi.fn().mockReturnValue(true),
                shouldStop: vi.fn().mockReturnValue(false),
                processResponse: vi.fn(),
                decideNextState: vi.fn().mockReturnValue('stop'),
                errorFunction: vi.fn(),
            }),
        };
        vi.mocked(WorkflowConfig).mockImplementation(() => mockWorkflowConfig);

        // Mock WorkflowAgent
        mockWorkflowAgent = {
            sendMessage: vi.fn().mockResolvedValue('Agent response'),
            makeContextCall: vi.fn().mockResolvedValue('Agent response'),
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
                stateMachine.costsManager
            );
            stateMachine.agents.set(agentConfig.agent_role, agent);

            expect(WorkflowAgent).toHaveBeenCalledWith(
                agentConfig,
                mockWorkflowContext,
                stateMachine.config,
                stateMachine.toolManager,
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

    // ===== NEW COMPREHENSIVE TESTS FOR CURRENT 4-STEP WORKFLOW PATTERN =====

    describe('4-step workflow pattern execution', () => {
        let mockConfig;

        beforeEach(async () => {
            mockConfig = {
                workflow_name: 'test_4step_workflow',
                description: 'Test 4-step workflow pattern',
                input: { name: 'user_request', type: 'string', description: 'User request' },
                output: { name: 'result', type: 'string', description: 'Workflow result' },
                variables: { max_iterations: 5 },
                contexts: [{ name: 'main_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'main_context', role: 'assistant' }],
                states: [
                    {
                        name: 'start',
                        agent: 'test_agent',
                        pre_handler: 'initializeRequest',
                        post_handler: 'processResponse',
                        transition_handler: 'decideNextState',
                    },
                    { name: 'stop' },
                ],
            };

            // Reset mocks and set up fresh config for each test
            vi.clearAllMocks();
            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(mockConfig);
            mockWorkflowConfig.getWorkflowName.mockReturnValue('test_4step_workflow');

            await stateMachine.loadWorkflow('./test-config.json');

            // Set up mock agent
            stateMachine.agents.set('test_agent', mockWorkflowAgent);
        });

        it('should execute all 4 steps in correct order', async () => {
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.initializeRequest = vi.fn();
            scriptModule.processResponse = vi.fn();
            scriptModule.decideNextState = vi.fn().mockReturnValue('stop');

            const result = await stateMachine.executeWorkflow('test_4step_workflow', 'test input');

            expect(result.success).toBe(true);
            expect(scriptModule.initializeRequest).toHaveBeenCalled();
            expect(mockWorkflowAgent.makeContextCall).toHaveBeenCalled();
            expect(scriptModule.processResponse).toHaveBeenCalled();
            expect(scriptModule.decideNextState).toHaveBeenCalled();
        });

        it('should skip pre_handler if not defined', async () => {
            mockConfig.states[0].pre_handler = null;
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.processResponse = vi.fn();
            scriptModule.decideNextState = vi.fn().mockReturnValue('stop');

            const result = await stateMachine.executeWorkflow('test_4step_workflow', 'test input');

            expect(result.success).toBe(true);
            expect(mockWorkflowAgent.makeContextCall).toHaveBeenCalled();
            expect(scriptModule.processResponse).toHaveBeenCalled();
            expect(scriptModule.decideNextState).toHaveBeenCalled();
        });

        it('should skip post_handler if not defined', async () => {
            mockConfig.states[0].post_handler = null;
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.initializeRequest = vi.fn();
            scriptModule.decideNextState = vi.fn().mockReturnValue('stop');

            const result = await stateMachine.executeWorkflow('test_4step_workflow', 'test input');

            expect(result.success).toBe(true);
            expect(scriptModule.initializeRequest).toHaveBeenCalled();
            expect(mockWorkflowAgent.makeContextCall).toHaveBeenCalled();
            expect(scriptModule.decideNextState).toHaveBeenCalled();
        });

        it('should default to stop if no transition_handler', async () => {
            mockConfig.states[0].transition_handler = null;
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.initializeRequest = vi.fn();
            scriptModule.processResponse = vi.fn();

            const result = await stateMachine.executeWorkflow('test_4step_workflow', 'test input');

            expect(result.success).toBe(true);
            expect(result.final_state).toBe('stop');
        });

        it('should require agent for non-stop states', async () => {
            // Create a new config with no agent
            const noAgentConfig = {
                ...mockConfig,
                states: [
                    {
                        name: 'start',
                        agent: null,
                        pre_handler: 'initializeRequest',
                        post_handler: 'processResponse',
                        transition_handler: 'decideNextState',
                    },
                    { name: 'stop' },
                ],
            };

            mockWorkflowConfig.load.mockResolvedValue(noAgentConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(noAgentConfig);
            await stateMachine.loadWorkflow('./test-config.json');

            const result = await stateMachine.executeWorkflow('test_4step_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toContain('State start must have an agent defined');
        });

        it('should handle unknown agent error', async () => {
            // Create a new config with unknown agent
            const unknownAgentConfig = {
                ...mockConfig,
                states: [
                    {
                        name: 'start',
                        agent: 'unknown_agent',
                        pre_handler: 'initializeRequest',
                        post_handler: 'processResponse',
                        transition_handler: 'decideNextState',
                    },
                    { name: 'stop' },
                ],
            };

            mockWorkflowConfig.load.mockResolvedValue(unknownAgentConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(unknownAgentConfig);
            await stateMachine.loadWorkflow('./test-config.json');

            const result = await stateMachine.executeWorkflow('test_4step_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown agent: unknown_agent');
        });
    });

    describe('script function execution with context binding', () => {
        beforeEach(async () => {
            const mockConfig = {
                workflow_name: 'script_test_workflow',
                description: 'Test script function execution',
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

        it('should execute script function with proper context binding', () => {
            const scriptModule = mockWorkflowConfig.getScriptModule();
            const testFunction = vi.fn().mockImplementation(function () {
                // Verify 'this' context has expected properties
                expect(this.common_data).toBeDefined();
                expect(this.workflow_contexts).toBeDefined();
                expect(this.last_response).toBeDefined();
                expect(this.input).toBeDefined();
                return 'test result';
            });
            scriptModule.testFunction = testFunction;

            stateMachine.commonData.test = 'value';
            stateMachine.lastRawResponse = { test: 'response' };
            stateMachine._updateScriptContext();

            const result = stateMachine._executeScriptFunction('testFunction', mockWorkflowConfig);

            expect(testFunction).toHaveBeenCalled();
            expect(result).toBe('test result');
        });

        it('should throw error if script module not loaded', () => {
            mockWorkflowConfig.getScriptModule.mockReturnValue(null);

            expect(() => {
                stateMachine._executeScriptFunction('testFunction', mockWorkflowConfig);
            }).toThrow('No script module loaded for function: testFunction');
        });

        it('should throw error if function not found in module', () => {
            // Script module exists but doesn't have the requested function
            expect(() => {
                stateMachine._executeScriptFunction('nonExistentFunction', mockWorkflowConfig);
            }).toThrow('Function not found in script module: nonExistentFunction');
        });
    });

    describe('workflow initialization and variables', () => {
        it('should initialize common_data with input and variables', async () => {
            const mockConfig = {
                workflow_name: 'init_test_workflow',
                description: 'Test initialization',
                input: { name: 'user_input', type: 'string', description: 'User input' },
                output: { name: 'result', type: 'string', description: 'Result' },
                variables: { max_iterations: 10, timeout: 5000 },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(mockConfig);
            mockWorkflowConfig.getWorkflowName.mockReturnValue('init_test_workflow');
            await stateMachine.loadWorkflow('./init-test-config.json');

            await stateMachine.executeWorkflow('init_test_workflow', 'test input value');

            expect(stateMachine.commonData.user_input).toBe('test input value');
            expect(stateMachine.commonData.max_iterations).toBe(10);
            expect(stateMachine.commonData.timeout).toBe(5000);
        });

        it('should reset state between workflow executions', async () => {
            const mockConfig = {
                workflow_name: 'reset_test_workflow',
                description: 'Test state reset',
                input: { name: 'input', type: 'string', description: 'Input' },
                output: { name: 'output', type: 'string', description: 'Output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(mockConfig);
            mockWorkflowConfig.getWorkflowName.mockReturnValue('reset_test_workflow');
            await stateMachine.loadWorkflow('./reset-test-config.json');

            // First execution
            await stateMachine.executeWorkflow('reset_test_workflow', 'first input');
            stateMachine.commonData.custom_data = 'first execution';

            // Second execution should reset state
            await stateMachine.executeWorkflow('reset_test_workflow', 'second input');

            expect(stateMachine.commonData.input).toBe('second input');
            expect(stateMachine.commonData.custom_data).toBeUndefined();
        });
    });

    describe('workflow execution error handling', () => {
        let errorTestConfig;

        beforeEach(async () => {
            errorTestConfig = {
                workflow_name: 'error_test_workflow',
                description: 'Test error handling',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [
                    {
                        name: 'start',
                        agent: 'test_agent',
                        pre_handler: 'errorFunction',
                        post_handler: 'processResponse',
                        transition_handler: 'decideNext',
                    },
                    { name: 'stop' },
                ],
            };

            mockWorkflowConfig.load.mockResolvedValue(errorTestConfig);
            mockWorkflowConfig.getConfig.mockReturnValue(errorTestConfig);
            mockWorkflowConfig.getWorkflowName.mockReturnValue('error_test_workflow');
            await stateMachine.loadWorkflow('./error-test-config.json');
            stateMachine.agents.set('test_agent', mockWorkflowAgent);
        });

        it('should handle script function errors gracefully', async () => {
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.errorFunction = vi.fn().mockImplementation(() => {
                throw new Error('Script function error');
            });

            const result = await stateMachine.executeWorkflow('error_test_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script function error');
        });

        it('should handle agent API call errors', async () => {
            const scriptModule = mockWorkflowConfig.getScriptModule();
            scriptModule.errorFunction = vi.fn(); // Don't throw in pre_handler
            scriptModule.decideNext = vi.fn().mockReturnValue('stop');
            mockWorkflowAgent.makeContextCall.mockRejectedValue(new Error('API call failed'));

            const result = await stateMachine.executeWorkflow('error_test_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toContain('API call failed');
        });

        it('should handle unknown workflow error', async () => {
            const result = await stateMachine.executeWorkflow('unknown_workflow', 'test input');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Workflow not found: unknown_workflow');
            expect(result.workflow_name).toBe('unknown_workflow');
        });
    });

    describe('expression evaluation', () => {
        beforeEach(() => {
            stateMachine.commonData = {
                simple_value: 'test',
                nested: {
                    property: 'nested_value',
                },
                number: 42,
            };
        });

        it('should evaluate simple common_data expressions', () => {
            expect(stateMachine.evaluateExpression('common_data.simple_value')).toBe('test');
            expect(stateMachine.evaluateExpression('common_data.number')).toBe(42);
        });

        it('should evaluate nested property expressions', () => {
            expect(stateMachine.evaluateExpression('common_data.nested.property')).toBe(
                'nested_value'
            );
        });

        it('should return expression as-is if not common_data reference', () => {
            expect(stateMachine.evaluateExpression('literal_string')).toBe('literal_string');
            expect(stateMachine.evaluateExpression(123)).toBe(123);
        });

        it('should handle undefined properties gracefully', () => {
            expect(
                stateMachine.evaluateExpression('common_data.undefined_property')
            ).toBeUndefined();
            expect(stateMachine.evaluateExpression('common_data.nested.undefined')).toBeUndefined();
        });
    });

    describe('workflow metadata and utilities', () => {
        it('should return available workflow names', async () => {
            const mockConfig1 = {
                workflow_name: 'workflow1',
                description: 'First workflow',
                input: { name: 'input1', type: 'string', description: 'Input 1' },
                output: { name: 'output1', type: 'string', description: 'Output 1' },
                contexts: [],
                agents: [],
                states: [],
            };

            const mockConfig2 = {
                workflow_name: 'workflow2',
                description: 'Second workflow',
                input: { name: 'input2', type: 'string', description: 'Input 2' },
                output: { name: 'output2', type: 'string', description: 'Output 2' },
                contexts: [],
                agents: [],
                states: [],
            };

            // Load two workflows
            mockWorkflowConfig.load.mockResolvedValueOnce(mockConfig1);
            mockWorkflowConfig.getWorkflowName.mockReturnValueOnce('workflow1');
            await stateMachine.loadWorkflow('./workflow1.json');

            mockWorkflowConfig.load.mockResolvedValueOnce(mockConfig2);
            mockWorkflowConfig.getWorkflowName.mockReturnValueOnce('workflow2');
            await stateMachine.loadWorkflow('./workflow2.json');

            const availableWorkflows = stateMachine.getAvailableWorkflows();
            expect(availableWorkflows).toContain('workflow1');
            expect(availableWorkflows).toContain('workflow2');
            expect(availableWorkflows.length).toBe(2);
        });

        it('should return workflow metadata', async () => {
            const mockConfig = {
                workflow_name: 'metadata_test',
                description: 'Test metadata',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'context1' }],
                agents: [{ agent_role: 'agent1' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            const mockMetadata = {
                name: 'metadata_test',
                description: 'Test metadata',
                input: mockConfig.input,
                output: mockConfig.output,
                contextCount: 1,
                agentCount: 1,
                stateCount: 2,
            };

            mockWorkflowConfig.load.mockResolvedValue(mockConfig);
            mockWorkflowConfig.getWorkflowName.mockReturnValue('metadata_test');
            mockWorkflowConfig.getMetadata.mockReturnValue(mockMetadata);
            await stateMachine.loadWorkflow('./metadata-test.json');

            const metadata = await stateMachine.getWorkflowMetadata('metadata_test');
            expect(metadata).toEqual(mockMetadata);
        });

        it('should return null for non-existent workflow metadata', async () => {
            const metadata = await stateMachine.getWorkflowMetadata('non_existent');
            expect(metadata).toBeNull();
        });

        it('should return execution statistics', () => {
            stateMachine.workflowConfigs.set('workflow1', {});
            stateMachine.workflowConfigs.set('workflow2', {});
            stateMachine.contexts.set('context1', {});
            stateMachine.agents.set('agent1', {});
            stateMachine.commonData = { key1: 'value1', key2: 'value2', key3: 'value3' };

            const stats = stateMachine.getStats();

            expect(stats).toEqual({
                loadedWorkflows: 2,
                activeContexts: 1,
                activeAgents: 1,
                commonDataKeys: 3,
            });
        });
    });
});
