/**
 * HTTP mocks for grocery store workflow e2e test
 * Contains exact requests and responses from logs/http_requests.txt
 */

/**
 * Exact HTTP responses from the logs in order
 */
const httpResponses = [
    // Response 1: grocery_worker initial response
    {
        id: 'chatcmpl-BiSjxbXxPMTv3ESaFxFrkG7HZG3KI',
        object: 'chat.completion',
        created: 1749936609,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "Hi! Yes, we do have a good selection of marinara sauces here at FreshMart. We carry both store brands and some premium options. For a pasta dinner for six, I recommend picking up a couple of jars to ensure you have enough sauce. \n\nWould you prefer a more traditional marinara, or are you looking for something with added herbs or a special flavor? Also, if you'd like, I can suggest some pasta varieties and other ingredients to complete your meal.  \n\nCurrently, we're running a promotion on our store brand marinara—buy one, get a small discount—so it's a great time to stock up.",
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 380,
            completion_tokens: 127,
            total_tokens: 507,
            prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0,
            },
            completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
            },
        },
        service_tier: 'default',
        system_fingerprint: 'fp_f12167b370',
    },

    // Response 2: customer decision (first tool call)
    {
        id: 'chatcmpl-BiSjykkH03M3M9MnZxGk2RncjObzP',
        object: 'chat.completion',
        created: 1749936610,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: 'call_xj5JniNFi8OvxRYHsDfZiLA6',
                            type: 'function',
                            function: {
                                name: 'interaction_decision',
                                arguments:
                                    '{"continue_shopping":true,"continue_message":"I\'d like to see the store brand marinara and maybe a premium one as well. Please also help me find pasta, garlic bread, and salad ingredients."}',
                            },
                        },
                    ],
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 562,
            completion_tokens: 42,
            total_tokens: 604,
            prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0,
            },
            completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
            },
        },
        service_tier: 'default',
        system_fingerprint: 'fp_38343a2f8f',
    },

    // Response 3: grocery_worker detailed response
    {
        id: 'chatcmpl-BiSjzFuImIWebme24WcSTTaFyPi6a',
        object: 'chat.completion',
        created: 1749936611,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "Absolutely! Let me guide you to the marinara sauces first.\n\nOur store brand marinara is located in the pasta aisle, aisle 3, near the other sauces. It's a solid choice with good flavor and a great price. The premium marinara is just a few shelves over, in the same aisle—it's made with extra fresh herbs and a richer taste. Both are in jars and easily accessible.\n\nFor the pasta, you'll find a wide selection on aisle 2. We have spaghetti, penne, and fusilli—most of it in both regular and organic varieties.\n\nThe garlic bread is baked fresh daily and found in the frozen section near the bakery, aisle 4. It's great for serving alongside pasta.\n\nAs for salad ingredients, you can pick up fresh lettuce, tomatoes, and cucumbers from our produce section, aisle 1. Since it's late fall, the tomatoes aren't at their peak, but greenhouse varieties are available for a decent flavor. I recommend grabbing some fresh lettuce and cucumbers to keep the salad light and refreshing.\n\nWould you like me to help you put together a quick shopping list or suggest some additional ingredients like Parmesan cheese or herbs?",
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 546,
            completion_tokens: 236,
            total_tokens: 782,
            prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0,
            },
            completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
            },
        },
        service_tier: 'default',
        system_fingerprint: 'fp_f12167b370',
    },

    // Response 4: customer decision (second tool call)
    {
        id: 'chatcmpl-BiSk0fLDG48vZcqg1aK8gY1Uh70pf',
        object: 'chat.completion',
        created: 1749936612,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: 'call_XRWtWfIQyXPKcI0N7fqsb2Qs',
                            type: 'function',
                            function: {
                                name: 'interaction_decision',
                                arguments:
                                    '{"continue_shopping":true,"continue_message":"Yes, please add these items to my list and suggest Parmesan cheese and herbs."}',
                            },
                        },
                    ],
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 837,
            completion_tokens: 27,
            total_tokens: 864,
            prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0,
            },
            completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
            },
        },
        service_tier: 'default',
        system_fingerprint: 'fp_38343a2f8f',
    },

    // Response 5: grocery_worker final list
    {
        id: 'chatcmpl-BiSk1wHmOTpIdm7LKtCW1lkAjCLVK',
        object: 'chat.completion',
        created: 1749936613,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "Of course! Here's a suggested list of everything you'll need for your pasta dinner:\n\n- Store brand marinara sauce (located in aisle 3)\n- Premium marinara sauce (located in aisle 3, near the store brand)\n- Pasta (your choice of type in aisle 2)\n- Garlic bread (frozen section near the bakery in aisle 4)\n- Fresh lettuce, tomatoes, cucumbers (produce section, aisle 1)\n- Parmesan cheese (found in the dairy aisle, aisle 5)\n- Dried herbs such as basil, oregano, and parsley (spice aisle, aisle 6)\n\nIf you'd like, I can recommend specific brands for Parmesan or herbs, or suggest pre-packaged herb mixes if you're short on time. Also, if you want, I can tell you about any current promotions on these items. Would you like me to prepare a printable shopping list for you?",
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 806,
            completion_tokens: 182,
            total_tokens: 988,
            prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0,
            },
            completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
            },
        },
        service_tier: 'default',
        system_fingerprint: 'fp_f12167b370',
    },

    // Response 6: customer final decision (stop shopping)
    {
        id: 'chatcmpl-BiSk2ZXahbo646J8PAfGYjBk9eiFz',
        object: 'chat.completion',
        created: 1749936614,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: 'call_gtArx8milgJFisXomHGOaut6',
                            type: 'function',
                            function: {
                                name: 'interaction_decision',
                                arguments:
                                    '{"continue_shopping":false,"shopping_summary":"Items purchased: store brand marinara sauce, premium marinara sauce, pasta (penne), garlic bread, lettuce, tomatoes, cucumbers, Parmesan cheese, dried basil, oregano, and parsley. Total cost is approximately $40. The shopping was efficient, and you are within your $45 budget."}',
                            },
                        },
                    ],
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 1043,
            completion_tokens: 72,
            total_tokens: 1115,
            prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0,
            },
            completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
            },
        },
        service_tier: 'default',
        system_fingerprint: 'fp_38343a2f8f',
    },
];

/**
 * Expected HTTP requests from the logs (structure only, content may vary)
 */
const httpRequests = [
    // Request 1: grocery_worker initial
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
        messages: [
            {
                role: 'system',
                content: 'You are Sam, a helpful employee at FreshMart grocery store...',
            },
            {
                role: 'user',
                content:
                    "Hi, I'm looking for ingredients to make pasta dinner for 6 people tomorrow. Do you have good marinara sauce?",
            },
        ],
    },

    // Request 2: customer decision (with tool)
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'interaction_decision',
                    description:
                        'Decide whether to continue the interaction or conclude your shopping assistance, should be called exactly once per interaction',
                },
            },
        ],
        tool_choice: {
            type: 'function',
            function: {
                name: 'interaction_decision',
            },
        },
    },

    // Request 3: grocery_worker response
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
    },

    // Request 4: customer decision (with tool)
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'interaction_decision',
                },
            },
        ],
        tool_choice: {
            type: 'function',
            function: {
                name: 'interaction_decision',
            },
        },
    },

    // Request 5: grocery_worker response
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
    },

    // Request 6: customer final decision (with tool)
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'interaction_decision',
                },
            },
        ],
        tool_choice: {
            type: 'function',
            function: {
                name: 'interaction_decision',
            },
        },
    },
];

/**
 * Export object with helper functions
 */
export const groceryStoreHttpMocks = {
    /**
     * Get all HTTP responses in order
     */
    getResponses() {
        return httpResponses;
    },

    /**
     * Get all HTTP request structures in order
     */
    getRequests() {
        return httpRequests;
    },

    /**
     * Get a specific response by index
     */
    getResponse(index) {
        return httpResponses[index];
    },

    /**
     * Get a specific request by index
     */
    getRequest(index) {
        return httpRequests[index];
    },

    /**
     * Get the total number of HTTP interactions
     */
    getCount() {
        return httpResponses.length;
    },

    /**
     * Create a low-level OpenAI mock that only intercepts the HTTP call
     * and returns the correct response based on request pattern matching
     */
    createOpenAIMock() {
        let groceryWorkerCallCount = 0;
        let customerCallCount = 0;

        return async function mockOpenAICreate(requestData) {
            // Determine request type and return appropriate response
            let response;
            let responseIndex;

            if (requestData.tools && requestData.tools.length > 0) {
                // Customer request (has tools) - responses 2, 4, 6 (indices 1, 3, 5)
                responseIndex = 1 + customerCallCount * 2; // 1, 3, 5
                if (responseIndex >= httpResponses.length) {
                    throw new Error(
                        `No more customer responses available (call ${customerCallCount + 1})`
                    );
                }
                response = httpResponses[responseIndex];
                customerCallCount++;
            } else {
                // Grocery worker request (no tools) - responses 1, 3, 5 (indices 0, 2, 4)
                responseIndex = 0 + groceryWorkerCallCount * 2; // 0, 2, 4
                if (responseIndex >= httpResponses.length) {
                    throw new Error(
                        `No more grocery worker responses available (call ${groceryWorkerCallCount + 1})`
                    );
                }
                response = httpResponses[responseIndex];
                groceryWorkerCallCount++;
            }

            return response;
        };
    },
};
