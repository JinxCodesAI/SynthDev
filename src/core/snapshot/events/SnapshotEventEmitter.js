/**
 * Event emitter for snapshot system events
 * Provides a simple event system for snapshot lifecycle notifications
 */

/**
 * Event emitter interface for snapshot events
 *
 * Purpose: Provides event-driven architecture for snapshot system coordination
 *
 * Event Listeners:
 * - SnapshotManager: Listens to strategy switches, snapshot creation, system errors
 * - Strategies (Git/File): Emit events for snapshot operations, initialization
 * - External integrations: Can listen to snapshot lifecycle events
 * - Performance monitoring: Tracks operation metrics via events
 * - User interface: Updates UI based on snapshot events
 *
 * Key Events:
 * - snapshot:created, snapshot:restored, snapshot:deleted (lifecycle)
 * - strategy:switched, strategy:initialized (strategy management)
 * - git:branch_created, git:commit_created (Git operations)
 * - system:initialized, system:error (system status)
 *
 * Benefits:
 * - Decoupled communication between components
 * - Extensible event system for future integrations
 * - Centralized event coordination
 * - Performance monitoring and debugging support
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
     * Add a one-time event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     */
    once(event, listener) {
        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            listener(...args);
        };
        this.on(event, onceWrapper);
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
     * @param {string} event - Event name (optional, if not provided removes all listeners)
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get the number of listeners for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).length : 0;
    }

    /**
     * Get all event names that have listeners
     * @returns {string[]} Array of event names
     */
    eventNames() {
        return Array.from(this.listeners.keys());
    }
}

/**
 * Snapshot system event types
 */
export const SnapshotEvents = {
    // Snapshot lifecycle events
    SNAPSHOT_CREATED: 'snapshot:created',
    SNAPSHOT_RESTORED: 'snapshot:restored',
    SNAPSHOT_DELETED: 'snapshot:deleted',
    SNAPSHOT_FAILED: 'snapshot:failed',

    // Strategy events
    STRATEGY_SWITCHED: 'strategy:switched',
    STRATEGY_FAILED: 'strategy:failed',

    // File events
    FILE_BACKED_UP: 'file:backed_up',
    FILE_RESTORED: 'file:restored',
    FILE_CHANGED: 'file:changed',

    // Git events
    GIT_BRANCH_CREATED: 'git:branch_created',
    GIT_COMMIT_CREATED: 'git:commit_created',
    GIT_MERGE_COMPLETED: 'git:merge_completed',
    GIT_RESET_COMPLETED: 'git:reset_completed',

    // System events
    SYSTEM_INITIALIZED: 'system:initialized',
    SYSTEM_SHUTDOWN: 'system:shutdown',
    CLEANUP_STARTED: 'cleanup:started',
    CLEANUP_COMPLETED: 'cleanup:completed',

    // Error events
    ERROR_OCCURRED: 'error:occurred',
    WARNING_ISSUED: 'warning:issued',
};

export default SnapshotEventEmitter;
