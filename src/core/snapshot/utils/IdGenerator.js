/**
 * ID generation utilities for the snapshot system
 * Provides various methods for generating unique identifiers
 */

import { createHash, randomBytes } from 'crypto';

/**
 * ID generator for snapshots and related entities
 */
class IdGenerator {
    /**
     * Generate a unique snapshot ID
     * @param {string} instruction - User instruction (optional, for deterministic IDs)
     * @returns {string} Unique snapshot ID
     */
    static generateSnapshotId(instruction = null) {
        const timestamp = Date.now();
        const random = randomBytes(4).toString('hex');

        if (instruction) {
            // Create a deterministic component based on instruction
            const instructionHash = createHash('md5')
                .update(instruction)
                .digest('hex')
                .substring(0, 8);
            return `snap_${timestamp}_${instructionHash}_${random}`;
        }

        return `snap_${timestamp}_${random}`;
    }

    /**
     * Generate a session ID for tracking related snapshots
     * @returns {string} Session ID
     */
    static generateSessionId() {
        const timestamp = Date.now();
        const random = randomBytes(6).toString('hex');
        return `session_${timestamp}_${random}`;
    }

    /**
     * Generate a short ID for display purposes
     * @param {string} fullId - Full ID to shorten
     * @returns {string} Short ID (first 8 characters)
     */
    static generateShortId(fullId) {
        return fullId.substring(0, 8);
    }

    /**
     * Generate a Git branch name from instruction
     * @param {string} instruction - User instruction
     * @param {string} prefix - Branch prefix (default: 'synth-dev/')
     * @returns {string} Safe Git branch name
     */
    static generateBranchName(instruction, prefix = 'synth-dev/') {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const safeName = instruction
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .slice(0, 30); // Limit length

        return `${prefix}${timestamp}-${safeName}`;
    }

    /**
     * Generate a content hash for change detection
     * @param {string} content - Content to hash
     * @param {string} algorithm - Hash algorithm (default: 'md5')
     * @returns {string} Content hash
     */
    static generateContentHash(content, algorithm = 'md5') {
        return createHash(algorithm).update(content, 'utf8').digest('hex');
    }

    /**
     * Generate a file checksum
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @returns {string} File checksum
     */
    static generateFileChecksum(filePath, content) {
        const combined = `${filePath}:${content}`;
        return createHash('md5').update(combined, 'utf8').digest('hex');
    }

    /**
     * Generate a UUID-like identifier
     * @returns {string} UUID-like string
     */
    static generateUUID() {
        const bytes = randomBytes(16);

        // Set version (4) and variant bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = bytes.toString('hex');
        return [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32),
        ].join('-');
    }

    /**
     * Validate an ID format
     * @param {string} id - ID to validate
     * @param {string} type - Expected ID type ('snapshot', 'session', 'uuid')
     * @returns {boolean} True if ID is valid
     */
    static validateId(id, type = 'snapshot') {
        if (!id || typeof id !== 'string') {
            return false;
        }

        switch (type) {
        case 'snapshot':
            return (
                /^snap_\d+_[a-f0-9]{8}_[a-f0-9]{8}$/.test(id) ||
                    /^snap_\d+_[a-f0-9]{8}$/.test(id)
            );
        case 'session':
            return /^session_\d+_[a-f0-9]{12}$/.test(id);
        case 'uuid':
            return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
                id
            );
        default:
            return id.length > 0;
        }
    }

    /**
     * Extract timestamp from a snapshot ID
     * @param {string} snapshotId - Snapshot ID
     * @returns {Date|null} Timestamp or null if invalid
     */
    static extractTimestamp(snapshotId) {
        const match = snapshotId.match(/^snap_(\d+)_/);
        if (match) {
            return new Date(parseInt(match[1], 10));
        }
        return null;
    }

    /**
     * Generate a deterministic ID from multiple inputs
     * @param {...string} inputs - Input strings to combine
     * @returns {string} Deterministic ID
     */
    static generateDeterministicId(...inputs) {
        const combined = inputs.join('|');
        const hash = createHash('sha256').update(combined, 'utf8').digest('hex');
        return hash.substring(0, 16);
    }

    /**
     * Generate a human-readable ID
     * @param {string} prefix - ID prefix
     * @param {string} description - Description to include
     * @returns {string} Human-readable ID
     */
    static generateReadableId(prefix, description) {
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const safeDescription = description
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 20);

        const random = randomBytes(2).toString('hex');
        return `${prefix}-${timestamp}-${safeDescription}-${random}`;
    }
}

export default IdGenerator;
