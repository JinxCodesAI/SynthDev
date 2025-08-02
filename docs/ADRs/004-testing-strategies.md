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
│   ├── assertionHelpers.js     # Custom assertion helpers
│   └── envTestHelper.js        # Environment management for tests
├── mocks/                      # Mock implementations
│   ├── mockAPIClient.js        # AI API client mocks
│   ├── mockFileSystem.js       # File system mocks
│   └── mockConsoleInterface.js # Console interface mocks
├── unit/                       # Unit tests
│   ├── commands/               # Command unit tests
│   ├── core/                   # Core component tests
│   ├── tools/                  # Tool unit tests
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

### Agents Integration Tests

TODO: Describe tests for agent spawning, communication, and tool execution

## End-to-End Testing Patterns

### Full Application E2E Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { createTestProcessEnv } from '../helpers/envTestHelper.js';

describe('End-to-End Application Tests', () => {
    let appProcess;

    beforeEach(() => {
        // No file manipulation needed - use process environment
    });

    afterEach(async () => {
        if (appProcess && !appProcess.killed) {
            try {
                // Graceful termination
                appProcess.kill('SIGTERM');
                await new Promise(resolve => setTimeout(resolve, 500));

                // Force kill if still running
                if (!appProcess.killed) {
                    appProcess.kill('SIGKILL');
                }
            } catch (error) {
                // Process might already be dead
            }
            appProcess = null;
        }
    });

    it('should start application and respond to commands', async () => {
        return new Promise((resolve, reject) => {
            appProcess = spawn('node', ['src/core/app.js'], {
                env: createTestProcessEnv({
                    SYNTHDEV_API_KEY: 'test-key-12345',
                    SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
                    SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
                    SYNTHDEV_VERBOSITY_LEVEL: '2',
                }),
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

## Environment Management for Tests

### Environment Test Helper

To prevent `.env` file corruption during testing, use the `EnvTestHelper` class for safe environment management:

```javascript
import { setupTestEnv, createTestProcessEnv } from '../helpers/envTestHelper.js';

describe('Component requiring environment variables', () => {
    let cleanupTestEnv;

    beforeEach(() => {
        // Option 1: File-based override (creates backup, restores after)
        cleanupTestEnv = setupTestEnv({
            SYNTHDEV_API_KEY: 'test-key-12345',
            SYNTHDEV_BASE_MODEL: 'gpt-4.1-mini',
            SYNTHDEV_VERBOSITY_LEVEL: '2',
        });
    });

    afterEach(() => {
        // Always cleanup to restore original .env
        if (cleanupTestEnv) {
            cleanupTestEnv();
            cleanupTestEnv = null;
        }
    });

    it('should use test environment', () => {
        // Test runs with overridden environment
        expect(process.env.SYNTHDEV_API_KEY).toBe('test-key-12345');
    });
});
```

### Process Environment Approach (Preferred)

For tests that spawn processes, use the safer environment variable approach:

```javascript
import { createTestProcessEnv } from '../helpers/envTestHelper.js';
import { spawn } from 'child_process';

describe('E2E Application Tests', () => {
    it('should run with test environment', async () => {
        const appProcess = spawn('node', ['src/core/app.js'], {
            env: createTestProcessEnv({
                SYNTHDEV_API_KEY: 'test-key-12345',
                SYNTHDEV_VERBOSITY_LEVEL: '2',
            }),
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Test process runs with test environment without touching .env file
    });
});
```

### Environment Testing Best Practices

**✅ DO:**

- Use `createTestProcessEnv()` for spawned processes (safer)
- Use `setupTestEnv()` for file-based testing (operates in temp directory)
- Always call cleanup functions in `afterEach`
- Register cleanup handlers for process exit scenarios
- All environment tests now operate in temporary directories by default

**❌ DON'T:**

- Directly overwrite `.env` files in tests
- Forget to restore original environment after tests
- Use hardcoded environment values in production code
- Skip cleanup in test teardown
- Use `createProjectEnvHelper()` unless absolutely necessary for E2E tests

### Emergency Cleanup

The `EnvTestHelper` includes automatic cleanup handlers for process exit scenarios:

```javascript
// Automatic cleanup is registered for:
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', cleanup);
process.on('unhandledRejection', cleanup);
```

This ensures `.env` files are restored even if tests crash or are interrupted.

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

### Configuration Fixtures

Configuration fixtures provide controlled, predictable configurations for different test scenarios. They should be used to ensure tests are deterministic and don't depend on external state.

#### Auto-Snapshot Configuration Fixtures

Configuration fixtures are stored in `tests/e2e/fixtures/` and provide different configuration scenarios for reliable testing:

- **`auto-snapshot-enabled.json`**: Full auto-snapshot functionality enabled - for testing snapshot creation, tool execution triggers, and initial snapshots
- **`auto-snapshot-disabled.json`**: All auto-snapshot features disabled - for testing that functionality is properly disabled when configured off
- **`auto-snapshot-manual-only.json`**: Only manual snapshots enabled - for testing manual snapshot creation without automatic triggers

#### Fixture Management System

The `ConfigFixtures` class (`tests/helpers/configFixtures.js`) provides:

- **Dynamic Configuration Loading**: Load different fixture configurations at runtime
- **Mock Configuration Managers**: Create mock configuration managers that use fixture data
- **Proper Cleanup**: Restore original configurations after tests complete
- **Configuration Isolation**: Ensure tests don't interfere with each other's configurations

#### Usage Guidelines

1. **Isolation**: Each test should use its own fixture or properly clean up shared fixtures
2. **Naming**: Fixtures should have descriptive names indicating their purpose (e.g., `auto-snapshot-disabled.json`)
3. **Documentation**: Complex fixtures should include a `description` field explaining their purpose
4. **Versioning**: When fixtures change, ensure backward compatibility or update all dependent tests
5. **Configuration Testing**: Tests should use fixtures instead of live configuration files to ensure reliability

#### Example Usage

```javascript
import { ConfigFixtures } from '../helpers/configFixtures.js';

describe('Configuration-dependent Tests', () => {
    let configFixtures;
    let mockConfigManager;
    let cleanupFixture;

    beforeEach(() => {
        // Initialize fixture system
        configFixtures = new ConfigFixtures();

        // Use disabled configuration for testing
        mockConfigManager = configFixtures.createMockConfigManager(
            ConfigFixtures.FIXTURES.AUTO_SNAPSHOT_DISABLED
        );
    });

    afterEach(() => {
        // Clean up fixtures
        if (cleanupFixture) {
            cleanupFixture();
            cleanupFixture = null;
        }
        if (configFixtures) {
            configFixtures.restoreAll();
        }
    });

    it('should work with disabled auto-snapshot configuration', async () => {
        // Apply configuration and test
        const manager = new AutoSnapshotManager(toolManager);
        const disabledConfig = configFixtures.loadFixture(
            ConfigFixtures.FIXTURES.AUTO_SNAPSHOT_DISABLED
        );
        manager.updateConfiguration(disabledConfig);

        await manager.initialize();

        // Test that no automatic snapshots are created
        const snapshots = await manager.snapshotManager.listSnapshots();
        expect(snapshots.length).toBe(0);
    });
});
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

### Test Isolation and Sequential Execution

**CRITICAL**: E2E tests and integration tests that spawn processes or modify shared resources MUST run sequentially to prevent interference.

#### When to Use Sequential Execution

**✅ ALWAYS use `describe.sequential()` for:**

- E2E tests that spawn application processes
- Tests that modify the file system (especially .env files)
- Tests that use shared resources (ports, temporary directories)
- Tests that modify global state or environment variables
- Integration tests that interact with external systems

**❌ NEVER run these tests in parallel:**

```javascript
// BAD - Will cause race conditions and timeouts
describe('E2E Tests', () => {
    it('should start app and test command 1', async () => {
        // Spawns process on same port/resources
    });

    it('should start app and test command 2', async () => {
        // Conflicts with first test
    });
});
```

**✅ ALWAYS use sequential execution:**

```javascript
// GOOD - Prevents conflicts and timeouts
describe.sequential('E2E Tests', { retry: 2 }, () => {
    let appProcess;

    afterEach(async () => {
        // Proper cleanup between tests
        if (appProcess && !appProcess.killed) {
            appProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!appProcess.killed) {
                appProcess.kill('SIGKILL');
            }
        }

        // Wait for system to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should test command 1', async () => {
        // Test runs in isolation
    });

    it('should test command 2', async () => {
        // Runs after first test completes
    });
});
```

#### Timeout Configuration

**E2E tests require longer timeouts** due to process spawning and I/O operations:

```javascript
// Configure appropriate timeouts for different test types
describe.sequential('E2E Tests', { retry: 2 }, () => {
    let testTimeout;

    beforeEach(() => {
        // Adjust timeout based on environment
        testTimeout = process.env.CI ? 45000 : 30000;
    });

    it('should complete within timeout', async () => {
        // Test implementation
    }, 60000); // Individual test timeout
});
```

#### Process Cleanup Best Practices

**CRITICAL**: Always clean up spawned processes to prevent zombie processes and port conflicts:

```javascript
afterEach(async () => {
    if (appProcess && !appProcess.killed) {
        try {
            // 1. Graceful termination first
            appProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 500));

            // 2. Force kill if still running
            if (!appProcess.killed) {
                appProcess.kill('SIGKILL');
            }
        } catch (error) {
            // Process might already be dead
        }
        appProcess = null;
    }

    // 3. Wait for system stabilization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Clean up state files
    const stateFiles = [
        '.synthdev-initial-snapshot',
        '.synthdev-config-cache',
        '.synthdev-session',
    ];

    for (const file of stateFiles) {
        if (existsSync(file)) {
            try {
                unlinkSync(file);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }
});
```

#### File System Test Isolation

**CRITICAL**: Tests that modify files must not interfere with each other:

```javascript
// Use temporary directories for file operations
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe.sequential('File System Tests', () => {
    let tempDir;

    beforeEach(() => {
        // Create unique temp directory for each test
        tempDir = mkdtempSync(join(tmpdir(), 'test-'));
    });

    afterEach(() => {
        // Clean up temp directory
        if (tempDir && existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
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

### Environment Safety

**CRITICAL**: All environment tests now operate in temporary directories by default to prevent any risk of modifying the real `.env` file.

**❌ NEVER do this:**

```javascript
// BAD - Can permanently corrupt .env file
beforeEach(() => {
    writeFileSync('.env', 'SYNTHDEV_API_KEY=test-key-12345\n');
});

afterEach(() => {
    // If this fails, .env is corrupted!
    unlinkSync('.env');
});
```

**✅ ALWAYS use the environment helper (now safe by default):**

```javascript
// GOOD - Operates in temporary directory with automatic cleanup
import { setupTestEnv, createTestProcessEnv } from '../helpers/envTestHelper.js';

describe('My Test', () => {
    let cleanupTestEnv;

    beforeEach(() => {
        // This now operates in a temporary directory - completely safe
        cleanupTestEnv = setupTestEnv({
            SYNTHDEV_API_KEY: 'test-key-12345',
        });
    });

    afterEach(() => {
        if (cleanupTestEnv) {
            cleanupTestEnv();
        }
    });

    // Or use process environment for spawned processes (also safe)
    it('should spawn process with test env', () => {
        const appProcess = spawn('node', ['app.js'], {
            env: createTestProcessEnv({ SYNTHDEV_API_KEY: 'test-key' }),
        });
    });
});
```

### Common Test Failure Prevention

#### Preventing Timeout Failures

**E2E tests commonly fail due to timeouts.** Follow these practices:

**✅ Use appropriate timeouts:**

```javascript
describe.sequential('E2E Tests', { retry: 2 }, () => {
    let testTimeout;

    beforeEach(() => {
        // Longer timeouts for CI environments
        testTimeout = process.env.CI ? 45000 : 30000;
    });

    it('should complete within reasonable time', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout - specific operation'));
            }, testTimeout);

            // Your test logic here

            // Always clear timeout
            clearTimeout(timeout);
            resolve();
        });
    }, 60000); // Individual test timeout
});
```

**✅ Wait for proper application startup:**

```javascript
// Wait for specific startup indicators
await waitForOutput('💭 You:', 15000);

// Add delays for process stabilization
setTimeout(() => {
    if (appProcess && appProcess.stdin) {
        appProcess.stdin.write('/help\n');
    }
}, 500); // Allow process to fully initialize
```

**✅ Implement robust output waiting:**

```javascript
function waitForOutput(expectedText, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkOutput = () => {
            if (testOutput.includes(expectedText)) {
                resolve(true);
            } else if (Date.now() - startTime > timeout) {
                // Provide detailed error information
                reject(
                    new Error(
                        `Timeout waiting for: "${expectedText}"\n` +
                            `Current output: "${testOutput.slice(-200)}"\n` +
                            `Process killed: ${appProcess?.killed}\n` +
                            `Process PID: ${appProcess?.pid}`
                    )
                );
            } else {
                setTimeout(checkOutput, 100);
            }
        };

        checkOutput();
    });
}
```

#### Preventing Environment File Errors

**Tests fail when .env.test files are missing.** Handle this properly:

**✅ Check for file existence before operations:**

```javascript
import { existsSync } from 'fs';

// In envTestHelper.js - handle missing files gracefully
setupTestEnv(envConfig) {
    try {
        // Create backup only if original exists
        if (existsSync(this.originalEnvPath) && !this.isBackupCreated) {
            const originalContent = readFileSync(this.originalEnvPath, 'utf8');
            writeFileSync(this.backupEnvPath, originalContent);
            this.isBackupCreated = true;
        }

        // Create test environment content
        const testEnvContent = this.createEnvContent(envConfig);

        // Write to test file first (for debugging)
        writeFileSync(this.testEnvPath, testEnvContent);

        // Then overwrite main .env
        writeFileSync(this.originalEnvPath, testEnvContent);

        this.isTestActive = true;
        return () => this.cleanup();
    } catch (error) {
        console.error('Failed to setup test environment:', error);
        this.forceRestore();
        throw error;
    }
}
```

**✅ Prefer process environment over file manipulation:**

```javascript
// PREFERRED - No file system interaction
const appProcess = spawn('node', ['src/core/app.js'], {
    env: createTestProcessEnv({
        SYNTHDEV_API_KEY: 'test-key-12345',
        SYNTHDEV_VERBOSITY_LEVEL: '2',
    }),
    stdio: ['pipe', 'pipe', 'pipe'],
});
```

#### Preventing Process Conflicts

**Multiple processes can conflict on ports and resources:**

**✅ Use unique identifiers:**

```javascript
// Use process PID or timestamp for unique resources
const uniquePort = 3000 + (process.pid % 1000);
const uniqueDir = `/tmp/test-${Date.now()}-${process.pid}`;
```

**✅ Implement proper process lifecycle:**

```javascript
describe.sequential('Process Tests', () => {
    let appProcess;

    beforeEach(() => {
        // Ensure clean state
        expect(appProcess).toBeUndefined();
    });

    afterEach(async () => {
        if (appProcess && !appProcess.killed) {
            // Graceful shutdown
            appProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Force kill if needed
            if (!appProcess.killed) {
                appProcess.kill('SIGKILL');
            }
        }
        appProcess = null;

        // System stabilization
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
});
```

### Cross-Platform Testing

**CRITICAL**: All tests must work consistently across Windows, macOS, and Linux.

#### File Path Handling

**❌ NEVER use hardcoded path separators:**

```javascript
// BAD - Will fail on Windows
expect(fileData.files['docs/.gitkeep'].content).toBe('');
expect(fileData.files['src/components/.gitkeep'].content).toBe('');
```

**✅ ALWAYS use path.join() for dynamic paths:**

```javascript
// GOOD - Works on all platforms
import { join } from 'path';

const docsGitkeepPath = join('docs', '.gitkeep');
const srcComponentsGitkeepPath = join('src', 'components', '.gitkeep');

expect(fileData.files[docsGitkeepPath].content).toBe('');
expect(fileData.files[srcComponentsGitkeepPath].content).toBe('');
```

#### File System Operations

**✅ ALWAYS use Node.js path utilities:**

```javascript
import { join, resolve, relative, dirname, basename } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

// Create cross-platform directory structure
mkdirSync(join(testDir, 'docs', 'api'), { recursive: true });
writeFileSync(join(testDir, 'docs', '.gitkeep'), '');

// Generate cross-platform paths for assertions
const expectedPath = join('docs', '.gitkeep');
expect(fileData.files[expectedPath]).toBeDefined();
```

#### Production Code Path Handling

**❌ NEVER use hardcoded relative paths in production code:**

```javascript
// BAD - Will fail on Windows
const configPath = join(__dirname, '../../config/file.json');
const envPath = join(__dirname, '/../../../.env');
```

**✅ ALWAYS break down path components:**

```javascript
// GOOD - Works on all platforms
const configPath = join(__dirname, '..', '..', 'config', 'file.json');
const envPath = join(__dirname, '..', '..', '..', '.env');
```

#### Path Normalization in Tests

**✅ For file system tests, normalize paths before comparison:**

```javascript
import { normalize } from 'path';

// When comparing paths from different sources
const actualPath = normalize(result.filePath);
const expectedPath = normalize(join('expected', 'path.txt'));
expect(actualPath).toBe(expectedPath);
```

#### Test Data Paths

**✅ Use relative paths in test data, not absolute:**

```javascript
// Test configuration data - these are just strings for pattern matching
const testCases = [
    { path: 'src/main.js', expected: false, reason: 'Source files' },
    { path: 'docs/guide.md', expected: false, reason: 'Documentation' },
    // These are fine as they're just test patterns, not file operations
];
```

#### Environment-Specific Considerations

- **Line endings**: Use `\n` in tests, let Git handle conversion
- **Case sensitivity**: Assume case-sensitive file systems in tests
- **Path length**: Keep test paths reasonably short for Windows compatibility
- **Special characters**: Avoid special characters in test file names

#### Validation Checklist

Before committing code that involves file operations:

**For Tests:**

- [ ] All file paths use `path.join()` or similar utilities
- [ ] No hardcoded `/` or `\` path separators in file operations
- [ ] Test runs successfully on both Windows and Unix-like systems
- [ ] File assertions use dynamically generated paths
- [ ] Temporary directories are properly cleaned up

**For Production Code:**

- [ ] All relative paths use separate path components in `join()`
- [ ] No hardcoded paths like `'../../config/file.json'`
- [ ] Configuration loading uses proper path utilities
- [ ] File system operations are cross-platform compatible

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
