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
