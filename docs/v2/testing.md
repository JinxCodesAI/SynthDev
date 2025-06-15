# Testing Guide

This guide provides comprehensive instructions for testing SynthDev, including unit tests, integration tests, and end-to-end workflow testing.

## Testing Overview

SynthDev uses a modern testing stack with:

- **Vitest**: Fast testing framework with ES modules support
- **Coverage**: V8 provider with HTML, JSON, and text reporting
- **Mocking**: Comprehensive mock system for external dependencies
- **E2E Testing**: End-to-end workflow validation

## Test Structure

```
tests/
├── unit/
│   ├── core/                    # Core module tests
│   │   ├── toolManager.test.js
│   │   ├── aiAPIClient.test.js
│   │   ├── configManager.test.js
│   │   └── logger.test.js
│   ├── commands/                # Command system tests
│   │   ├── commandRegistry.test.js
│   │   └── helpCommand.test.js
│   └── tools/                   # Tool implementation tests
│       ├── baseTool.test.js
│       ├── readFile.test.js
│       └── writeFile.test.js
├── e2e/                         # End-to-end tests
│   ├── fixtures/                # Test configuration files
│   └── workflow.test.js
└── mocks/                       # Mock implementations
    ├── consoleInterface.js
    └── openai.js
```

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run tests/unit/core/toolManager.test.js

# Run tests in watch mode
npx vitest watch

# Run with verbose output
npx vitest run --reporter=verbose
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

## Unit Testing

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YourModule } from '../src/yourModule.js';

describe('YourModule', () => {
    let module;

    beforeEach(() => {
        module = new YourModule();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should perform basic operation', () => {
        const result = module.basicOperation('input');
        expect(result).toBe('expected_output');
    });

    it('should handle errors gracefully', () => {
        expect(() => module.errorOperation()).toThrow('Expected error');
    });
});
```

### Testing Tools

```javascript
import { describe, it, expect, vi } from 'vitest';
import toolImplementation from '../tools/your_tool/implementation.js';

describe('Your Tool', () => {
    it('should validate required parameters', async () => {
        const result = await toolImplementation({});
        expect(result.success).toBe(false);
        expect(result.error).toContain('required');
    });

    it('should process valid input', async () => {
        const result = await toolImplementation({
            required_param: 'valid_value',
        });
        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();
    });

    it('should handle file system errors', async () => {
        // Mock file system to throw error
        vi.mock('fs', () => ({
            readFileSync: vi.fn().mockImplementation(() => {
                throw new Error('File not found');
            }),
        }));

        const result = await toolImplementation({
            file_path: 'nonexistent.txt',
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('File not found');
    });
});
```

### Testing Commands

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourCommand } from '../commands/your-command.js';

describe('YourCommand', () => {
    let command;
    let mockContext;

    beforeEach(() => {
        command = new YourCommand();
        mockContext = {
            apiClient: vi.fn(),
            consoleInterface: {
                displayMessage: vi.fn(),
                promptForInput: vi.fn(),
            },
        };
    });

    it('should execute successfully with valid context', async () => {
        const result = await command.implementation([], mockContext);
        expect(result).toBe(true);
        expect(mockContext.consoleInterface.displayMessage).toHaveBeenCalled();
    });
});
```

## Integration Testing

### Testing Component Interactions

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ToolManager from '../toolManager.js';
import ConfigManager from '../configManager.js';

describe('ToolManager Integration', () => {
    let toolManager;
    let configManager;

    beforeEach(async () => {
        configManager = ConfigManager.getInstance();
        await configManager.initialize();
        toolManager = new ToolManager();
    });

    it('should load tools and execute them', async () => {
        await toolManager.loadTools();
        const tools = toolManager.getAvailableTools();
        expect(tools.length).toBeGreaterThan(0);

        const result = await toolManager.executeTool('read_file', {
            file_path: 'package.json',
        });
        expect(result.success).toBe(true);
    });
});
```

## End-to-End Testing

### E2E Test Structure

E2E tests validate complete workflow execution with realistic HTTP interactions:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorkflowStateMachine from '../../workflow/WorkflowStateMachine.js';
import { workflowHttpMocks } from '../mocks/workflow-http.js';

describe('Workflow E2E Test', () => {
    let stateMachine;
    let originalEnv;

    beforeEach(async () => {
        // Setup environment variables
        originalEnv = process.env;
        process.env.MODEL = 'gpt-4.1-nano';
        process.env.API_KEY = 'test-key';

        // Setup HTTP mocking
        await setupHttpMocking();

        // Initialize state machine
        stateMachine = new WorkflowStateMachine(/* dependencies */);
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.resetAllMocks();
    });

    it('should execute workflow with expected output', async () => {
        const workflowPath = 'config/workflows/test_workflow.json';
        await stateMachine.loadWorkflow(workflowPath);

        const result = await stateMachine.executeWorkflow('test_workflow', 'Test input');

        expect(result.success).toBe(true);
        expect(result.output).toBe('Expected output');
        expect(result.final_state).toBe('stop');
    });
});
```

### Creating E2E Tests

1. **Create Workflow Configuration**: Define workflow in `tests/e2e/fixtures/`
2. **Create HTTP Mocks**: Capture real API responses in `tests/mocks/`
3. **Write Test File**: Create test in `tests/e2e/`
4. **Setup File Mocks**: Mock configuration files
5. **Verify Results**: Check workflow execution and outputs

### HTTP Mock Example

```javascript
// tests/mocks/workflow-http.js
const httpResponses = [
    {
        id: 'chatcmpl-example',
        object: 'chat.completion',
        choices: [
            {
                message: {
                    role: 'assistant',
                    content: 'Expected response content',
                },
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        },
    },
];

export const workflowHttpMocks = {
    createOpenAIMock() {
        let callCount = 0;
        return async function mockCreate(requestData) {
            const response = httpResponses[callCount];
            callCount++;
            return response;
        };
    },
};
```

## Mocking Strategies

### File System Mocking

```javascript
import { vi } from 'vitest';

// Mock fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        existsSync: vi.fn(),
    };
});

// Setup mock behavior
import { readFileSync } from 'fs';
vi.mocked(readFileSync).mockReturnValue('mocked file content');
```

### API Mocking

```javascript
// Mock OpenAI client
vi.mock('openai', () => ({
    OpenAI: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Mocked response' } }],
                }),
            },
        },
    })),
}));
```

### Environment Mocking

```javascript
beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = 'test-key';
});

afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
});
```

## Test Quality Guidelines

### Test Organization

1. **Descriptive Names**: Use clear, descriptive test names
2. **Logical Grouping**: Group related tests in describe blocks
3. **Setup/Teardown**: Use beforeEach/afterEach for consistent state
4. **Isolation**: Each test should be independent

### Assertion Best Practices

```javascript
// Good: Specific assertions
expect(result.success).toBe(true);
expect(result.data).toHaveLength(3);
expect(result.message).toContain('success');

// Avoid: Vague assertions
expect(result).toBeTruthy();
expect(result.data).toBeDefined();
```

### Error Testing

```javascript
// Test error conditions
it('should handle invalid input', async () => {
    const result = await tool.execute({ invalid: 'input' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/validation failed/i);
});

// Test exception handling
it('should handle exceptions gracefully', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
    });

    const result = await tool.execute({ file_path: 'test.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
});
```

## Coverage Goals

### Target Coverage Metrics

- **Overall Coverage**: 70%+ lines
- **Branch Coverage**: 80%+ branches
- **Function Coverage**: 90%+ functions
- **Core Modules**: 90%+ coverage for critical components

### Coverage Analysis

```bash
# Generate detailed coverage report
npm run test:coverage

# View coverage by file
npx vitest run --coverage --reporter=verbose

# Check coverage thresholds
npx vitest run --coverage --reporter=json
```

## Debugging Tests

### Debug Strategies

1. **Console Logging**: Add temporary console.log statements
2. **Debugger**: Use `debugger;` statements with Node.js inspector
3. **Verbose Output**: Run tests with `--reporter=verbose`
4. **Isolation**: Run single test files to isolate issues

### Common Issues

#### Mock Not Working

```javascript
// Ensure mock is setup before import
vi.mock('module-name');
import { moduleFunction } from 'module-name';
```

#### Async Test Issues

```javascript
// Always await async operations
it('should handle async operation', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
});
```

#### Environment Conflicts

```javascript
// Always restore environment
afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
});
```

## Continuous Integration

### GitHub Actions Integration

Tests run automatically on:

- Push to main branch
- Pull requests
- Scheduled runs

### Quality Gates

- All tests must pass
- Coverage thresholds must be met
- ESLint checks must pass
- Security audit must pass

---

_For tool-specific testing patterns, see [Tool Development](tool-development.md)_
_For configuration testing, see [Configuration Guide](configuration.md)_
