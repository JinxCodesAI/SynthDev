import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import WorkflowStateMachine from '../../workflow/WorkflowStateMachine.js';
import { groceryStoreHttpMocks } from '../mocks/grocery-store-http.js';

// Mock OpenAI client
vi.mock('openai', () => ({
    OpenAI: vi.fn(),
}));

// Mock file system to return exact config files
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    };
});

/**
 * End-to-end test for grocery store workflow
 * Tests the complete workflow execution with mocked HTTP responses
 * matching the exact requests/responses from logs/http_requests.txt
 */
describe('Grocery Store Workflow E2E Test', () => {
    let stateMachine;
    let mockConfig;
    let mockToolManager;
    let mockSnapshotManager;
    let mockConsoleInterface;
    let mockCostsManager;
    let originalEnv;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Store original environment variables
        originalEnv = {
            MODEL: process.env.MODEL,
            MAX_COMPLETION_TOKENS: process.env.MAX_COMPLETION_TOKENS,
        };

        // Set environment variables to match the logged requests
        process.env.MODEL = 'gpt-4.1-nano';
        process.env.MAX_COMPLETION_TOKENS = '32000';

        // Setup file system mocks to return exact config content
        setupFileMocks();

        // Setup HTTP mocks to return exact responses
        await setupHttpMocking();

        // Setup other mocks
        setupMocks();

        // Create state machine instance
        stateMachine = new WorkflowStateMachine(
            mockConfig,
            mockToolManager,
            mockSnapshotManager,
            mockConsoleInterface,
            mockCostsManager
        );
    });

    afterEach(() => {
        // Restore original environment variables
        if (originalEnv.MODEL !== undefined) {
            process.env.MODEL = originalEnv.MODEL;
        } else {
            delete process.env.MODEL;
        }
        if (originalEnv.MAX_COMPLETION_TOKENS !== undefined) {
            process.env.MAX_COMPLETION_TOKENS = originalEnv.MAX_COMPLETION_TOKENS;
        } else {
            delete process.env.MAX_COMPLETION_TOKENS;
        }

        vi.resetAllMocks();
    });

    /**
     * Setup file system mocks to return exact config content
     */
    function setupFileMocks() {
        const mockExistsSync = vi.mocked(existsSync);
        const mockReadFileSync = vi.mocked(readFileSync);

        // Mock existsSync to return true for our config files
        mockExistsSync.mockImplementation(path => {
            const pathStr = path.toString();
            return (
                pathStr.includes('grocery_store_test.json') ||
                pathStr.includes('script.js') ||
                pathStr.includes('roles.json') ||
                pathStr.includes('workflows') ||
                pathStr.includes('application.json') ||
                pathStr.includes('defaults') ||
                pathStr.includes('environment-template.json') ||
                pathStr.includes('.index')
            );
        });

        // Mock readFileSync to return exact config content
        mockReadFileSync.mockImplementation(path => {
            const pathStr = path.toString();
            console.log('🔍 DEBUG: readFileSync called with path:', pathStr);

            if (pathStr.includes('grocery_store_test.json')) {
                return JSON.stringify({
                    workflow_name: 'grocery_store_test',
                    description:
                        'Test workflow simulating customer-grocery worker interaction to test multi-agent conversation patterns and context sharing',
                    input: {
                        name: 'initial_customer_request',
                        type: 'string',
                        description:
                            'What the customer initially asks for or mentions when approaching the grocery worker',
                    },
                    output: {
                        name: 'interaction_summary',
                        type: 'string',
                        description:
                            'Summary of the customer-worker interaction and what was accomplished',
                    },
                    variables: {
                        max_interactions: 15,
                    },
                    contexts: [
                        {
                            name: 'store_conversation',
                            starting_messages: [],
                            max_length: 30000,
                        },
                    ],
                    agents: [
                        {
                            agent_role: 'grocery_worker',
                            context: 'store_conversation',
                            role: 'assistant',
                        },
                        {
                            agent_role: 'customer',
                            context: 'store_conversation',
                            role: 'user',
                        },
                    ],
                    states: [
                        {
                            name: 'start',
                            agent: 'grocery_worker',
                            pre_handler: 'addInitialCustomerMessage',
                            post_handler: 'addWorkerResponse',
                            transition_handler: 'alwaysTransitionToCustomer',
                        },
                        {
                            name: 'customer_decision',
                            agent: 'customer',
                            pre_handler: null,
                            post_handler: 'processCustomerDecision',
                            transition_handler: 'decideNextState',
                        },
                        {
                            name: 'worker_response',
                            agent: 'grocery_worker',
                            pre_handler: null,
                            post_handler: 'addWorkerResponse',
                            transition_handler: 'alwaysTransitionToCustomer',
                        },
                        {
                            name: 'stop',
                            input: 'common_data.interaction_summary',
                        },
                    ],
                });
            }

            if (pathStr.includes('environment-template.json')) {
                return JSON.stringify({
                    template:
                        '\n\nEnvironment Information:\n- Operating System: {os}\n- Current Working Directory: {cwd}\n- .index directory exists: {indexExists}\n- Current Date/Time: {currentDateTime}',
                    variables: {
                        os: {
                            description: 'Operating system platform',
                            value: 'win32',
                        },
                        cwd: {
                            description: 'Current working directory',
                            value: 'E:\\AI\\projects\\synth-dev',
                        },
                        indexExists: {
                            description: 'Whether .index directory exists',
                            value: 'Yes',
                        },
                        currentDateTime: {
                            description: 'Current date and time',
                            value: '15/06/2025, 00:28:38',
                        },
                    },
                });
            }

            if (pathStr.includes('roles.json')) {
                // Return the exact roles configuration
                const rolesConfig = {
                    customer: {
                        level: 'fast',
                        systemMessage:
                            "You are a customer at FreshMart grocery store. You came here today with a specific shopping list and budget in mind:\n\n**Your Shopping Mission:**\n- You need ingredients for a dinner party tomorrow (6 people)\n- Your planned menu: pasta with marinara sauce, garlic bread, and a simple salad\n- Budget: $45\n- You prefer organic when possible but will compromise for budget\n- You're somewhat picky about produce quality\n\n**Your Personality:**\n- Friendly but focused on getting what you need\n- Ask questions about alternatives if your preferred items aren't available\n- You'll negotiate on substitutions but have preferences\n- You want to finish shopping efficiently\n\n**Interaction Style:**\n- Start by asking about specific items from your list\n- Be realistic about what a grocery worker would know\n- Ask about prices and consider them when making decisions \n- Decide when you're satisfied with the help and ready to finish shopping. Allways use interaction_decision tool to decide if you need more help or not. specify continue_message if continue_shopping is true and shopping_summary if continue_shopping is false.",
                        includedTools: [],
                        parsingTools: [
                            {
                                type: 'function',
                                function: {
                                    name: 'interaction_decision',
                                    description:
                                        'Decide whether to continue the interaction or conclude your shopping assistance, should be called exactly once per interaction',
                                    parameters: {
                                        type: 'object',
                                        properties: {
                                            continue_shopping: {
                                                type: 'boolean',
                                                description:
                                                    'Whether you need more help from the grocery worker',
                                            },
                                            continue_message: {
                                                type: 'string',
                                                description:
                                                    "Your next question or request can't be empty if continue_shopping is true",
                                            },
                                            shopping_summary: {
                                                type: 'string',
                                                description:
                                                    "Summary of what you exacly bought and how much it cost if you're done shopping can't be empty if continue_shopping is false",
                                            },
                                        },
                                        required: ['continue_shopping'],
                                    },
                                },
                                parsingOnly: true,
                            },
                        ],
                    },
                    grocery_worker: {
                        level: 'fast',
                        systemMessage:
                            "You are Sam, a helpful employee at FreshMart grocery store. You've been working here for 2 years and know the store layout and inventory well.\n\n**Store Information:**\n- FreshMart is a mid-size grocery store with good produce and competitive prices\n- Current season: Late fall, so some summer produce is limited\n- Store specialties: Fresh bakery, good organic selection, local dairy products\n\n**Current Inventory Status:**\n- Pasta: Full stock (regular and organic options available)\n- Marinara sauce: Good selection, including store brand and premium options\n- Garlic bread: Fresh baked daily, frozen options also available\n- Salad ingredients: Fresh lettuce, tomatoes, cucumbers in stock\n- Organic produce: Limited but available for most items at 20-30% premium\n- Seasonal note: Tomatoes are not at peak quality, but greenhouse varieties available\n\n**Your Personality:**\n- Genuinely helpful and knowledgeable\n- Proactive in suggesting alternatives when items aren't ideal\n- Know about current sales and promotions\n- Can provide cooking tips when relevant\n- Professional but friendly\n\n**Your Approach:**\n- Listen to what the customer needs\n- Offer specific alternatives when their first choice isn't optimal\n- Mention relevant sales or promotions\n- Help them stay within budget if they mention it\n- Provide location information for items in the store. Customers budget of $45 should be enough to buy all the items they need, but not most luxury items.",
                        includedTools: [],
                    },
                };
                console.log(
                    '🔍 DEBUG: Returning roles.json:',
                    JSON.stringify(rolesConfig, null, 2)
                );
                return JSON.stringify(rolesConfig);
            }

            // For application.json file, return basic config
            if (pathStr.includes('application.json')) {
                return JSON.stringify({
                    models: {
                        base: {
                            model: 'gpt-4.1-nano',
                            baseUrl: 'https://api.openai.com/v1',
                        },
                        smart: {
                            model: null,
                            baseUrl: null,
                        },
                        fast: {
                            model: null,
                            baseUrl: null,
                        },
                    },
                    global_settings: {
                        maxToolCalls: 50,
                        enablePromptEnhancement: false,
                        verbosityLevel: 2,
                    },
                    ui_settings: {
                        defaultRole: 'coder',
                        showStartupBanner: false,
                        enableColors: true,
                        promptPrefix: '💭 You: ',
                    },
                    tool_settings: {
                        autoRun: true,
                        requiresBackup: false,
                        defaultEncoding: 'utf8',
                        maxFileSize: 10485760,
                        defaultTimeout: 10000,
                    },
                    logging: {
                        defaultLevel: 2,
                        enableHttpLogging: false,
                        enableToolLogging: true,
                        enableErrorLogging: true,
                    },
                    safety: {
                        enableAISafetyCheck: true,
                        fallbackToPatternMatching: true,
                        maxScriptSize: 50000,
                        scriptTimeout: {
                            min: 1000,
                            max: 30000,
                            default: 10000,
                        },
                    },
                    features: {
                        enableSnapshots: true,
                        enableIndexing: true,
                        enableCommandHistory: true,
                        enableContextIntegration: false,
                    },
                });
            }

            // For script.js file, return the script content
            if (pathStr.includes('script.js')) {
                return `export default {
                    addInitialCustomerMessage() {
                        const context = this.workflow_contexts.get('store_conversation');
                        if (context && this.common_data.initial_customer_request) {
                            context.addMessage({
                                role: 'user',
                                content: this.common_data.initial_customer_request,
                            });
                        }
                    },
                    addWorkerResponse() {
                        const context = this.workflow_contexts.get('store_conversation');
                        const responseContent = this.last_response?.choices?.[0]?.message?.content;
                        if (context && responseContent) {
                            context.addMessage({
                                role: 'assistant',
                                content: responseContent,
                            });
                        }
                    },
                    alwaysTransitionToCustomer() {
                        return 'customer_decision';
                    },
                    processCustomerDecision() {
                        const context = this.workflow_contexts.get('store_conversation');
                        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];
                        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');
                        if (decisionCall && context) {
                            try {
                                const arguments_ = JSON.parse(decisionCall.function.arguments);
                                if (arguments_.continue_shopping === true && arguments_.continue_message) {
                                    context.addMessage({
                                        role: 'user',
                                        content: arguments_.continue_message,
                                    });
                                } else if (arguments_.continue_shopping === false && arguments_.shopping_summary) {
                                    this.common_data.interaction_summary = arguments_.shopping_summary;
                                }
                            } catch (error) {
                                console.error('Error parsing interaction_decision arguments:', error);
                            }
                        }
                    },
                    decideNextState() {
                        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];
                        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');
                        if (decisionCall) {
                            try {
                                const arguments_ = JSON.parse(decisionCall.function.arguments);
                                if (arguments_.continue_shopping === true) {
                                    return 'worker_response';
                                } else {
                                    return 'stop';
                                }
                            } catch (error) {
                                console.error('Error parsing interaction_decision arguments:', error);
                                return 'stop';
                            }
                        }
                        return 'stop';
                    },
                };`;
            }

            return '';
        });
    }

    /**
     * Setup all required mocks
     */
    function setupMocks() {
        // Mock config manager
        mockConfig = {
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-4.1-nano',
                maxCompletionTokens: 32000,
            }),
            getRoleConfig: vi.fn().mockImplementation(roleName => {
                // Return role configurations from our mocked roles.json
                const rolesConfig = {
                    customer: {
                        level: 'fast',
                        systemMessage:
                            "You are a customer at FreshMart grocery store. You came here today with a specific shopping list and budget in mind:\n\n**Your Shopping Mission:**\n- You need ingredients for a dinner party tomorrow (6 people)\n- Your planned menu: pasta with marinara sauce, garlic bread, and a simple salad\n- Budget: $45\n- You prefer organic when possible but will compromise for budget\n- You're somewhat picky about produce quality\n\n**Your Personality:**\n- Friendly but focused on getting what you need\n- Ask questions about alternatives if your preferred items aren't available\n- You'll negotiate on substitutions but have preferences\n- You want to finish shopping efficiently\n\n**Interaction Style:**\n- Start by asking about specific items from your list\n- Be realistic about what a grocery worker would know\n- Ask about prices and consider them when making decisions \n- Decide when you're satisfied with the help and ready to finish shopping. Allways use interaction_decision tool to decide if you need more help or not. specify continue_message if continue_shopping is true and shopping_summary if continue_shopping is false.",
                        includedTools: [],
                        parsingTools: [
                            {
                                type: 'function',
                                function: {
                                    name: 'interaction_decision',
                                    description:
                                        'Decide whether to continue the interaction or conclude your shopping assistance, should be called exactly once per interaction',
                                    parameters: {
                                        type: 'object',
                                        properties: {
                                            continue_shopping: {
                                                type: 'boolean',
                                                description:
                                                    'Whether you need more help from the grocery worker',
                                            },
                                            continue_message: {
                                                type: 'string',
                                                description:
                                                    "Your next question or request can't be empty if continue_shopping is true",
                                            },
                                            shopping_summary: {
                                                type: 'string',
                                                description:
                                                    "Summary of what you exacly bought and how much it cost if you're done shopping can't be empty if continue_shopping is false",
                                            },
                                        },
                                        required: ['continue_shopping'],
                                    },
                                },
                                parsingOnly: true,
                            },
                        ],
                    },
                    grocery_worker: {
                        level: 'fast',
                        systemMessage:
                            "You are Sam, a helpful employee at FreshMart grocery store. You've been working here for 2 years and know the store layout and inventory well.\n\n**Store Information:**\n- FreshMart is a mid-size grocery store with good produce and competitive prices\n- Current season: Late fall, so some summer produce is limited\n- Store specialties: Fresh bakery, good organic selection, local dairy products\n\n**Current Inventory Status:**\n- Pasta: Full stock (regular and organic options available)\n- Marinara sauce: Good selection, including store brand and premium options\n- Garlic bread: Fresh baked daily, frozen options also available\n- Salad ingredients: Fresh lettuce, tomatoes, cucumbers in stock\n- Organic produce: Limited but available for most items at 20-30% premium\n- Seasonal note: Tomatoes are not at peak quality, but greenhouse varieties available\n\n**Your Personality:**\n- Genuinely helpful and knowledgeable\n- Proactive in suggesting alternatives when items aren't ideal\n- Know about current sales and promotions\n- Can provide cooking tips when relevant\n- Professional but friendly\n\n**Your Approach:**\n- Listen to what the customer needs\n- Offer specific alternatives when their first choice isn't optimal\n- Mention relevant sales or promotions\n- Help them stay within budget if they mention it\n- Provide location information for items in the store. Customers budget of $45 should be enough to buy all the items they need, but not most luxury items.",
                        includedTools: [],
                    },
                };
                return rolesConfig[roleName];
            }),
        };

        // Mock tool manager
        mockToolManager = {
            getTools: vi.fn().mockReturnValue([]),
        };

        // Mock snapshot manager
        mockSnapshotManager = {
            createSnapshot: vi.fn().mockResolvedValue(),
        };

        // Mock console interface
        mockConsoleInterface = {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Mock costs manager
        mockCostsManager = {
            addCost: vi.fn(),
            getCosts: vi.fn().mockReturnValue({ total: 0 }),
        };
    }

    /**
     * Main e2e test that executes the grocery store workflow
     * with exact HTTP response mocking from logs/http_requests.txt
     */
    it('should execute grocery store workflow with exact HTTP responses', async () => {
        // Setup HTTP mocking to return exact responses from logs
        await setupHttpMocking();

        // Load the workflow using mocked file system
        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'grocery_store_test.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        // Execute the workflow with the exact input from the logs
        const initialCustomerRequest =
            "Hi, I'm looking for ingredients to make pasta dinner for 6 people tomorrow. Do you have good marinara sauce?";

        const result = await stateMachine.executeWorkflow(
            'grocery_store_test',
            initialCustomerRequest
        );

        // Debug: Log the actual result to understand what's happening
        console.log('🔍 DEBUG: Workflow result:', JSON.stringify(result, null, 2));
        console.log('🔍 DEBUG: OpenAI calls made:', global.mockOpenAICreate.mock.calls.length);
        console.log(
            '🔍 DEBUG: OpenAI calls structure:',
            global.mockOpenAICreate.mock.calls.map((call, i) => `Call ${i}: ${call.length} args`)
        );
        console.log('🔍 DEBUG: First call args:', global.mockOpenAICreate.mock.calls[0]);
        console.log('🔍 DEBUG: Second call args:', global.mockOpenAICreate.mock.calls[1]);

        // Verify the workflow executed successfully
        expect(result.success).toBe(true);
        expect(result.workflow_name).toBe('grocery_store_test');
        expect(result.execution_time).toBeGreaterThan(0);

        // Verify the exact final output matches the expected result
        const expectedOutput =
            'Items purchased: store brand marinara sauce, premium marinara sauce, pasta (penne), garlic bread, lettuce, tomatoes, cucumbers, Parmesan cheese, dried basil, oregano, and parsley. Total cost is approximately $40. The shopping was efficient, and you are within your $45 budget.';

        expect(result.output).toBe(expectedOutput);

        // Verify states were visited in correct order
        expect(result.states_visited).toContain('start');
        expect(result.states_visited).toContain('customer_decision');
        expect(result.states_visited).toContain('worker_response');
        expect(result.final_state).toBe('stop');

        // Verify HTTP requests were made with exact parameters
        verifyHttpRequests();
    });

    /**
     * Setup HTTP mocking to return exact responses from logs
     */
    async function setupHttpMocking() {
        // Use the low-level OpenAI mock that only intercepts the HTTP call
        const mockCreate = vi.fn().mockImplementation(groceryStoreHttpMocks.createOpenAIMock());

        const mockOpenAI = {
            chat: {
                completions: {
                    create: mockCreate,
                },
            },
            baseURL: 'https://api.openai.com/v1',
        };

        // Store the mock for verification
        global.mockOpenAICreate = mockCreate;

        // Mock the OpenAI constructor
        const openaiModule = vi.mocked(await import('openai'));
        openaiModule.OpenAI.mockImplementation(() => mockOpenAI);
    }

    /**
     * Verify that HTTP requests were made with exact parameters from logs
     */
    function verifyHttpRequests() {
        const expectedRequests = groceryStoreHttpMocks.getRequests();
        const actualCalls = global.mockOpenAICreate.mock.calls;

        expect(actualCalls).toHaveLength(expectedRequests.length);

        actualCalls.forEach((call, index) => {
            const [requestData] = call;
            const expectedRequest = expectedRequests[index];

            // Verify request data matches expected
            expect(requestData.model).toBe(expectedRequest.model);
            expect(requestData.max_completion_tokens).toBe(expectedRequest.max_completion_tokens);

            // Verify messages structure (allowing for dynamic content)
            expect(requestData.messages).toBeDefined();
            expect(Array.isArray(requestData.messages)).toBe(true);

            // For requests with tools, verify tool structure
            if (expectedRequest.tools) {
                expect(requestData.tools).toBeDefined();
                expect(requestData.tool_choice).toBeDefined();
                expect(requestData.tools[0].function.name).toBe('interaction_decision');
            }
        });
    }

    /**
     * Test that verifies environment variables are correctly applied
     */
    it('should use correct environment variables in requests', async () => {
        await setupHttpMocking();

        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'grocery_store_test.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        await stateMachine.executeWorkflow('grocery_store_test', 'Test input');

        // Verify that requests used the correct model and max_completion_tokens
        const actualCalls = global.mockOpenAICreate.mock.calls;

        actualCalls.forEach(call => {
            const [requestData] = call;

            expect(requestData.model).toBe('gpt-4.1-nano');
            expect(requestData.max_completion_tokens).toBe(32000);
        });
    });

    /**
     * Test that verifies configuration files are properly isolated
     */
    it('should use mocked configuration files', async () => {
        // Verify that mocked files are accessible
        expect(
            existsSync(join(process.cwd(), 'config', 'workflows', 'grocery_store_test.json'))
        ).toBe(true);
        expect(
            existsSync(
                join(process.cwd(), 'config', 'workflows', 'grocery_store_test', 'script.js')
            )
        ).toBe(true);
        expect(existsSync(join(process.cwd(), 'config', 'roles', 'roles.json'))).toBe(true);

        // Load workflow using mocked file system
        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'grocery_store_test.json'
        );
        const config = await stateMachine.loadWorkflow(workflowConfigPath);

        // Verify configuration was loaded correctly
        expect(config.workflow_name).toBe('grocery_store_test');
        expect(config.description).toContain('customer-grocery worker interaction');
        expect(config.agents).toHaveLength(2);
        expect(config.states).toHaveLength(4);
    });

    /**
     * Test that verifies the workflow produces the exact expected output
     */
    it('should produce exact shopping summary output', async () => {
        await setupHttpMocking();

        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'grocery_store_test.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        const result = await stateMachine.executeWorkflow(
            'grocery_store_test',
            "Hi, I'm looking for ingredients to make pasta dinner for 6 people tomorrow. Do you have good marinara sauce?"
        );

        // The exact output should match what was logged in the original execution
        const expectedSummary =
            'Items purchased: store brand marinara sauce, premium marinara sauce, pasta (penne), garlic bread, lettuce, tomatoes, cucumbers, Parmesan cheese, dried basil, oregano, and parsley. Total cost is approximately $40. The shopping was efficient, and you are within your $45 budget.';

        expect(result.output).toBe(expectedSummary);
        expect(result.success).toBe(true);
        expect(result.final_state).toBe('stop');
    });

    /**
     * Test that verifies all HTTP requests match the logged sequence
     */
    it('should make HTTP requests in exact sequence from logs', async () => {
        await setupHttpMocking();

        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'grocery_store_test.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        await stateMachine.executeWorkflow(
            'grocery_store_test',
            "Hi, I'm looking for ingredients to make pasta dinner for 6 people tomorrow. Do you have good marinara sauce?"
        );

        // Verify the exact number of HTTP requests (6 from the logs)
        expect(global.mockOpenAICreate.mock.calls).toHaveLength(6);

        // Verify each request matches the logged pattern
        const calls = global.mockOpenAICreate.mock.calls;

        // Request 1: grocery_worker initial response
        let requestData = calls[0][0];
        expect(requestData.messages[0].role).toBe('system');
        expect(requestData.messages[0].content).toContain(
            'You are Sam, a helpful employee at FreshMart'
        );
        expect(requestData.messages[1].role).toBe('user');
        expect(requestData.messages[1].content).toContain('pasta dinner for 6 people');

        // Request 2: customer decision with tool call
        requestData = calls[1][0];
        expect(requestData.tools).toBeDefined();
        expect(requestData.tools[0].function.name).toBe('interaction_decision');
        expect(requestData.tool_choice.function.name).toBe('interaction_decision');

        // Verify the pattern continues for all 6 requests
        calls.forEach(call => {
            const [requestData] = call;

            expect(requestData.model).toBe('gpt-4.1-nano');
            expect(requestData.max_completion_tokens).toBe(32000);
        });
    });
});
