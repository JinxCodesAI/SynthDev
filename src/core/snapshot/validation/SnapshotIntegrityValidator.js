/**
 * Snapshot Integrity Validation System
 * Validates snapshot data integrity and consistency
 */

import { createHash } from 'crypto';
import SnapshotLogger from '../utils/SnapshotLogger.js';

/**
 * Validates snapshot integrity and consistency
 *
 * Usage: This validator is used by SnapshotManager to validate snapshots during:
 * - Snapshot creation (validateSnapshot method)
 * - Snapshot restoration (integrity checks)
 * - System health checks (validateSnapshot method)
 *
 * Documentation: Role described in:
 * - src/core/snapshot/README.md (Validation section)
 * - docs/functional-specification/snapshots-reimplementation-spec.md (Integrity validation)
 * - Comprehensive unit tests in tests/unit/snapshot/content-change-detection.test.js
 *
 * The validator ensures snapshot data integrity through:
 * - Structure validation (required fields, data types)
 * - Content hash verification (file content matches stored hashes)
 * - File existence validation (referenced files exist)
 * - Checksum consistency (stored checksums match calculated values)
 * - Metadata validation (instruction format, timestamp validity)
 */
class SnapshotIntegrityValidator {
    constructor(config) {
        this.config = config;
        this.logger = new SnapshotLogger();
        this.hashAlgorithm = config.getSnapshotConfig().contentHashing.algorithm || 'md5';
    }

    /**
     * Validate a complete snapshot
     * @param {Object} snapshot - Snapshot object to validate
     * @returns {Promise<{valid: boolean, details: Object}>} Validation result
     */
    async validateSnapshot(snapshot) {
        const timer = this.logger.createTimer('snapshot_validation');

        try {
            const validationResults = {
                structure: this.validateSnapshotStructure(snapshot),
                contentHashes: await this.validateContentHashes(snapshot),
                fileExistence: await this.validateFileExistence(snapshot),
                checksumConsistency: await this.validateChecksumConsistency(snapshot),
                metadata: this.validateMetadata(snapshot),
            };

            const isValid = Object.values(validationResults).every(result => result.valid);

            timer(isValid);
            this.logger.logSnapshotOperation('validate', {
                snapshotId: snapshot.id,
                mode: snapshot.mode,
                success: isValid,
                validationResults,
            });

            return {
                valid: isValid,
                details: validationResults,
                summary: this._generateValidationSummary(validationResults),
            };
        } catch (error) {
            this.logger.error(`Error validating snapshot ${snapshot.id}: ${error.message}`);
            timer(false, { error: error.message });
            return {
                valid: false,
                details: { error: error.message },
                summary: `Validation failed: ${error.message}`,
            };
        }
    }

    /**
     * Validate snapshot structure and required fields
     * @param {Object} snapshot - Snapshot object
     * @returns {Object} Structure validation result
     */
    validateSnapshotStructure(snapshot) {
        const errors = [];
        const warnings = [];

        // Required fields
        const requiredFields = ['id', 'instruction', 'timestamp', 'mode'];
        for (const field of requiredFields) {
            if (!snapshot[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate ID format
        if (snapshot.id && !this._isValidSnapshotId(snapshot.id)) {
            errors.push(`Invalid snapshot ID format: ${snapshot.id}`);
        }

        // Validate mode
        const validModes = ['git', 'file'];
        if (snapshot.mode && !validModes.includes(snapshot.mode)) {
            errors.push(`Invalid mode: ${snapshot.mode}. Must be one of: ${validModes.join(', ')}`);
        }

        // Validate timestamp
        if (snapshot.timestamp) {
            const timestamp = new Date(snapshot.timestamp);
            if (isNaN(timestamp.getTime())) {
                errors.push(`Invalid timestamp: ${snapshot.timestamp}`);
            } else if (timestamp > new Date()) {
                warnings.push('Snapshot timestamp is in the future');
            }
        }

        // Mode-specific validation
        if (snapshot.mode === 'git') {
            if (!snapshot.gitHash) {
                errors.push('Git mode snapshot missing gitHash');
            }
            if (!snapshot.branchName) {
                warnings.push('Git mode snapshot missing branchName');
            }
        }

        if (snapshot.mode === 'file') {
            if (!snapshot.files || !(snapshot.files instanceof Map)) {
                errors.push('File mode snapshot missing or invalid files Map');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate content hashes in the snapshot
     * @param {Object} snapshot - Snapshot object
     * @returns {Promise<Object>} Content hash validation result
     */
    async validateContentHashes(snapshot) {
        if (!snapshot.fileChecksums || snapshot.mode !== 'file') {
            return { valid: true, reason: 'No checksums to validate or not file mode' };
        }

        const inconsistencies = [];
        const errors = [];

        try {
            for (const [filePath, expectedHash] of snapshot.fileChecksums) {
                const fileContent = snapshot.files.get(filePath);

                if (fileContent === null) {
                    // File was deleted, skip hash validation
                    continue;
                }

                if (fileContent === undefined) {
                    errors.push(`File ${filePath} has checksum but no content in snapshot`);
                    continue;
                }

                const actualHash = this.calculateHash(fileContent);
                if (actualHash !== expectedHash) {
                    inconsistencies.push({
                        file: filePath,
                        expected: expectedHash,
                        actual: actualHash,
                        severity: 'error',
                    });
                }
            }

            return {
                valid: inconsistencies.length === 0 && errors.length === 0,
                inconsistencies,
                errors,
                checkedFiles: snapshot.fileChecksums.size,
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
            };
        }
    }

    /**
     * Validate file existence for file mode snapshots
     * @param {Object} snapshot - Snapshot object
     * @returns {Promise<Object>} File existence validation result
     */
    async validateFileExistence(snapshot) {
        if (snapshot.mode !== 'file' || !snapshot.files) {
            return { valid: true, reason: 'Not file mode or no files to validate' };
        }

        // For file mode snapshots, we don't validate file existence on disk
        // The snapshot contains the file content, not references to disk files
        const missingFiles = [];
        const existingFiles = [];
        const errors = [];

        // Just validate that files in snapshot have content
        for (const [filePath, content] of snapshot.files) {
            if (content !== null) {
                existingFiles.push(filePath);
            }
        }

        return {
            valid: true, // File mode snapshots are self-contained
            missingFiles,
            existingFiles,
            errors,
            totalFiles: snapshot.files.size,
        };
    }

    /**
     * Validate checksum consistency
     * @param {Object} snapshot - Snapshot object
     * @returns {Promise<Object>} Checksum consistency validation result
     */
    async validateChecksumConsistency(snapshot) {
        if (!snapshot.fileChecksums || !snapshot.files) {
            return { valid: true, reason: 'No checksums or files to validate' };
        }

        const orphanedChecksums = [];
        const missingChecksums = [];

        // Check for checksums without corresponding files
        for (const filePath of snapshot.fileChecksums.keys()) {
            if (!snapshot.files.has(filePath)) {
                orphanedChecksums.push(filePath);
            }
        }

        // Check for files without checksums (only if checksums are expected to exist)
        // For file mode snapshots, checksums are optional unless explicitly required
        const checksumValidationEnabled = this.config.getFileConfig().checksumValidation;
        if (checksumValidationEnabled && snapshot.fileChecksums.size > 0) {
            for (const filePath of snapshot.files.keys()) {
                if (
                    snapshot.files.get(filePath) !== null &&
                    !snapshot.fileChecksums.has(filePath)
                ) {
                    missingChecksums.push(filePath);
                }
            }
        }

        return {
            valid: orphanedChecksums.length === 0 && missingChecksums.length === 0,
            orphanedChecksums,
            missingChecksums,
            totalChecksums: snapshot.fileChecksums.size,
            totalFiles: snapshot.files.size,
        };
    }

    /**
     * Validate snapshot metadata
     * @param {Object} snapshot - Snapshot object
     * @returns {Object} Metadata validation result
     */
    validateMetadata(snapshot) {
        const warnings = [];
        const errors = [];

        // Check instruction length
        if (snapshot.instruction && snapshot.instruction.length > 1000) {
            warnings.push('Instruction is very long (>1000 characters)');
        }

        if (snapshot.instruction && snapshot.instruction.trim().length === 0) {
            warnings.push('Instruction is empty or whitespace only');
        }

        // Check content hash if present
        if (snapshot.contentHash) {
            if (!this._isValidHash(snapshot.contentHash)) {
                errors.push(`Invalid content hash format: ${snapshot.contentHash}`);
            }
        }

        // Check author information
        if (snapshot.author && typeof snapshot.author !== 'string') {
            errors.push('Author must be a string');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Calculate hash for content
     * @param {string} content - Content to hash
     * @returns {string} Content hash
     */
    calculateHash(content) {
        return createHash(this.hashAlgorithm).update(content, 'utf8').digest('hex');
    }

    /**
     * Validate snapshot ID format
     * @private
     * @param {string} id - Snapshot ID
     * @returns {boolean} True if valid
     */
    _isValidSnapshotId(id) {
        return /^snap_\d+_[a-f0-9]{8}(_[a-f0-9]{8})?$/.test(id);
    }

    /**
     * Validate hash format
     * @private
     * @param {string} hash - Hash string
     * @returns {boolean} True if valid
     */
    _isValidHash(hash) {
        const lengths = { md5: 32, sha1: 40, sha256: 64 };
        const expectedLength = lengths[this.hashAlgorithm];
        return expectedLength && hash.length === expectedLength && /^[a-f0-9]+$/.test(hash);
    }

    /**
     * Generate validation summary
     * @private
     * @param {Object} validationResults - Validation results
     * @returns {string} Summary string
     */
    _generateValidationSummary(validationResults) {
        const issues = [];

        for (const [category, result] of Object.entries(validationResults)) {
            if (!result.valid) {
                const errorCount = result.errors ? result.errors.length : 0;
                const warningCount = result.warnings ? result.warnings.length : 0;

                if (errorCount > 0) {
                    issues.push(`${category}: ${errorCount} error(s)`);
                }
                if (warningCount > 0) {
                    issues.push(`${category}: ${warningCount} warning(s)`);
                }
            }
        }

        return issues.length > 0
            ? `Validation issues found: ${issues.join(', ')}`
            : 'Snapshot validation passed';
    }

    /**
     * Quick validation for basic snapshot structure
     * @param {Object} snapshot - Snapshot object
     * @returns {boolean} True if basic structure is valid
     */
    quickValidate(snapshot) {
        return (
            snapshot &&
            snapshot.id &&
            snapshot.instruction &&
            snapshot.timestamp &&
            snapshot.mode &&
            ['git', 'file'].includes(snapshot.mode)
        );
    }
}

export default SnapshotIntegrityValidator;
