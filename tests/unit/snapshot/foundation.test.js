/**
 * Unit tests for snapshot system foundation components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SnapshotConfig from '../../../src/core/snapshot/SnapshotConfig.js';
import {
    SnapshotStrategy,
    SnapshotStore,
} from '../../../src/core/snapshot/interfaces/SnapshotStrategy.js';
import SnapshotEventEmitter, {
    SnapshotEvents,
} from '../../../src/core/snapshot/events/SnapshotEventEmitter.js';
import SnapshotLogger from '../../../src/core/snapshot/utils/SnapshotLogger.js';
import IdGenerator from '../../../src/core/snapshot/utils/IdGenerator.js';

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('SnapshotConfig', () => {
    let config;

    beforeEach(() => {
        // Mock process.cwd() before creating config
        process.cwd = vi.fn(() => '/test/workspace');

        // Clear environment variables
        delete process.env.SYNTHDEV_SNAPSHOT_MODE;
        delete process.env.SYNTHDEV_SNAPSHOT_BRANCH_PREFIX;
        delete process.env.SYNTHDEV_SNAPSHOT_MAX_COUNT;
        config = new SnapshotConfig();
    });

    afterEach(() => {
        // Restore original process.cwd
        process.cwd = originalCwd;
    });

    it('should load default configuration', () => {
        const snapshotConfig = config.getSnapshotConfig();
        expect(snapshotConfig.mode).toBe('auto');
        expect(snapshotConfig.git.branchPrefix).toBe('synth-dev/');
        expect(snapshotConfig.file.maxSnapshots).toBe(50);
    });

    it('should apply environment variable overrides', async () => {
        process.env.SYNTHDEV_SNAPSHOT_MODE = 'git';
        process.env.SYNTHDEV_SNAPSHOT_MAX_COUNT = '100';

        // Reload ConfigManager to pick up environment changes
        const ConfigManager = (await import('../../../src/config/managers/configManager.js'))
            .default;
        const configManager = ConfigManager.getInstance();
        await configManager.reloadConfiguration();

        const newConfig = new SnapshotConfig();
        const snapshotConfig = newConfig.getSnapshotConfig();

        expect(snapshotConfig.mode).toBe('git');
        expect(snapshotConfig.file.maxSnapshots).toBe(100);
    });

    it('should validate configuration', () => {
        expect(() => {
            const invalidConfig = new SnapshotConfig();
            invalidConfig.updateConfig('snapshots.mode', 'invalid');
        }).toThrow();
    });

    it('should parse memory limits correctly', () => {
        expect(config.parseMemoryLimit('100MB')).toBe(100 * 1024 * 1024);
        expect(config.parseMemoryLimit('1GB')).toBe(1024 * 1024 * 1024);
        expect(config.parseMemoryLimit('512KB')).toBe(512 * 1024);
    });

    it('should update configuration at runtime', () => {
        config.updateConfig('snapshots.file.maxSnapshots', 75);
        expect(config.getFileConfig().maxSnapshots).toBe(75);
    });
});

describe('SnapshotStrategy Abstract Class', () => {
    it('should not be instantiable directly', () => {
        expect(() => new SnapshotStrategy()).toThrow('SnapshotStrategy is an abstract class');
    });

    it('should require subclasses to implement abstract methods', async () => {
        class TestStrategy extends SnapshotStrategy {
            constructor() {
                super({}, console);
            }
        }

        const strategy = new TestStrategy();

        await expect(() => strategy.initialize()).rejects.toThrow(
            'initialize() must be implemented'
        );
        await expect(() => strategy.createSnapshot()).rejects.toThrow(
            'createSnapshot() must be implemented'
        );
        await expect(() => strategy.getSnapshots()).rejects.toThrow(
            'getSnapshots() must be implemented'
        );
    });
});

describe('SnapshotStore Abstract Class', () => {
    it('should not be instantiable directly', () => {
        expect(() => new SnapshotStore()).toThrow('SnapshotStore is an abstract class');
    });

    it('should require subclasses to implement abstract methods', async () => {
        class TestStore extends SnapshotStore {
            constructor() {
                super({}, console);
            }
        }

        const store = new TestStore();

        await expect(() => store.initialize()).rejects.toThrow('initialize() must be implemented');
        await expect(() => store.storeSnapshot()).rejects.toThrow(
            'storeSnapshot() must be implemented'
        );
        await expect(() => store.getSnapshot()).rejects.toThrow(
            'getSnapshot() must be implemented'
        );
    });
});

describe('SnapshotEventEmitter', () => {
    let emitter;

    beforeEach(() => {
        emitter = new SnapshotEventEmitter();
    });

    it('should add and emit events', () => {
        let eventFired = false;
        const listener = () => {
            eventFired = true;
        };

        emitter.on('test', listener);
        emitter.emit('test');

        expect(eventFired).toBe(true);
    });

    it('should remove event listeners', () => {
        let eventFired = false;
        const listener = () => {
            eventFired = true;
        };

        emitter.on('test', listener);
        emitter.off('test', listener);
        emitter.emit('test');

        expect(eventFired).toBe(false);
    });

    it('should support once listeners', () => {
        let callCount = 0;
        const listener = () => {
            callCount++;
        };

        emitter.once('test', listener);
        emitter.emit('test');
        emitter.emit('test');

        expect(callCount).toBe(1);
    });

    it('should provide listener count', () => {
        const listener1 = () => {};
        const listener2 = () => {};

        emitter.on('test', listener1);
        emitter.on('test', listener2);

        expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should handle errors in listeners gracefully', () => {
        const errorListener = () => {
            throw new Error('Test error');
        };
        const normalListener = vi.fn();

        emitter.on('test', errorListener);
        emitter.on('test', normalListener);

        // Should not throw
        expect(() => emitter.emit('test')).not.toThrow();
        expect(normalListener).toHaveBeenCalled();
    });
});

describe('IdGenerator', () => {
    it('should generate unique snapshot IDs', () => {
        const id1 = IdGenerator.generateSnapshotId();
        const id2 = IdGenerator.generateSnapshotId();

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^snap_\d+_[a-f0-9]{8}$/);
    });

    it('should generate deterministic IDs with instruction', () => {
        const instruction = 'test instruction';
        const id1 = IdGenerator.generateSnapshotId(instruction);
        const id2 = IdGenerator.generateSnapshotId(instruction);

        // Should have same instruction hash component
        const hash1 = id1.split('_')[2];
        const hash2 = id2.split('_')[2];
        expect(hash1).toBe(hash2);
    });

    it('should generate valid Git branch names', () => {
        const branchName = IdGenerator.generateBranchName('Add authentication system');
        expect(branchName).toMatch(/^synth-dev\/\d{8}T\d{6}-add-authentication-system$/);
    });

    it('should validate ID formats', () => {
        const validSnapshotId = IdGenerator.generateSnapshotId();
        const validSessionId = IdGenerator.generateSessionId();
        const validUUID = IdGenerator.generateUUID();

        expect(IdGenerator.validateId(validSnapshotId, 'snapshot')).toBe(true);
        expect(IdGenerator.validateId(validSessionId, 'session')).toBe(true);
        expect(IdGenerator.validateId(validUUID, 'uuid')).toBe(true);
        expect(IdGenerator.validateId('invalid', 'snapshot')).toBe(false);
    });

    it('should extract timestamps from snapshot IDs', () => {
        const beforeTime = Date.now();
        const snapshotId = IdGenerator.generateSnapshotId();
        const afterTime = Date.now();

        const extractedTime = IdGenerator.extractTimestamp(snapshotId);
        expect(extractedTime.getTime()).toBeGreaterThanOrEqual(beforeTime);
        expect(extractedTime.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should generate content hashes', () => {
        const content = 'test content';
        const hash1 = IdGenerator.generateContentHash(content);
        const hash2 = IdGenerator.generateContentHash(content);

        expect(hash1).toBe(hash2); // Same content should produce same hash
        expect(hash1).toMatch(/^[a-f0-9]{32}$/); // MD5 format
    });
});

describe('SnapshotEvents', () => {
    it('should define all required event types', () => {
        expect(SnapshotEvents.SNAPSHOT_CREATED).toBe('snapshot:created');
        expect(SnapshotEvents.SNAPSHOT_RESTORED).toBe('snapshot:restored');
        expect(SnapshotEvents.STRATEGY_SWITCHED).toBe('strategy:switched');
        expect(SnapshotEvents.GIT_BRANCH_CREATED).toBe('git:branch_created');
        expect(SnapshotEvents.SYSTEM_INITIALIZED).toBe('system:initialized');
    });
});
