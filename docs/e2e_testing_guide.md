# E2E Workflow Testing Guide

This guide provides comprehensive instructions for creating end-to-end (E2E) tests for workflows in the SynthDev project. E2E tests validate complete workflow execution with realistic HTTP interactions and proper isolation.

## Overview

E2E workflow tests verify:

- Complete workflow execution from start to finish
- Proper HTTP request/response handling with OpenAI API
- Correct state transitions and agent interactions
- Expected final outputs and intermediate results
- Configuration file loading and environment variable handling

## Project Structure

```
tests/
├── e2e/
│   ├── fixtures/                    # Test configuration files
│   │   ├── workflow_name.json       # Workflow configuration
│   │   ├── workflow_name/
│   │   │   └── script.js            # Workflow script functions
│   │   ├── roles.json               # Agent role definitions
│   │   ├── application.json         # Application configuration
│   │   ├── environment-template.json # Environment template
│   │   ├── config-validation.json   # Config validation rules
│   │   └── console-messages.json    # Console message templates
│   ├── workflow-name.test.js        # E2E test file
│   └── ...
├── mocks/
│   ├── workflow-name-http.js        # HTTP request/response mocks
│   └── ...
└── ...
```

## Step 1: Create Workflow Configuration Files

### 1.1 Workflow JSON Configuration

Create `tests/e2e/fixtures/your_workflow.json`:

```json
{
    "workflow_name": "your_workflow",
    "description": "Description of what the workflow does",
    "input": {
        "name": "input_parameter_name",
        "type": "string",
        "description": "Description of the input parameter"
    },
    "output": {
        "name": "output_parameter_name",
        "type": "string",
        "description": "Description of the output"
    },
    "variables": {
        "max_iterations": 10
    },
    "contexts": [
        {
            "name": "main_context",
            "starting_messages": [],
            "max_length": 30000
        }
    ],
    "agents": [
        {
            "agent_role": "agent1_role",
            "context": "main_context",
            "role": "assistant"
        },
        {
            "agent_role": "agent2_role",
            "context": "main_context",
            "role": "user"
        }
    ],
    "states": [
        {
            "name": "start",
            "agent": "agent1_role",
            "pre_handler": "initializeWorkflow",
            "post_handler": "processResponse",
            "transition_handler": "decideNextState"
        },
        {
            "name": "stop",
            "input": "common_data.final_output"
        }
    ]
}
```

### 1.2 Workflow Script Functions

Create `tests/e2e/fixtures/your_workflow/script.js`:

```javascript
export default {
    // Pre-handler: Executed before agent API call
    initializeWorkflow() {
        const context = this.workflow_contexts.get('main_context');
        if (context && this.common_data.input_parameter_name) {
            context.addMessage({
                role: 'user',
                content: this.common_data.input_parameter_name,
            });
        }
    },

    // Post-handler: Executed after agent API call
    processResponse() {
        const context = this.workflow_contexts.get('main_context');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (context && responseContent) {
            context.addMessage({
                role: 'assistant',
                content: responseContent,
            });
        }
    },

    // Transition handler: Decides next state
    decideNextState() {
        // Your logic to determine next state
        // Return 'stop' to end workflow
        // Return state name to continue
        return 'stop';
    },
};
```

## Step 2: Create HTTP Mocks

### 2.1 HTTP Mock File

Create `tests/mocks/your-workflow-http.js`:

```javascript
/**
 * HTTP mocks for your workflow e2e test
 * Contains exact requests and responses from actual workflow execution
 */

const httpResponses = [
    // Response 1: First agent response
    {
        id: 'chatcmpl-example1',
        object: 'chat.completion',
        created: 1749936609,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: 'Expected response content from agent',
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_example',
    },
    // Add more responses as needed...
];

const httpRequests = [
    // Request 1: Expected request structure
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
        messages: [
            {
                role: 'system',
                content: 'System prompt...',
            },
            {
                role: 'user',
                content: 'User input...',
            },
        ],
    },
    // Add more request patterns as needed...
];

export const yourWorkflowHttpMocks = {
    getResponses() {
        return httpResponses;
    },

    getRequests() {
        return httpRequests;
    },

    getResponse(index) {
        return httpResponses[index];
    },

    getRequest(index) {
        return httpRequests[index];
    },

    getCount() {
        return httpResponses.length;
    },

    createOpenAIMock() {
        let callCount = 0;

        return async function mockOpenAICreate(requestData) {
            if (callCount >= httpResponses.length) {
                throw new Error(`No more responses available (call ${callCount + 1})`);
            }

            const response = httpResponses[callCount];
            callCount++;

            return response;
        };
    },
};
```

## Step 3: Create E2E Test File

Create `tests/e2e/your-workflow.test.js`:

```javascript
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
import { yourWorkflowHttpMocks } from '../mocks/your-workflow-http.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import actual fs functions before mocking
const actualFs = await vi.importActual('fs');

// Helper function to read fixture files
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

// Mock file system
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    };
});

describe('Your Workflow E2E Test', () => {
    let stateMachine;
    let originalEnv;
    let fixtureFiles;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Cache fixture files before mocking readFileSync
        fixtureFiles = {
            'your_workflow.json': readFixtureFile('your_workflow.json'),
            'environment-template.json': readFixtureFile('environment-template.json'),
            'roles.json': readFixtureFile('roles.json'),
            'application.json': readFixtureFile('application.json'),
            'your_workflow/script.js': readFixtureFile('your_workflow/script.js'),
            'config-validation.json': readFixtureFile('config-validation.json'),
            'console-messages.json': readFixtureFile('console-messages.json'),
        };

        // Store and set environment variables
        originalEnv = {
            MODEL: process.env.MODEL,
            MAX_COMPLETION_TOKENS: process.env.MAX_COMPLETION_TOKENS,
            API_KEY: process.env.API_KEY,
            BASE_URL: process.env.BASE_URL,
        };

        process.env.MODEL = 'gpt-4.1-nano';
        process.env.MAX_COMPLETION_TOKENS = '32000';
        process.env.API_KEY = 'sk-test-key-for-testing-purposes-only';
        process.env.BASE_URL = 'https://api.openai.com/v1';

        // Setup file system mocks
        setupFileMocks();

        // Initialize components
        const confMgr = ConfigManager.getInstance();
        await confMgr.initialize();

        const toolManager = new ToolManager();
        const snapshotManager = new SnapshotManager();
        const consoleInterface = new ConsoleInterface();

        stateMachine = new WorkflowStateMachine(
            confMgr,
            toolManager,
            snapshotManager,
            consoleInterface,
            costsManager
        );
    });

    afterEach(() => {
        // Restore environment variables
        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            } else {
                delete process.env[key];
            }
        });

        vi.resetAllMocks();
    });

    function setupFileMocks() {
        const mockExistsSync = vi.mocked(existsSync);
        const mockReadFileSync = vi.mocked(readFileSync);

        // Mock existsSync to return true for config files
        mockExistsSync.mockImplementation(path => {
            const pathStr = path.toString();
            return (
                pathStr.includes('your_workflow.json') ||
                pathStr.includes('script.js') ||
                pathStr.includes('roles.json') ||
                pathStr.includes('application.json') ||
                pathStr.includes('environment-template.json') ||
                pathStr.includes('console-messages.json') ||
                pathStr.includes('config-validation.json') ||
                pathStr.includes('workflows') ||
                pathStr.includes('defaults') ||
                pathStr.includes('.index')
            );
        });

        // Mock readFileSync to return fixture content
        mockReadFileSync.mockImplementation(path => {
            const pathStr = path.toString();

            if (pathStr.includes('your_workflow.json')) {
                return fixtureFiles['your_workflow.json'];
            }
            if (pathStr.includes('script.js')) {
                return fixtureFiles['your_workflow/script.js'];
            }
            if (pathStr.includes('roles.json')) {
                return fixtureFiles['roles.json'];
            }
            if (pathStr.includes('application.json')) {
                return fixtureFiles['application.json'];
            }
            if (pathStr.includes('environment-template.json')) {
                return fixtureFiles['environment-template.json'];
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

    async function setupHttpMocking() {
        const mockCreate = vi.fn().mockImplementation(yourWorkflowHttpMocks.createOpenAIMock());

        const mockOpenAI = {
            chat: {
                completions: {
                    create: mockCreate,
                },
            },
            baseURL: 'https://api.openai.com/v1',
        };

        global.mockOpenAICreate = mockCreate;

        const openaiModule = vi.mocked(await import('openai'));
        openaiModule.OpenAI.mockImplementation(() => mockOpenAI);
    }

    it('should execute workflow with expected output', async () => {
        await setupHttpMocking();

        const workflowConfigPath = join(process.cwd(), 'config', 'workflows', 'your_workflow.json');
        await stateMachine.loadWorkflow(workflowConfigPath);

        const result = await stateMachine.executeWorkflow('your_workflow', 'Test input');

        // Verify workflow execution
        expect(result.success).toBe(true);
        expect(result.workflow_name).toBe('your_workflow');
        expect(result.execution_time).toBeGreaterThan(0);
        expect(result.output).toBe('Expected final output');
        expect(result.final_state).toBe('stop');

        // Verify HTTP requests
        const expectedRequests = yourWorkflowHttpMocks.getRequests();
        const actualCalls = global.mockOpenAICreate.mock.calls;
        expect(actualCalls).toHaveLength(expectedRequests.length);
    });
});
```

## Step 4: Configuration Files

### 4.1 Required Fixture Files

Copy these configuration files to your `tests/e2e/fixtures/` directory:

#### roles.json

Contains agent role definitions with system prompts and tool configurations.

#### application.json

Contains application-wide configuration settings.

#### environment-template.json

Contains environment variable templates and defaults.

#### config-validation.json

Contains validation rules for configuration files.

#### console-messages.json

Contains console message templates and formatting rules.

## Step 5: Best Practices

### 5.1 HTTP Mock Creation

1. **Capture Real Responses**: Run your workflow manually and capture actual HTTP requests/responses
2. **Exact Matching**: Use exact response structures from real API calls
3. **Sequential Responses**: Ensure responses are returned in the correct order
4. **Request Validation**: Verify that requests match expected patterns

### 5.2 Test Isolation

1. **Environment Variables**: Always backup and restore environment variables
2. **File System Mocking**: Mock all file system operations to avoid dependencies
3. **Cache Fixture Files**: Read fixture files before mocking to avoid conflicts
4. **Clean State**: Reset all mocks between tests

### 5.3 Assertion Strategies

1. **Workflow Success**: Verify `result.success` is true
2. **Expected Output**: Check exact output matches expected result
3. **State Transitions**: Verify states were visited in correct order
4. **HTTP Interactions**: Validate request count and structure
5. **Environment Usage**: Confirm correct environment variables were used

### 5.4 Debugging Tips

1. **Debug Logging**: Use console.log statements to trace execution
2. **Response Inspection**: Log actual vs expected responses
3. **Mock Verification**: Check that mocks are being called correctly
4. **State Tracking**: Monitor workflow state transitions

## Step 6: Advanced Patterns

### 6.1 Multi-Agent Workflows

For workflows with multiple agents:

```javascript
// In HTTP mocks, distinguish between agent types
createOpenAIMock() {
    let agent1CallCount = 0;
    let agent2CallCount = 0;

    return async function mockOpenAICreate(requestData) {
        // Determine agent type based on request characteristics
        if (requestData.tools && requestData.tools.length > 0) {
            // Agent with tools
            const response = toolAgentResponses[agent2CallCount];
            agent2CallCount++;
            return response;
        } else {
            // Regular agent
            const response = regularAgentResponses[agent1CallCount];
            agent1CallCount++;
            return response;
        }
    };
}
```

### 6.2 Tool Call Testing

For workflows using tool calls:

```javascript
// Verify tool call structure
expect(requestData.tools).toBeDefined();
expect(requestData.tool_choice).toBeDefined();
expect(requestData.tools[0].function.name).toBe('expected_tool_name');

// Verify tool call responses
const toolCalls = response.choices[0].message.tool_calls;
expect(toolCalls).toHaveLength(1);
expect(toolCalls[0].function.name).toBe('expected_tool_name');
```

### 6.3 Dynamic Content Handling

For workflows with dynamic content:

```javascript
// Allow for dynamic content while checking structure
expect(requestData.messages).toBeDefined();
expect(Array.isArray(requestData.messages)).toBe(true);
expect(requestData.messages[0].role).toBe('system');
expect(requestData.messages[0].content).toContain('expected_keyword');
```

## Step 7: Running Tests

### 7.1 Single Test Execution

```bash
# Run specific e2e test
npx vitest run tests/e2e/your-workflow.test.js

# Run with verbose output
npx vitest run tests/e2e/your-workflow.test.js --reporter=verbose
```

### 7.2 All E2E Tests

```bash
# Run all e2e tests
npx vitest run tests/e2e/

# Run with coverage
npx vitest run tests/e2e/ --coverage
```

## Step 8: Troubleshooting

### 8.1 Common Issues

1. **Mock Not Called**: Verify OpenAI mock is properly set up
2. **Wrong Response**: Check response order and agent type detection
3. **File Not Found**: Ensure fixture files exist and are properly cached
4. **Environment Issues**: Verify environment variables are set correctly

### 8.2 Debug Checklist

- [ ] Fixture files exist and contain valid JSON/JS
- [ ] HTTP mocks return responses in correct order
- [ ] Environment variables are set for test
- [ ] File system mocks cover all required paths
- [ ] Workflow configuration is valid
- [ ] Expected output matches actual workflow behavior

## Conclusion

E2E workflow tests provide comprehensive validation of workflow execution. Follow this guide to create robust, isolated tests that verify complete workflow functionality while maintaining test reliability and debugging capabilities.

Key principles:

- **Isolation**: Mock all external dependencies
- **Realism**: Use actual HTTP responses from real executions
- **Completeness**: Test entire workflow from input to output
- **Maintainability**: Structure tests for easy updates and debugging

```

```
