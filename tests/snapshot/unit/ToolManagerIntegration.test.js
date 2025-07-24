/**
 * Unit tests for ToolManagerIntegration component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolManagerIntegration } from '../../../src/core/snapshot/ToolManagerIntegration.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('ToolManagerIntegration', () => {
    let integration;
    let mockSnapshotTrigger;
    let mockToolMonitor;
    let mockFileChangeDetector;
    let mockToolManager;

    beforeEach(() => {
        mockSnapshotTrigger = {
            onToolExecution: vi.fn().mockResolvedValue({ id: 'snapshot-123' }),
            onExecutionComplete: vi.fn().mockResolvedValue(),
            onApplicationStart: vi.fn().mockResolvedValue(),
        };

        mockToolMonitor = {
            shouldCreateSnapshot: vi.fn().mockReturnValue(true),
            modifiesFiles: vi.fn().mockReturnValue(true),
        };

        mockFileChangeDetector = {
            captureFileStates: vi.fn().mockResolvedValue({
                files: { 'test.js': { size: 1024 } },
                timestamp: Date.now(),
            }),
            compareFileStates: vi.fn().mockReturnValue({
                hasChanges: true,
                changeCount: 1,
                changes: { modified: [{ path: 'test.js' }] },
            }),
            validateActualChanges: vi.fn().mockReturnValue({
                expectedModifications: true,
                unexpectedChanges: [],
            }),
            warnAboutUnexpectedChanges: vi.fn(),
        };

        mockToolManager = {
            executeToolCall: vi.fn().mockResolvedValue({ success: true, result: 'Test result' }),
        };

        integration = new ToolManagerIntegration(
            mockSnapshotTrigger,
            mockToolMonitor,
            mockFileChangeDetector
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            expect(integration.config.enabled).toBe(true);
            expect(integration.config.trackFileChanges).toBe(true);
            expect(integration.config.cleanupEmptySnapshots).toBe(true);
            expect(integration.config.logToolExecution).toBe(true);
        });

        it('should accept custom configuration', () => {
            const customConfig = {
                enabled: false,
                trackFileChanges: false,
                cleanupEmptySnapshots: false,
                logToolExecution: false,
            };

            const customIntegration = new ToolManagerIntegration(
                mockSnapshotTrigger,
                mockToolMonitor,
                mockFileChangeDetector,
                customConfig
            );

            expect(customIntegration.config.enabled).toBe(false);
            expect(customIntegration.config.trackFileChanges).toBe(false);
            expect(customIntegration.config.cleanupEmptySnapshots).toBe(false);
            expect(customIntegration.config.logToolExecution).toBe(false);
        });

        it('should initialize tracking maps', () => {
            expect(integration.activeExecutions).toBeInstanceOf(Map);
            expect(integration.preExecutionStates).toBeInstanceOf(Map);
            expect(integration.activeExecutions.size).toBe(0);
            expect(integration.preExecutionStates.size).toBe(0);
        });
    });

    describe('integrateWithToolManager', () => {
        it('should integrate with valid ToolManager', () => {
            const originalExecute = mockToolManager.executeToolCall;

            integration.integrateWithToolManager(mockToolManager);

            expect(mockToolManager.executeToolCall).not.toBe(originalExecute);
            expect(typeof mockToolManager.executeToolCall).toBe('function');
        });

        it('should handle null ToolManager gracefully', () => {
            // Should not throw
            integration.integrateWithToolManager(null);
        });

        it('should warn when no ToolManager provided', () => {
            const warnSpy = vi.spyOn(integration.logger, 'warn');

            integration.integrateWithToolManager(null);

            expect(warnSpy).toHaveBeenCalledWith('No ToolManager provided for integration');
        });
    });

    describe('enhancedExecuteToolCall', () => {
        let originalExecuteToolCall;
        let mockToolCall;

        beforeEach(() => {
            originalExecuteToolCall = vi.fn().mockResolvedValue({ success: true });
            mockToolCall = {
                function: {
                    name: 'write_file',
                    arguments: JSON.stringify({ file_path: 'test.js', content: 'test' }),
                },
            };
        });

        it('should execute tool with integration hooks when enabled', async () => {
            const result = await integration.enhancedExecuteToolCall(
                originalExecuteToolCall,
                mockToolCall,
                {},
                {}
            );

            expect(result).toEqual({ success: true });
            expect(originalExecuteToolCall).toHaveBeenCalled();
            expect(mockSnapshotTrigger.onToolExecution).toHaveBeenCalled();
            expect(mockSnapshotTrigger.onExecutionComplete).toHaveBeenCalled();
        });

        it('should bypass integration when disabled', async () => {
            integration.config.enabled = false;

            const result = await integration.enhancedExecuteToolCall(
                originalExecuteToolCall,
                mockToolCall,
                {},
                {}
            );

            expect(result).toEqual({ success: true });
            expect(originalExecuteToolCall).toHaveBeenCalled();
            expect(mockSnapshotTrigger.onToolExecution).not.toHaveBeenCalled();
        });

        it('should handle tool execution errors', async () => {
            const error = new Error('Tool execution failed');
            originalExecuteToolCall.mockRejectedValue(error);

            await expect(
                integration.enhancedExecuteToolCall(originalExecuteToolCall, mockToolCall, {}, {})
            ).rejects.toThrow('Tool execution failed');

            expect(integration.activeExecutions.size).toBe(0); // Should clean up
        });
    });

    describe('beforeToolExecution', () => {
        it('should track execution and capture file state', async () => {
            const executionId = 'test-execution-123';

            await integration.beforeToolExecution(
                'write_file',
                { file_path: 'test.js' },
                { executionId }
            );

            expect(integration.activeExecutions.has(executionId)).toBe(true);
            expect(mockFileChangeDetector.captureFileStates).toHaveBeenCalled();
            expect(mockSnapshotTrigger.onToolExecution).toHaveBeenCalledWith(
                'write_file',
                { file_path: 'test.js' },
                expect.objectContaining({ executionId })
            );
        });

        it('should skip file state capture when trackFileChanges is disabled', async () => {
            integration.config.trackFileChanges = false;
            const executionId = 'test-execution-123';

            await integration.beforeToolExecution(
                'write_file',
                { file_path: 'test.js' },
                { executionId }
            );

            expect(mockFileChangeDetector.captureFileStates).not.toHaveBeenCalled();
        });

        it('should skip file state capture for non-snapshot tools', async () => {
            mockToolMonitor.shouldCreateSnapshot.mockReturnValue(false);
            const executionId = 'test-execution-123';

            await integration.beforeToolExecution(
                'read_file',
                { file_path: 'test.js' },
                { executionId }
            );

            expect(mockFileChangeDetector.captureFileStates).not.toHaveBeenCalled();
        });

        it('should handle file state capture errors gracefully', async () => {
            mockFileChangeDetector.captureFileStates.mockRejectedValue(new Error('Capture failed'));
            const executionId = 'test-execution-123';

            // Should not throw
            await integration.beforeToolExecution(
                'write_file',
                { file_path: 'test.js' },
                { executionId }
            );

            expect(integration.activeExecutions.has(executionId)).toBe(true);
        });

        it('should associate snapshot with execution when created', async () => {
            const executionId = 'test-execution-123';
            mockSnapshotTrigger.onToolExecution.mockResolvedValue({ id: 'snapshot-456' });

            await integration.beforeToolExecution(
                'write_file',
                { file_path: 'test.js' },
                { executionId }
            );

            const execution = integration.activeExecutions.get(executionId);
            expect(execution.snapshotId).toBe('snapshot-456');
            expect(execution.snapshotCreated).toBe(true);
        });
    });

    describe('afterToolExecution', () => {
        let executionId;

        beforeEach(() => {
            executionId = 'test-execution-123';
            integration.activeExecutions.set(executionId, {
                toolName: 'write_file',
                args: { file_path: 'test.js' },
                startTime: Date.now() - 1000,
                context: { executionId },
                snapshotCreated: true,
                snapshotId: 'snapshot-123',
            });
            integration.preExecutionStates.set(executionId, {
                files: { 'test.js': { size: 1024 } },
            });
        });

        it('should complete execution tracking and check file changes', async () => {
            const results = { success: true, result: 'File written' };

            await integration.afterToolExecution('write_file', results, { executionId });

            expect(mockFileChangeDetector.compareFileStates).toHaveBeenCalled();
            expect(mockFileChangeDetector.validateActualChanges).toHaveBeenCalled();
            expect(mockFileChangeDetector.warnAboutUnexpectedChanges).toHaveBeenCalled();
            expect(mockSnapshotTrigger.onExecutionComplete).toHaveBeenCalled();

            // Should clean up tracking
            expect(integration.activeExecutions.has(executionId)).toBe(false);
            expect(integration.preExecutionStates.has(executionId)).toBe(false);
        });

        it('should skip file change checking when tracking is disabled', async () => {
            integration.config.trackFileChanges = false;
            const results = { success: true };

            await integration.afterToolExecution('write_file', results, { executionId });

            expect(mockFileChangeDetector.compareFileStates).not.toHaveBeenCalled();
        });

        it('should handle missing execution record', async () => {
            integration.activeExecutions.clear();
            const results = { success: true };

            // Should not throw
            await integration.afterToolExecution('write_file', results, { executionId });
        });

        it('should cleanup empty snapshots when configured', async () => {
            mockFileChangeDetector.compareFileStates.mockReturnValue({
                hasChanges: false,
                changeCount: 0,
            });

            const cleanupSpy = vi.spyOn(integration, 'cleanupEmptySnapshot');

            await integration.afterToolExecution('write_file', { success: true }, { executionId });

            expect(cleanupSpy).toHaveBeenCalledWith('snapshot-123', 'write_file');
        });

        it('should not cleanup snapshots when changes detected', async () => {
            const cleanupSpy = vi.spyOn(integration, 'cleanupEmptySnapshot');

            await integration.afterToolExecution('write_file', { success: true }, { executionId });

            expect(cleanupSpy).not.toHaveBeenCalled();
        });
    });

    describe('checkFileChanges', () => {
        let executionId, execution;

        beforeEach(() => {
            executionId = 'test-execution-123';
            execution = {
                toolName: 'write_file',
                args: { file_path: 'test.js' },
                snapshotCreated: true,
                snapshotId: 'snapshot-123',
            };
            integration.preExecutionStates.set(executionId, {
                files: { 'test.js': { size: 1024 } },
            });
        });

        it('should analyze file changes and update execution record', async () => {
            await integration.checkFileChanges('write_file', executionId, execution);

            expect(mockFileChangeDetector.captureFileStates).toHaveBeenCalled();
            expect(mockFileChangeDetector.compareFileStates).toHaveBeenCalled();
            expect(mockFileChangeDetector.validateActualChanges).toHaveBeenCalled();
            expect(execution.fileChanges).toBeDefined();
            expect(execution.changeValidation).toBeDefined();
        });

        it('should handle missing pre-execution state', async () => {
            integration.preExecutionStates.delete(executionId);

            // Should not throw and should return early
            await integration.checkFileChanges('write_file', executionId, execution);

            expect(mockFileChangeDetector.captureFileStates).not.toHaveBeenCalled();
        });

        it('should handle file change detection errors', async () => {
            mockFileChangeDetector.captureFileStates.mockRejectedValue(new Error('Capture failed'));

            // Should not throw
            await integration.checkFileChanges('write_file', executionId, execution);
        });
    });

    describe('onToolError', () => {
        it('should handle tool errors and cleanup', async () => {
            const executionId = 'test-execution-123';
            integration.activeExecutions.set(executionId, {
                toolName: 'write_file',
                startTime: Date.now() - 1000,
            });
            integration.preExecutionStates.set(executionId, {});

            const error = new Error('Tool failed');

            await integration.onToolError('write_file', error, { executionId });

            expect(integration.activeExecutions.has(executionId)).toBe(false);
            expect(integration.preExecutionStates.has(executionId)).toBe(false);
        });

        it('should handle cleanup errors gracefully', async () => {
            const executionId = 'test-execution-123';
            // Corrupt the execution record to cause an error
            integration.activeExecutions.set(executionId, null);

            const error = new Error('Tool failed');

            // Should not throw
            await integration.onToolError('write_file', error, { executionId });
        });
    });

    describe('onApplicationStart', () => {
        it('should reset state and notify trigger', async () => {
            integration.activeExecutions.set('test', {});
            integration.preExecutionStates.set('test', {});

            await integration.onApplicationStart({ basePath: '/test' });

            expect(integration.activeExecutions.size).toBe(0);
            expect(integration.preExecutionStates.size).toBe(0);
            expect(mockSnapshotTrigger.onApplicationStart).toHaveBeenCalledWith({
                basePath: '/test',
            });
        });

        it('should handle application start errors gracefully', async () => {
            mockSnapshotTrigger.onApplicationStart.mockRejectedValue(new Error('Start failed'));

            // Should not throw
            await integration.onApplicationStart({ basePath: '/test' });
        });
    });

    describe('setupApplicationStartupHooks', () => {
        it('should setup hooks for app with onApplicationStart method', () => {
            const mockApp = {
                onApplicationStart: vi.fn().mockResolvedValue(),
            };

            const originalOnStart = mockApp.onApplicationStart;
            integration.setupApplicationStartupHooks(mockApp);

            expect(mockApp.onApplicationStart).not.toBe(originalOnStart);
        });

        it('should handle app without onApplicationStart method', () => {
            const mockApp = {};

            // Should not throw
            integration.setupApplicationStartupHooks(mockApp);
        });

        it('should warn when no app provided', () => {
            const warnSpy = vi.spyOn(integration.logger, 'warn');

            integration.setupApplicationStartupHooks(null);

            expect(warnSpy).toHaveBeenCalledWith(
                'No application instance provided for startup hooks'
            );
        });
    });

    describe('cleanupEmptySnapshot', () => {
        it('should log cleanup intention for valid snapshot ID', async () => {
            const debugSpy = vi.spyOn(integration.logger, 'debug');

            await integration.cleanupEmptySnapshot('snapshot-123', 'write_file');

            expect(debugSpy).toHaveBeenCalledWith('Empty snapshot cleanup needed for write_file', {
                snapshotId: 'snapshot-123',
            });
        });

        it('should handle null snapshot ID', async () => {
            // Should return early and not throw
            await integration.cleanupEmptySnapshot(null, 'write_file');
        });
    });

    describe('setupToolExecutionHooks', () => {
        it('should be an alias for integrateWithToolManager', () => {
            const spy = vi.spyOn(integration, 'integrateWithToolManager');

            integration.setupToolExecutionHooks(mockToolManager);

            expect(spy).toHaveBeenCalledWith(mockToolManager);
        });
    });

    describe('trackToolExecutionState', () => {
        it('should log execution state tracking', () => {
            const debugSpy = vi.spyOn(integration.logger, 'debug');

            integration.trackToolExecutionState('write_file', {}, { executionId: 'test' });

            expect(debugSpy).toHaveBeenCalledWith('Tracking execution state for write_file', {
                executionId: 'test',
            });
        });
    });

    describe('manageSnapshotSession', () => {
        it('should log session management', () => {
            const debugSpy = vi.spyOn(integration.logger, 'debug');

            integration.manageSnapshotSession('session-123');

            expect(debugSpy).toHaveBeenCalledWith('Managing snapshot session: session-123');
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration', () => {
            const newConfig = {
                enabled: false,
                trackFileChanges: false,
                cleanupEmptySnapshots: false,
            };

            integration.updateConfiguration(newConfig);

            expect(integration.config.enabled).toBe(false);
            expect(integration.config.trackFileChanges).toBe(false);
            expect(integration.config.cleanupEmptySnapshots).toBe(false);
            expect(integration.config.logToolExecution).toBe(true); // Should preserve existing values
        });
    });

    describe('getStats', () => {
        it('should return comprehensive statistics', () => {
            integration.activeExecutions.set('test1', {});
            integration.preExecutionStates.set('test2', {});

            const stats = integration.getStats();

            expect(stats).toMatchObject({
                enabled: true,
                activeExecutions: 1,
                preExecutionStates: 1,
                trackFileChanges: true,
                cleanupEmptySnapshots: true,
                config: expect.objectContaining({
                    enabled: true,
                    trackFileChanges: true,
                }),
            });
        });
    });

    describe('cleanup', () => {
        it('should clear all tracking state', () => {
            integration.activeExecutions.set('test1', {});
            integration.preExecutionStates.set('test2', {});

            integration.cleanup();

            expect(integration.activeExecutions.size).toBe(0);
            expect(integration.preExecutionStates.size).toBe(0);
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete tool execution flow', async () => {
            // Setup integration
            integration.integrateWithToolManager(mockToolManager);

            const mockToolCall = {
                function: {
                    name: 'write_file',
                    arguments: JSON.stringify({ file_path: 'test.js', content: 'test' }),
                },
            };

            // Execute tool through integrated method
            const result = await mockToolManager.executeToolCall(mockToolCall, {}, {});

            expect(result).toEqual({ success: true, result: 'Test result' });
            expect(mockSnapshotTrigger.onToolExecution).toHaveBeenCalled();
            expect(mockSnapshotTrigger.onExecutionComplete).toHaveBeenCalled();
            expect(integration.activeExecutions.size).toBe(0); // Should be cleaned up
        });

        it('should handle tool execution with file changes', async () => {
            integration.integrateWithToolManager(mockToolManager);

            const mockToolCall = {
                function: {
                    name: 'write_file',
                    arguments: JSON.stringify({ file_path: 'test.js', content: 'test' }),
                },
            };

            await mockToolManager.executeToolCall(mockToolCall, {}, {});

            expect(mockFileChangeDetector.captureFileStates).toHaveBeenCalledTimes(2); // Before and after
            expect(mockFileChangeDetector.compareFileStates).toHaveBeenCalled();
            expect(mockFileChangeDetector.validateActualChanges).toHaveBeenCalled();
        });

        it('should handle disabled integration gracefully', async () => {
            integration.config.enabled = false;
            integration.integrateWithToolManager(mockToolManager);

            const mockToolCall = {
                function: {
                    name: 'write_file',
                    arguments: JSON.stringify({ file_path: 'test.js', content: 'test' }),
                },
            };

            const result = await mockToolManager.executeToolCall(mockToolCall, {}, {});

            expect(result).toEqual({ success: true, result: 'Test result' });
            expect(mockSnapshotTrigger.onToolExecution).not.toHaveBeenCalled();
        });
    });
});
