/**
 * Abstract base class for snapshot strategies
 * Defines the interface that all snapshot strategies must implement
 */

/**
 * Abstract snapshot strategy interface
 * This class defines the contract that all snapshot strategies must follow
 */
class SnapshotStrategy {
    constructor(config, logger) {
        if (this.constructor === SnapshotStrategy) {
            throw new Error(
                'SnapshotStrategy is an abstract class and cannot be instantiated directly'
            );
        }
        this.config = config;
        this.logger = logger;
    }

    /**
     * Initialize the strategy
     * @abstract
     * @returns {Promise<void>}
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Create a new snapshot
     * @abstract
     * @param {string} instruction - User instruction that triggered the snapshot
     * @param {Map<string, string>} files - Map of file paths to their content
     * @returns {Promise<Snapshot>} Created snapshot
     */
    async createSnapshot(instruction, files) {
        throw new Error('createSnapshot() must be implemented by subclass');
    }

    /**
     * Get all available snapshots
     * @abstract
     * @returns {Promise<Snapshot[]>} Array of snapshots
     */
    async getSnapshots() {
        throw new Error('getSnapshots() must be implemented by subclass');
    }

    /**
     * Get a specific snapshot by ID
     * @abstract
     * @param {string} id - Snapshot ID
     * @returns {Promise<Snapshot|null>} Snapshot or null if not found
     */
    async getSnapshot(id) {
        throw new Error('getSnapshot() must be implemented by subclass');
    }

    /**
     * Restore a snapshot
     * @abstract
     * @param {string} id - Snapshot ID to restore
     * @returns {Promise<RestoreResult>} Restoration result
     */
    async restoreSnapshot(id) {
        throw new Error('restoreSnapshot() must be implemented by subclass');
    }

    /**
     * Delete a snapshot
     * @abstract
     * @param {string} id - Snapshot ID to delete
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteSnapshot(id) {
        throw new Error('deleteSnapshot() must be implemented by subclass');
    }

    /**
     * Get the strategy mode identifier
     * @abstract
     * @returns {string} Strategy mode ('git' or 'file')
     */
    getMode() {
        throw new Error('getMode() must be implemented by subclass');
    }

    /**
     * Check if the strategy is available in the current environment
     * @abstract
     * @returns {Promise<boolean>} True if strategy is available
     */
    async isAvailable() {
        throw new Error('isAvailable() must be implemented by subclass');
    }

    /**
     * Get strategy status information
     * @abstract
     * @returns {Promise<Object>} Status information
     */
    async getStatus() {
        throw new Error('getStatus() must be implemented by subclass');
    }

    /**
     * Cleanup resources and perform maintenance
     * @abstract
     * @returns {Promise<void>}
     */
    async cleanup() {
        throw new Error('cleanup() must be implemented by subclass');
    }

    /**
     * Shutdown the strategy and release resources
     * @abstract
     * @returns {Promise<void>}
     */
    async shutdown() {
        throw new Error('shutdown() must be implemented by subclass');
    }
}

/**
 * Abstract storage interface
 * Defines the contract for snapshot storage implementations
 */
class SnapshotStore {
    constructor(config, logger) {
        if (this.constructor === SnapshotStore) {
            throw new Error(
                'SnapshotStore is an abstract class and cannot be instantiated directly'
            );
        }
        this.config = config;
        this.logger = logger;
    }

    /**
     * Initialize the storage
     * @abstract
     * @returns {Promise<void>}
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Store a snapshot
     * @abstract
     * @param {Snapshot} snapshot - Snapshot to store
     * @returns {Promise<void>}
     */
    async storeSnapshot(snapshot) {
        throw new Error('storeSnapshot() must be implemented by subclass');
    }

    /**
     * Retrieve a snapshot by ID
     * @abstract
     * @param {string} id - Snapshot ID
     * @returns {Promise<Snapshot|null>} Snapshot or null if not found
     */
    async getSnapshot(id) {
        throw new Error('getSnapshot() must be implemented by subclass');
    }

    /**
     * Get all snapshots
     * @abstract
     * @returns {Promise<Snapshot[]>} Array of snapshots
     */
    async getAllSnapshots() {
        throw new Error('getAllSnapshots() must be implemented by subclass');
    }

    /**
     * Delete a snapshot
     * @abstract
     * @param {string} id - Snapshot ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteSnapshot(id) {
        throw new Error('deleteSnapshot() must be implemented by subclass');
    }

    /**
     * Clear all snapshots
     * @abstract
     * @returns {Promise<void>}
     */
    async clearAll() {
        throw new Error('clearAll() must be implemented by subclass');
    }

    /**
     * Get storage statistics
     * @abstract
     * @returns {Promise<Object>} Storage statistics
     */
    async getStats() {
        throw new Error('getStats() must be implemented by subclass');
    }
}

/**
 * Event emitter interface for snapshot events
 */
class SnapshotEventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Add an event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(listener);
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     */
    off(event, listener) {
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Event arguments
     */
    emit(event, ...args) {
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            for (const listener of listeners) {
                try {
                    listener(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            }
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

export { SnapshotStrategy, SnapshotStore, SnapshotEventEmitter };
