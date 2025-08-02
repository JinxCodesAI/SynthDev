/**
 * Unit tests for SnapshotTrigger component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnapshotTrigger } from '../../../src/core/snapshot/SnapshotTrigger.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe.sequential('SnapshotTrigger', () => {
    let trigger;
    let mockSnapshotManager;
    let mockToolMonitor;

    beforeEach(() => {
        mockSnapshotManager = {
            createSnapshot: vi.fn().mockResolvedValue({
                id: 'snapshot-123',
                description: 'Test snapshot',
                timestamp: Date.now(),
            }),
        };

        mockToolMonitor = {
            shouldCreateSnapshot: vi.fn().mockReturnValue(true),
            extractFileTargets: vi.fn().mockReturnValue(['file1.js', 'file2.js']),
            getToolMetadata: vi.fn().mockReturnValue({
                toolName: 'write_file',
                classification: true,
                fileTargets: ['file1.js'],
                timestamp: Date.now(),
            }),
        };

        trigger = new SnapshotTrigger(mockSnapshotManager, mockToolMonitor);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            expect(trigger.config.enabled).toBe(true);
            expect(trigger.config.createOnToolExecution).toBe(true);
            expect(trigger.config.maxSnapshotsPerSession).toBe(20);
            expect(trigger.config.cooldownPeriod).toBe(5000);
            expect(trigger.config.requireActualChanges).toBe(false);
            expect(trigger.config.maxDescriptionLength).toBe(100);
            expect(trigger.config.includeToolName).toBe(true);
            expect(trigger.config.includeTargetFiles).toBe(true);
            expect(trigger.config.includeTimestamp).toBe(false);
        });

        it('should accept custom configuration', () => {
            const customConfig = {
                enabled: false,
                maxSnapshotsPerSession: 10,
                cooldownPeriod: 1000,
                maxDescriptionLength: 50,
            };

            const customTrigger = new SnapshotTrigger(
                mockSnapshotManager,
                mockToolMonitor,
                customConfig
            );

            expect(customTrigger.config.enabled).toBe(false);
            expect(customTrigger.config.maxSnapshotsPerSession).toBe(10);
            expect(customTrigger.config.cooldownPeriod).toBe(1000);
            expect(customTrigger.config.maxDescriptionLength).toBe(50);
        });

        it('should initialize session tracking', () => {
            expect(trigger.sessionSnapshots).toBe(0);
            expect(trigger.lastSnapshotTime).toBe(0);
            expect(trigger.activeOperations).toBeInstanceOf(Map);
            expect(trigger.activeOperations.size).toBe(0);
        });
    });

    describe('processTrigger', () => {
        it('should create snapshot for valid tool execution', async () => {
            const result = await trigger.processTrigger('write_file', { file_path: 'test.js' });

            expect(result).toBeDefined();
            expect(result.id).toBe('snapshot-123');
            expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith(
                expect.stringContaining('write_file'),
                expect.objectContaining({
                    triggerType: 'automatic',
                    toolName: 'write_file',
                })
            );
        });

        it('should return null when trigger is disabled', async () => {
            trigger.config.enabled = false;

            const result = await trigger.processTrigger('write_file', { file_path: 'test.js' });

            expect(result).toBeNull();
            expect(mockSnapshotManager.createSnapshot).not.toHaveBeenCalled();
        });

        it('should return null when tool should not create snapshot', async () => {
            mockToolMonitor.shouldCreateSnapshot.mockReturnValue(false);

            const result = await trigger.processTrigger('read_files', { file_path: 'test.js' });

            expect(result).toBeNull();
            expect(mockSnapshotManager.createSnapshot).not.toHaveBeenCalled();
        });

        it('should handle errors during trigger processing', async () => {
            mockSnapshotManager.createSnapshot.mockRejectedValue(new Error('Snapshot failed'));

            await expect(
                trigger.processTrigger('write_file', { file_path: 'test.js' })
            ).rejects.toThrow('Snapshot failed');
        });
    });

    describe('createTriggeredSnapshot', () => {
        it('should create snapshot with generated description and metadata', async () => {
            const result = await trigger.createTriggeredSnapshot('write_file', {
                file_path: 'test.js',
            });

            expect(result.id).toBe('snapshot-123');
            expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith(
                'Before write_file: file1.js, file2.js',
                expect.objectContaining({
                    triggerType: 'automatic',
                    toolName: 'write_file',
                    sessionSnapshot: 1,
                })
            );
        });

        it('should update session tracking after creating snapshot', async () => {
            expect(trigger.sessionSnapshots).toBe(0);
            expect(trigger.lastSnapshotTime).toBe(0);

            await trigger.createTriggeredSnapshot('write_file', { file_path: 'test.js' });

            expect(trigger.sessionSnapshots).toBe(1);
            expect(trigger.lastSnapshotTime).toBeGreaterThan(0);
        });

        it('should handle snapshot creation failures', async () => {
            mockSnapshotManager.createSnapshot.mockRejectedValue(new Error('Creation failed'));

            await expect(
                trigger.createTriggeredSnapshot('write_file', { file_path: 'test.js' })
            ).rejects.toThrow('Creation failed');
        });
    });

    describe('_shouldTriggerSnapshot', () => {
        it('should return true for valid conditions', () => {
            const result = trigger._shouldTriggerSnapshot('write_file', {}, {});
            expect(result).toBe(true);
        });

        it('should return false when tool should not create snapshot', () => {
            mockToolMonitor.shouldCreateSnapshot.mockReturnValue(false);

            const result = trigger._shouldTriggerSnapshot('read_files', {}, {});
            expect(result).toBe(false);
        });

        it('should return false when session limit is reached', () => {
            trigger.sessionSnapshots = 20; // At limit

            const result = trigger._shouldTriggerSnapshot('write_file', {}, {});
            expect(result).toBe(false);
        });

        it('should return false when in cooldown period', () => {
            trigger.lastSnapshotTime = Date.now() - 1000; // 1 second ago (less than 5 second cooldown)

            const result = trigger._shouldTriggerSnapshot('write_file', {}, {});
            expect(result).toBe(false);
        });

        it('should return true when cooldown period has passed', () => {
            trigger.lastSnapshotTime = Date.now() - 6000; // 6 seconds ago (more than 5 second cooldown)

            const result = trigger._shouldTriggerSnapshot('write_file', {}, {});
            expect(result).toBe(true);
        });
    });

    describe('generateSnapshotDescription', () => {
        it('should generate basic description with tool name', () => {
            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toBe('Before write_file: file1.js, file2.js');
        });

        it('should generate description without tool name when disabled', () => {
            trigger.config.includeToolName = false;
            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toBe('Automatic snapshot: file1.js, file2.js');
        });

        it('should include target files when enabled', () => {
            mockToolMonitor.extractFileTargets.mockReturnValue([
                'file1.js',
                'file2.js',
                'file3.js',
            ]);

            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toBe('Before write_file: file1.js, file2.js, file3.js');
        });

        it('should limit file list and show more count', () => {
            mockToolMonitor.extractFileTargets.mockReturnValue([
                'file1.js',
                'file2.js',
                'file3.js',
                'file4.js',
                'file5.js',
            ]);

            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toBe('Before write_file: file1.js, file2.js, file3.js and 2 more');
        });

        it('should exclude target files when disabled', () => {
            trigger.config.includeTargetFiles = false;
            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toBe('Before write_file');
        });

        it('should include timestamp when enabled', () => {
            trigger.config.includeTimestamp = true;
            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toMatch(
                /Before write_file: file1\.js, file2\.js \(\d{2}:\d{2}:\d{2}\)/
            );
        });

        it('should truncate long descriptions', () => {
            trigger.config.maxDescriptionLength = 20;
            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toHaveLength(20);
            expect(description.endsWith('...')).toBe(true);
        });

        it('should handle empty file targets', () => {
            mockToolMonitor.extractFileTargets.mockReturnValue([]);
            const description = trigger.generateSnapshotDescription('write_file', {});
            expect(description).toBe('Before write_file');
        });
    });

    describe('createToolMetadata', () => {
        it('should create comprehensive tool metadata', () => {
            const args = { file_path: 'test.js', content: 'test' };
            const context = { basePath: '/test', user: 'test-user' };

            const metadata = trigger.createToolMetadata('write_file', args, context);

            expect(metadata).toMatchObject({
                triggerType: 'automatic',
                toolName: 'write_file',
                arguments: args,
                sessionSnapshot: 1,
                triggerTime: expect.any(Number),
                context: {
                    basePath: '/test',
                    user: 'test-user',
                },
            });
            expect(metadata.toolMetadata).toBeDefined();
        });

        it('should use current working directory as default basePath', () => {
            const metadata = trigger.createToolMetadata('write_file', {}, {});
            expect(metadata.context.basePath).toBe(process.cwd());
        });
    });

    describe('onToolExecution', () => {
        it('should call processTrigger', async () => {
            const spy = vi.spyOn(trigger, 'processTrigger').mockResolvedValue({ id: 'test' });

            const result = await trigger.onToolExecution(
                'write_file',
                { file_path: 'test.js' },
                {}
            );

            expect(spy).toHaveBeenCalledWith('write_file', { file_path: 'test.js' }, {});
            expect(result).toEqual({ id: 'test' });
        });
    });

    describe('onExecutionComplete', () => {
        it('should handle successful tool execution', async () => {
            trigger.activeOperations.set('write_file', { timestamp: Date.now() });

            await trigger.onExecutionComplete(
                'write_file',
                { success: true },
                { basePath: '/test' }
            );

            expect(trigger.activeOperations.has('write_file')).toBe(false);
        });

        it('should handle failed tool execution', async () => {
            trigger.activeOperations.set('write_file', { timestamp: Date.now() });

            await trigger.onExecutionComplete(
                'write_file',
                { error: new Error('Tool failed') },
                { basePath: '/test' }
            );

            expect(trigger.activeOperations.has('write_file')).toBe(false);
        });
    });

    describe('onApplicationStart', () => {
        it('should reset session state', async () => {
            trigger.sessionSnapshots = 5;
            trigger.lastSnapshotTime = Date.now();
            trigger.activeOperations.set('test', {});

            await trigger.onApplicationStart({ basePath: '/test' });

            expect(trigger.sessionSnapshots).toBe(0);
            expect(trigger.lastSnapshotTime).toBe(0);
            expect(trigger.activeOperations.size).toBe(0);
        });
    });

    describe('shouldSkipSnapshot', () => {
        it('should return opposite of _shouldTriggerSnapshot', () => {
            const spy = vi.spyOn(trigger, '_shouldTriggerSnapshot').mockReturnValue(true);
            expect(trigger.shouldSkipSnapshot('write_file', {}, {})).toBe(false);

            spy.mockReturnValue(false);
            expect(trigger.shouldSkipSnapshot('write_file', {}, {})).toBe(true);
        });
    });

    describe('resetSession', () => {
        it('should reset all session state', () => {
            trigger.sessionSnapshots = 10;
            trigger.lastSnapshotTime = Date.now();
            trigger.activeOperations.set('test', {});

            trigger.resetSession();

            expect(trigger.sessionSnapshots).toBe(0);
            expect(trigger.lastSnapshotTime).toBe(0);
            expect(trigger.activeOperations.size).toBe(0);
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration', () => {
            const newConfig = {
                enabled: false,
                maxSnapshotsPerSession: 15,
                cooldownPeriod: 10000,
            };

            trigger.updateConfiguration(newConfig);

            expect(trigger.config.enabled).toBe(false);
            expect(trigger.config.maxSnapshotsPerSession).toBe(15);
            expect(trigger.config.cooldownPeriod).toBe(10000);
            expect(trigger.config.includeToolName).toBe(true); // Should preserve existing values
        });
    });

    describe('getStats', () => {
        it('should return comprehensive statistics', () => {
            trigger.sessionSnapshots = 5;
            trigger.lastSnapshotTime = Date.now() - 1000;
            trigger.activeOperations.set('test', {});

            const stats = trigger.getStats();

            expect(stats).toMatchObject({
                sessionSnapshots: 5,
                lastSnapshotTime: expect.any(Number),
                activeOperations: 1,
                config: expect.objectContaining({
                    enabled: true,
                    maxSnapshotsPerSession: 20,
                }),
                timeSinceLastSnapshot: expect.any(Number),
            });
        });

        it('should return null for timeSinceLastSnapshot when no snapshots created', () => {
            const stats = trigger.getStats();
            expect(stats.timeSinceLastSnapshot).toBeNull();
        });
    });

    describe('isInCooldown', () => {
        it('should return false when no snapshots created', () => {
            expect(trigger.isInCooldown()).toBe(false);
        });

        it('should return true when in cooldown period', () => {
            trigger.lastSnapshotTime = Date.now() - 1000; // 1 second ago

            expect(trigger.isInCooldown()).toBe(true);
        });

        it('should return false when cooldown period has passed', () => {
            trigger.lastSnapshotTime = Date.now() - 6000; // 6 seconds ago

            expect(trigger.isInCooldown()).toBe(false);
        });
    });

    describe('getRemainingCooldown', () => {
        it('should return 0 when not in cooldown', () => {
            expect(trigger.getRemainingCooldown()).toBe(0);
        });

        it('should return remaining time when in cooldown', () => {
            trigger.lastSnapshotTime = Date.now() - 2000; // 2 seconds ago

            const remaining = trigger.getRemainingCooldown();
            expect(remaining).toBeGreaterThan(2900); // Should be close to 3000ms remaining
            expect(remaining).toBeLessThanOrEqual(3000);
        });
    });

    describe('forceCreateSnapshot', () => {
        it('should create snapshot regardless of cooldown or limits', async () => {
            // Set conditions that would normally prevent snapshot creation
            trigger.sessionSnapshots = 25; // Over limit
            trigger.lastSnapshotTime = Date.now() - 100; // In cooldown

            const result = await trigger.forceCreateSnapshot('write_file', {
                file_path: 'test.js',
            });

            expect(result.id).toBe('snapshot-123');
            expect(mockSnapshotManager.createSnapshot).toHaveBeenCalled();
        });

        it('should still update session tracking', async () => {
            const initialCount = trigger.sessionSnapshots;

            await trigger.forceCreateSnapshot('write_file', { file_path: 'test.js' });

            expect(trigger.sessionSnapshots).toBe(initialCount + 1);
            expect(trigger.lastSnapshotTime).toBeGreaterThan(0);
        });
    });

    describe('edge cases', () => {
        it('should handle missing arguments gracefully', async () => {
            const result = await trigger.processTrigger('write_file');
            expect(result).toBeDefined();
        });

        it('should handle missing context gracefully', async () => {
            const metadata = trigger.createToolMetadata('write_file', { file_path: 'test.js' });
            expect(metadata.context.basePath).toBe(process.cwd());
        });

        it('should handle tool monitor errors gracefully', () => {
            mockToolMonitor.shouldCreateSnapshot.mockImplementation(() => {
                throw new Error('Monitor error');
            });

            expect(() => {
                trigger._shouldTriggerSnapshot('write_file', {}, {});
            }).toThrow('Monitor error');
        });

        it('should handle snapshot manager errors gracefully', async () => {
            mockSnapshotManager.createSnapshot.mockRejectedValue(new Error('Manager error'));

            await expect(
                trigger.createTriggeredSnapshot('write_file', { file_path: 'test.js' })
            ).rejects.toThrow('Manager error');
        });
    });
});
