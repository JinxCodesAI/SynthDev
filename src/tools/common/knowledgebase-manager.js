/**
 * Knowledgebase Manager - In-memory shared knowledgebase storage
 * Provides centralized knowledgebase management functionality for agent coordination
 */

import { getLogger } from '../../core/managers/logger.js';

/**
 * Knowledgebase operations:
 * - read: Get current knowledgebase content
 * - override: Replace entire knowledgebase content
 * - append: Add content to the end (always on new line)
 * - remove: Remove specific content (with whitespace cleanup)
 */

class KnowledgebaseManager {
    constructor() {
        this.knowledgebase = ''; // Multiline string storage
        this.logger = getLogger();
        this.logger.debug('KnowledgebaseManager initialized');
    }

    /**
     * Read the current knowledgebase content
     * @returns {Object} Result with success and content
     */
    read() {
        try {
            this.logger.debug('Reading knowledgebase content', {
                current_length: this.knowledgebase.length,
                current_lines: this.knowledgebase ? this.knowledgebase.split('\n').length : 0,
            });

            const result = {
                success: true,
                content: this.knowledgebase,
                length: this.knowledgebase.length,
                lines: this.knowledgebase ? this.knowledgebase.split('\n').length : 0,
            };

            this.logger.debug('Knowledgebase read completed successfully', {
                content_length: result.length,
                content_lines: result.lines,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to read knowledgebase', error.message);
            return {
                success: false,
                error: `Failed to read knowledgebase: ${error.message}`,
            };
        }
    }

    /**
     * Update the knowledgebase with specified operation
     * @param {string} type - Operation type: 'override', 'append', 'remove'
     * @param {string} content - Content to use for the operation
     * @returns {Object} Result with success/error and operation details
     */
    update(type, content) {
        try {
            this.logger.debug('Starting knowledgebase update', {
                operation_type: type,
                content_length: content ? content.length : 0,
                current_kb_length: this.knowledgebase.length,
            });

            const validTypes = ['override', 'append', 'remove'];

            if (!validTypes.includes(type)) {
                this.logger.warn('Invalid operation type provided', {
                    provided_type: type,
                    valid_types: validTypes,
                });
                return {
                    success: false,
                    error: `Invalid operation type: ${type}. Valid types: ${validTypes.join(', ')}`,
                };
            }

            if (content === undefined || content === null) {
                this.logger.warn('Content parameter missing for knowledgebase update');
                return {
                    success: false,
                    error: 'Content parameter is required',
                };
            }

            if (typeof content !== 'string') {
                this.logger.warn('Invalid content type provided', {
                    provided_type: typeof content,
                    expected_type: 'string',
                });
                return {
                    success: false,
                    error: 'Content must be a string',
                };
            }

            const previousContent = this.knowledgebase;
            const previousLength = previousContent.length;

            switch (type) {
                case 'override':
                    this.logger.debug('Performing override operation', {
                        previous_length: previousLength,
                        new_content_length: content.length,
                    });
                    this.knowledgebase = content;
                    break;

                case 'append':
                    this.logger.debug('Performing append operation', {
                        previous_length: previousLength,
                        content_to_append_length: content.length,
                        needs_newline:
                            this.knowledgebase.length > 0 && !this.knowledgebase.endsWith('\n'),
                    });
                    if (this.knowledgebase.length > 0 && !this.knowledgebase.endsWith('\n')) {
                        this.knowledgebase += '\n';
                    }
                    this.knowledgebase += content;
                    break;

                case 'remove':
                    if (content.length === 0) {
                        this.logger.warn('Attempted to remove empty content');
                        return {
                            success: false,
                            error: 'Cannot remove empty content',
                        };
                    }

                    this.logger.debug('Performing remove operation', {
                        content_to_remove_length: content.length,
                        content_preview:
                            content.length > 50 ? `${content.substring(0, 47)}...` : content,
                    });

                    // Find all occurrences of the content to remove
                    const contentRegex = new RegExp(this._escapeRegExp(content), 'g');
                    let match;
                    const replacements = [];

                    // Find all matches and determine what to replace them with
                    while ((match = contentRegex.exec(this.knowledgebase)) !== null) {
                        const startIndex = match.index;
                        const endIndex = startIndex + content.length;

                        // Check what's on the left and right of the content
                        const leftChar = startIndex > 0 ? this.knowledgebase[startIndex - 1] : '';
                        const rightChar =
                            endIndex < this.knowledgebase.length
                                ? this.knowledgebase[endIndex]
                                : '';

                        // Determine replacement: add newline if neither side ends with whitespace
                        let replacement = '';
                        if (
                            leftChar &&
                            rightChar &&
                            !this._isWhitespace(leftChar) &&
                            !this._isWhitespace(rightChar)
                        ) {
                            replacement = '\n';
                        }

                        replacements.push({
                            start: startIndex,
                            end: endIndex,
                            replacement: replacement,
                        });

                        // Reset regex lastIndex to avoid infinite loop
                        contentRegex.lastIndex = endIndex;
                    }

                    this.logger.debug('Found content matches for removal', {
                        matches_found: replacements.length,
                        replacements: replacements.map(r => ({
                            start: r.start,
                            end: r.end,
                            replacement_length: r.replacement.length,
                        })),
                    });

                    // Apply replacements from right to left to maintain correct indices
                    replacements.reverse();
                    for (const repl of replacements) {
                        this.knowledgebase =
                            this.knowledgebase.substring(0, repl.start) +
                            repl.replacement +
                            this.knowledgebase.substring(repl.end);
                    }
                    break;
            }

            const newLength = this.knowledgebase.length;
            const newLines = this.knowledgebase ? this.knowledgebase.split('\n').length : 0;

            const result = {
                success: true,
                operation: type,
                content_provided: content,
                previous_length: previousLength,
                new_length: newLength,
                new_lines: newLines,
                content_changed: previousContent !== this.knowledgebase,
            };

            this.logger.debug('Knowledgebase update completed successfully', {
                operation: type,
                previous_length: previousLength,
                new_length: newLength,
                content_changed: result.content_changed,
                size_change: newLength - previousLength,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to update knowledgebase', error.message);
            return {
                success: false,
                error: `Failed to update knowledgebase: ${error.message}`,
                operation: type,
            };
        }
    }

    /**
     * Clear the entire knowledgebase (useful for testing)
     */
    clear() {
        const previousLength = this.knowledgebase.length;
        this.logger.debug('Clearing knowledgebase', {
            previous_length: previousLength,
        });
        this.knowledgebase = '';
        this.logger.debug('Knowledgebase cleared successfully');
    }

    /**
     * Get knowledgebase statistics
     * @returns {Object} Statistics about the knowledgebase
     */
    getStats() {
        const lines = this.knowledgebase ? this.knowledgebase.split('\n') : [];
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);

        const stats = {
            total_length: this.knowledgebase.length,
            total_lines: lines.length,
            non_empty_lines: nonEmptyLines.length,
            empty_lines: lines.length - nonEmptyLines.length,
            is_empty: this.knowledgebase.length === 0,
        };

        this.logger.debug('Generated knowledgebase statistics', stats);
        return stats;
    }

    /**
     * Escape special regex characters in a string
     * @param {string} string - String to escape
     * @returns {string} Escaped string
     */
    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Check if a character is whitespace (space, tab, newline, etc.)
     * @param {string} char - Character to check
     * @returns {boolean} True if character is whitespace
     */
    _isWhitespace(char) {
        return /\s/.test(char);
    }
}

// Create singleton instance
const knowledgebaseManager = new KnowledgebaseManager();

export default knowledgebaseManager;
export { KnowledgebaseManager };
