/**
 * Workflow script functions for newspaper_copywriter workflow
 *
 * This workflow demonstrates independent agent contexts with selective information sharing.
 * Each agent maintains their own isolated context, and information is selectively copied
 * between contexts based on the workflow's information sharing rules.
 *
 * Context Isolation Rules:
 * - Reviewers: Only see current article version, no other reviews or history
 * - Copywriter: Sees all article versions and all reviews with role attribution
 * - Chief Editor: Sees final submitted version and reviews of that specific version
 *
 * This object contains all functions referenced in the workflow JSON configuration.
 * Each function has access to 'this' context containing:
 * - common_data: Shared workflow variables
 * - input: Input parameters from workflow configuration
 * - workflow_contexts: Map of WorkflowContext instances
 * - last_response: Raw API response from last agent call
 */

export default {
    // ===== UTILITY FUNCTIONS =====

    /**
     * Copy specific information from one context to another
     * @param {string} fromContextName - Source context name
     * @param {string} toContextName - Target context name
     * @param {Array} messages - Messages to copy
     */
    copyMessagesToContext(fromContextName, toContextName, messages) {
        const targetContext = this.workflow_contexts.get(toContextName);
        if (targetContext && messages && messages.length > 0) {
            messages.forEach(message => {
                targetContext.addMessage(message);
            });
        }
    },

    /**
     * Get the current article content
     * @returns {string} Current article content
     */
    getCurrentArticle() {
        return this.common_data.current_article || '';
    },

    /**
     * Store article version in history
     * @param {string} content - Article content
     * @param {string} author - Author of the version
     */
    storeArticleVersion(content, author) {
        this.common_data.article_history = this.common_data.article_history || [];
        this.common_data.article_history.push({
            version: this.common_data.current_revision,
            content: content,
            author: author,
            timestamp: new Date().toISOString(),
        });
    },

    // ===== START STATE HANDLERS =====

    /**
     * PRE-HANDLER for start state (copywriter)
     * Adds the initial article assignment to the copywriter's context
     */
    addInitialAssignment() {
        const context = this.workflow_contexts.get('copywriter_context');
        if (context && this.common_data.article_assignment) {
            context.addMessage({
                role: 'user',
                content: `Article Assignment: ${this.common_data.article_assignment}`,
            });
        }
    },

    /**
     * POST-HANDLER for start state (copywriter)
     * Stores the copywriter's initial draft and adds it to their context
     */
    storeCopywriterDraft() {
        const context = this.workflow_contexts.get('copywriter_context');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (context && responseContent) {
            // Store in common data
            this.common_data.current_article = responseContent;
            this.storeArticleVersion(responseContent, 'copywriter');

            // Add to copywriter's context
            context.addMessage({
                role: 'assistant',
                content: responseContent,
            });
        }
    },

    /**
     * TRANSITION-HANDLER for start state (copywriter)
     * Transitions to the review cycle
     */
    transitionToReviewCycle() {
        this.common_data.reviewers_completed = 0;
        this.common_data.current_reviews = [];
        return 'legal_review';
    },

    // ===== REVIEW STATE HANDLERS =====

    /**
     * PRE-HANDLER for legal_review state
     * Copies ONLY the current article to legal reviewer's isolated context
     */
    prepareLegalReviewContext() {
        const context = this.workflow_contexts.get('legal_reviewer_context');
        if (context && this.common_data.current_article) {
            // Clear any previous messages in reviewer's context
            context.messages.length = 0;

            // Add only the current article for review
            context.addMessage({
                role: 'user',
                content: `Please review this article for legal compliance (Revision ${this.common_data.current_revision}):\n\n${this.common_data.current_article}`,
            });
        }
    },

    /**
     * PRE-HANDLER for editorial_review state
     * Copies ONLY the current article to editorial reviewer's isolated context
     */
    prepareEditorialReviewContext() {
        const context = this.workflow_contexts.get('editorial_reviewer_context');
        if (context && this.common_data.current_article) {
            // Clear any previous messages in reviewer's context
            context.messages.length = 0;

            // Add only the current article for review
            context.addMessage({
                role: 'user',
                content: `Please review this article for editorial quality (Revision ${this.common_data.current_revision}):\n\n${this.common_data.current_article}`,
            });
        }
    },

    /**
     * PRE-HANDLER for fact_check state
     * Copies ONLY the current article to fact checker's isolated context
     */
    prepareFactCheckContext() {
        const context = this.workflow_contexts.get('fact_checker_context');
        if (context && this.common_data.current_article) {
            // Clear any previous messages in reviewer's context
            context.messages.length = 0;

            // Add only the current article for review
            context.addMessage({
                role: 'user',
                content: `Please fact-check this article (Revision ${this.common_data.current_revision}):\n\n${this.common_data.current_article}`,
            });
        }
    },

    /**
     * POST-HANDLER for legal_review state
     * Processes legal review and copies it to copywriter's context with attribution
     */
    processLegalReview() {
        this.processReviewResponse('legal_reviewer', 'LEGAL_REVIEWER');
    },

    /**
     * POST-HANDLER for editorial_review state
     * Processes editorial review and copies it to copywriter's context with attribution
     */
    processEditorialReview() {
        this.processReviewResponse('editorial_reviewer', 'EDITORIAL_REVIEWER');
    },

    /**
     * POST-HANDLER for fact_check state
     * Processes fact check and copies it to copywriter's context with attribution
     */
    processFactCheck() {
        this.processReviewResponse('fact_checker', 'FACT_CHECKER');
    },

    /**
     * Common review processing logic with context isolation
     * @param {string} reviewerType - Type of reviewer (for context name)
     * @param {string} attributionPrefix - Prefix for copywriter context
     */
    processReviewResponse(reviewerType, attributionPrefix) {
        const reviewerContext = this.workflow_contexts.get(`${reviewerType}_context`);
        const copywriterContext = this.workflow_contexts.get('copywriter_context');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;

        if (responseContent) {
            // Store review in common data
            this.common_data.current_reviews = this.common_data.current_reviews || [];
            this.common_data.current_reviews.push({
                type: reviewerType,
                content: responseContent,
                timestamp: new Date().toISOString(),
                revision: this.common_data.current_revision,
            });

            this.common_data.reviewers_completed++;

            // Add review to reviewer's own context
            if (reviewerContext) {
                reviewerContext.addMessage({
                    role: 'assistant',
                    content: responseContent,
                });
            }

            // Copy review to copywriter's context with attribution
            if (copywriterContext) {
                copywriterContext.addMessage({
                    role: 'user',
                    content: `[${attributionPrefix}]: ${responseContent}`,
                });
            }
        }
    },

    /**
     * TRANSITION-HANDLER for review states
     * Determines next reviewer or moves to copywriter decision
     */
    checkNextReviewer() {
        if (this.common_data.reviewers_completed < this.common_data.total_reviewers) {
            // Move to next reviewer
            if (this.common_data.reviewers_completed === 1) {
                return 'editorial_review';
            } else if (this.common_data.reviewers_completed === 2) {
                return 'fact_check';
            }
        }
        // All reviewers completed, move to copywriter decision
        return 'copywriter_decision';
    },

    // ===== COPYWRITER DECISION HANDLERS =====

    /**
     * PRE-HANDLER for copywriter_decision state
     * Copywriter already has all reviews in their context with attribution
     * Just add a decision prompt
     */
    prepareDecisionContext() {
        const context = this.workflow_contexts.get('copywriter_context');
        if (context) {
            context.addMessage({
                role: 'user',
                content: `All reviews are complete for revision ${this.common_data.current_revision}. You have received feedback from all reviewers above. Please decide whether to revise the article based on this feedback or submit it to the chief editor for final approval.`,
            });
        }
    },

    /**
     * POST-HANDLER for copywriter_decision state
     * Processes the copywriter's decision using tool calls
     */
    processCopywriterDecision() {
        const context = this.workflow_contexts.get('copywriter_context');
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        const decisionCall = toolCalls.find(call => call.function?.name === 'copywriter_decision');

        if (decisionCall && context) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);
                this.common_data.copywriter_decision = arguments_;

                const responseContent = this.last_response?.choices?.[0]?.message?.content;
                if (responseContent) {
                    context.addMessage({
                        role: 'assistant',
                        content: responseContent,
                    });
                }
            } catch (error) {
                console.error('Error parsing copywriter_decision arguments:', error);
            }
        }
    },

    /**
     * TRANSITION-HANDLER for copywriter_decision state
     * Decides whether to revise or submit to chief
     */
    decideCopywriterAction() {
        const decision = this.common_data.copywriter_decision;

        if (decision?.action === 'revise') {
            if (this.common_data.current_revision >= this.common_data.max_revision_cycles) {
                // Max revisions reached, force submission to chief
                return 'chief_review';
            }
            return 'copywriter_revision';
        } else if (decision?.action === 'submit') {
            return 'chief_review';
        }

        // Default to chief review if no clear decision
        return 'chief_review';
    },

    // ===== CHIEF EDITOR HANDLERS =====

    /**
     * PRE-HANDLER for chief_review state
     * Copies ONLY the final submitted article and reviews of that version to chief editor's context
     */
    prepareChiefReviewContext() {
        const context = this.workflow_contexts.get('chief_editor_context');
        if (context && this.common_data.current_article) {
            // Clear any previous messages in chief editor's context
            context.messages.length = 0;

            // Get reviews for the current revision only
            const currentRevisionReviews = (this.common_data.current_reviews || []).filter(
                review => review.revision === this.common_data.current_revision
            );

            const reviewSummary =
                currentRevisionReviews.length > 0
                    ? `\n\nReview feedback for this version:\n${currentRevisionReviews.map(r => `${r.type.toUpperCase()}: ${r.content}`).join('\n\n')}`
                    : '';

            context.addMessage({
                role: 'user',
                content: `Chief Editor Review - Final Article Submission (Revision ${this.common_data.current_revision}):\n\n${this.common_data.current_article}${reviewSummary}\n\nPlease provide your final decision on this article.`,
            });
        }
    },

    /**
     * POST-HANDLER for chief_review state
     * Processes the chief editor's decision and copies it to copywriter's context
     */
    processChiefDecision() {
        const chiefContext = this.workflow_contexts.get('chief_editor_context');
        const copywriterContext = this.workflow_contexts.get('copywriter_context');
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        const decisionCall = toolCalls.find(call => call.function?.name === 'chief_decision');

        if (decisionCall) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);
                this.common_data.chief_decision = arguments_;

                if (arguments_.approved === true) {
                    this.common_data.final_article_status = `APPROVED: ${arguments_.feedback || 'Article approved for publication'}`;
                } else {
                    this.common_data.final_article_status = `REVISION REQUESTED: ${arguments_.feedback || 'Chief editor requested revisions'}`;
                }

                const responseContent = this.last_response?.choices?.[0]?.message?.content;

                // Add to chief editor's own context
                if (chiefContext && responseContent) {
                    chiefContext.addMessage({
                        role: 'assistant',
                        content: responseContent,
                    });
                }

                // Copy chief editor's decision to copywriter's context with attribution
                if (copywriterContext && responseContent) {
                    copywriterContext.addMessage({
                        role: 'user',
                        content: `[CHIEF_EDITOR]: ${responseContent}`,
                    });
                }
            } catch (error) {
                console.error('Error parsing chief_decision arguments:', error);
                this.common_data.final_article_status =
                    'ERROR: Unable to process chief editor decision';
            }
        }
    },

    /**
     * TRANSITION-HANDLER for chief_review state
     * Decides whether to approve or request revision
     */
    decideChiefAction() {
        const decision = this.common_data.chief_decision;

        if (decision?.approved === true) {
            return 'stop';
        } else if (decision?.approved === false) {
            if (this.common_data.current_revision >= this.common_data.max_revision_cycles) {
                // Max revisions reached, stop workflow
                this.common_data.final_article_status = 'REJECTED: Maximum revision cycles reached';
                return 'stop';
            }
            return 'copywriter_revision';
        }

        // Default to stop if no clear decision
        return 'stop';
    },

    // ===== REVISION HANDLERS =====

    /**
     * PRE-HANDLER for copywriter_revision state
     * Copywriter already has all feedback in their context, just add revision prompt
     */
    prepareRevisionContext() {
        const context = this.workflow_contexts.get('copywriter_context');
        if (context) {
            const feedback =
                this.common_data.chief_decision?.feedback ||
                'Please address the review feedback above';

            context.addMessage({
                role: 'user',
                content: `Please revise the article based on the feedback above. Focus on: ${feedback}\n\nCurrent article:\n${this.common_data.current_article}`,
            });
        }
    },

    /**
     * POST-HANDLER for copywriter_revision state
     * Stores the revised article and updates copywriter's context
     */
    storeCopywriterRevision() {
        const context = this.workflow_contexts.get('copywriter_context');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;

        if (context && responseContent) {
            // Update revision number and current article
            this.common_data.current_revision++;
            this.common_data.current_article = responseContent;

            // Store in article history
            this.storeArticleVersion(responseContent, 'copywriter');

            // Add to copywriter's context
            context.addMessage({
                role: 'assistant',
                content: responseContent,
            });
        }
    },

    // ===== CONTEXT ISOLATION DEMONSTRATION FUNCTIONS =====

    /**
     * Update the workflow states to use specific pre-handlers for each reviewer
     * This ensures proper context isolation
     */
    prepareReviewContext() {
        // This is a fallback - specific handlers should be used instead
        throw new Error(
            'Use specific prepareXxxReviewContext handlers for proper context isolation'
        );
    },
};
