/**
 * HTTP mocks for newspaper copywriter workflow e2e test
 * Contains exact requests and responses for realistic workflow execution
 */

const httpResponses = [
    // Response 1: Copywriter initial draft
    {
        id: 'chatcmpl-newspaper1',
        object: 'chat.completion',
        created: 1749936609,
        model: 'gpt-4.1-mini-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        '# Local Tech Startup Secures $2M in Series A Funding\n\nTechFlow Solutions, a local software development company, announced today that it has successfully raised $2 million in Series A funding led by venture capital firm Innovation Partners.\n\nThe startup, founded in 2022 by former Google engineers Sarah Chen and Michael Rodriguez, specializes in developing AI-powered workflow automation tools for small and medium-sized businesses.\n\n"This funding will allow us to expand our team and accelerate product development," said Chen, who serves as CEO. "We\'re seeing tremendous demand for our automation solutions, especially among businesses looking to streamline their operations."\n\nThe company plans to use the funding to hire 15 additional engineers and expand its sales team. TechFlow currently employs 25 people and serves over 200 clients across the region.\n\nInnovation Partners Managing Director Lisa Wang will join TechFlow\'s board of directors as part of the investment deal.\n\n"TechFlow has demonstrated strong product-market fit and impressive growth metrics," Wang said. "We\'re excited to support their expansion plans."\n\nThe funding round also included participation from angel investors and existing shareholders. TechFlow previously raised $500,000 in seed funding in early 2023.',
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 150,
            completion_tokens: 280,
            total_tokens: 430,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_newspaper1',
    },
    // Response 2: Legal reviewer feedback
    {
        id: 'chatcmpl-newspaper2',
        object: 'chat.completion',
        created: 1749936610,
        model: 'gpt-4.1-mini-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "Legal Review: The article looks good from a legal perspective. All statements are properly attributed to sources and the factual claims appear to be verifiable. The quotes from the CEO and investor are clearly attributed. No concerns about defamation or privacy issues. The article maintains appropriate journalistic distance and doesn't make unsubstantiated claims. Approved from legal standpoint.",
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 320,
            completion_tokens: 85,
            total_tokens: 405,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_newspaper2',
    },
    // Response 3: Editorial reviewer feedback
    {
        id: 'chatcmpl-newspaper3',
        object: 'chat.completion',
        created: 1749936611,
        model: 'gpt-4.1-mini-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "Editorial Review: Strong article overall with good structure and newsworthy content. The lead effectively captures the key information. However, I suggest adding more context about the local tech ecosystem and perhaps including information about TechFlow's competitors or market position. The article could also benefit from more specific details about their AI automation tools. Consider adding a brief explanation of what makes their solution unique. The writing is clear and follows our style guidelines well.",
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 380,
            completion_tokens: 95,
            total_tokens: 475,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_newspaper3',
    },
    // Response 4: Fact checker feedback
    {
        id: 'chatcmpl-newspaper4',
        object: 'chat.completion',
        created: 1749936612,
        model: 'gpt-4.1-mini-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "Fact Check Review: I need to verify several claims in this article. The founding date of 2022 and the founders' Google background should be confirmed through company records or LinkedIn profiles. The $2M funding amount and Series A designation need verification through SEC filings or official press releases. The current employee count of 25 and client count of 200 should be verified. The previous $500K seed funding in early 2023 also needs confirmation. Please provide sources for these key facts before publication.",
                    refusal: null,
                    annotations: [],
                },
                logprobs: null,
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 420,
            completion_tokens: 110,
            total_tokens: 530,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_newspaper4',
    },
    // Response 5: Copywriter decision (submit to chief)
    {
        id: 'chatcmpl-newspaper5',
        object: 'chat.completion',
        created: 1749936613,
        model: 'gpt-4.1-mini-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "After reviewing all the feedback, I believe the article is ready to submit to the chief editor. The legal review found no issues, the editorial feedback suggests minor enhancements that can be addressed in future articles, and the fact-checker's concerns are standard verification requests that I can provide documentation for. The core story is solid and newsworthy.",
                    refusal: null,
                    annotations: [],
                    tool_calls: [
                        {
                            id: 'call_copywriter_decision_1',
                            type: 'function',
                            function: {
                                name: 'copywriter_decision',
                                arguments:
                                    '{"action": "submit", "reasoning": "Article is ready for chief editor review. Legal approved, editorial suggestions are minor, and fact-check verification can be provided. Core story is solid and newsworthy."}',
                            },
                        },
                    ],
                },
                logprobs: null,
                finish_reason: 'tool_calls',
            },
        ],
        usage: {
            prompt_tokens: 650,
            completion_tokens: 120,
            total_tokens: 770,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_newspaper5',
    },
    // Response 6: Chief editor final approval
    {
        id: 'chatcmpl-newspaper6',
        object: 'chat.completion',
        created: 1749936614,
        model: 'gpt-4.1-nano-2025-04-14',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content:
                        "After reviewing the article and all team feedback, I approve this article for publication. The story is newsworthy and well-written. While the fact-checker raised valid verification points, these are standard due diligence items that can be resolved with proper documentation. The legal team found no issues, and the editorial suggestions, while valuable, don't prevent publication. This is exactly the kind of local business coverage our readers expect. Approved for publication.",
                    refusal: null,
                    annotations: [],
                    tool_calls: [
                        {
                            id: 'call_chief_decision_1',
                            type: 'function',
                            function: {
                                name: 'chief_decision',
                                arguments:
                                    '{"approved": true, "feedback": "Article approved for publication. Strong local business story that serves our readers well. Fact verification items are standard and can be documented."}',
                            },
                        },
                    ],
                },
                logprobs: null,
                finish_reason: 'tool_calls',
            },
        ],
        usage: {
            prompt_tokens: 750,
            completion_tokens: 140,
            total_tokens: 890,
        },
        service_tier: 'default',
        system_fingerprint: 'fp_newspaper6',
    },
];

const httpRequests = [
    // Request 1: Copywriter initial draft
    {
        model: 'gpt-4.1-mini',
        max_completion_tokens: 32000,
        messages: [
            {
                role: 'system',
                content: 'You are Alex, a skilled copywriter at The Daily Herald newspaper...',
            },
            {
                role: 'user',
                content:
                    'Article Assignment: Write a 300-word news article about TechFlow Solutions, a local startup that just raised $2M in Series A funding. Include quotes from the CEO and lead investor. Focus on what they plan to do with the funding and their growth plans.',
            },
        ],
    },
    // Request 2: Legal reviewer
    {
        model: 'gpt-4.1-mini',
        max_completion_tokens: 32000,
        messages: [
            {
                role: 'system',
                content: 'You are Jordan, the legal reviewer at The Daily Herald newspaper...',
            },
            {
                role: 'user',
                content:
                    'Please review this article (Revision 1):\n\n# Local Tech Startup Secures $2M in Series A Funding...',
            },
        ],
    },
    // Request 3: Editorial reviewer
    {
        model: 'gpt-4.1-mini',
        max_completion_tokens: 32000,
        messages: [
            {
                role: 'system',
                content: 'You are Sam, the editorial reviewer at The Daily Herald newspaper...',
            },
            {
                role: 'user',
                content:
                    'Please review this article (Revision 1):\n\n# Local Tech Startup Secures $2M in Series A Funding...',
            },
        ],
    },
    // Request 4: Fact checker
    {
        model: 'gpt-4.1-mini',
        max_completion_tokens: 32000,
        messages: [
            {
                role: 'system',
                content: 'You are Casey, the fact-checker at The Daily Herald newspaper...',
            },
            {
                role: 'user',
                content:
                    'Please review this article (Revision 1):\n\n# Local Tech Startup Secures $2M in Series A Funding...',
            },
        ],
    },
    // Request 5: Copywriter decision with tool
    {
        model: 'gpt-4.1-mini',
        max_completion_tokens: 32000,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'copywriter_decision',
                    description:
                        'Decision tool for copywriter to choose next action after receiving feedback',
                    parameters: {
                        type: 'object',
                        properties: {
                            action: {
                                type: 'string',
                                enum: ['revise', 'submit'],
                                description:
                                    'Whether to revise the article based on feedback or submit to chief editor',
                            },
                            reasoning: {
                                type: 'string',
                                description: 'Explanation for the decision',
                            },
                        },
                        required: ['action', 'reasoning'],
                    },
                },
            },
        ],
        tool_choice: {
            type: 'function',
            function: { name: 'copywriter_decision' },
        },
        messages: [
            {
                role: 'system',
                content: 'You are Alex, a skilled copywriter at The Daily Herald newspaper...',
            },
            {
                role: 'user',
                content:
                    'All reviews are complete for revision 1. Here are the feedback comments:\n\nLEGAL: Legal Review: The article looks good from a legal perspective...',
            },
        ],
    },
    // Request 6: Chief editor decision with tool
    {
        model: 'gpt-4.1-nano',
        max_completion_tokens: 32000,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'chief_decision',
                    description: 'Final decision tool for chief editor on article approval',
                    parameters: {
                        type: 'object',
                        properties: {
                            approved: {
                                type: 'boolean',
                                description: 'Whether the article is approved for publication',
                            },
                            feedback: {
                                type: 'string',
                                description:
                                    'Feedback explaining the decision and any required changes',
                            },
                        },
                        required: ['approved', 'feedback'],
                    },
                },
            },
        ],
        tool_choice: {
            type: 'function',
            function: { name: 'chief_decision' },
        },
        messages: [
            {
                role: 'system',
                content: 'You are Morgan, the Chief Editor at The Daily Herald newspaper...',
            },
            {
                role: 'user',
                content:
                    'Chief Editor Review - Article Revision 1:\n\n# Local Tech Startup Secures $2M in Series A Funding...',
            },
        ],
    },
];

export const newspaperCopywriterHttpMocks = {
    getResponses() {
        return httpResponses;
    },

    getRequests() {
        return httpRequests;
    },

    getResponse(index) {
        return httpResponses[index];
    },

    getRequest(index) {
        return httpRequests[index];
    },

    getCount() {
        return httpResponses.length;
    },

    createOpenAIMock() {
        let callCount = 0;

        return async function mockOpenAICreate(requestData) {
            if (callCount >= httpResponses.length) {
                throw new Error(`No more responses available (call ${callCount + 1})`);
            }

            const response = httpResponses[callCount];
            callCount++;

            return response;
        };
    },
};
