import { OpenAI } from 'openai';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import ConfigManager from './configManager.js';
import SystemMessages from './systemMessages.js';
import { getLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Handles all OpenAI Compatible API communication and conversation state
 */
class AIAPIClient {
    constructor(
        costsManager,
        apiKey,
        baseURL = 'https://api.openai.com/v1',
        model = 'gpt-4.1-mini'
    ) {
        // Store initial configuration as base model
        this.baseClient = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL,
        });
        this.baseModel = model;

        // Current active client and model (will be switched based on role level)
        this.client = this.baseClient;
        this.model = this.baseModel;

        this.costsManager = costsManager;

        // Store model configurations for different levels
        this.modelConfigs = {
            base: {
                client: this.baseClient,
                model: this.baseModel,
            },
        };

        this.messages = [];
        this.tools = [];
        this.allTools = []; // Store original tools before filtering
        this.role = null;
        this.exampleMessageCount = 0; // Track number of example messages for current role
        this.lastAPICall = {
            request: null,
            response: null,
            timestamp: null,
        };

        // Safety limits from config
        const config = ConfigManager.getInstance();
        this.maxToolCalls = config.getConfig().global.maxToolCalls;
        this.toolCallCount = 0;

        // Callbacks for UI interaction
        this.onThinking = null;
        this.onChainOfThought = null;
        this.onFinalChainOfThought = null;
        this.onToolExecution = null;
        this.onResponse = null;
        this.onError = null;
        this.onContentDisplay = null;
        this.onMessagePush = null;

        // Initialize logger
        this.logger = getLogger();

        // Initialize additional model configurations
        this._initializeModelConfigs();
    }

    /**
     * Initialize model configurations for smart and fast levels
     * @private
     */
    _initializeModelConfigs() {
        const config = ConfigManager.getInstance();

        // Initialize smart model if configured
        if (config.hasSmartModelConfig()) {
            const smartConfig = config.getModel('smart');
            this.modelConfigs.smart = {
                client: new OpenAI({
                    apiKey: smartConfig.apiKey,
                    baseURL: smartConfig.baseUrl,
                }),
                model: smartConfig.model,
            };
        }

        // Initialize fast model if configured
        if (config.hasFastModelConfig()) {
            const fastConfig = config.getModel('fast');
            this.modelConfigs.fast = {
                client: new OpenAI({
                    apiKey: fastConfig.apiKey,
                    baseURL: fastConfig.baseUrl,
                }),
                model: fastConfig.model,
            };
        }
    }

    /**
     * Switch to the appropriate model based on the level
     * @param {string} level - The model level ('base', 'smart', 'fast')
     * @private
     */
    _switchToModelLevel(level) {
        if (this.modelConfigs[level]) {
            this.client = this.modelConfigs[level].client;
            this.model = this.modelConfigs[level].model;
        } else {
            // Fallback to base model if requested level is not configured
            this.logger.warn(`Model level '${level}' not configured, falling back to base model`);
            this.client = this.modelConfigs.base.client;
            this.model = this.modelConfigs.base.model;
        }
    }

    setCallbacks({
        onThinking = null,
        onChainOfThought = null,
        onFinalChainOfThought = null,
        onToolExecution = null,
        onResponse = null,
        onError = null,
        onReminder = null,
        onContentDisplay = null,
        onParseResponse = null,
        onMessagePush = null,
    }) {
        this.onThinking = onThinking;
        this.onChainOfThought = onChainOfThought;
        this.onFinalChainOfThought = onFinalChainOfThought;
        this.onToolExecution = onToolExecution;
        this.onResponse = onResponse;
        this.onError = onError;
        this.onReminder = onReminder;
        this.onContentDisplay = onContentDisplay;
        this.onParseResponse = onParseResponse;
        this.onMessagePush = onMessagePush;
    }

    setTools(tools) {
        this.allTools = [...tools]; // Store original tools
        this.tools = [...tools]; // Set current tools
        this._applyToolFiltering(); // Apply current role filtering if any
    }

    /**
     * Set system message for a specific role and filter tools accordingly
     * @param {string} systemMessage - The system message to set
     * @param {string} role - The role name (optional, for tool filtering)
     */
    async setSystemMessage(systemMessage, role = null) {
        // Remove existing system message and examples if present
        this._removeSystemMessageAndExamples();

        // Add new system message at the beginning
        this.messages.unshift({
            role: 'system',
            content: systemMessage,
        });

        // Add examples for the role (few-shot prompting)
        if (role) {
            this._addExamplesForRole(role);
        }

        // Update current role and apply tool filtering
        if (role === this.role) {
            return;
        }
        this.role = role;
        this._applyToolFiltering();

        // Switch to appropriate model based on role level
        if (role) {
            const previousModel = this.model;
            try {
                const level = SystemMessages.getLevel(role);
                this._switchToModelLevel(level);
                if (this.model !== previousModel) {
                    this.logger.info(
                        `🤖 Switched to ${level} model (${this.model}) for role '${role}'`
                    );
                }
            } catch (error) {
                this.logger.warn(
                    `Could not determine model level for role '${role}': ${error.message}`
                );
            }
        }
    }

    /**
     * Apply tool filtering based on current role's included/excluded tools and add role-specific tools
     * @private
     */
    _applyToolFiltering() {
        if (!this.role || !this.allTools.length) {
            return;
        }

        try {
            const parsingTools = SystemMessages.getParsingTools(this.role);

            // Filter tools using inclusion logic (handles both includedTools and excludedTools)
            const filteredTools = this.allTools.filter(tool => {
                const toolName = tool.function?.name || tool.name;
                return SystemMessages.isToolIncluded(this.role, toolName);
            });

            // Add role-specific tools
            this.tools = [...filteredTools, ...parsingTools];
        } catch (error) {
            this.logger.warn(
                `Could not apply tool filtering for role '${this.role}': ${error.message}`
            );
            // Keep all tools if filtering fails
            this.tools = [...this.allTools];
        }
    }

    /**
     * Remove system message and any existing examples from messages
     * @private
     */
    _removeSystemMessageAndExamples() {
        // Remove system message
        this.messages = this.messages.filter(msg => msg.role !== 'system');

        // Remove existing examples (first N messages after system message)
        if (this.exampleMessageCount > 0) {
            this.messages.splice(0, this.exampleMessageCount);
            this.exampleMessageCount = 0;
        }
    }

    /**
     * Add examples for the specified role (few-shot prompting)
     * @param {string} role - The role name
     * @private
     */
    _addExamplesForRole(role) {
        try {
            const examples = SystemMessages.getExamples(role);
            if (examples && examples.length > 0) {
                // Insert examples after system message (at index 1)
                // Examples are added in order, so they appear right after system message
                for (let i = 0; i < examples.length; i++) {
                    const example = examples[i];
                    // Create a clean copy without any internal tracking properties
                    const exampleMessage = {
                        role: example.role,
                        content: example.content,
                    };

                    // Add function call properties if present (for function examples)
                    if (example.name) {
                        exampleMessage.name = example.name;
                    }
                    if (example.arguments) {
                        exampleMessage.arguments = example.arguments;
                    }

                    this.messages.splice(1 + i, 0, exampleMessage);
                }
                this.exampleMessageCount = examples.length;

                this.logger.debug(`Added ${examples.length} examples for role '${role}'`);
            }
        } catch (error) {
            this.logger.warn(`Could not add examples for role '${role}': ${error.message}`);
        }
    }

    /**
     * Get current role
     * @returns {string|null} Current role or null if not set
     */
    getCurrentRole() {
        return this.role;
    }

    /**
     * Get filtered tool count for current role
     * @returns {number} Number of available tools after filtering
     */
    getFilteredToolCount() {
        return this.tools.length;
    }

    /**
     * Get total tool count before filtering
     * @returns {number} Total number of tools before filtering
     */
    getTotalToolCount() {
        return this.allTools.length;
    }

    async sendUserMessage(userInput) {
        try {
            // Reset tool call counter for new user interaction
            this.toolCallCount = 0;

            // Ensure system message is present for current role
            this._ensureSystemMessage();

            // Add user message to conversation
            this._pushMessage({ role: 'user', content: userInput });

            // Notify UI that thinking has started
            if (this.onThinking) {
                this.onThinking();
            }

            // Get initial response
            const response = await this._makeAPICall();
            const message = response.choices[0].message;

            // Handle reasoning content (model-specific)
            if (message.reasoning_content) {
                if (this.onChainOfThought) {
                    this.onChainOfThought(message.reasoning_content);
                }
                // Clear reasoning content before storing (model-specific behavior)
                message.reasoning_content = null;
            }

            const parsingTools = SystemMessages.getParsingTools(this.role).map(
                tool => tool.function.name
            );
            this.logger.debug('Parsing tools:', parsingTools);

            const toolCalls = message.tool_calls || [];
            const parsingToolCalls = toolCalls.filter(call =>
                parsingTools.includes(call.function.name)
            );
            const nonParsingToolCalls = toolCalls.filter(
                call => !parsingTools.includes(call.function.name)
            );

            if (parsingToolCalls.length > 0 && nonParsingToolCalls.length > 0) {
                this.onError(
                    new Error(
                        'AI response contains both parsing and non-parsing tool calls. This is not supported.'
                    )
                );
                return null;
            }

            // Handle tool calls if present
            if (nonParsingToolCalls.length > 0) {
                this.logger.debug('AI response contains tool calls');

                // Display content immediately if present (before tool execution)
                if (message.content && this.onContentDisplay) {
                    this.onContentDisplay(message.content, this.role);
                }
                await this._handleToolCalls(message);

                // Return the final message content after tool execution
                const finalMessage = this.messages[this.messages.length - 1];
                return finalMessage.content || '';
            } else {
                let content = null;
                if (parsingToolCalls.length > 0) {
                    this.logger.debug('AI response contains parsing tool calls');
                    if (this.onParseResponse) {
                        const parsedResponse = this.onParseResponse(message);
                        this.logger.debug('Parsed response:', parsedResponse);
                        if (parsedResponse.success) {
                            content = parsedResponse.content;
                        } else {
                            this.onError(new Error(parsedResponse.error));
                            return null;
                        }
                    } else {
                        this.logger.error('No parsing response handler defined');
                        this.onError(new Error('No parsing response handler defined'));
                        return null;
                    }
                } else {
                    this.logger.debug('AI response contains no tool calls');
                    content = message.content;
                }
                // Regular response without tools
                this._pushMessage({ role: 'assistant', content: content });
                if (this.onResponse && !this.onParseResponse) {
                    this.onResponse(response, this.role);
                }
                return content || '';
            }
        } catch (error) {
            if (this.onError) {
                this.onError(error);
            }
            return null;
        }
    }

    addUserMessage(userMessage) {
        this._pushMessage({ role: 'user', content: userMessage });
    }

    async _makeAPICall() {
        const config = ConfigManager.getInstance();

        // Prepare API request
        const requestData = {
            model: this.model,
            messages: this.messages,
            tools: this.tools.length > 0 ? this.tools : undefined,
            max_completion_tokens: config.getMaxTokens(this.model),
        };

        // Add tool_choice for parsing-only tools to force them to be called
        if (this.tools.length > 0) {
            const parsingTools = SystemMessages.getParsingTools(this.role);
            const parsingOnlyTools = parsingTools.filter(tool => tool.parsingOnly === true);

            if (parsingOnlyTools.length === 1) {
                // Force the single parsing-only tool to be called
                requestData.tool_choice = {
                    type: 'function',
                    function: { name: parsingOnlyTools[0].function.name },
                };
                this.logger.debug(`🔧 Forcing tool choice: ${parsingOnlyTools[0].function.name}`);
            } else if (parsingOnlyTools.length > 1) {
                this.logger.warn(
                    `Multiple parsing-only tools found for role ${this.role}, cannot force tool choice`
                );
            }
        }

        // Store request data for review
        this.lastAPICall.request = JSON.parse(JSON.stringify(requestData));
        this.lastAPICall.timestamp = new Date().toISOString();

        // Call OpenAI Compatible API
        const response = await this.client.chat.completions.create(requestData).catch(error => {
            this.logger.error(error, 'API call failed');
            this.logger.httpRequest(
                'POST',
                `${this.client.baseURL}/chat/completions`,
                requestData,
                error
            );
            throw error;
        });

        // Store response data for review
        this.lastAPICall.response = JSON.parse(JSON.stringify(response));

        // Log HTTP request/response at verbosity level 5
        this.logger.httpRequest(
            'POST',
            `${this.client.baseURL}/chat/completions`,
            requestData,
            response
        );

        if (response && response.usage) {
            this.costsManager.addUsage(this.model, response.usage);
            this.logger.debug(
                `🤖 ${this.model} usage: ${response.usage.total_tokens} tokens, ${response.usage.prompt_tokens} prompt tokens, ${response.usage.completion_tokens} completion tokens`
            );
        }

        return response;
    }

    async _handleToolCalls(message) {
        // Add the initial assistant message with tool calls to conversation
        this._pushMessage(message);

        let currentMessage = message;

        // Continue processing tool calls until we get a final response without tool calls
        while (currentMessage.tool_calls && currentMessage.tool_calls.length > 0) {
            // Check if we've exceeded the maximum number of tool calls
            if (this.toolCallCount + currentMessage.tool_calls.length > this.maxToolCalls) {
                throw new Error(
                    `Maximum number of tool calls (${this.maxToolCalls}) exceeded. This may indicate an infinite loop or overly complex task.`
                );
            }

            // Execute each tool call in the current message
            for (const toolCall of currentMessage.tool_calls) {
                this.toolCallCount++;

                if (this.onToolExecution) {
                    try {
                        const toolResult = await this.onToolExecution(toolCall);
                        this._pushMessage(toolResult);
                    } catch (error) {
                        // Add error result to conversation
                        this._pushMessage({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: `Error: ${error.message}`,
                        });
                    }
                }
            }

            // Add reminder message if current role has one
            if (this.role) {
                try {
                    let reminder = SystemMessages.getReminder(this.role);
                    if (this.onReminder) {
                        reminder = this.onReminder(reminder);
                    }
                    if (reminder) {
                        this._pushMessage({
                            role: 'user',
                            content: reminder,
                        });
                    }
                } catch (error) {
                    this.logger.warn(
                        `Could not get reminder for role '${this.role}': ${error.message}`
                    );
                }
            }

            // Get next response after tool execution
            const nextResponse = await this._makeAPICall();
            const nextMessage = nextResponse.choices[0].message;

            // Handle reasoning content for intermediate responses
            if (nextMessage.reasoning_content) {
                if (this.onChainOfThought) {
                    this.onChainOfThought(nextMessage.reasoning_content);
                }
                // Clear reasoning content before storing (model-specific behavior)
                nextMessage.reasoning_content = null;
            }

            // Add the response message to conversation
            this._pushMessage(nextMessage);

            // Update current message for next iteration
            currentMessage = nextMessage;
        }

        // At this point, currentMessage has no tool calls - it's the final response
        if (this.onResponse) {
            if (this.lastAPICall.response) {
                this.onResponse(this.lastAPICall.response, this.role);
            } else {
                this.logger.error(
                    'Could not find last API response object to pass to onResponse callback.'
                );
                this.onResponse({ choices: [{ message: currentMessage }] }, this.role);
            }
        }

        // Return the final message content
        return currentMessage.content || '';
    }

    /**
     * Ensure system message and examples are present for the current role
     * @private
     */
    _ensureSystemMessage() {
        if (!this.role) {
            return; // No role set, nothing to restore
        }

        // Check if system message is already present
        const hasSystemMessage = this.messages.length > 0 && this.messages[0].role === 'system';
        if (hasSystemMessage) {
            return; // System message already present
        }

        // Get and add system message for current role
        try {
            const systemMessage = SystemMessages.getSystemMessage(this.role);
            this.messages.unshift({
                role: 'system',
                content: systemMessage,
            });

            // Also add examples for the role
            this._addExamplesForRole(this.role);
        } catch (error) {
            this.logger.warn(
                `Could not restore system message for role '${this.role}': ${error.message}`
            );
        }
    }

    clearConversation() {
        this.messages = [];
        this.exampleMessageCount = 0;
        // Restore system message and examples for current role if one is set
        this._ensureSystemMessage();
    }

    getLastAPICall() {
        return this.lastAPICall;
    }

    getModel() {
        return this.model;
    }

    getMessageCount() {
        return this.messages.length;
    }

    getMessages() {
        // Return a copy to prevent external modification
        return [...this.messages];
    }

    getToolCallCount() {
        return this.toolCallCount;
    }

    getMaxToolCalls() {
        return this.maxToolCalls;
    }

    getExampleMessageCount() {
        return this.exampleMessageCount;
    }

    /**
     * Push a message to the conversation and notify handler
     * @param {Object} message - The message to push
     * @private
     */
    _pushMessage(message) {
        this.messages.push(message);
        if (this.onMessagePush) {
            this.onMessagePush(message);
        }
    }
}

export default AIAPIClient;
