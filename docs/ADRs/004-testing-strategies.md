# ADR-004: Testing Strategies and E2E Testing

## Status

Accepted

## Context

SynthDev requires comprehensive testing to ensure reliability, maintainability, and proper functionality across all components. The testing strategy must cover unit tests, integration tests, and end-to-end tests with appropriate mocking strategies.

## Decision

We will implement a multi-layered testing approach with specific patterns for different types of tests, comprehensive mocking strategies, and clear guidelines for test organization and execution.

## Testing Architecture

### Test Organization

```
tests/
├── setup.js                    # Global test setup
├── helpers/                    # Test helper utilities
│   ├── mockHelpers.js          # Common mocking utilities
│   ├── testFixtures.js         # Test data and fixtures
│   └── assertionHelpers.js     # Custom assertion helpers
├── mocks/                      # Mock implementations
│   ├── mockAPIClient.js        # AI API client mocks
│   ├── mockFileSystem.js       # File system mocks
│   └── mockConsoleInterface.js # Console interface mocks
├── unit/                       # Unit tests
│   ├── commands/               # Command unit tests
│   ├── core/                   # Core component tests
│   ├── tools/                  # Tool unit tests
│   └── workflow/               # Workflow unit tests
├── integration/                # Integration tests
│   ├── command-integration.test.js
│   ├── tool-integration.test.js
│   └── workflow-integration.test.js
└── e2e/                       # End-to-end tests
    ├── fixtures/              # E2E test fixtures
    ├── workflow.test.js       # Full workflow tests
    └── config-reload.test.js  # Configuration tests
```

### Test Configuration

#### Vitest Configuration (`vitest.config.js`)

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'tests/', '*.config.js'],
            thresholds: {
                global: {
                    branches: 40,
                    functions: 40,
                    lines: 40,
                    statements: 40,
                },
            },
        },
        testTimeout: 10000,
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },
});
```

#### Global Test Setup (`tests/setup.js`)

```javascript
import { vi, afterEach } from 'vitest';

// Mock console methods to avoid noise in tests
globalThis.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
};

// Mock process.exit to prevent tests from exiting
vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit() was called');
});

// Reset all mocks after each test
afterEach(() => {
    vi.clearAllMocks();
});
```

## Unit Testing Patterns

### Basic Unit Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YourClass } from '../../../src/path/to/YourClass.js';

describe('YourClass', () => {
    let instance;
    let mockDependency;

    beforeEach(() => {
        // Set up mocks
        mockDependency = {
            method: vi.fn().mockResolvedValue('mock result'),
        };

        // Create instance with mocked dependencies
        instance = new YourClass(mockDependency);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(instance.property).toBeDefined();
        });
    });

    describe('method', () => {
        it('should execute successfully with valid input', async () => {
            const result = await instance.method('valid input');
            expect(result).toBe('expected result');
            expect(mockDependency.method).toHaveBeenCalledWith('valid input');
        });

        it('should handle errors gracefully', async () => {
            mockDependency.method.mockRejectedValue(new Error('Test error'));

            await expect(instance.method('input')).rejects.toThrow('Test error');
        });
    });
});
```

### Tool Testing Pattern

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import toolImplementation from '../../../src/tools/your_tool/implementation.js';

describe('Your Tool', () => {
    let mockCostsManager;

    beforeEach(() => {
        mockCostsManager = {
            trackCost: vi.fn(),
        };
    });

    describe('parameter validation', () => {
        it('should return error for missing required parameter', async () => {
            const result = await toolImplementation({
                costsManager: mockCostsManager,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('required parameter');
        });

        it('should validate parameter types', async () => {
            const result = await toolImplementation({
                invalidParam: 'wrong type',
                costsManager: mockCostsManager,
            });

            expect(result.success).toBe(false);
        });
    });

    describe('successful execution', () => {
        it('should execute successfully with valid parameters', async () => {
            const result = await toolImplementation({
                validParam: 'correct value',
                costsManager: mockCostsManager,
            });

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle file system errors', async () => {
            // Mock file system error
            vi.mock('fs/promises', () => ({
                readFile: vi.fn().mockRejectedValue(new Error('File not found')),
            }));

            const result = await toolImplementation({
                filePath: 'nonexistent.txt',
                costsManager: mockCostsManager,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });
    });
});
```

### Command Testing Pattern

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourCommand } from '../../../src/commands/category/YourCommand.js';

describe('YourCommand', () => {
    let command;
    let mockContext;

    beforeEach(() => {
        command = new YourCommand();
        mockContext = {
            consoleInterface: {
                showMessage: vi.fn(),
                showError: vi.fn(),
                promptForInput: vi.fn(),
            },
            apiClient: {
                sendMessage: vi.fn().mockResolvedValue('AI response'),
            },
            toolManager: {
                executeTool: vi.fn(),
            },
        };
    });

    describe('execute', () => {
        it('should execute successfully with valid arguments', async () => {
            const result = await command.execute('valid args', mockContext);

            expect(result).toBe('success');
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalled();
        });

        it('should handle missing context dependencies', async () => {
            const incompleteContext = { consoleInterface: mockContext.consoleInterface };

            await expect(command.execute('args', incompleteContext)).rejects.toThrow(
                'Missing required context'
            );
        });
    });

    describe('argument parsing', () => {
        it('should parse simple arguments', () => {
            const result = command.parseArguments('simple arg');
            expect(result.args).toBe('simple arg');
        });

        it('should parse complex arguments with flags', () => {
            const result = command.parseArguments('--flag value positional');
            expect(result.flags.flag).toBe('value');
            expect(result.positional).toContain('positional');
        });
    });
});
```

## Integration Testing Patterns

### Component Integration Tests

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolManager } from '../../src/core/managers/toolManager.js';
import { ConfigManager } from '../../src/core/managers/configManager.js';

describe('Tool Manager Integration', () => {
    let toolManager;
    let configManager;

    beforeEach(async () => {
        configManager = ConfigManager.getInstance();
        await configManager.initialize();

        toolManager = new ToolManager(configManager);
        await toolManager.loadTools();
    });

    it('should load all tools successfully', () => {
        expect(toolManager.getToolsCount()).toBeGreaterThan(0);
        expect(toolManager.getLoadingErrors()).toHaveLength(0);
    });

    it('should execute tools with proper context', async () => {
        const mockConsoleInterface = {
            showToolResult: vi.fn(),
        };

        const result = await toolManager.executeTool(
            { id: 'test', function: { name: 'calculate', arguments: '{"expression": "2+2"}' } },
            mockConsoleInterface
        );

        expect(result.role).toBe('tool');
        expect(result.content).toContain('success');
    });
});
```

### Workflow Integration Tests

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import WorkflowStateMachine from '../../src/workflow/WorkflowStateMachine.js';

describe('Workflow Integration', () => {
    let stateMachine;

    beforeEach(() => {
        stateMachine = new WorkflowStateMachine();
    });

    it('should load and execute simple workflow', async () => {
        await stateMachine.loadWorkflow('./tests/fixtures/simple-workflow.json');

        const result = await stateMachine.executeWorkflow({
            user_input: 'test input',
        });

        expect(result.success).toBe(true);
        expect(result.workflow_name).toBe('simple_test');
    });

    it('should handle workflow errors gracefully', async () => {
        await stateMachine.loadWorkflow('./tests/fixtures/error-workflow.json');

        const result = await stateMachine.executeWorkflow({
            invalid_input: 'test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

## End-to-End Testing Patterns

### Full Application E2E Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

describe('End-to-End Application Tests', () => {
    let appProcess;
    let testEnvFile;

    beforeEach(() => {
        // Create test environment file
        testEnvFile = '.env.test';
        writeFileSync(
            testEnvFile,
            `
SYNTHDEV_API_KEY=test-key-12345
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=2
        `
        );
    });

    afterEach(() => {
        if (appProcess) {
            appProcess.kill();
        }
        if (testEnvFile) {
            unlinkSync(testEnvFile);
        }
    });

    it('should start application and respond to commands', async () => {
        return new Promise((resolve, reject) => {
            appProcess = spawn('node', ['src/core/app.js'], {
                env: { ...process.env, NODE_ENV: 'test' },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let output = '';
            appProcess.stdout.on('data', data => {
                output += data.toString();

                if (output.includes('💭 You:')) {
                    // Send help command
                    appProcess.stdin.write('/help\n');
                }

                if (output.includes('Available Commands')) {
                    // Send exit command
                    appProcess.stdin.write('/exit\n');
                }
            });

            appProcess.on('close', code => {
                expect(output).toContain('Synth-Dev Console Application Started');
                expect(output).toContain('Available Commands');
                expect(code).toBe(0);
                resolve();
            });

            appProcess.on('error', reject);

            setTimeout(() => reject(new Error('Test timeout')), 10000);
        });
    });
});
```

### Workflow E2E Tests

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import WorkflowStateMachine from '../../src/workflow/WorkflowStateMachine.js';

describe('Workflow E2E Tests', () => {
    let stateMachine;
    let mockHttpResponses;

    beforeEach(() => {
        // Load mock HTTP responses from logs
        mockHttpResponses = JSON.parse(
            readFileSync('./tests/e2e/fixtures/workflow-responses.json', 'utf8')
        );

        // Mock HTTP client
        vi.mock('openai', () => ({
            OpenAI: vi.fn().mockImplementation(() => ({
                chat: {
                    completions: {
                        create: vi.fn().mockImplementation(request => {
                            // Find matching mock response
                            const response = mockHttpResponses.find(
                                r =>
                                    r.request.model === request.model &&
                                    r.request.messages.length === request.messages.length
                            );
                            return Promise.resolve(response.response);
                        }),
                    },
                },
            })),
        }));

        stateMachine = new WorkflowStateMachine();
    });

    it('should execute grocery store workflow with exact responses', async () => {
        await stateMachine.loadWorkflow('./tests/e2e/fixtures/grocery-store-workflow.json');

        const result = await stateMachine.executeWorkflow({
            shopping_list: 'milk, bread, eggs',
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('Shopping Summary');
        expect(result.states_visited).toEqual(['start', 'analyze', 'summarize', 'stop']);
    });
});
```

## Mocking Strategies

### AI API Client Mocking

```javascript
// Mock OpenAI client for consistent responses
export function createMockAPIClient() {
    return {
        chat: {
            completions: {
                create: vi.fn().mockImplementation(async request => {
                    return {
                        choices: [
                            {
                                message: {
                                    content: 'Mock AI response',
                                    tool_calls: [],
                                },
                            },
                        ],
                        usage: {
                            prompt_tokens: 10,
                            completion_tokens: 5,
                            total_tokens: 15,
                        },
                    };
                }),
            },
        },
    };
}
```

### File System Mocking

```javascript
// Mock file system operations
export function setupFileMocks() {
    const mockFiles = new Map();

    vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockImplementation(async path => {
            if (mockFiles.has(path)) {
                return mockFiles.get(path);
            }
            throw new Error(`File not found: ${path}`);
        }),
        writeFile: vi.fn().mockImplementation(async (path, content) => {
            mockFiles.set(path, content);
        }),
        access: vi.fn().mockImplementation(async path => {
            if (!mockFiles.has(path)) {
                throw new Error(`File not found: ${path}`);
            }
        }),
    }));

    return {
        setFile: (path, content) => mockFiles.set(path, content),
        getFile: path => mockFiles.get(path),
        hasFile: path => mockFiles.has(path),
    };
}
```

### Configuration Mocking

```javascript
// Mock configuration for tests
export function createMockConfig() {
    return {
        getModel: vi.fn().mockReturnValue({
            model: 'gpt-4.1-mini',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
        }),
        getConfig: vi.fn().mockReturnValue({
            global: {
                maxToolCalls: 50,
                verbosityLevel: 2,
            },
        }),
        hasBaseModelConfig: vi.fn().mockReturnValue(true),
    };
}
```

## Test Data Management

### Fixtures Organization

```javascript
// tests/helpers/testFixtures.js
export const testFixtures = {
    workflows: {
        simple: {
            workflow_name: 'test_workflow',
            description: 'Simple test workflow',
            input: { name: 'test_input', type: 'string' },
            output: { name: 'test_output', type: 'string' },
            contexts: [{ name: 'test_context', starting_messages: [] }],
            agents: [{ agent_role: 'coder', context: 'test_context' }],
            states: [
                { name: 'start', agent: 'coder', message: 'Test message', next_state: 'stop' },
                { name: 'stop' },
            ],
        },
    },

    apiResponses: {
        success: {
            choices: [{ message: { content: 'Success response' } }],
            usage: { total_tokens: 15 },
        },
        error: {
            error: { message: 'API Error' },
        },
    },

    toolResults: {
        success: {
            success: true,
            result: 'Tool executed successfully',
            timestamp: '2024-01-01T00:00:00.000Z',
        },
        error: {
            success: false,
            error: 'Tool execution failed',
            timestamp: '2024-01-01T00:00:00.000Z',
        },
    },
};
```

## Test Execution Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npx vitest run tests/unit/tools/calculate.test.js
```

### Test Debugging

```bash
# Run with verbose output
npx vitest run --reporter=verbose

# Debug specific test
npx vitest run --inspect-brk tests/unit/specific.test.js

# Run with environment variables
SYNTHDEV_VERBOSITY_LEVEL=5 npm test
```

## Best Practices

### Test Organization

- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused and independent

### Mocking Strategy

- Mock external dependencies at the boundary
- Use real implementations for internal components
- Mock HTTP requests for E2E tests
- Avoid over-mocking that hides real issues

### Test Data

- Use fixtures for complex test data
- Generate test data programmatically when possible
- Keep test data minimal and focused
- Use realistic data that matches production scenarios

### Error Testing

- Test both success and failure scenarios
- Verify error messages and types
- Test edge cases and boundary conditions
- Ensure proper cleanup after errors

## Consequences

### Positive

- Comprehensive test coverage across all layers
- Consistent testing patterns and practices
- Reliable mocking strategies
- Clear test organization and execution
- Confidence in code changes and refactoring

### Negative

- Additional development time for test creation
- Complexity in maintaining mocks and fixtures
- Potential for tests to become brittle
- Need for ongoing test maintenance

---

_This ADR establishes the testing standards and patterns for SynthDev. Follow these guidelines to ensure reliable, maintainable tests._
