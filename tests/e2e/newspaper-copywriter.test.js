import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import WorkflowStateMachine from '../../workflow/WorkflowStateMachine.js';
import ConfigManager from '../../configManager.js';
import ToolManager from '../../toolManager.js';
import SnapshotManager from '../../snapshotManager.js';
import ConsoleInterface from '../../consoleInterface.js';
import costsManager from '../../costsManager.js';
import { newspaperCopywriterHttpMocks } from '../mocks/newspaper-copywriter-http.js';

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
 * End-to-end test for newspaper copywriter workflow
 * Tests the complete workflow execution with mocked HTTP responses
 * simulating article creation, multi-role review, and editorial approval
 */
describe('Newspaper Copywriter Workflow E2E Test', () => {
    let stateMachine;
    let originalEnv;

    // Cache fixture files before mocking
    let fixtureFiles;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Cache fixture files before mocking readFileSync
        fixtureFiles = {
            'newspaper_copywriter.json': readFixtureFile('newspaper_copywriter.json'),
            'environment-template.json': readFixtureFile('environment-template.json'),
            'roles.json': readFixtureFile('roles.json'),
            'application.json': readFixtureFile('application.json'),
            'newspaper_copywriter/script.js': readFixtureFile('newspaper_copywriter/script.js'),
            'config-validation.json': readFixtureFile('config-validation.json'),
            'console-messages.json': readFixtureFile('console-messages.json'),
        };

        // Store original environment variables
        originalEnv = {
            MODEL: process.env.MODEL,
            MAX_COMPLETION_TOKENS: process.env.MAX_COMPLETION_TOKENS,
            API_KEY: process.env.API_KEY,
            BASE_URL: process.env.BASE_URL,
            SMART_BASE_URL: process.env.SMART_BASE_URL,
            FAST_BASE_URL: process.env.FAST_BASE_URL,
        };

        // Set environment variables to match the logged requests
        process.env.MODEL = 'gpt-4.1-nano';
        process.env.MAX_COMPLETION_TOKENS = '32000';
        process.env.API_KEY = 'sk-test-key-for-testing-purposes-only';
        process.env.BASE_URL = 'https://api.openai.com/v1';
        process.env.SMART_BASE_URL = 'https://api.openai.com/v1';
        process.env.FAST_BASE_URL = 'https://api.openai.com/v1';

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
                pathStr.includes('newspaper_copywriter.json') ||
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

            if (pathStr.includes('newspaper_copywriter.json')) {
                return fixtureFiles['newspaper_copywriter.json'];
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
                return fixtureFiles['newspaper_copywriter/script.js'];
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
     * Main e2e test that executes the newspaper copywriter workflow
     * with exact HTTP response mocking
     */
    it('should execute newspaper copywriter workflow with article approval', async () => {
        // Setup HTTP mocking to return exact responses
        await setupHttpMocking();

        // Load the workflow using mocked file system
        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'newspaper_copywriter.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        // Execute the workflow with article assignment
        const articleAssignment =
            'Write a 300-word news article about TechFlow Solutions, a local startup that just raised $2M in Series A funding. Include quotes from the CEO and lead investor. Focus on what they plan to do with the funding and their growth plans.';

        const result = await stateMachine.executeWorkflow(
            'newspaper_copywriter',
            articleAssignment
        );

        // Verify the workflow executed successfully
        expect(result.success).toBe(true);
        expect(result.workflow_name).toBe('newspaper_copywriter');
        expect(result.execution_time).toBeGreaterThan(0);

        // Verify the exact final output matches the expected result
        const expectedOutput =
            'APPROVED: Article approved for publication. Strong local business story that serves our readers well. Fact verification items are standard and can be documented.';

        expect(result.output).toBe(expectedOutput);

        // Verify states were visited in correct order
        expect(result.states_visited).toContain('start');
        expect(result.states_visited).toContain('legal_review');
        expect(result.states_visited).toContain('editorial_review');
        expect(result.states_visited).toContain('fact_check');
        expect(result.states_visited).toContain('copywriter_decision');
        expect(result.states_visited).toContain('chief_review');
        expect(result.final_state).toBe('stop');

        // Verify HTTP requests were made with exact parameters
        verifyHttpRequests();
    });

    /**
     * Setup HTTP mocking to return exact responses
     */
    async function setupHttpMocking() {
        // Use the low-level OpenAI mock that only intercepts the HTTP call
        const mockCreate = vi
            .fn()
            .mockImplementation(newspaperCopywriterHttpMocks.createOpenAIMock());

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
     * Verify that HTTP requests were made with exact parameters
     */
    function verifyHttpRequests() {
        const expectedRequests = newspaperCopywriterHttpMocks.getRequests();
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

                if (index === 4) {
                    // Copywriter decision
                    expect(requestData.tools[0].function.name).toBe('copywriter_decision');
                } else if (index === 5) {
                    // Chief decision
                    expect(requestData.tools[0].function.name).toBe('chief_decision');
                }
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
            'newspaper_copywriter.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        await stateMachine.executeWorkflow('newspaper_copywriter', 'Test assignment');

        // Verify that requests used the correct model and max_completion_tokens
        const actualCalls = global.mockOpenAICreate.mock.calls;

        actualCalls.forEach((call, index) => {
            const [requestData] = call;

            // Most roles use base level (gpt-4.1-mini), except chief_editor which uses smart level (gpt-4.1-nano)
            const expectedModel = index === 5 ? 'gpt-4.1-nano' : 'gpt-4.1-mini'; // Chief editor is request 6 (index 5)
            expect(requestData.model).toBe(expectedModel);
            expect(requestData.max_completion_tokens).toBe(32000);
        });
    });

    /**
     * Test that verifies configuration files are properly isolated
     */
    it('should use mocked configuration files', async () => {
        // Verify that mocked files are accessible
        expect(
            existsSync(join(process.cwd(), 'config', 'workflows', 'newspaper_copywriter.json'))
        ).toBe(true);
        expect(
            existsSync(
                join(process.cwd(), 'config', 'workflows', 'newspaper_copywriter', 'script.js')
            )
        ).toBe(true);
        expect(existsSync(join(process.cwd(), 'config', 'roles', 'roles.json'))).toBe(true);

        // Load workflow using mocked file system
        const workflowConfigPath = join(
            process.cwd(),
            'config',
            'workflows',
            'newspaper_copywriter.json'
        );
        const config = await stateMachine.loadWorkflow(workflowConfigPath);

        // Verify configuration was loaded correctly
        expect(config.workflow_name).toBe('newspaper_copywriter');
        expect(config.description).toContain('Newspaper copywriter workflow');
        expect(config.agents).toHaveLength(5);
        expect(config.states).toHaveLength(8);
    });
});
