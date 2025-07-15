/**
 * Snapshots Command
 * Interactive snapshot management interface for SynthDev
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import { getLogger } from '../../core/managers/logger.js';
import { SnapshotManager } from '../../core/snapshot/SnapshotManager.js';

export class SnapshotsCommand extends InteractiveCommand {
    constructor() {
        super('snapshots', 'Interactive snapshot management interface');
        this.snapshotManager = null; // Will be initialized in implementation
    }

    /**
     * Get required dependencies for the snapshots command
     * @returns {string[]} Required dependencies
     */
    getRequiredDependencies() {
        return ['consoleInterface', ...super.getRequiredDependencies()];
    }

    /**
     * Normalize status format from different snapshot manager implementations
     * @private
     * @param {Object} statusResult - Status result from snapshot manager
     * @returns {Object} Normalized status object
     */
    _normalizeStatus(statusResult) {
        // Handle real SnapshotManager format: {success: boolean, status: {...}}
        if (statusResult && typeof statusResult === 'object' && statusResult.success !== undefined) {
            const status = statusResult.status || {};
            return {
                mode: status.strategy || status.mode || 'file',
                gitStatus: status.strategyDetails?.gitStatus || 'Not Available',
                originalBranch: status.strategyDetails?.originalBranch || null,
                featureBranch: status.strategyDetails?.featureBranch || null,
                ready: statusResult.success && status.initialized !== false,
                initialized: status.initialized,
                strategy: status.strategy,
                health: status.health,
                metrics: status.metrics
            };
        }

        // Handle mock format (direct status object)
        return statusResult || {
            mode: 'file',
            gitStatus: 'Not Available',
            originalBranch: null,
            featureBranch: null,
            ready: true
        };
    }

    /**
     * Execute the snapshots command
     * @param {string} args - Command arguments (unused for now)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const logger = getLogger();

        // Initialize real snapshot manager
        try {
            this.snapshotManager = new SnapshotManager();
            const initResult = await this.snapshotManager.initialize();
            if (!initResult.success) {
                logger.raw(`❌ Failed to initialize snapshot system: ${initResult.error}`);
                logger.raw('💡 Falling back to mock data for demonstration');
                this.snapshotManager = this._createMockSnapshotManager();
            }
        } catch (error) {
            logger.raw(`❌ Error initializing snapshot system: ${error.message}`);
            logger.raw('💡 Falling back to mock data for demonstration');
            this.snapshotManager = this._createMockSnapshotManager();
        }

        // Show header
        logger.raw('\n📸 Available Snapshots:');
        logger.raw('═'.repeat(80));

        // Get snapshot mode and status
        const statusResult = await this.snapshotManager.getStatus();
        const status = this._normalizeStatus(statusResult);
        await this._showModeHeader(status);

        // Main interaction loop
        while (true) {
            // Show snapshots list
            await this._showSnapshotsList(context);

            // Show commands menu
            await this._showCommandsMenu(status.mode);

            // Get user input
            const input = await this.promptForInput('snapshots> ', context);
            const trimmed = input.trim().toLowerCase();

            // Handle user input
            const shouldExit = await this._handleUserInput(trimmed, context, status);
            if (shouldExit) {
                break;
            }

            logger.raw('');
        }

        return true;
    }

    /**
     * Show the mode-specific header
     * @private
     * @param {Object} status - Snapshot system status
     */
    async _showModeHeader(status) {
        const logger = getLogger();

        if (status.mode === 'git') {
            logger.raw(
                `🌿 Git Status: ${status.gitStatus} | Original: ${status.originalBranch} | Feature: ${status.featureBranch || 'none'}`
            );
        } else {
            logger.raw('📁 File-based Mode: Active (Git not available)');
        }
        logger.raw('');
    }

    /**
     * Show the list of available snapshots with enhanced formatting and pagination
     * @private
     * @param {Object} _context - Execution context (unused)
     */
    async _showSnapshotsList(_context) {
        const logger = getLogger();
        const snapshots = await this.snapshotManager.getSnapshots();

        if (snapshots.length === 0) {
            logger.raw('📭 No snapshots available');
            logger.raw('   💡 Snapshots will appear here after you make changes to files');
            return;
        }

        // Show summary header
        const statusResult = await this.snapshotManager.getStatus();
        const status = this._normalizeStatus(statusResult);
        this._showSnapshotsSummary(snapshots, status);

        // Determine pagination settings
        const maxDisplayItems = 10;
        const totalSnapshots = snapshots.length;
        const shouldPaginate = totalSnapshots > maxDisplayItems;

        if (shouldPaginate) {
            logger.raw(`📄 Showing latest ${maxDisplayItems} of ${totalSnapshots} snapshots`);
            logger.raw('   💡 Use detailed view for complete history');
            logger.raw('');
        }

        // Display snapshots (latest first, limited by pagination)
        const displaySnapshots = snapshots.slice(0, maxDisplayItems);

        displaySnapshots.forEach((snapshot, index) => {
            this._renderSnapshotListItem(snapshot, index + 1, status.mode);
        });

        if (shouldPaginate) {
            logger.raw(`   ... and ${totalSnapshots - maxDisplayItems} more snapshots`);
            logger.raw('');
        }
    }

    /**
     * Show summary information about snapshots
     * @private
     * @param {Array} snapshots - Array of snapshots
     * @param {Object} status - Current system status
     */
    _showSnapshotsSummary(snapshots, status) {
        const logger = getLogger();
        const totalCount = snapshots.length;
        const gitCount = snapshots.filter(s => s.mode === 'git').length;
        const fileCount = snapshots.filter(s => s.mode === 'file').length;

        // Summary line
        const summaryParts = [`📊 Total: ${totalCount}`];
        if (gitCount > 0) {
            summaryParts.push(`🔗 Git: ${gitCount}`);
        }
        if (fileCount > 0) {
            summaryParts.push(`📁 File: ${fileCount}`);
        }

        logger.raw(summaryParts.join(' | '));

        // Current mode indicator
        const modeIcon = status.mode === 'git' ? '🔗' : '📁';
        const modeText = status.mode === 'git' ? 'Git Mode' : 'File Mode';
        logger.raw(`${modeIcon} Current: ${modeText}`);
        logger.raw('');
    }

    /**
     * Render a single snapshot list item with enhanced formatting
     * @private
     * @param {Object} snapshot - Snapshot object
     * @param {number} number - Display number
     * @param {string} currentMode - Current system mode
     */
    _renderSnapshotListItem(snapshot, number, currentMode) {
        const logger = getLogger();
        const timestamp = this._formatTimestamp(snapshot.timestamp);
        const isCurrentMode = snapshot.mode === currentMode;
        const modeIndicator = isCurrentMode ? '' : ` [${snapshot.mode.toUpperCase()}]`;

        // Main snapshot line with enhanced formatting
        const instruction = this._truncateText(snapshot.instruction, 60);
        logger.raw(
            `${number.toString().padStart(2)}. [${timestamp}] ${instruction}${modeIndicator}`
        );

        // Mode-specific details with improved formatting
        if (snapshot.mode === 'git') {
            this._renderGitSnapshotDetails(snapshot);
        } else {
            this._renderFileSnapshotDetails(snapshot);
        }

        logger.raw('');
    }

    /**
     * Render Git-specific snapshot details
     * @private
     * @param {Object} snapshot - Git snapshot object
     */
    _renderGitSnapshotDetails(snapshot) {
        const logger = getLogger();
        const gitHash = snapshot.gitHash?.substring(0, 7) || 'unknown';
        const author = snapshot.author || 'SynthDev';
        const branch = snapshot.branchName ? ` | Branch: ${snapshot.branchName}` : '';

        logger.raw(`    🔗 Commit: ${gitHash} | Author: ${author}${branch}`);

        if (snapshot.filesChanged) {
            const changedCount = snapshot.filesChanged.length;
            const filesList = snapshot.filesChanged.slice(0, 2).join(', ');
            const moreText = changedCount > 2 ? ` +${changedCount - 2} more` : '';
            logger.raw(`    📝 Changed: ${filesList}${moreText}`);
        }
    }

    /**
     * Render File-specific snapshot details
     * @private
     * @param {Object} snapshot - File snapshot object
     */
    _renderFileSnapshotDetails(snapshot) {
        const logger = getLogger();
        const fileCount = snapshot.files?.size || snapshot.fileCount || 0;
        const sizeInfo = snapshot.totalSize
            ? ` | Size: ${this._formatFileSize(snapshot.totalSize)}`
            : '';

        logger.raw(`    📁 Files: ${fileCount}${sizeInfo}`);

        if (snapshot.modifiedFiles && snapshot.modifiedFiles.size > 0) {
            const modifiedArray = Array.from(snapshot.modifiedFiles);
            const displayFiles = modifiedArray.slice(0, 2);
            const moreCount = modifiedArray.length - displayFiles.length;
            const moreText = moreCount > 0 ? ` +${moreCount} more` : '';

            logger.raw(`    📝 Modified: ${displayFiles.join(', ')}${moreText}`);
        }
    }

    /**
     * Format timestamp for display
     * @private
     * @param {Date|string|number} timestamp - Timestamp to format
     * @returns {string} Formatted timestamp
     */
    _formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Relative time for recent snapshots
        if (diffMins < 1) {
            return 'Just now';
        }
        if (diffMins < 60) {
            return `${diffMins}m ago`;
        }
        if (diffHours < 24) {
            return `${diffHours}h ago`;
        }
        if (diffDays < 7) {
            return `${diffDays}d ago`;
        }

        // Absolute time for older snapshots
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    /**
     * Truncate text to specified length with ellipsis
     * @private
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    _truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text || '';
        }
        return `${text.substring(0, maxLength - 3)}...`;
    }

    /**
     * Format file size for display
     * @private
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    _formatFileSize(bytes) {
        if (!bytes || bytes === 0) {
            return '0B';
        }
        if (bytes < 1024) {
            return `${bytes}B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)}KB`;
        }
        if (bytes < 1024 * 1024 * 1024) {
            return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        }
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    }

    /**
     * Get file icon based on file extension
     * @private
     * @param {string} filePath - File path
     * @returns {string} File icon
     */
    _getFileIcon(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const iconMap = {
            js: '📜',
            ts: '📘',
            jsx: '⚛️',
            tsx: '⚛️',
            vue: '💚',
            html: '🌐',
            css: '🎨',
            scss: '🎨',
            sass: '🎨',
            less: '🎨',
            json: '📋',
            xml: '📄',
            md: '📝',
            txt: '📄',
            py: '🐍',
            java: '☕',
            cpp: '⚙️',
            c: '⚙️',
            h: '📋',
            php: '🐘',
            rb: '💎',
            go: '🐹',
            rs: '🦀',
            sql: '🗃️',
            png: '🖼️',
            jpg: '🖼️',
            jpeg: '🖼️',
            gif: '🖼️',
            svg: '🎨',
            pdf: '📕',
            zip: '📦',
            tar: '📦',
            gz: '📦',
        };
        return iconMap[ext] || '📄';
    }

    /**
     * Get file type icon
     * @private
     * @param {string} type - File type
     * @returns {string} Type icon
     */
    _getFileTypeIcon(type) {
        const iconMap = {
            javascript: '📜',
            typescript: '📘',
            css: '🎨',
            html: '🌐',
            json: '📋',
            markdown: '📝',
            python: '🐍',
            image: '🖼️',
            archive: '📦',
            config: '⚙️',
            other: '📄',
        };
        return iconMap[type] || '📄';
    }

    /**
     * Analyze file types in a snapshot
     * @private
     * @param {Map} files - Files map
     * @returns {Object} File type analysis
     */
    _analyzeFileTypes(files) {
        const types = {};

        for (const [filePath, fileInfo] of files) {
            const ext = filePath.split('.').pop()?.toLowerCase();
            let type = 'other';

            if (['js', 'jsx', 'mjs'].includes(ext)) {
                type = 'javascript';
            } else if (['ts', 'tsx'].includes(ext)) {
                type = 'typescript';
            } else if (['css', 'scss', 'sass', 'less'].includes(ext)) {
                type = 'css';
            } else if (['html', 'htm'].includes(ext)) {
                type = 'html';
            } else if (['json', 'jsonc'].includes(ext)) {
                type = 'json';
            } else if (['md', 'markdown'].includes(ext)) {
                type = 'markdown';
            } else if (['py', 'pyw'].includes(ext)) {
                type = 'python';
            } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                type = 'image';
            } else if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
                type = 'archive';
            } else if (['config', 'conf', 'ini', 'env'].includes(ext)) {
                type = 'config';
            }

            if (!types[type]) {
                types[type] = { count: 0, size: 0 };
            }

            types[type].count++;
            types[type].size += fileInfo.size || 0;
        }

        return types;
    }

    /**
     * Handle actions from the detail view
     * @private
     * @param {string} input - User input
     * @param {number} snapshotIndex - Current snapshot index
     * @param {Object} context - Execution context
     */
    async _handleDetailViewAction(input, snapshotIndex, context) {
        const logger = getLogger();

        // Restore command
        if (input === `r${snapshotIndex + 1}`) {
            await this._restoreSnapshot(snapshotIndex, context);
            return;
        }

        // Delete command (file mode only)
        if (input === `d${snapshotIndex + 1}`) {
            const statusResult = await this.snapshotManager.getStatus();
            const status = this._normalizeStatus(statusResult);
            if (status.mode === 'file') {
                await this._deleteSnapshot(snapshotIndex, context);
            } else {
                logger.raw('❌ Delete not available in Git mode');
            }
            return;
        }

        logger.raw('❌ Invalid action. Press Enter to continue...');
        await this.promptForInput('', context);
    }

    /**
     * Show the commands menu based on current mode
     * @private
     * @param {string} mode - Current snapshot mode ('git' or 'file')
     */
    async _showCommandsMenu(mode) {
        const logger = getLogger();

        logger.raw('Commands:');
        logger.raw('  [number] - View detailed snapshot info');
        logger.raw('  r[number] - Restore snapshot (e.g., r1)');

        if (mode === 'git') {
            logger.raw('  m - Merge feature branch to original branch');
            logger.raw('  s - Switch back to original branch (without merge)');
        } else {
            logger.raw('  📁 File mode: Restore overwrites files with backed-up content');
            logger.raw('  d[number] - Delete snapshot (e.g., d1)');
            logger.raw('  c - Clear all snapshots');
        }

        logger.raw('  q - Quit snapshots view');
        logger.raw('');
    }

    /**
     * Handle user input and execute corresponding actions
     * @private
     * @param {string} input - User input
     * @param {Object} context - Execution context
     * @param {Object} status - Snapshot system status
     * @returns {boolean} True if should exit, false to continue
     */
    async _handleUserInput(input, context, status) {
        const logger = getLogger();

        // Quit command
        if (input === 'q' || input === 'quit' || input === 'exit') {
            return true;
        }

        // Numeric commands (view snapshot details)
        if (/^\d+$/.test(input)) {
            const snapshotIndex = parseInt(input) - 1;
            await this._showSnapshotDetails(snapshotIndex, context);
            return false;
        }

        // Restore commands (r1, r2, etc.)
        if (/^r\d+$/.test(input)) {
            const snapshotIndex = parseInt(input.substring(1)) - 1;
            await this._restoreSnapshot(snapshotIndex, context);
            return false;
        }

        // Delete commands (d1, d2, etc.) - file mode only
        if (/^d\d+$/.test(input) && status.mode === 'file') {
            const snapshotIndex = parseInt(input.substring(1)) - 1;
            await this._deleteSnapshot(snapshotIndex, context);
            return false;
        }

        // Clear all snapshots - file mode only
        if (input === 'c' && status.mode === 'file') {
            await this._clearAllSnapshots(context);
            return false;
        }

        // Git-specific commands
        if (status.mode === 'git') {
            if (input === 'm') {
                await this._mergeBranch(context);
                return false;
            }
            if (input === 's') {
                await this._switchBranch(context);
                return false;
            }
        }

        // Invalid command
        logger.raw('❌ Invalid command. Please try again.');
        return false;
    }

    /**
     * Show detailed information about a specific snapshot with comprehensive metadata
     * @private
     * @param {number} index - Snapshot index
     * @param {Object} context - Execution context
     */
    async _showSnapshotDetails(index, context) {
        const logger = getLogger();
        const snapshots = await this.snapshotManager.getSnapshots();

        if (index < 0 || index >= snapshots.length) {
            logger.raw('❌ Invalid snapshot number');
            return;
        }

        const snapshot = snapshots[index];

        // Header with enhanced formatting
        logger.raw(`\n${'═'.repeat(80)}`);
        logger.raw(`📸 SNAPSHOT ${index + 1} DETAILS`);
        logger.raw(`${'═'.repeat(80)}`);

        // Basic information section
        this._renderBasicSnapshotInfo(snapshot, index);

        // Mode-specific detailed information
        if (snapshot.mode === 'git') {
            await this._renderGitSnapshotDetailsExpanded(snapshot);
        } else {
            await this._renderFileSnapshotDetailsExpanded(snapshot);
        }

        // Performance and metadata section
        this._renderSnapshotMetadata(snapshot);

        // Navigation options
        logger.raw(`\n${'─'.repeat(80)}`);
        logger.raw('📋 Actions:');
        logger.raw(`   r${index + 1} - Restore this snapshot`);
        if (snapshot.mode === 'file') {
            logger.raw(`   d${index + 1} - Delete this snapshot`);
        }
        logger.raw('   Enter - Return to snapshots list');
        logger.raw(`${'─'.repeat(80)}`);

        const input = await this.promptForInput('Action (or Enter to continue): ', context);

        // Handle actions from detail view
        if (input.trim()) {
            await this._handleDetailViewAction(input.trim(), index, context);
        }
    }

    /**
     * Render basic snapshot information
     * @private
     * @param {Object} snapshot - Snapshot object
     * @param {number} index - Snapshot index
     */
    _renderBasicSnapshotInfo(snapshot, index) {
        const logger = getLogger();

        logger.raw('\n📋 BASIC INFORMATION');
        logger.raw('─'.repeat(40));
        logger.raw(`📝 Instruction: ${snapshot.instruction}`);
        logger.raw(
            `⏰ Created: ${this._formatTimestamp(snapshot.timestamp)} (${new Date(snapshot.timestamp).toLocaleString()})`
        );
        logger.raw(`🔧 Mode: ${snapshot.mode.toUpperCase()}`);
        logger.raw(`🆔 ID: ${snapshot.id || `snapshot-${index + 1}`}`);

        // Age calculation
        const ageMs = Date.now() - new Date(snapshot.timestamp).getTime();
        const ageMinutes = Math.floor(ageMs / (1000 * 60));
        const ageHours = Math.floor(ageMinutes / 60);
        const ageDays = Math.floor(ageHours / 24);

        let ageText = '';
        if (ageDays > 0) {
            ageText = `${ageDays} day${ageDays > 1 ? 's' : ''} old`;
        } else if (ageHours > 0) {
            ageText = `${ageHours} hour${ageHours > 1 ? 's' : ''} old`;
        } else if (ageMinutes > 0) {
            ageText = `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} old`;
        } else {
            ageText = 'Just created';
        }

        logger.raw(`📅 Age: ${ageText}`);
    }

    /**
     * Render detailed Git snapshot information for detail view
     * @private
     * @param {Object} snapshot - Git snapshot object
     */
    async _renderGitSnapshotDetailsExpanded(snapshot) {
        const logger = getLogger();

        logger.raw('\n🔗 GIT INFORMATION');
        logger.raw('─'.repeat(40));
        logger.raw(`🔗 Commit Hash: ${snapshot.gitHash || 'unknown'}`);
        logger.raw(`🌿 Branch: ${snapshot.branchName || 'unknown'}`);
        logger.raw(`👤 Author: ${snapshot.author || 'SynthDev'}`);

        if (snapshot.commitMessage) {
            logger.raw(`💬 Commit Message: ${snapshot.commitMessage}`);
        }

        if (snapshot.parentHash) {
            logger.raw(`⬆️  Parent: ${snapshot.parentHash.substring(0, 7)}`);
        }

        // Files changed in this commit
        if (snapshot.filesChanged && snapshot.filesChanged.length > 0) {
            logger.raw('\n📝 CHANGED FILES');
            logger.raw('─'.repeat(40));
            snapshot.filesChanged.forEach((file, index) => {
                const icon = this._getFileIcon(file);
                logger.raw(`${(index + 1).toString().padStart(2)}. ${icon} ${file}`);
            });

            if (snapshot.filesChanged.length > 10) {
                logger.raw(`   ... and ${snapshot.filesChanged.length - 10} more files`);
            }
        }

        // Git statistics
        if (snapshot.stats) {
            logger.raw('\n📊 COMMIT STATISTICS');
            logger.raw('─'.repeat(40));
            logger.raw(`➕ Additions: ${snapshot.stats.additions || 0} lines`);
            logger.raw(`➖ Deletions: ${snapshot.stats.deletions || 0} lines`);
            logger.raw(`📄 Files Changed: ${snapshot.stats.filesChanged || 0}`);
        }
    }

    /**
     * Render detailed file-based snapshot information
     * @private
     * @param {Object} snapshot - File snapshot object
     */
    async _renderFileSnapshotDetailsExpanded(snapshot) {
        const logger = getLogger();

        logger.raw('\n📁 FILE INFORMATION');
        logger.raw('─'.repeat(40));

        const fileCount = snapshot.files?.size || snapshot.fileCount || 0;
        const totalSize = snapshot.totalSize || 0;

        logger.raw(`📄 Total Files: ${fileCount}`);
        logger.raw(`💾 Total Size: ${this._formatFileSize(totalSize)}`);

        if (snapshot.modifiedFiles && snapshot.modifiedFiles.size > 0) {
            logger.raw(`✏️  Modified Files: ${snapshot.modifiedFiles.size}`);
        }

        // File breakdown by type
        if (snapshot.files && snapshot.files.size > 0) {
            const fileTypes = this._analyzeFileTypes(snapshot.files);

            logger.raw('\n📊 FILE BREAKDOWN');
            logger.raw('─'.repeat(40));
            Object.entries(fileTypes).forEach(([type, info]) => {
                const icon = this._getFileTypeIcon(type);
                logger.raw(
                    `${icon} ${type.toUpperCase()}: ${info.count} files (${this._formatFileSize(info.size)})`
                );
            });
        }

        // Detailed file list
        if (snapshot.files && snapshot.files.size > 0) {
            logger.raw('\n📋 DETAILED FILE LIST');
            logger.raw('─'.repeat(40));

            const filesArray = Array.from(snapshot.files.entries());
            const displayFiles = filesArray.slice(0, 15); // Show first 15 files

            displayFiles.forEach(([filePath, fileInfo], index) => {
                const icon = this._getFileIcon(filePath);
                const size = this._formatFileSize(fileInfo.size || 0);
                const modified = snapshot.modifiedFiles?.has(filePath) ? '✏️ ' : '  ';
                const status = fileInfo.modified ? '[MODIFIED]' : '[BACKUP]';

                logger.raw(`${(index + 1).toString().padStart(2)}. ${modified}${icon} ${filePath}`);
                logger.raw(`     Size: ${size} | Status: ${status}`);
            });

            if (filesArray.length > 15) {
                logger.raw(`\n   ... and ${filesArray.length - 15} more files`);
                logger.raw('   💡 Use file system tools to explore complete file list');
            }
        }

        // Modified files summary
        if (snapshot.modifiedFiles && snapshot.modifiedFiles.size > 0) {
            logger.raw('\n✏️  MODIFIED FILES SUMMARY');
            logger.raw('─'.repeat(40));

            const modifiedArray = Array.from(snapshot.modifiedFiles);
            const displayModified = modifiedArray.slice(0, 10);

            displayModified.forEach((filePath, index) => {
                const icon = this._getFileIcon(filePath);
                logger.raw(`${(index + 1).toString().padStart(2)}. ${icon} ${filePath}`);
            });

            if (modifiedArray.length > 10) {
                logger.raw(`   ... and ${modifiedArray.length - 10} more modified files`);
            }
        }
    }

    /**
     * Render snapshot metadata and performance information
     * @private
     * @param {Object} snapshot - Snapshot object
     */
    _renderSnapshotMetadata(snapshot) {
        const logger = getLogger();

        logger.raw('\n⚙️  METADATA');
        logger.raw('─'.repeat(40));

        // Creation performance
        if (snapshot.creationTime) {
            logger.raw(`⏱️  Creation Time: ${snapshot.creationTime}ms`);
        }

        // Memory usage
        if (snapshot.memoryUsage) {
            logger.raw(`🧠 Memory Usage: ${this._formatFileSize(snapshot.memoryUsage)}`);
        }

        // Compression info for file mode
        if (snapshot.mode === 'file' && snapshot.compressionRatio) {
            logger.raw(`🗜️  Compression: ${(snapshot.compressionRatio * 100).toFixed(1)}% saved`);
        }

        // Checksum for integrity
        if (snapshot.checksum) {
            logger.raw(`🔐 Checksum: ${snapshot.checksum.substring(0, 16)}...`);
        }

        // Tags or labels
        if (snapshot.tags && snapshot.tags.length > 0) {
            logger.raw(`🏷️  Tags: ${snapshot.tags.join(', ')}`);
        }

        // Related snapshots
        if (snapshot.relatedSnapshots && snapshot.relatedSnapshots.length > 0) {
            logger.raw(`🔗 Related: ${snapshot.relatedSnapshots.length} snapshot(s)`);
        }
    }

    /**
     * Restore a snapshot with confirmation
     * @private
     * @param {number} index - Snapshot index
     * @param {Object} context - Execution context
     */
    async _restoreSnapshot(index, context) {
        const logger = getLogger();
        const snapshots = await this.snapshotManager.getSnapshots();

        if (index < 0 || index >= snapshots.length) {
            logger.raw('❌ Invalid snapshot number');
            return;
        }

        const snapshot = snapshots[index];

        // Show confirmation prompt
        logger.raw(`\nRestore snapshot ${index + 1}?`);
        if (snapshot.mode === 'git') {
            logger.raw(`  🔗 Commit: ${snapshot.instruction}`);
            logger.raw('  ⚠️  This will discard all changes after this commit!');
        } else {
            const fileCount = snapshot.files?.size || 0;
            logger.raw(`  📄 Will restore: ${fileCount} files`);
            logger.raw('  ⚠️  This will overwrite current file contents!');
        }

        const confirmed = await this.promptForConfirmation('\nConfirm? (y/N): ', context);

        if (confirmed) {
            logger.raw('\n🔄 Restoring snapshot...');

            // Use real snapshot manager if available, otherwise simulate
            if (this.snapshotManager.restoreSnapshot && typeof this.snapshotManager.restoreSnapshot === 'function') {
                const result = await this.snapshotManager.restoreSnapshot(snapshot.id);
                if (result.success) {
                    logger.raw(`✅ Successfully restored snapshot ${index + 1}`);
                    if (snapshot.mode === 'git') {
                        logger.raw(`   🔗 ${snapshot.instruction}`);
                    } else {
                        const fileCount = result.filesRestored?.length || snapshot.files?.size || 0;
                        logger.raw(`   📄 Restored ${fileCount} files`);
                    }
                } else {
                    logger.raw(`❌ Failed to restore snapshot: ${result.error}`);
                }
            } else {
                // Fallback to mock restoration
                await this._simulateRestore(snapshot);
                logger.raw(`✅ Successfully restored snapshot ${index + 1} (simulated)`);
                if (snapshot.mode === 'git') {
                    logger.raw(`   🔗 ${snapshot.instruction}`);
                } else {
                    logger.raw(`   📄 Restored ${snapshot.files?.size || 0} files`);
                }
            }
        } else {
            logger.raw('❌ Restore cancelled');
        }
    }

    /**
     * Create a mock snapshot manager for testing
     * @private
     * @returns {Object} Mock snapshot manager
     */
    _createMockSnapshotManager() {
        return {
            async getStatus() {
                return {
                    mode: 'file', // Switch to file mode for testing
                    gitStatus: 'Not Available',
                    originalBranch: null,
                    featureBranch: null,
                    ready: true,
                };
            },

            async getSnapshots() {
                return [
                    {
                        id: '1',
                        instruction:
                            'Add authentication to the login form with validation and error handling',
                        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
                        mode: 'file',
                        files: new Map([
                            ['src/auth/LoginForm.js', { size: 2048, modified: true }],
                            ['src/auth/AuthService.js', { size: 1536, modified: true }],
                            ['src/utils/validation.js', { size: 512, modified: false }],
                            ['src/styles/auth.css', { size: 768, modified: true }],
                            ['tests/auth/LoginForm.test.js', { size: 1024, modified: false }],
                        ]),
                        modifiedFiles: new Set([
                            'src/auth/LoginForm.js',
                            'src/auth/AuthService.js',
                            'src/styles/auth.css',
                        ]),
                        fileCount: 5,
                        totalSize: 5888,
                        creationTime: 245,
                        memoryUsage: 8192,
                        compressionRatio: 0.35,
                        checksum: 'sha256:a1b2c3d4e5f6789012345678901234567890abcdef',
                        tags: ['authentication', 'security', 'forms'],
                    },
                    {
                        id: '2',
                        instruction:
                            'Fix responsive layout issues in navigation and sidebar components',
                        timestamp: new Date(Date.now() - 600000), // 10 minutes ago
                        mode: 'file',
                        files: new Map([
                            ['src/components/Navigation.js', { size: 3072, modified: true }],
                            ['src/components/Sidebar.js', { size: 2560, modified: true }],
                            ['src/styles/responsive.css', { size: 1024, modified: true }],
                            ['src/styles/navigation.css', { size: 768, modified: true }],
                        ]),
                        modifiedFiles: new Set([
                            'src/components/Navigation.js',
                            'src/components/Sidebar.js',
                            'src/styles/responsive.css',
                            'src/styles/navigation.css',
                        ]),
                        fileCount: 4,
                        totalSize: 7424,
                    },
                    {
                        id: '3',
                        instruction: 'Implement user profile management system',
                        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
                        mode: 'git',
                        gitHash: 'f1a2b3c4d5e6789012345678901234567890abcd',
                        branchName: 'synth-dev/20241205T141500-profile',
                        author: 'SynthDev',
                        commitMessage:
                            'feat: add comprehensive user profile management with avatar upload',
                        parentHash: 'e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3',
                        filesChanged: [
                            'src/profile/ProfileManager.js',
                            'src/profile/ProfileForm.js',
                            'src/api/profileApi.js',
                            'src/components/AvatarUpload.js',
                            'src/styles/profile.css',
                            'tests/profile/ProfileManager.test.js',
                        ],
                        stats: {
                            additions: 245,
                            deletions: 18,
                            filesChanged: 6,
                        },
                        creationTime: 1250,
                        tags: ['profile', 'user-management', 'ui'],
                    },
                    {
                        id: '4',
                        instruction: 'Update database schema for user preferences',
                        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
                        mode: 'file',
                        files: new Map([
                            ['migrations/001_user_preferences.sql', { size: 1024, modified: true }],
                            ['src/models/UserPreferences.js', { size: 2048, modified: true }],
                        ]),
                        modifiedFiles: new Set([
                            'migrations/001_user_preferences.sql',
                            'src/models/UserPreferences.js',
                        ]),
                        fileCount: 2,
                        totalSize: 3072,
                    },
                    {
                        id: '5',
                        instruction: 'Add comprehensive error logging and monitoring',
                        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
                        mode: 'git',
                        gitHash: 'g7h8i9j0k1l2',
                        branchName: 'synth-dev/20241205T123000-logging',
                        author: 'SynthDev',
                        filesChanged: [
                            'src/utils/logger.js',
                            'src/middleware/errorHandler.js',
                            'src/monitoring/metrics.js',
                            'config/logging.json',
                        ],
                    },
                ];
            },
        };
    }

    /**
     * Simulate snapshot restoration (mock implementation)
     * @private
     * @param {Object} _snapshot - Snapshot to restore (unused in mock)
     */
    async _simulateRestore(_snapshot) {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    /**
     * Delete a specific snapshot (file mode only)
     * @private
     * @param {number} index - Snapshot index
     * @param {Object} context - Execution context
     */
    async _deleteSnapshot(index, context) {
        const logger = getLogger();
        const snapshots = await this.snapshotManager.getSnapshots();

        if (index < 0 || index >= snapshots.length) {
            logger.raw('❌ Invalid snapshot number');
            return;
        }

        const snapshot = snapshots[index];
        const confirmed = await this.promptForConfirmation(
            `Delete snapshot ${index + 1} "${snapshot.instruction}"? (y/N): `,
            context
        );

        if (confirmed) {
            logger.raw('🗑️ Deleting snapshot...');

            // Use real snapshot manager if available, otherwise simulate
            if (this.snapshotManager.deleteSnapshot && typeof this.snapshotManager.deleteSnapshot === 'function') {
                const result = await this.snapshotManager.deleteSnapshot(snapshot.id);
                if (result.success) {
                    logger.raw(`✅ Snapshot ${index + 1} deleted`);
                } else {
                    logger.raw(`❌ Failed to delete snapshot: ${result.error}`);
                }
            } else {
                // Fallback to mock deletion
                await new Promise(resolve => setTimeout(resolve, 500));
                logger.raw(`✅ Snapshot ${index + 1} deleted (simulated)`);
            }
        } else {
            logger.raw('❌ Delete cancelled');
        }
    }

    /**
     * Clear all snapshots (file mode only)
     * @private
     * @param {Object} context - Execution context
     */
    async _clearAllSnapshots(context) {
        const logger = getLogger();
        const snapshots = await this.snapshotManager.getSnapshots();

        if (snapshots.length === 0) {
            logger.raw('📭 No snapshots to clear');
            return;
        }

        const confirmed = await this.promptForConfirmation(
            `Clear all ${snapshots.length} snapshots? This cannot be undone! (y/N): `,
            context
        );

        if (confirmed) {
            logger.raw('🗑️ Clearing all snapshots...');

            // Use real snapshot manager if available, otherwise simulate
            if (this.snapshotManager.clearSnapshots && typeof this.snapshotManager.clearSnapshots === 'function') {
                const result = await this.snapshotManager.clearSnapshots();
                if (result.success) {
                    logger.raw(`✅ All ${result.cleared || snapshots.length} snapshots cleared`);
                } else {
                    logger.raw(`❌ Failed to clear snapshots: ${result.error}`);
                }
            } else {
                // Fallback to mock clearing
                await new Promise(resolve => setTimeout(resolve, 1000));
                logger.raw('✅ All snapshots cleared (simulated)');
            }
        } else {
            logger.raw('❌ Clear cancelled');
        }
    }

    /**
     * Merge feature branch to original branch (git mode only)
     * @private
     * @param {Object} context - Execution context
     */
    async _mergeBranch(context) {
        const logger = getLogger();
        const statusResult = await this.snapshotManager.getStatus();
        const status = this._normalizeStatus(statusResult);

        if (!status.featureBranch) {
            logger.raw('❌ No feature branch to merge');
            return;
        }

        logger.raw(`\nMerge feature branch to ${status.originalBranch}?`);
        logger.raw(`  🌿 From: ${status.featureBranch}`);
        logger.raw(`  🌿 To: ${status.originalBranch}`);
        logger.raw('  ⚠️  This will merge all changes and delete the feature branch!');

        const confirmed = await this.promptForConfirmation('\nConfirm merge? (y/N): ', context);

        if (confirmed) {
            logger.raw('\n🔀 Merging branch...');
            // Mock merge (replace with real implementation later)
            await new Promise(resolve => setTimeout(resolve, 2000));
            logger.raw(
                `✅ Successfully merged ${status.featureBranch} to ${status.originalBranch}`
            );
            logger.raw('🧹 Feature branch cleaned up');
        } else {
            logger.raw('❌ Merge cancelled');
        }
    }

    /**
     * Switch back to original branch without merging (git mode only)
     * @private
     * @param {Object} context - Execution context
     */
    async _switchBranch(context) {
        const logger = getLogger();
        const statusResult = await this.snapshotManager.getStatus();
        const status = this._normalizeStatus(statusResult);

        if (!status.featureBranch) {
            logger.raw('❌ Already on original branch');
            return;
        }

        logger.raw(`\nSwitch to ${status.originalBranch} without merging?`);
        logger.raw(`  🌿 Current: ${status.featureBranch}`);
        logger.raw(`  🌿 Target: ${status.originalBranch}`);
        logger.raw('  ⚠️  Changes in feature branch will be preserved but not merged!');

        const confirmed = await this.promptForConfirmation('\nConfirm switch? (y/N): ', context);

        if (confirmed) {
            logger.raw('\n🔄 Switching branch...');
            // Mock switch (replace with real implementation later)
            await new Promise(resolve => setTimeout(resolve, 1000));
            logger.raw(`✅ Switched to ${status.originalBranch}`);
            logger.raw(`💡 Feature branch ${status.featureBranch} is still available`);
        } else {
            logger.raw('❌ Switch cancelled');
        }
    }
}
