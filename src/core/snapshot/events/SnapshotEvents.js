/**
 * Snapshot System Event Constants
 * Defines all event types used throughout the snapshot system
 */

/**
 * Event constants for the snapshot system
 */
export const SnapshotEvents = {
    // System events
    SYSTEM_INITIALIZED: 'system:initialized',
    SYSTEM_ERROR: 'system:error',
    STRATEGY_INITIALIZED: 'strategy:initialized',
    STRATEGY_FACTORY_INITIALIZED: 'strategy:factory:initialized',
    STRATEGY_SWITCHED: 'strategy:switched',

    // Git events
    GIT_INITIALIZED: 'git:initialized',
    GIT_OPERATION_SUCCESS: 'git:operation:success',
    GIT_OPERATION_FAILED: 'git:operation:failed',

    // Branch events
    BRANCH_CREATED: 'branch:created',
    BRANCH_SWITCHED: 'branch:switched',
    BRANCH_DELETED: 'branch:deleted',
    BRANCH_MERGED: 'branch:merged',

    // Snapshot-specific branch events
    SNAPSHOT_BRANCH_CREATED: 'snapshot:branch:created',
    SNAPSHOT_BRANCH_DELETED: 'snapshot:branch:deleted',

    // File events
    FILES_STAGED: 'files:staged',
    COMMIT_CREATED: 'commit:created',

    // Repository events
    REPOSITORY_RESET: 'repository:reset',

    // Snapshot events
    SNAPSHOT_CREATED: 'snapshot:created',
    SNAPSHOT_RESTORED: 'snapshot:restored',
    SNAPSHOT_DELETED: 'snapshot:deleted',
    SNAPSHOT_VALIDATED: 'snapshot:validated',
    SNAPSHOTS_CLEARED: 'snapshots:cleared',

    // Change detection events
    CHANGE_DETECTED: 'change:detected',
    CACHE_HIT: 'cache:hit',
    CACHE_MISS: 'cache:miss',

    // Performance events
    PERFORMANCE_WARNING: 'performance:warning',
    MEMORY_THRESHOLD_EXCEEDED: 'memory:threshold:exceeded',

    // Storage events
    STORAGE_FULL: 'storage:full',
    STORAGE_CLEANUP: 'storage:cleanup',
};

/**
 * Event categories for filtering and organization
 */
export const EventCategories = {
    SYSTEM: 'system',
    GIT: 'git',
    BRANCH: 'branch',
    SNAPSHOT: 'snapshot',
    PERFORMANCE: 'performance',
    STORAGE: 'storage',
    CHANGE: 'change',
};

/**
 * Get event category from event name
 * @param {string} eventName - Event name
 * @returns {string} Event category
 */
export function getEventCategory(eventName) {
    if (!eventName || typeof eventName !== 'string') {
        return 'unknown';
    }

    const parts = eventName.split(':');
    return parts[0] || 'unknown';
}

/**
 * Check if event belongs to a specific category
 * @param {string} eventName - Event name
 * @param {string} category - Category to check
 * @returns {boolean}
 */
export function isEventInCategory(eventName, category) {
    return getEventCategory(eventName) === category;
}
