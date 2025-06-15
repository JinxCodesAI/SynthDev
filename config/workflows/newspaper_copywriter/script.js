/**
 * Workflow script functions for newspaper_copywriter workflow
 *
 * This object contains all functions referenced in the workflow JSON configuration.
 * Each function has access to 'this' context containing:
 * - common_data: Shared workflow variables
 * - input: Input parameters from workflow configuration
 * - workflow_contexts: Map of WorkflowContext instances
 * - last_response: Raw API response from last agent call
 */

export default {
    // ===== START STATE HANDLERS =====

    /**
     * PRE-HANDLER for start state (copywriter)
     * Adds the initial article assignment to the context
     */
    addInitialAssignment() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        if (context && this.common_data.article_assignment) {
            context.addMessage({
                role: 'user',
                content: `Article Assignment: ${this.common_data.article_assignment}`,
            });
        }
    },

    /**
     * POST-HANDLER for start state (copywriter)
     * Stores the copywriter's initial draft
     */
    storeCopywriterDraft() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (context && responseContent) {
            this.common_data.current_article = responseContent;
            this.common_data.article_history = this.common_data.article_history || [];
            this.common_data.article_history.push({
                version: this.common_data.current_revision,
                content: responseContent,
                author: 'copywriter',
                timestamp: new Date().toISOString(),
            });

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
     * PRE-HANDLER for review states
     * Prepares context for reviewers with current article
     */
    prepareReviewContext() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        if (context && this.common_data.current_article) {
            context.addMessage({
                role: 'user',
                content: `Please review this article (Revision ${this.common_data.current_revision}):\n\n${this.common_data.current_article}`,
            });
        }
    },

    /**
     * POST-HANDLER for legal_review state
     */
    processLegalReview() {
        this.processReviewResponse('legal');
    },

    /**
     * POST-HANDLER for editorial_review state
     */
    processEditorialReview() {
        this.processReviewResponse('editorial');
    },

    /**
     * POST-HANDLER for fact_check state
     */
    processFactCheck() {
        this.processReviewResponse('fact_check');
    },

    /**
     * Common review processing logic
     */
    processReviewResponse(reviewType) {
        const context = this.workflow_contexts.get('newsroom_conversation');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;

        if (context && responseContent) {
            this.common_data.current_reviews = this.common_data.current_reviews || [];
            this.common_data.current_reviews.push({
                type: reviewType,
                content: responseContent,
                timestamp: new Date().toISOString(),
            });

            this.common_data.reviewers_completed++;

            context.addMessage({
                role: 'assistant',
                content: `${reviewType.toUpperCase()} REVIEW: ${responseContent}`,
            });
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
     * Prepares context with all reviews for copywriter to consider
     */
    prepareDecisionContext() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        if (context && this.common_data.current_reviews) {
            const reviewSummary = this.common_data.current_reviews
                .map(review => `${review.type.toUpperCase()}: ${review.content}`)
                .join('\n\n');

            context.addMessage({
                role: 'user',
                content: `All reviews are complete for revision ${this.common_data.current_revision}. Here are the feedback comments:\n\n${reviewSummary}\n\nPlease decide whether to revise the article based on this feedback or submit it to the chief editor for final approval.`,
            });
        }
    },

    /**
     * POST-HANDLER for copywriter_decision state
     * Processes the copywriter's decision using tool calls
     */
    processCopywriterDecision() {
        const context = this.workflow_contexts.get('newsroom_conversation');
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
     * Prepares context with article and recent reviews for chief editor
     */
    prepareChiefReviewContext() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        if (context && this.common_data.current_article) {
            const recentReviews = this.common_data.current_reviews || [];
            const reviewSummary =
                recentReviews.length > 0
                    ? `\n\nRecent review feedback:\n${recentReviews.map(r => `${r.type}: ${r.content}`).join('\n')}`
                    : '';

            context.addMessage({
                role: 'user',
                content: `Chief Editor Review - Article Revision ${this.common_data.current_revision}:\n\n${this.common_data.current_article}${reviewSummary}\n\nPlease provide your final decision on this article.`,
            });
        }
    },

    /**
     * POST-HANDLER for chief_review state
     * Processes the chief editor's decision
     */
    processChiefDecision() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        const decisionCall = toolCalls.find(call => call.function?.name === 'chief_decision');

        if (decisionCall && context) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);
                this.common_data.chief_decision = arguments_;

                if (arguments_.approved === true) {
                    this.common_data.final_article_status = `APPROVED: ${arguments_.feedback || 'Article approved for publication'}`;
                } else {
                    this.common_data.final_article_status = `REVISION REQUESTED: ${arguments_.feedback || 'Chief editor requested revisions'}`;
                }

                const responseContent = this.last_response?.choices?.[0]?.message?.content;
                if (responseContent) {
                    context.addMessage({
                        role: 'assistant',
                        content: responseContent,
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
     * Prepares context for copywriter to revise based on feedback
     */
    prepareRevisionContext() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        if (context) {
            const feedback =
                this.common_data.chief_decision?.feedback ||
                this.common_data.current_reviews?.map(r => r.content).join('; ') ||
                'General revision requested';

            context.addMessage({
                role: 'user',
                content: `Please revise the article based on this feedback: ${feedback}\n\nCurrent article:\n${this.common_data.current_article}`,
            });
        }
    },

    /**
     * POST-HANDLER for copywriter_revision state
     * Stores the revised article
     */
    storeCopywriterRevision() {
        const context = this.workflow_contexts.get('newsroom_conversation');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;

        if (context && responseContent) {
            this.common_data.current_revision++;
            this.common_data.current_article = responseContent;

            this.common_data.article_history = this.common_data.article_history || [];
            this.common_data.article_history.push({
                version: this.common_data.current_revision,
                content: responseContent,
                author: 'copywriter',
                timestamp: new Date().toISOString(),
            });

            context.addMessage({
                role: 'assistant',
                content: responseContent,
            });
        }
    },
};
