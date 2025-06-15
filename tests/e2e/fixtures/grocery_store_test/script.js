/**
 * Workflow script functions for grocery_store_test workflow
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
     * PRE-HANDLER for start state (grocery_worker)
     * Adds the initial customer request as a user message to the context
     */
    addInitialCustomerMessage() {
        const context = this.workflow_contexts.get('store_conversation');
        if (context && this.common_data.initial_customer_request) {
            context.addMessage({
                role: 'user',
                content: this.common_data.initial_customer_request,
            });
        }
    },

    /**
     * POST-HANDLER for start state (grocery_worker)
     * Adds the worker's response as an assistant message to the context
     */
    addWorkerResponse() {
        const context = this.workflow_contexts.get('store_conversation');
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (context && responseContent) {
            context.addMessage({
                role: 'assistant',
                content: responseContent,
            });
        }
    },

    /**
     * TRANSITION-HANDLER for start state (grocery_worker)
     * Always transitions to customer_decision
     */
    alwaysTransitionToCustomer() {
        return 'customer_decision';
    },

    // ===== CUSTOMER_DECISION STATE HANDLERS =====

    /**
     * POST-HANDLER for customer_decision state (customer)
     * Processes the customer's interaction_decision tool call and updates context
     */
    processCustomerDecision() {
        const context = this.workflow_contexts.get('store_conversation');
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        // Find the interaction_decision tool call
        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');

        if (decisionCall && context) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);

                if (arguments_.continue_shopping === true && arguments_.continue_message) {
                    // Customer wants to continue - add their message as 'user' role in context
                    // (customer has role="user" in config, so their messages should be 'user' in context)
                    context.addMessage({
                        role: 'user',
                        content: arguments_.continue_message,
                    });
                } else if (arguments_.continue_shopping === false && arguments_.shopping_summary) {
                    // Store the summary for final output
                    this.common_data.interaction_summary = arguments_.shopping_summary;
                }
            } catch (error) {
                console.error('Error parsing interaction_decision arguments:', error);
            }
        }
    },

    /**
     * TRANSITION-HANDLER for customer_decision state (customer)
     * Decides next state based on continue_shopping value
     */
    decideNextState() {
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');

        if (decisionCall) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);

                if (arguments_.continue_shopping === true) {
                    return 'worker_response';
                } else {
                    return 'stop';
                }
            } catch (error) {
                console.error('Error parsing interaction_decision arguments:', error);
                return 'stop'; // Default to stop on error
            }
        }

        return 'stop'; // Default to stop if no tool call found
    },
};
