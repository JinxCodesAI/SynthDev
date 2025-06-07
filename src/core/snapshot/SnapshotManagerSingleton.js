/**
 * SnapshotManager Singleton
 *
 * This singleton ensures that there's only one SnapshotManager instance
 * across the entire application, solving the issue where AutoSnapshotManager
 * and SnapshotsCommand had separate instances with separate stores.
 */

import { SnapshotManager } from './SnapshotManager.js';

let instance = null;

/**
 * Get the singleton SnapshotManager instance
 * @returns {SnapshotManager} The singleton instance
 */
export function getSnapshotManager() {
    if (!instance) {
        instance = new SnapshotManager();
    }
    return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 * @returns {void}
 */
export function resetSnapshotManager() {
    instance = null;
}

/**
 * Check if singleton instance exists
 * @returns {boolean} True if instance exists
 */
export function hasSnapshotManagerInstance() {
    return instance !== null;
}
