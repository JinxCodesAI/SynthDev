/**
 * Snapshot System Main Entry Point
 * Exports all public interfaces and components
 */

// Configuration
export { default as SnapshotConfig } from './SnapshotConfig.js';

// Main Manager
export { SnapshotManager } from './SnapshotManager.js';

// Interfaces and Abstract Classes
export { SnapshotStrategy, SnapshotStore } from './interfaces/SnapshotStrategy.js';

// Events
export { default as SnapshotEventEmitter, SnapshotEvents } from './events/SnapshotEventEmitter.js';

// Import classes for initialization
import SnapshotConfig from './SnapshotConfig.js';
import { SnapshotManager } from './SnapshotManager.js';
import SnapshotEventEmitter, { SnapshotEvents } from './events/SnapshotEventEmitter.js';
import SnapshotLogger from './utils/SnapshotLogger.js';
import ContentChangeDetector from './utils/ContentChangeDetector.js';
import SnapshotIntegrityValidator from './validation/SnapshotIntegrityValidator.js';
import PerformanceOptimizer from './utils/PerformanceOptimizer.js';
import SnapshotSerializer from './utils/SnapshotSerializer.js';
import MemorySnapshotStore from './storage/MemorySnapshotStore.js';

// Utilities
export { default as SnapshotLogger } from './utils/SnapshotLogger.js';
export { default as IdGenerator } from './utils/IdGenerator.js';
export { default as ContentChangeDetector } from './utils/ContentChangeDetector.js';
export { default as PerformanceOptimizer } from './utils/PerformanceOptimizer.js';
export { default as SnapshotSerializer } from './utils/SnapshotSerializer.js';

// Models
export { default as Snapshot } from './models/Snapshot.js';
export { default as SnapshotMetadata } from './models/SnapshotMetadata.js';

// Storage
export { default as MemorySnapshotStore } from './storage/MemorySnapshotStore.js';

// Validation
export { default as SnapshotIntegrityValidator } from './validation/SnapshotIntegrityValidator.js';

// Version information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

/**
 * Initialize the snapshot system with configuration
 * @param {Object} config - Configuration object (optional)
 * @returns {Object} Initialized snapshot system components
 */
//REVIEW: >>where this function is used ?<<
export function initializeSnapshotSystem(config = null) {
    const snapshotConfig = config ? new SnapshotConfig(config) : new SnapshotConfig();
    const logger = new SnapshotLogger();
    const eventEmitter = new SnapshotEventEmitter();
    const changeDetector = new ContentChangeDetector(snapshotConfig);
    const integrityValidator = new SnapshotIntegrityValidator(snapshotConfig);
    const performanceOptimizer = new PerformanceOptimizer(snapshotConfig);
    const serializer = new SnapshotSerializer(snapshotConfig);
    const memoryStore = new MemorySnapshotStore(snapshotConfig, logger);

    // Create the main snapshot manager
    const snapshotManager = new SnapshotManager(snapshotConfig, eventEmitter);

    logger.info('Snapshot system initialized');
    eventEmitter.emit(SnapshotEvents.SYSTEM_INITIALIZED, {
        version: VERSION,
        buildDate: BUILD_DATE,
        config: snapshotConfig.getConfig(),
    });

    return {
        config: snapshotConfig,
        manager: snapshotManager,
        logger,
        eventEmitter,
        changeDetector,
        integrityValidator,
        performanceOptimizer,
        serializer,
        memoryStore,
        version: VERSION,
    };
}

/**
 * Get system information
 * @returns {Object} System information
 */
export function getSystemInfo() {
    return {
        name: 'SynthDev Snapshots',
        version: VERSION,
        buildDate: BUILD_DATE,
        components: [
            'SnapshotManager',
            'SnapshotConfig',
            'SnapshotStrategy',
            'SnapshotStore',
            'SnapshotEventEmitter',
            'SnapshotLogger',
            'IdGenerator',
            'ContentChangeDetector',
            'SnapshotIntegrityValidator',
            'PerformanceOptimizer',
            'SnapshotSerializer',
            'Snapshot',
            'SnapshotMetadata',
            'MemorySnapshotStore',
        ],
    };
}
