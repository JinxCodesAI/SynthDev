/**
 * Snapshot Serialization and Deserialization Utilities
 * Handles conversion between Snapshot objects and various formats
 */

import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import Snapshot from '../models/Snapshot.js';
import SnapshotLogger from './SnapshotLogger.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Snapshot serialization utilities
 */
class SnapshotSerializer {
    constructor(config) {
        this.config = config;
        this.logger = new SnapshotLogger();
        this.compressionEnabled = config.getFileConfig().compressionEnabled;
        this.version = '1.0.0';
    }

    /**
     * Serialize snapshot to JSON
     * @param {Snapshot} snapshot - Snapshot to serialize
     * @param {boolean} compress - Whether to compress the result
     * @returns {Promise<string|Buffer>} Serialized snapshot
     */
    async serializeToJSON(snapshot, compress = this.compressionEnabled) {
        const timer = this.logger.createTimer('serialize_json');

        try {
            const data = {
                version: this.version,
                timestamp: new Date().toISOString(),
                snapshot: snapshot.toObject(),
                checksum: null, // Will be calculated after serialization
            };

            // Calculate checksum on the data without checksum field
            const dataForChecksum = { ...data };
            delete dataForChecksum.checksum;
            const checksum = createHash('md5')
                .update(JSON.stringify(dataForChecksum))
                .digest('hex');
            data.checksum = checksum;

            const finalJsonString = JSON.stringify(data, null, compress ? 0 : 2);

            let result = finalJsonString;
            const originalSize = Buffer.byteLength(finalJsonString, 'utf8');
            let compressedSize = originalSize;

            if (compress) {
                const compressed = await gzipAsync(finalJsonString);
                result = compressed;
                compressedSize = compressed.length;
            }

            this.logger.logPerformanceMetric('serialization_completed', originalSize, {
                snapshotId: snapshot.id,
                compressed: compress,
                originalSize,
                compressedSize,
                compressionRatio: compress
                    ? Math.round((1 - compressedSize / originalSize) * 100)
                    : 0,
            });

            timer(true, { originalSize, compressedSize, compressed: compress });
            return result;
        } catch (error) {
            this.logger.error(`Error serializing snapshot ${snapshot.id}: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Deserialize snapshot from JSON
     * @param {string|Buffer} data - Serialized data
     * @param {boolean} compressed - Whether data is compressed
     * @returns {Promise<Snapshot>} Deserialized snapshot
     */
    async deserializeFromJSON(data, compressed = null) {
        const timer = this.logger.createTimer('deserialize_json');

        try {
            let jsonString;

            // Auto-detect compression if not specified
            if (compressed === null) {
                compressed = Buffer.isBuffer(data);
            }

            if (compressed) {
                const decompressed = await gunzipAsync(data);
                jsonString = decompressed.toString('utf8');
            } else {
                jsonString = typeof data === 'string' ? data : data.toString('utf8');
            }

            const parsedData = JSON.parse(jsonString);

            // Validate format
            this._validateSerializedData(parsedData);

            // Verify checksum
            const dataForChecksum = { ...parsedData };
            delete dataForChecksum.checksum;
            const expectedChecksum = createHash('md5')
                .update(JSON.stringify(dataForChecksum))
                .digest('hex');

            if (parsedData.checksum !== expectedChecksum) {
                throw new Error('Checksum validation failed - data may be corrupted');
            }

            const snapshot = Snapshot.fromObject(parsedData.snapshot);

            this.logger.logPerformanceMetric('deserialization_completed', jsonString.length, {
                snapshotId: snapshot.id,
                compressed,
                version: parsedData.version,
            });

            timer(true, { size: jsonString.length, compressed });
            return snapshot;
        } catch (error) {
            this.logger.error(`Error deserializing snapshot: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Serialize multiple snapshots to a single archive
     * @param {Snapshot[]} snapshots - Array of snapshots
     * @returns {Promise<Buffer>} Serialized archive
     */
    async serializeToArchive(snapshots) {
        const timer = this.logger.createTimer('serialize_archive');

        try {
            const archive = {
                version: this.version,
                created: new Date().toISOString(),
                count: snapshots.length,
                snapshots: [],
                metadata: {
                    totalSize: 0,
                    modes: {},
                    timeRange: {
                        earliest: null,
                        latest: null,
                    },
                },
            };

            // Process each snapshot
            for (const snapshot of snapshots) {
                const snapshotData = snapshot.toObject();
                archive.snapshots.push(snapshotData);

                // Update metadata
                archive.metadata.totalSize += snapshot.calculateSize();
                archive.metadata.modes[snapshot.mode] =
                    (archive.metadata.modes[snapshot.mode] || 0) + 1;

                const timestamp =
                    snapshot.timestamp instanceof Date
                        ? snapshot.timestamp.getTime()
                        : new Date(snapshot.timestamp).getTime();

                if (
                    !archive.metadata.timeRange.earliest ||
                    timestamp < archive.metadata.timeRange.earliest
                ) {
                    archive.metadata.timeRange.earliest = timestamp;
                }
                if (
                    !archive.metadata.timeRange.latest ||
                    timestamp > archive.metadata.timeRange.latest
                ) {
                    archive.metadata.timeRange.latest = timestamp;
                }
            }

            const jsonString = JSON.stringify(archive);
            const compressed = await gzipAsync(jsonString);

            this.logger.logSnapshotOperation('archive_created', {
                snapshotCount: snapshots.length,
                originalSize: Buffer.byteLength(jsonString, 'utf8'),
                compressedSize: compressed.length,
                success: true,
                duration: timer(true),
            });

            return compressed;
        } catch (error) {
            this.logger.error(`Error creating snapshot archive: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Deserialize snapshots from archive
     * @param {Buffer} archiveData - Compressed archive data
     * @returns {Promise<Snapshot[]>} Array of snapshots
     */
    async deserializeFromArchive(archiveData) {
        const timer = this.logger.createTimer('deserialize_archive');

        try {
            const decompressed = await gunzipAsync(archiveData);
            const archive = JSON.parse(decompressed.toString('utf8'));

            // Validate archive format
            if (!archive.version || !archive.snapshots || !Array.isArray(archive.snapshots)) {
                throw new Error('Invalid archive format');
            }

            const snapshots = [];
            for (const snapshotData of archive.snapshots) {
                const snapshot = Snapshot.fromObject(snapshotData);
                snapshots.push(snapshot);
            }

            this.logger.logSnapshotOperation('archive_extracted', {
                snapshotCount: snapshots.length,
                archiveVersion: archive.version,
                success: true,
                duration: timer(true),
            });

            return snapshots;
        } catch (error) {
            this.logger.error(`Error extracting snapshot archive: ${error.message}`);
            timer(false, { error: error.message });
            throw error;
        }
    }

    /**
     * Export snapshot to human-readable format
     * @param {Snapshot} snapshot - Snapshot to export
     * @returns {string} Human-readable representation
     */
    exportToReadableFormat(snapshot) {
        const lines = [];

        lines.push('='.repeat(80));
        lines.push(`SNAPSHOT: ${snapshot.id}`);
        lines.push('='.repeat(80));
        lines.push('');

        lines.push(`Instruction: ${snapshot.instruction}`);
        lines.push(`Timestamp: ${snapshot.timestamp}`);
        lines.push(`Mode: ${snapshot.mode}`);
        lines.push(`File Count: ${snapshot.files.size}`);

        if (snapshot.tags.length > 0) {
            lines.push(`Tags: ${snapshot.tags.join(', ')}`);
        }

        if (snapshot.author) {
            lines.push(`Author: ${snapshot.author}`);
        }

        if (snapshot.sessionId) {
            lines.push(`Session: ${snapshot.sessionId}`);
        }

        if (snapshot.mode === 'git') {
            lines.push('');
            lines.push('Git Information:');
            lines.push(`  Hash: ${snapshot.gitHash || 'N/A'}`);
            lines.push(`  Branch: ${snapshot.branchName || 'N/A'}`);
        }

        if (snapshot.files.size > 0) {
            lines.push('');
            lines.push('Files:');
            lines.push('-'.repeat(40));

            for (const [filePath, content] of snapshot.files) {
                if (content === null) {
                    lines.push(`  [DELETED] ${filePath}`);
                } else {
                    const size = Buffer.byteLength(content, 'utf8');
                    lines.push(`  ${filePath} (${size} bytes)`);
                }
            }
        }

        lines.push('');
        lines.push('='.repeat(80));

        return lines.join('\n');
    }

    /**
     * Create a snapshot diff in readable format
     * @param {Snapshot} snapshot1 - First snapshot
     * @param {Snapshot} snapshot2 - Second snapshot
     * @returns {string} Diff representation
     */
    createDiff(snapshot1, snapshot2) {
        const comparison = snapshot1.compare(snapshot2);
        const lines = [];

        lines.push('='.repeat(80));
        lines.push(`SNAPSHOT DIFF: ${snapshot1.id} -> ${snapshot2.id}`);
        lines.push('='.repeat(80));
        lines.push('');

        if (comparison.instruction) {
            lines.push('Instruction changed:');
            lines.push(`  From: ${snapshot1.instruction}`);
            lines.push(`  To:   ${snapshot2.instruction}`);
            lines.push('');
        }

        if (comparison.mode) {
            lines.push(`Mode changed: ${snapshot1.mode} -> ${snapshot2.mode}`);
            lines.push('');
        }

        if (comparison.files.added.length > 0) {
            lines.push('Added files:');
            for (const file of comparison.files.added) {
                lines.push(`  + ${file}`);
            }
            lines.push('');
        }

        if (comparison.files.removed.length > 0) {
            lines.push('Removed files:');
            for (const file of comparison.files.removed) {
                lines.push(`  - ${file}`);
            }
            lines.push('');
        }

        if (comparison.files.modified.length > 0) {
            lines.push('Modified files:');
            for (const file of comparison.files.modified) {
                lines.push(`  ~ ${file}`);
            }
            lines.push('');
        }

        lines.push('='.repeat(80));

        return lines.join('\n');
    }

    /**
     * Validate serialized data format
     * @private
     * @param {Object} data - Parsed data
     */
    _validateSerializedData(data) {
        if (!data.version) {
            throw new Error('Missing version information');
        }

        if (!data.snapshot) {
            throw new Error('Missing snapshot data');
        }

        if (!data.checksum) {
            throw new Error('Missing checksum');
        }

        // Version compatibility check
        const [majorVersion] = data.version.split('.');
        const [currentMajorVersion] = this.version.split('.');

        if (majorVersion !== currentMajorVersion) {
            throw new Error(`Incompatible version: ${data.version} (current: ${this.version})`);
        }
    }

    /**
     * Get serialization statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            version: this.version,
            compressionEnabled: this.compressionEnabled,
            supportedFormats: ['json', 'archive', 'readable'],
        };
    }
}

export default SnapshotSerializer;
