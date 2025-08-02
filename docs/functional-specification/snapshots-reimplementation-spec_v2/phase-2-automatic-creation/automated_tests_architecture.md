# Phase 2: Automated Tests Architecture

## Overview

This document defines the comprehensive testing strategy for Phase 2 of the snapshot system, focusing on automatic snapshot creation, tool-based triggering, and integration with existing systems. The testing approach builds upon Phase 1 foundations while adding new testing dimensions for deterministic tool-based functionality.

## Testing Philosophy

- **Test-Driven Development**: Write tests before implementation
- **Comprehensive Coverage**: >90% code coverage target
- **Integration-Focused**: Emphasis on integration testing for tool-based workflows
- **Performance-Aware**: Performance testing for tool monitoring and file change detection
- **Deterministic-Driven**: Test actual tool execution and file modification scenarios

## Test Structure

### Directory Organization

```
tests/snapshot/
├── phase2/                           # Phase 2 specific tests
│   ├── unit/                        # Unit tests for Phase 2 components
│   │   ├── ToolMonitor.test.js
│   │   ├── FileChangeDetector.test.js
│   │   ├── SnapshotTrigger.test.js
│   │   ├── InitialSnapshotManager.test.js
│   │   ├── ToolManagerIntegration.test.js
│   │   └── ToolExecutionHooks.test.js
│   ├── integration/                 # Integration tests
│   │   ├── automatic-creation.test.js
│   │   ├── toolmanager-integration.test.js
│   │   ├── tool-execution.test.js
│   │   ├── tool-monitoring.test.js
│   │   ├── file-change-detection.test.js
│   │   └── configuration.test.js
│   ├── e2e/                        # End-to-end workflow tests
│   │   ├── automatic-workflows.test.js
│   │   ├── tool-based-scenarios.test.js
│   │   ├── performance.test.js
│   │   └── error-handling.test.js
│   └── fixtures/                   # Test data and scenarios
│       ├── tools/
│       │   ├── modifying-tools.json
│       │   ├── readonly-tools.json
│       │   └── conditional-tools.json
│       ├── mock-tools/
│       ├── test-projects/
│       └── file-states/
└── helpers/                        # Enhanced test utilities
    ├── tool-helpers.js
    ├── file-change-helpers.js
    └── integration-helpers.js
```

## Unit Tests

### ToolMonitor Tests

**File**: `tests/snapshot/phase2/unit/ToolMonitor.test.js`

**Test Categories**:

#### Basic Tool Classification

```javascript
describe('ToolMonitor', () => {
    describe('basic tool classification', () => {
        it('should classify file modification tools correctly');
        it('should classify read-only tools correctly');
        it('should classify conditional tools correctly');
        it('should handle unknown tools gracefully');
        it('should return deterministic results');
    });

    describe('tool categorization', () => {
        it('should identify write_file as modifying');
        it('should identify edit_file as modifying');
        it('should identify read_file as read-only');
        it('should identify list_directory as read-only');
        it('should handle custom tool rules');
    });

    describe('file target analysis', () => {
        it('should extract file targets from tool arguments');
        it('should predict file modifications from tool args');
        it('should handle missing file arguments gracefully');
        it('should validate file path arguments');
    });
});
```

#### Advanced Tool Analysis

```javascript
describe('advanced tool analysis', () => {
    it('should handle execute_terminal conditionally');
    it('should analyze execute_script for file operations');
    it('should handle tools with multiple file targets');
    it('should support custom tool classification rules');
    it('should handle tool argument validation');
});
```

#### Configuration and Performance

```javascript
describe('configuration and performance', () => {
    it('should load tool classifications from config');
    it('should classify tools within 1ms');
    it('should cache tool classification results');
    it('should handle configuration updates');
    it('should validate tool configuration');
});
```

### FileChangeDetector Tests

**File**: `tests/snapshot/phase2/unit/FileChangeDetector.test.js`

**Test Categories**:

#### File State Management

```javascript
describe('FileChangeDetector', () => {
    describe('file state capture', () => {
        it('should capture file modification times');
        it('should capture file checksums');
        it('should create file state snapshots');
        it('should handle large directories efficiently');
        it('should handle missing files gracefully');
    });

    describe('change detection', () => {
        it('should detect file modifications');
        it('should detect file creations');
        it('should detect file deletions');
        it('should detect file moves');
        it('should ignore timestamp-only changes');
    });

    describe('state comparison', () => {
        it('should compare before/after states');
        it('should identify modified files');
        it('should calculate change significance');
        it('should handle file permission changes');
        it('should validate actual content changes');
    });
});
```

### SnapshotTrigger Tests

**File**: `tests/snapshot/phase2/unit/SnapshotTrigger.test.js`

**Test Categories**:

#### Trigger Logic

```javascript
describe('SnapshotTrigger', () => {
    describe('trigger logic', () => {
        it('should trigger on file-modifying tools');
        it('should skip read-only tools');
        it('should handle conditional tools');
        it('should handle trigger cooldowns');
        it('should respect rate limits');
    });

    describe('snapshot creation', () => {
        it('should create snapshots with tool-based descriptions');
        it('should include tool execution metadata');
        it('should handle creation failures gracefully');
        it('should coordinate with SnapshotManager');
    });

    describe('configuration', () => {
        it('should apply trigger configuration');
        it('should handle configuration updates');
        it('should validate trigger rules');
        it('should fallback to defaults on errors');
    });
});
```

### InitialSnapshotManager Tests

**File**: `tests/snapshot/phase2/unit/InitialSnapshotManager.test.js`

**Test Categories**:

#### Initial Snapshot Creation

```javascript
describe('InitialSnapshotManager', () => {
    describe('initial snapshot logic', () => {
        it('should create initial snapshot on first run');
        it('should skip creation if initial snapshot exists');
        it('should handle application startup integration');
        it('should generate appropriate descriptions');
        it('should include startup metadata');
    });

    describe('first run detection', () => {
        it('should detect first run correctly');
        it('should handle missing snapshot directory');
        it('should validate existing snapshots');
        it('should handle corrupted initial snapshots');
    });

    describe('configuration', () => {
        it('should apply initial snapshot configuration');
        it('should handle configuration timeouts');
        it('should validate snapshot creation settings');
        it('should handle configuration errors');
    });
});
```

### ToolExecutionHooks Tests

**File**: `tests/snapshot/phase2/unit/ToolExecutionHooks.test.js`

**Test Categories**:

#### Hook Management

```javascript
describe('ToolExecutionHooks', () => {
    describe('hook registration', () => {
        it('should register with ToolManager');
        it('should handle multiple tool types');
        it('should provide selective hook registration');
        it('should handle hook conflicts');
    });

    describe('file modification detection', () => {
        it('should detect file modifications by tools');
        it('should track file changes before/after');
        it('should handle file permission changes');
        it('should detect directory structure changes');
    });

    describe('backup coordination', () => {
        it('should coordinate pre-execution backups');
        it('should validate backup necessity');
        it('should handle backup failures');
        it('should clean up unnecessary backups');
    });
});
```

## Integration Tests

### Automatic Snapshot Creation

**File**: `tests/snapshot/phase2/integration/automatic-creation.test.js`

**Test Scenarios**:

```javascript
describe('Automatic Snapshot Creation Integration', () => {
    describe('end-to-end workflow', () => {
        it('should create snapshot for file-modifying tool');
        it('should skip snapshot for read-only tool');
        it('should handle tool classification errors');
        it('should coordinate with existing manual snapshots');
    });

    describe('tool execution flow', () => {
        it('should process tool through complete pipeline');
        it('should handle classification to trigger to creation');
        it('should include metadata in created snapshots');
        it('should handle concurrent tool executions');
    });

    describe('file change integration', () => {
        it('should create backup before tool execution');
        it('should validate changes after tool execution');
        it('should handle tool execution failures');
        it('should clean up empty snapshots');
    });
});
```

### ToolManager Integration

**File**: `tests/snapshot/phase2/integration/toolmanager-integration.test.js`

**Test Scenarios**:

```javascript
describe('ToolManager Integration', () => {
    describe('tool execution processing', () => {
        it('should integrate with ToolManager execution lifecycle');
        it('should handle integration hook failures');
        it('should maintain ToolManager functionality');
        it('should provide graceful degradation');
    });

    describe('session management', () => {
        it('should track tool execution sessions');
        it('should handle application restart scenarios');
        it('should maintain session state consistency');
        it('should clean up on app shutdown');
    });

    describe('error handling', () => {
        it('should handle ToolManager errors gracefully');
        it('should not interfere with tool execution');
        it('should provide error recovery mechanisms');
        it('should log integration errors appropriately');
    });
});
```

### Tool Execution Integration

**File**: `tests/snapshot/phase2/integration/tool-execution.test.js`

**Test Scenarios**:

```javascript
describe('Tool Execution Integration', () => {
    describe('tool lifecycle monitoring', () => {
        it('should monitor complete tool execution lifecycle');
        it('should handle tool execution errors');
        it('should work with all tool types');
        it('should maintain tool execution performance');
    });

    describe('file modification detection', () => {
        it('should detect modifications from write_file tool');
        it('should detect modifications from edit_file tool');
        it('should ignore modifications from read_file tool');
        it('should handle modifications from execute_script tool');
    });

    describe('backup coordination', () => {
        it('should coordinate backup creation with tool execution');
        it('should validate backup necessity after execution');
        it('should handle backup failures gracefully');
        it('should optimize backup performance');
    });
});
```

### Instruction Classification Integration

**File**: `tests/snapshot/phase2/integration/instruction-classification.test.js`

**Test Scenarios**:

```javascript
describe('Instruction Classification Integration', () => {
    describe('classifier to trigger integration', () => {
        it('should pass classification results to trigger');
        it('should handle classification errors in trigger');
        it('should coordinate confidence thresholds');
        it('should handle classifier configuration changes');
    });

    describe('parser to classifier integration', () => {
        it('should use parser results in classification');
        it('should handle parser errors gracefully');
        it('should coordinate metadata generation');
        it('should handle parser configuration changes');
    });

    describe('context analysis integration', () => {
        it('should integrate tool context with classification');
        it('should handle context availability changes');
        it('should coordinate context weighting');
        it('should handle context analysis errors');
    });
});
```

### Configuration Integration

**File**: `tests/snapshot/phase2/integration/configuration.test.js`

**Test Scenarios**:

```javascript
describe('Configuration Integration', () => {
    describe('phase 1 compatibility', () => {
        it('should maintain Phase 1 configuration compatibility');
        it('should handle configuration migration');
        it('should provide backward compatibility');
        it('should validate mixed configuration scenarios');
    });

    describe('runtime configuration changes', () => {
        it('should handle classification pattern updates');
        it('should handle trigger rule changes');
        it('should handle integration setting changes');
        it('should validate configuration consistency');
    });

    describe('configuration validation', () => {
        it('should validate complete configuration');
        it('should handle invalid configuration gracefully');
        it('should provide configuration error feedback');
        it('should maintain system stability with invalid config');
    });
});
```

## End-to-End Tests

### Automatic Workflows

**File**: `tests/snapshot/phase2/e2e/automatic-workflows.test.js`

**Test Scenarios**:

```javascript
describe('Automatic Workflow E2E Tests', () => {
    describe('complete user workflows', () => {
        it('should handle "create a new component" workflow');
        it('should handle "refactor existing code" workflow');
        it('should handle "fix bug in file" workflow');
        it('should handle "add new feature" workflow');
        it('should handle "update documentation" workflow');
    });

    describe('mixed manual and automatic workflows', () => {
        it('should handle manual snapshot then automatic instruction');
        it('should handle automatic snapshot then manual operations');
        it('should handle interleaved manual and automatic snapshots');
        it('should maintain snapshot consistency');
    });

    describe('error recovery workflows', () => {
        it('should recover from classification errors');
        it('should recover from trigger failures');
        it('should recover from integration errors');
        it('should maintain system stability');
    });
});
```

### Classification Scenarios

**File**: `tests/snapshot/phase2/e2e/classification-scenarios.test.js`

**Test Scenarios**:

```javascript
describe('Classification Scenarios E2E Tests', () => {
    describe('real-world instruction scenarios', () => {
        it('should handle developer coding instructions');
        it('should handle system administration instructions');
        it('should handle data analysis instructions');
        it('should handle documentation instructions');
        it('should handle debugging instructions');
    });

    describe('edge case scenarios', () => {
        it('should handle very short instructions');
        it('should handle very long instructions');
        it('should handle non-English instructions');
        it('should handle technical jargon instructions');
        it('should handle ambiguous instructions');
    });

    describe('context-dependent scenarios', () => {
        it('should handle instructions with project context');
        it('should handle instructions with tool context');
        it('should handle instructions with user context');
        it('should handle instructions with temporal context');
    });
});
```

### Performance Tests

**File**: `tests/snapshot/phase2/e2e/performance.test.js`

**Test Scenarios**:

```javascript
describe('Performance E2E Tests', () => {
    describe('classification performance', () => {
        it('should classify 1000 instructions in <1 second');
        it('should handle concurrent classification requests');
        it('should maintain performance with large pattern sets');
        it('should optimize repeated instruction patterns');
    });

    describe('trigger performance', () => {
        it('should process triggers within 50ms');
        it('should handle rapid instruction sequences');
        it('should maintain performance with multiple sessions');
        it('should optimize trigger decision making');
    });

    describe('integration performance', () => {
        it('should add <5% overhead to app.js processing');
        it('should add <5% overhead to tool execution');
        it('should maintain responsive user interface');
        it('should handle performance under load');
    });
});
```

### Error Handling Tests

**File**: `tests/snapshot/phase2/e2e/error-handling.test.js`

**Test Scenarios**:

```javascript
describe('Error Handling E2E Tests', () => {
    describe('classification errors', () => {
        it('should handle pattern matching failures');
        it('should handle context analysis errors');
        it('should handle configuration errors');
        it('should provide graceful degradation');
    });

    describe('integration errors', () => {
        it('should handle app.js integration failures');
        it('should handle tool execution integration failures');
        it('should handle snapshot creation failures');
        it('should maintain system stability');
    });

    describe('configuration errors', () => {
        it('should handle invalid configuration');
        it('should handle configuration corruption');
        it('should handle configuration file missing');
        it('should recover from configuration errors');
    });
});
```

## Test Data and Fixtures

### Tool Fixtures

**File**: `tests/snapshot/phase2/fixtures/tools/modifying-tools.json`

```json
{
    "file_creation": [
        {
            "toolName": "write_file",
            "args": {
                "path": "src/config.js",
                "content": "module.exports = { port: 3000 };"
            }
        },
        {
            "toolName": "write_file",
            "args": {
                "path": "src/components/Header.js",
                "content": "import React from 'react';"
            }
        }
    ],
    "file_modification": [
        {
            "toolName": "edit_file",
            "args": {
                "path": "src/auth.js",
                "changes": [
                    {
                        "line": 10,
                        "content": "const token = generateToken(user);"
                    }
                ]
            }
        }
    ],
    "script_execution": [
        {
            "toolName": "execute_script",
            "args": {
                "script": "const fs = require('fs'); fs.writeFileSync('test.txt', 'hello');"
            }
        }
    ]
}
```

**File**: `tests/snapshot/phase2/fixtures/tools/readonly-tools.json`

```json
{
    "file_reading": [
        {
            "toolName": "read_files",
            "args": {
                "path": "src/config.js"
            }
        },
        {
            "toolName": "read_files",
            "args": {
                "path": "package.json"
            }
        }
    ],
    "directory_listing": [
        {
            "toolName": "list_directory",
            "args": {
                "path": "src/"
            }
        }
    ],
    "searching": [
        {
            "toolName": "exact_search",
            "args": {
                "query": "function authenticate",
                "path": "src/"
            }
        }
    ]
}
```

### Mock Tool Implementations

**File**: `tests/snapshot/phase2/fixtures/mock-tools/mock-write-file.js`

```javascript
export class MockWriteFile {
    constructor() {
        this.filesWritten = [];
    }

    async execute(args) {
        this.filesWritten.push({
            path: args.path,
            content: args.content,
            timestamp: Date.now(),
        });

        return {
            success: true,
            message: `File written: ${args.path}`,
        };
    }

    getFilesWritten() {
        return this.filesWritten;
    }

    reset() {
        this.filesWritten = [];
    }
}
```

## Test Utilities and Helpers

### Tool Helpers

**File**: `tests/snapshot/helpers/tool-helpers.js`

```javascript
export class ToolHelpers {
    // Tool execution simulation
    static simulateToolExecution(toolName, args, expectedFiles)
    static createMockToolCall(toolName, args)
    static generateToolResults(toolName, success, files)
    static simulateToolFailure(toolName, args, error)

    // Tool validation
    static validateToolClassification(toolName, expectedType)
    static validateToolMetadata(toolName, args, metadata)
    static validateToolTrigger(toolName, shouldTrigger)

    // Test data management
    static loadToolFixtures(category)
    static createToolTestSuite(tools)
    static generateToolVariations(baseTool)
}
```

### File Change Helpers

**File**: `tests/snapshot/helpers/file-change-helpers.js`

```javascript
export class FileChangeHelpers {
    // File state simulation
    static createMockFileState(basePath, files)
    static simulateFileChanges(beforeState, modifications)
    static generateFileModifications(type, count)
    static createChecksumMap(files)

    // Change validation
    static validateChangeDetection(beforeState, afterState, expectedChanges)
    static validateChangeSignificance(changes, threshold)
    static testChangePerformance(fileCount, changeCount)

    // Test file management
    static createTestFiles(structure)
    static modifyTestFiles(files, changes)
    static cleanupTestFiles(files)
}
```

### Integration Helpers

**File**: `tests/snapshot/helpers/integration-helpers.js`

```javascript
export class IntegrationHelpers {
    // App integration
    static createMockApp(configuration)
    static simulateUserInput(app, instructions)
    static validateAppIntegration(app, expectedBehavior)

    // Tool integration
    static createMockToolManager(tools)
    static simulateToolExecution(toolManager, toolName, args)
    static validateToolIntegration(toolManager, expectedBehavior)

    // Performance testing
    static measurePerformanceImpact(baseline, withIntegration)
    static validatePerformanceThresholds(metrics, thresholds)
    static generatePerformanceReport(metrics)
}
```

## Test Execution Strategy

### Development Testing

#### Unit Test Development

1. **TDD Approach**: Write tests before implementation
2. **Component Isolation**: Test each component in isolation
3. **Mock Dependencies**: Use mocks for external dependencies
4. **Fast Feedback**: Keep unit tests fast (<1 second)

#### Integration Test Development

1. **Component Integration**: Test component interactions
2. **Realistic Scenarios**: Use realistic test scenarios
3. **Error Conditions**: Test error handling thoroughly
4. **Performance Validation**: Validate performance impact

### Continuous Integration

#### Automated Testing Pipeline

```yaml
# Example CI pipeline for Phase 2
phase2_tests:
    stages:
        - unit_tests:
              - run: npm run test:unit:phase2
              - coverage: >90
              - timeout: 5 minutes

        - integration_tests:
              - run: npm run test:integration:phase2
              - requires: unit_tests
              - timeout: 15 minutes

        - e2e_tests:
              - run: npm run test:e2e:phase2
              - requires: integration_tests
              - timeout: 30 minutes

        - performance_tests:
              - run: npm run test:performance:phase2
              - requires: e2e_tests
              - timeout: 20 minutes
```

#### Quality Gates

- **Unit Tests**: Must pass with >90% coverage
- **Integration Tests**: Must pass all scenarios
- **E2E Tests**: Must pass all user workflows
- **Performance Tests**: Must meet performance thresholds
- **Code Quality**: Must pass linting and security checks

### Local Development

#### Test Running Scripts

```json
{
    "scripts": {
        "test:phase2": "vitest run tests/snapshot/phase2/",
        "test:phase2:unit": "vitest run tests/snapshot/phase2/unit/",
        "test:phase2:integration": "vitest run tests/snapshot/phase2/integration/",
        "test:phase2:e2e": "vitest run tests/snapshot/phase2/e2e/",
        "test:phase2:watch": "vitest watch tests/snapshot/phase2/",
        "test:phase2:coverage": "vitest run --coverage tests/snapshot/phase2/"
    }
}
```

#### Development Workflow

1. **Write Tests**: Write tests for new functionality
2. **Run Tests**: Run tests locally before committing
3. **Fix Issues**: Fix any failing tests
4. **Validate Performance**: Check performance impact
5. **Commit Changes**: Commit with tests passing

## Performance Testing

### Performance Benchmarks

#### Tool Classification Performance

```javascript
describe('Tool Classification Performance', () => {
    it('should classify tools in <1ms', async () => {
        const toolMonitor = new ToolMonitor(config);
        const toolName = 'write_file';

        const startTime = performance.now();
        const result = await toolMonitor.shouldCreateSnapshot(toolName, {});
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(1);
        expect(result).toBe(true);
    });

    it('should handle 10000 tool classifications in <1 second', async () => {
        const toolMonitor = new ToolMonitor(config);
        const toolCalls = generateTestToolCalls(10000);

        const startTime = performance.now();
        const results = await Promise.all(
            toolCalls.map(({ toolName, args }) => toolMonitor.shouldCreateSnapshot(toolName, args))
        );
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(1000);
        expect(results).toHaveLength(10000);
    });
});
```

#### Integration Performance

```javascript
describe('Integration Performance', () => {
    it('should add <5% overhead to app.js processing', async () => {
        const app = createMockApp();
        const baselineTime = await measureProcessingTime(app, instructions);

        const appWithIntegration = createMockAppWithIntegration();
        const integrationTime = await measureProcessingTime(appWithIntegration, instructions);

        const overhead = (integrationTime - baselineTime) / baselineTime;
        expect(overhead).toBeLessThan(0.05); // 5% overhead
    });
});
```

### Memory Performance

#### Memory Usage Testing

```javascript
describe('Memory Usage', () => {
    it('should maintain stable memory usage', async () => {
        const classifier = new InstructionClassifier(config);
        const initialMemory = process.memoryUsage();

        // Process 1000 instructions
        for (let i = 0; i < 1000; i++) {
            await classifier.shouldCreateSnapshot(`instruction ${i}`);
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // Should not increase by more than 10MB
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
});
```

## Quality Assurance

### Test Coverage Requirements

#### Coverage Targets

- **Unit Tests**: >95% line coverage
- **Integration Tests**: 100% of integration points
- **E2E Tests**: 100% of user workflows
- **Performance Tests**: 100% of performance-critical paths

#### Coverage Validation

```javascript
// Coverage validation script
const coverageThresholds = {
    global: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
    },
    'src/core/snapshot/InstructionClassifier.js': {
        branches: 95,
        functions: 100,
        lines: 95,
        statements: 95,
    },
};
```

### Test Quality Metrics

#### Code Quality

- All tests follow consistent patterns
- Tests have clear, descriptive names
- Tests are well-documented
- Tests are maintainable and readable

#### Test Reliability

- Tests are deterministic
- Tests are independent
- Tests handle async operations correctly
- Tests clean up after themselves

#### Test Performance

- Unit tests run in <1 second
- Integration tests run in <5 seconds
- E2E tests run in <30 seconds
- Performance tests provide meaningful metrics

## Test Documentation

### Test Plan Documentation

#### Test Case Documentation

```javascript
/**
 * Test: Instruction Classification Accuracy
 *
 * Purpose: Verify that the InstructionClassifier correctly identifies
 *          file-modifying instructions and triggers snapshot creation
 *
 * Preconditions:
 *   - InstructionClassifier is initialized with default configuration
 *   - Test instruction fixtures are loaded
 *
 * Test Steps:
 *   1. Load modifying instruction fixtures
 *   2. Process each instruction through classifier
 *   3. Verify classification result is 'modifying'
 *   4. Verify confidence score is above threshold
 *
 * Expected Results:
 *   - All modifying instructions classified as 'modifying'
 *   - Confidence scores above 0.7 threshold
 *   - Classification time under 10ms per instruction
 *
 * Postconditions:
 *   - No side effects or state changes
 *   - Memory usage returns to baseline
 */
```

#### Test Suite Documentation

```markdown
# Phase 2 Test Suite Documentation

## Test Categories

### Unit Tests

- **InstructionClassifier**: Tests classification logic and pattern matching
- **InstructionParser**: Tests instruction parsing and metadata extraction
- **SnapshotTrigger**: Tests trigger logic and snapshot creation
- **AppIntegration**: Tests app.js integration hooks
- **ToolExecutionHooks**: Tests tool execution monitoring

### Integration Tests

- **Automatic Creation**: Tests end-to-end automatic snapshot creation
- **App Integration**: Tests integration with app.js
- **Tool Execution**: Tests tool execution monitoring
- **Classification**: Tests classification pipeline
- **Configuration**: Tests configuration management

### E2E Tests

- **Automatic Workflows**: Tests complete user workflows
- **Classification Scenarios**: Tests real-world classification scenarios
- **Performance**: Tests performance under load
- **Error Handling**: Tests error recovery

## Test Data

### Instruction Fixtures

- **Modifying Instructions**: Instructions that should trigger snapshots
- **Read-only Instructions**: Instructions that should not trigger snapshots
- **Ambiguous Instructions**: Instructions requiring context analysis
- **Complex Instructions**: Multi-action instructions

### Mock Components

- **Mock Tools**: Simulate tool execution
- **Mock App**: Simulate app.js behavior
- **Mock Configuration**: Test configuration scenarios
```

This comprehensive testing architecture ensures that Phase 2 functionality is thoroughly tested across all dimensions - from individual component behavior to complete user workflows, performance characteristics, and error handling scenarios.
