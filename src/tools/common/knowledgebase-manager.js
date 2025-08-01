/**
 * Knowledgebase Manager - In-memory shared knowledgebase storage
 * Provides centralized knowledgebase management functionality for agent coordination
 */

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
    }

    /**
     * Read the current knowledgebase content
     * @returns {Object} Result with success and content
     */
    read() {
        try {
            return {
                success: true,
                content: this.knowledgebase,
                length: this.knowledgebase.length,
                lines: this.knowledgebase ? this.knowledgebase.split('\n').length : 0,
            };
        } catch (error) {
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
            const validTypes = ['override', 'append', 'remove'];

            if (!validTypes.includes(type)) {
                return {
                    success: false,
                    error: `Invalid operation type: ${type}. Valid types: ${validTypes.join(', ')}`,
                };
            }

            if (content === undefined || content === null) {
                return {
                    success: false,
                    error: 'Content parameter is required',
                };
            }

            if (typeof content !== 'string') {
                return {
                    success: false,
                    error: 'Content must be a string',
                };
            }

            const previousContent = this.knowledgebase;
            const previousLength = previousContent.length;

            switch (type) {
                case 'override':
                    this.knowledgebase = content;
                    break;

                case 'append':
                    if (this.knowledgebase.length > 0 && !this.knowledgebase.endsWith('\n')) {
                        this.knowledgebase += '\n';
                    }
                    this.knowledgebase += content;
                    break;

                case 'remove':
                    if (content.length === 0) {
                        return {
                            success: false,
                            error: 'Cannot remove empty content',
                        };
                    }

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

            return {
                success: true,
                operation: type,
                content_provided: content,
                previous_length: previousLength,
                new_length: newLength,
                new_lines: newLines,
                content_changed: previousContent !== this.knowledgebase,
            };
        } catch (error) {
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
        this.knowledgebase = '';
    }

    /**
     * Get knowledgebase statistics
     * @returns {Object} Statistics about the knowledgebase
     */
    getStats() {
        const lines = this.knowledgebase ? this.knowledgebase.split('\n') : [];
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);

        return {
            total_length: this.knowledgebase.length,
            total_lines: lines.length,
            non_empty_lines: nonEmptyLines.length,
            empty_lines: lines.length - nonEmptyLines.length,
            is_empty: this.knowledgebase.length === 0,
        };
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
