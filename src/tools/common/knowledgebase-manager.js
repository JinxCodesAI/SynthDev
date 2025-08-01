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

                    // Store original content to track which lines were affected
                    const originalContent = this.knowledgebase;
                    const originalLines = originalContent.split('\n');

                    // 1) Replace all occurrences of content
                    this.knowledgebase = this.knowledgebase.replace(
                        new RegExp(this._escapeRegExp(content), 'g'),
                        ''
                    );

                    // 2) Split into lines after replacement
                    const linesAfterRemoval = this.knowledgebase.split('\n');
                    const finalLines = [];

                    // 3) Process each line to remove only those that became empty due to content removal
                    for (let i = 0; i < linesAfterRemoval.length; i++) {
                        const currentLine = linesAfterRemoval[i];

                        // 4) If this line is now whitespace-only, check if it was affected by removal
                        if (currentLine.trim().length === 0) {
                            // Check if the corresponding original line contained the removed content
                            const originalLine = i < originalLines.length ? originalLines[i] : '';

                            // Only remove if the original line contained the content we removed
                            if (originalLine.includes(content)) {
                                continue; // Skip this line (remove it)
                            }
                        }

                        finalLines.push(currentLine);
                    }

                    // 5) Join everything back
                    this.knowledgebase = finalLines.join('\n');
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
}

// Create singleton instance
const knowledgebaseManager = new KnowledgebaseManager();

export default knowledgebaseManager;
export { KnowledgebaseManager };
