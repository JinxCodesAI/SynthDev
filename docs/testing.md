# SynthDev Testing Guide

This guide covers SynthDev's comprehensive testing strategy, including unit tests, integration tests, end-to-end tests, and best practices for maintaining high code quality.

## Testing Philosophy

SynthDev follows a multi-layered testing approach that ensures reliability, maintainability, and confidence in the codebase:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions and data flow
- **End-to-End Tests**: Test complete workflows and user scenarios
- **Mock System**: Comprehensive mocking for external dependencies

## Test Structure

### Directory Organization

```
tests/
├── unit/                   # Unit tests for individual components
│   ├── commands/          # Command tests
│   ├── config/            # Configuration tests
│   ├── core/              # Core component tests
│   ├── tools/             # Tool tests
├── integration/           # Integration tests
│   ├── command-tool/      # Command-tool integration
│   ├── config-loading/    # Configuration loading
├── e2e/                   # End-to-end tests
│   ├── grocery-store-workflow.test.js # Complete workflow tests
│   └── user-scenarios/    # User scenario tests
├── mocks/                 # Mock implementations
│   ├── openai.js         # OpenAI API mocking
│   ├── filesystem.js     # File system mocking
│   └── network.js        # Network request mocking
├── helpers/               # Test utilities
│   ├── testUtils.js      # Common test utilities
│   ├── mockFactory.js    # Mock object factory
│   └── fixtures/         # Test data fixtures
└── setup.js              # Global test setup
```

## Testing Framework

### Core Technologies

- **Jest**: Primary testing framework
- **Supertest**: HTTP testing for API endpoints
- **Sinon**: Mocking and stubbing
- **MSW (Mock Service Worker)**: HTTP request mocking
- **Custom Mocks**: Specialized mocks for AI APIs

### Test Configuration

```javascript
// jest.config.js
export default {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/config/defaults/**'],
    coverageThreshold: {
        global: {
            branches: 40,
            functions: 40,
            lines: 40,
            statements: 40,
        },
    },
    moduleType: 'module',
    transform: {},
};
```

## Unit Testing

### Component Testing Patterns

#### Command Testing

```javascript
// tests/unit/commands/role/RoleCommand.test.js
import RoleCommand from '../../../../src/commands/role/RoleCommand.js';
import { createMockContext } from '../../../helpers/testUtils.js';

describe('RoleCommand', () => {
    let command;
    let mockContext;

    beforeEach(() => {
        command = new RoleCommand();
        mockContext = createMockContext();
    });

    test('should switch to valid role', async () => {
        const args = ['coder'];
        const result = await command.execute(args, mockContext);

        expect(result.success).toBe(true);
        expect(mockContext.currentRole).toBe('coder');
    });

    test('should reject invalid role', async () => {
        const args = ['invalid_role'];
        const result = await command.execute(args, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown role');
    });
});
```

#### Tool Testing

```javascript
// tests/unit/tools/read_file.test.js
import ReadFileTool from '../../../src/tools/read_file/implementation.js';
import fs from 'fs/promises';

jest.mock('fs/promises');

describe('ReadFileTool', () => {
    let tool;

    beforeEach(() => {
        tool = new ReadFileTool();
        jest.clearAllMocks();
    });

    test('should read file successfully', async () => {
        const mockContent = 'file content';
        fs.readFile.mockResolvedValue(mockContent);

        const result = await tool.execute({
            file_path: 'test.txt',
        });

        expect(result.success).toBe(true);
        expect(result.data.content).toBe(mockContent);
    });

    test('should handle file not found', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

        const result = await tool.execute({
            file_path: 'nonexistent.txt',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('no such file');
    });

    test('should validate required parameters', async () => {
        const result = await tool.execute({});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing required parameter');
    });
});
```

#### Configuration Testing

```javascript
// tests/unit/config/configManager.test.js
import ConfigManager from '../../../src/config/managers/configManager.js';

describe('ConfigManager', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
        ConfigManager.resetInstance(); // Reset singleton for testing
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test('should load base model configuration', () => {
        process.env.SYNTHDEV_API_KEY = 'test-key';
        process.env.SYNTHDEV_BASE_MODEL = 'gpt-4';
        process.env.SYNTHDEV_BASE_URL = 'https://api.openai.com/v1';

        const config = ConfigManager.getInstance();
        const baseModel = config.getModel('base');

        expect(baseModel.apiKey).toBe('test-key');
        expect(baseModel.model).toBe('gpt-4');
        expect(baseModel.baseUrl).toBe('https://api.openai.com/v1');
    });

    test('should throw error for missing API key', () => {
        delete process.env.SYNTHDEV_API_KEY;

        expect(() => {
            ConfigManager.getInstance();
        }).toThrow('SYNTHDEV_API_KEY is required');
    });
});
```

## Integration Testing

### Component Integration

```javascript
// tests/integration/command-tool/command-tool-integration.test.js
import CommandHandler from '../../../src/core/interface/commandHandler.js';
import ToolManager from '../../../src/core/managers/toolManager.js';
import { createMockContext } from '../../helpers/testUtils.js';

describe('Command-Tool Integration', () => {
    let commandHandler;
    let toolManager;
    let mockContext;

    beforeEach(async () => {
        toolManager = new ToolManager();
        await toolManager.loadTools();

        commandHandler = new CommandHandler();
        mockContext = createMockContext({ toolManager });
    });

    test('should execute tool through command', async () => {
        const input = 'read_file test.txt';
        const result = await commandHandler.handleCommand(input, mockContext);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });

    test('should handle tool errors gracefully', async () => {
        const input = 'read_file nonexistent.txt';
        const result = await commandHandler.handleCommand(input, mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

### Configuration Loading Integration

```javascript
// tests/integration/config-loading/config-loading.test.js
import ConfigManager from '../../../src/config/managers/configManager.js';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

describe('Configuration Loading Integration', () => {
    test('should load roles from multiple files', async () => {
        const config = ConfigManager.getInstance();
        const systemMessages = new SystemMessages();

        const roles = await systemMessages.loadRoles();

        expect(roles).toHaveProperty('coder');
        expect(roles).toHaveProperty('reviewer');
        expect(roles.coder.systemMessage).toBeDefined();
    });

    test('should merge role configurations correctly', async () => {
        const systemMessages = new SystemMessages();
        const roles = await systemMessages.loadRoles();

        // Should have roles from both core-roles.json and roles.json
        expect(Object.keys(roles).length).toBeGreaterThan(5);
    });
});
```

## End-to-End Testing

TODO: Add end-to-end tests methodology here

## Mock System

### OpenAI API Mocking

```javascript
// tests/mocks/openai.js
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const createOpenAIMock = () => {
    return setupServer(
        http.post('*/chat/completions', async ({ request }) => {
            const body = await request.json();

            // Simulate different responses based on request
            if (body.messages.some(m => m.content.includes('error'))) {
                return HttpResponse.json(
                    { error: { message: 'Simulated API error' } },
                    { status: 400 }
                );
            }

            return HttpResponse.json({
                choices: [
                    {
                        message: {
                            content: 'Mocked AI response',
                            role: 'assistant',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            });
        })
    );
};
```

### File System Mocking

```javascript
// tests/mocks/filesystem.js
import fs from 'fs/promises';

export const mockFileSystem = () => {
    const mockFiles = new Map();

    jest.spyOn(fs, 'readFile').mockImplementation(async path => {
        if (mockFiles.has(path)) {
            return mockFiles.get(path);
        }
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    });

    jest.spyOn(fs, 'writeFile').mockImplementation(async (path, content) => {
        mockFiles.set(path, content);
    });

    return {
        addFile: (path, content) => mockFiles.set(path, content),
        removeFile: path => mockFiles.delete(path),
        clear: () => mockFiles.clear(),
    };
};
```

## Test Utilities

### Common Test Helpers

```javascript
// tests/helpers/testUtils.js
export const createMockContext = (overrides = {}) => {
    return {
        currentRole: 'coder',
        conversation: [],
        toolManager: null,
        configManager: null,
        logger: {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        ...overrides,
    };
};

export const createMockAIResponse = (content, toolCalls = null) => {
    return {
        choices: [
            {
                message: {
                    content,
                    role: 'assistant',
                    tool_calls: toolCalls,
                },
            },
        ],
        usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
        },
    };
};

export const waitFor = (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Timeout waiting for condition'));
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
};
```

### Mock Factory

```javascript
// tests/helpers/mockFactory.js
export class MockFactory {
    static createTool(name, implementation) {
        return {
            name,
            execute: jest.fn().mockImplementation(implementation),
            validateRequiredParams: jest.fn(),
            createSuccessResponse: jest.fn(data => ({ success: true, data })),
            createErrorResponse: jest.fn(error => ({ success: false, error })),
        };
    }

    static createCommand(name, implementation) {
        return {
            name,
            execute: jest.fn().mockImplementation(implementation),
            validateContext: jest.fn(),
            getHelp: jest.fn().mockReturnValue(`Help for ${name}`),
        };
    }

    static createWorkflowConfig(name, states = []) {
        return {
            workflow_name: name,
            description: `Test workflow: ${name}`,
            states,
            agents: [],
            contexts: [],
        };
    }
}
```

## Running Tests

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/commands/role/RoleCommand.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should switch to valid role"
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

## Best Practices

### Test Organization

1. **Descriptive Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern for test structure
3. **Single Responsibility**: Each test should test one specific behavior
4. **Independent Tests**: Tests should not depend on each other
5. **Clean Setup/Teardown**: Properly clean up after tests

### Mocking Strategy

1. **Mock External Dependencies**: Always mock external APIs and services
2. **Use Real Objects When Possible**: Prefer real objects over mocks for internal components
3. **Verify Interactions**: Test that mocks are called with expected parameters
4. **Reset Mocks**: Clear mock state between tests
5. **Realistic Mocks**: Make mocks behave like real implementations

### Coverage Goals

- **Overall Coverage**: Maintain 40%+ coverage across lines, branches, and functions
- **Core Components**: Aim for higher coverage (60%+) for critical components
- **New Code**: All new code should include comprehensive tests
- **Edge Cases**: Test error conditions and edge cases
- **Integration Points**: Focus on testing component interactions

### Performance Testing

1. **Timeout Management**: Set appropriate timeouts for async operations
2. **Resource Cleanup**: Ensure tests clean up resources properly
3. **Parallel Execution**: Design tests to run safely in parallel
4. **Memory Leaks**: Watch for memory leaks in long-running tests
5. **Test Speed**: Keep unit tests fast, allow longer times for integration tests

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: '20'
            - run: npm ci
            - run: npm run test:coverage
            - uses: codecov/codecov-action@v3
              with:
                  file: ./coverage/lcov.info
```

### Quality Gates

- All tests must pass before merging
- Coverage must not decrease below thresholds
- No new linting errors
- All security checks must pass

## Debugging Tests

### Common Issues

1. **Async Test Failures**: Ensure proper async/await usage
2. **Mock Interference**: Check for mock state bleeding between tests
3. **Timing Issues**: Use proper waiting mechanisms for async operations
4. **Environment Differences**: Ensure tests work across different environments
5. **Resource Conflicts**: Avoid conflicts with shared resources

### Debugging Tools

```javascript
// Add debugging to tests
test('debug example', async () => {
    console.log('Debug info:', someVariable);
    debugger; // Use with --inspect-brk flag

    const result = await someAsyncOperation();
    expect(result).toBeDefined();
});
```

---

_For specific testing patterns for tools and workflows, see the respective guides. For CI/CD setup, see the deployment documentation._
