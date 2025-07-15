/**
 * Mock Strategy for Testing
 */

import { SnapshotStrategy } from '../../../../src/core/snapshot/interfaces/SnapshotStrategy.js';

/**
 * Mock implementation of SnapshotStrategy for testing
 */
export class MockStrategy extends SnapshotStrategy {
    constructor() {
        super();
        this.isInitialized = false;
        this.snapshots = new Map();
        this.mode = 'mock';
    }

    /**
     * Get strategy mode
     * @returns {string} Strategy mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Initialize the strategy
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        this.isInitialized = true;
        return { success: true };
    }

    /**
     * Create a snapshot
     * @param {string} instruction - Snapshot instruction
     * @param {Map<string, string>|Array<string>|null} files - Files to include
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, snapshot?: Object, error?: string}>}
     */
    async createSnapshot(instruction, files = null, options = {}) {
        if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
            return { success: false, error: 'Snapshot instruction is required' };
        }

        if (files !== null && !(files instanceof Map) && !Array.isArray(files)) {
            return { success: false, error: 'Files must be a Map, Array, or null' };
        }

        const snapshot = {
            id: `mock-${Date.now()}`,
            instruction,
            files: files || new Map(),
            timestamp: new Date(),
            mode: this.mode,
        };

        this.snapshots.set(snapshot.id, snapshot);
        return { success: true, snapshot };
    }

    /**
     * Get snapshots
     * @param {Object} options - Query options
     * @returns {Promise<{success: boolean, snapshots?: Array, error?: string}>}
     */
    async getSnapshots(options = {}) {
        const snapshots = Array.from(this.snapshots.values());
        return { success: true, snapshots };
    }

    /**
     * Get a snapshot by ID
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, snapshot?: Object, error?: string}>}
     */
    async getSnapshot(id) {
        const snapshot = this.snapshots.get(id);
        if (!snapshot) {
            return { success: false, error: `Snapshot ${id} not found` };
        }
        return { success: true, snapshot };
    }

    /**
     * Restore a snapshot
     * @param {string} id - Snapshot ID
     * @param {Object} options - Restoration options
     * @returns {Promise<{success: boolean, filesRestored?: Array, error?: string}>}
     */
    async restoreSnapshot(id, options = {}) {
        const snapshot = this.snapshots.get(id);
        if (!snapshot) {
            return { success: false, error: `Snapshot ${id} not found` };
        }
        return {
            success: true,
            filesRestored: Array.from(snapshot.files.keys()),
        };
    }

    /**
     * Delete a snapshot
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteSnapshot(id) {
        const snapshot = this.snapshots.get(id);
        if (!snapshot) {
            return { success: false, error: `Snapshot ${id} not found` };
        }
        this.snapshots.delete(id);
        return { success: true };
    }

    /**
     * Clear all snapshots
     * @param {Object} options - Clear options
     * @returns {Promise<{success: boolean, cleared?: number, error?: string}>}
     */
    async clearSnapshots(options = {}) {
        const count = this.snapshots.size;
        this.snapshots.clear();
        return { success: true, cleared: count };
    }

    /**
     * Get strategy status
     * @returns {Promise<Object>} Status information
     */
    async getStatus() {
        return {
            mode: this.mode,
            initialized: this.isInitialized,
            snapshotCount: this.snapshots.size,
        };
    }

    /**
     * Shutdown the strategy
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async shutdown() {
        this.isInitialized = false;
        return { success: true };
    }
}
