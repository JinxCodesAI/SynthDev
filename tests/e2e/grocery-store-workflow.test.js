import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import WorkflowStateMachine from '../../src/workflow/WorkflowStateMachine.js';
import ConfigManager from '../../src/config/managers/configManager.js';
import ToolManager from '../../src/core/managers/toolManager.js';
import SnapshotManager from '../../src/core/managers/snapshotManager.js';
import ConsoleInterface from '../../src/core/interface/consoleInterface.js';
import costsManager from '../../src/core/managers/costsManager.js';
import { groceryStoreHttpMocks } from '../mocks/grocery-store-http.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import actual fs functions before mocking
const actualFs = await vi.importActual('fs');

// Helper function to read fixture files using the actual readFileSync
const readFixtureFile = filename => {
    const fixturePath = join(__dirname, 'fixtures', filename);

    try {
        const content = actualFs.readFileSync(fixturePath, 'utf8');
        return content || '';
    } catch (error) {
        console.error(`🔍 DEBUG: Error reading file ${fixturePath}:`, error);
        return '';
    }
};

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
    let originalEnv;

    // Cache fixture files before mocking
    let fixtureFiles;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Cache fixture files before mocking readFileSync
        fixtureFiles = {
            'grocery_store_test.json': readFixtureFile('grocery_store_test.json'),
            'environment-template.json': readFixtureFile('environment-template.json'),
            'roles.json': readFixtureFile('roles.json'),
            'application.json': readFixtureFile('application.json'),
            'grocery_store_test/script.js': readFixtureFile('grocery_store_test/script.js'),
            'config-validation.json': readFixtureFile('config-validation.json'),
            'console-messages.json': readFixtureFile('console-messages.json'),
        };

        // Store original environment variables
        originalEnv = {
            MODEL: process.env.MODEL,
            MAX_COMPLETION_TOKENS: process.env.MAX_COMPLETION_TOKENS,
            SYNTHDEV_API_KEY: process.env.SYNTHDEV_API_KEY,
            SYNTHDEV_BASE_URL: process.env.SYNTHDEV_BASE_URL,
            SYNTHDEV_SMART_BASE_URL: process.env.SYNTHDEV_SMART_BASE_URL,
            SYNTHDEV_FAST_BASE_URL: process.env.SYNTHDEV_FAST_BASE_URL,
        };

        // Set environment variables to match the logged requests
        process.env.MODEL = 'gpt-4.1-nano';
        process.env.MAX_COMPLETION_TOKENS = '32000';
        process.env.SYNTHDEV_API_KEY = 'sk-test-key-for-testing-purposes-only';
        process.env.SYNTHDEV_BASE_URL = 'https://api.openai.com/v1';
        process.env.SYNTHDEV_SMART_BASE_URL = 'https://api.openai.com/v1';
        process.env.SYNTHDEV_FAST_BASE_URL = 'https://api.openai.com/v1';

        // Setup file system mocks to return exact config content
        setupFileMocks();

        const confMgr = ConfigManager.getInstance();
        await confMgr.initialize();

        // Create real instances like in app.js
        const toolManager = new ToolManager();
        const snapshotManager = new SnapshotManager();
        const consoleInterface = new ConsoleInterface();

        // Create state machine instance with real instances
        stateMachine = new WorkflowStateMachine(
            confMgr,
            toolManager,
            snapshotManager,
            consoleInterface,
            costsManager
        );
    });

    afterEach(() => {
        // Restore original environment variables
        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            } else {
                delete process.env[key];
            }
        });

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
                pathStr.includes('console-messages.json') ||
                pathStr.includes('.index') || // For .index directory
                pathStr.includes('config-validation.json')
            );
        });

        // Mock readFileSync to return exact config content
        mockReadFileSync.mockImplementation(path => {
            const pathStr = path.toString();

            if (pathStr.includes('grocery_store_test.json')) {
                return fixtureFiles['grocery_store_test.json'];
            }

            if (pathStr.includes('environment-template.json')) {
                return fixtureFiles['environment-template.json'];
            }

            if (pathStr.includes('roles.json')) {
                const rolesContent = fixtureFiles['roles.json'];
                return rolesContent;
            }

            // For application.json file, return basic config
            if (pathStr.includes('application.json')) {
                return fixtureFiles['application.json'];
            }

            // For script.js file, return the script content
            if (pathStr.includes('script.js')) {
                return fixtureFiles['grocery_store_test/script.js'];
            }

            if (pathStr.includes('console-messages.json')) {
                return fixtureFiles['console-messages.json'];
            }

            if (pathStr.includes('config-validation.json')) {
                return fixtureFiles['config-validation.json'];
            }

            return '';
        });
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
            'src',
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
            'src',
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
            existsSync(join(process.cwd(), 'src', 'config', 'workflows', 'grocery_store_test.json'))
        ).toBe(true);
        expect(
            existsSync(
                join(process.cwd(), 'src', 'config', 'workflows', 'grocery_store_test', 'script.js')
            )
        ).toBe(true);
        expect(existsSync(join(process.cwd(), 'src', 'config', 'roles', 'roles.json'))).toBe(true);

        // Load workflow using mocked file system
        const workflowConfigPath = join(
            process.cwd(),
            'src',
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
            'src',
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
            'src',
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
