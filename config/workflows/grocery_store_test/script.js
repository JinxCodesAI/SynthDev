/**
 * Workflow script functions for grocery_store_test workflow
 *
 * This object contains all functions referenced in the workflow JSON configuration.
 * Each function has access to 'this' context containing:
 * - common_data: Shared workflow variables
 * - input: Input parameters from workflow configuration
 * - context: WorkflowContext instance
 * - last_response: Raw API response from last agent call
 */

export default {
    /**
     * Initialize the workflow by setting the current request
     * Called in the 'start' state
     */
    initializeRequest() {
        this.common_data.current_request = this.common_data.initial_customer_request;
    },

    /**
     * Always returns true - used for unconditional transitions
     */
    alwaysTrue() {
        return true;
    },

    /**
     * Set the worker response as the current request for the customer
     * Called before transitioning from worker_response to customer_decision
     */
    setWorkerResponse() {
        // Access the raw response content from the last API call
        const responseContent = this.last_response?.choices?.[0]?.message?.content;
        if (responseContent) {
            this.common_data.current_request = responseContent;
        }
    },

    /**
     * Check if customer wants to continue shopping
     * Looks for the interaction_decision parsing tool call in the raw response
     */
    shouldContinueShopping() {
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        // Find the interaction_decision tool call
        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');

        if (!decisionCall) {
            return false; // No decision tool call found
        }

        try {
            const arguments_ = JSON.parse(decisionCall.function.arguments);
            return arguments_.continue_shopping === true;
        } catch (error) {
            console.error('Error parsing interaction_decision arguments:', error);
            return false;
        }
    },

    /**
     * Check if customer wants to stop shopping
     * Inverse of shouldContinueShopping for clarity
     */
    shouldStopShopping() {
        return !this.shouldContinueShopping();
    },

    /**
     * Set the continue message from the customer's decision
     * Called before transitioning back to worker_response
     */
    setContinueMessage() {
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');

        if (decisionCall) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);
                if (arguments_.continue_message) {
                    this.common_data.current_request = arguments_.continue_message;
                }
            } catch (error) {
                console.error('Error parsing continue_message:', error);
            }
        }
    },

    /**
     * Set the shopping summary when customer is done
     * Called before transitioning to stop state
     */
    setShoppingSummary() {
        const toolCalls = this.last_response?.choices?.[0]?.message?.tool_calls || [];

        const decisionCall = toolCalls.find(call => call.function?.name === 'interaction_decision');

        if (decisionCall) {
            try {
                const arguments_ = JSON.parse(decisionCall.function.arguments);
                if (arguments_.shopping_summary) {
                    this.common_data.interaction_summary = arguments_.shopping_summary;
                }
            } catch (error) {
                console.error('Error parsing shopping_summary:', error);
                // Fallback summary
                this.common_data.interaction_summary = 'Shopping interaction completed';
            }
        } else {
            // Fallback if no tool call found
            this.common_data.interaction_summary = 'Shopping interaction completed without summary';
        }
    },
};
