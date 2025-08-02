import { OpenAI } from 'openai';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import ConfigManager from '../../config/managers/configManager.js';
import SystemMessages from './systemMessages.js';
import { getLogger } from '../managers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Processing states for AIAPIClient
 */
const ProcessingState = {
    IDLE: 'idle', // Ready for new requests
    PREPARING: 'preparing', // About to make API call (brief transition state)
    API_CALLING: 'api_calling', // Currently making API call
    PROCESSING_TOOLS: 'processing_tools', // Executing tools after API response
    FINALIZING: 'finalizing', // Processing final response (brief transition state)
};

/**
 * Handles all OpenAI Compatible API communication and conversation state
 */
class AIAPIClient {
    /**
     * Creates a new AIAPIClient instance
     * @param {Object} costsManager - Cost management instance
     * @param {string} apiKey - API key for OpenAI-compatible service
     * @param {string} baseURL - Base URL for API service
     * @param {string} model - Model name to use
     * @param {Object|null} toolManager - Optional tool manager for default tool execution
     */
    constructor(
        costsManager,
        apiKey,
        baseURL = 'https://api.openai.com/v1',
        model = 'gpt-4.1-mini',
        toolManager = null
    ) {
        // Store initial configuration as base model
        this.baseClient = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL,
        });
        this.baseModel = model;
        this._processingState = ProcessingState.IDLE;

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
        this.originalMaxToolCalls = config.getConfig().global.maxToolCalls;
        this.maxToolCalls = this.originalMaxToolCalls;
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
        this.onMaxToolCallsExceeded = null;

        // Initialize logger
        this.logger = getLogger();

        // Store toolManager reference and set up default tool execution if provided
        this.toolManager = toolManager;
        if (toolManager) {
            this.onToolExecution = this._defaultToolExecutionHandler.bind(this);
            this.logger.debug(`AIAPIClient initialized with toolManager for role: ${this.role}`);
        } else {
            this.logger.debug(
                'AIAPIClient initialized without toolManager - tools will require manual callback setup'
            );
        }

        // Initialize additional model configurations
        this._initializeModelConfigs();
    }

    isReady() {
        return this._processingState === ProcessingState.IDLE;
    }

    /**
     * Check if the client can accept a new request (more permissive than isReady)
     * @returns {boolean} True if can accept new request
     */
    canAcceptNewRequest() {
        return this._processingState === ProcessingState.IDLE;
    }

    /**
     * Get current processing state
     * @returns {string} Current processing state
     */
    getProcessingState() {
        return this._processingState;
    }

    /**
     * Set processing state with logging
     * @param {string} newState - New processing state
     * @private
     */
    _setProcessingState(newState) {
        const oldState = this._processingState;
        this._processingState = newState;
        this.logger.debug(`🔄 Processing state changed: ${oldState} → ${newState}`);
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
        onMaxToolCallsExceeded = null,
    }) {
        this.onThinking = onThinking;
        this.onChainOfThought = onChainOfThought;
        this.onFinalChainOfThought = onFinalChainOfThought;

        // Only override default tool execution handler if explicitly provided
        if (onToolExecution !== null) {
            this.onToolExecution = onToolExecution;
        }
        // If onToolExecution is null and we have a default, keep the default

        this.onResponse = onResponse;
        this.onError = onError;
        this.onReminder = onReminder;
        this.onContentDisplay = onContentDisplay;
        this.onParseResponse = onParseResponse;
        this.onMessagePush = onMessagePush;
        this.onMaxToolCallsExceeded = onMaxToolCallsExceeded;
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
        if (!this.role) {
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
            // Add user message to conversation
            this._pushMessage({ role: 'user', content: userInput });

            // Execute the common message processing logic
            return await this._processMessage();
        } catch (error) {
            if (this.onError) {
                this.onError(error);
            }
            return null;
        }
    }

    /**
     * Send a message using existing conversation context without adding a new user message
     * Used by workflow agents when context is managed externally
     * @returns {Promise<string>} Response content
     */
    async sendMessage() {
        this.logger.debug('🔍 DEBUG: sendMessage called for role', this.role?.name);
        try {
            // Execute the common message processing logic without adding a new message
            return await this._processMessage();
        } catch (error) {
            if (this.onError) {
                this.onError(error);
            }
            return null;
        }
    }

    /**
     * Common message processing logic shared by sendUserMessage and sendMessage
     * @private
     * @returns {Promise<string>} Response content
     */
    async _processMessage() {
        this.logger.debug('🔍 DEBUG: _processMessage called for role', this.role?.name);

        // Set state to preparing
        this._setProcessingState(ProcessingState.PREPARING);

        // Reset tool call counter for new interaction
        this.toolCallCount = 0;

        // Ensure system message is present for current role
        this._ensureSystemMessage();

        // Notify UI that thinking has started
        if (this.onThinking) {
            this.onThinking();
        }

        // Get initial response
        const response = await this._makeAPICall();
        const message = response.choices[0].message;

        // Handle reasoning content (model-specific)
        const reasoningContent = message.reasoning_content ?? message.reasoning_details;
        if (reasoningContent) {
            if (this.onChainOfThought) {
                this.onChainOfThought(reasoningContent);
            }
            // Clear reasoning content before storing (model-specific behavior)
            delete message.reasoning_content;
            delete message.reasoning_details;
        }

        const parsingTools = SystemMessages.getParsingTools(this.role).map(
            tool => tool.function.name
        );
        this.logger.debug('🔍 DEBUG: Parsing tools for role', this.role, ':', parsingTools);

        const toolCalls = message.tool_calls || [];
        this.logger.debug(
            '🔍 DEBUG: Tool calls in response:',
            toolCalls.map(call => call.function.name)
        );
        const parsingToolCalls = toolCalls.filter(call =>
            parsingTools.includes(call.function.name)
        );
        this.logger.debug('🔍 DEBUG: Parsing tool calls found:', parsingToolCalls.length);
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
            const result = await this._handleToolCalls(message);

            // Return the result from _handleToolCalls (could be early termination message)
            // Note: _handleToolCalls already sets state to IDLE when complete
            return result;
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

            // Always call onResponse to capture raw response data, regardless of parsing tools
            if (this.onResponse) {
                this.logger.debug('🔍 DEBUG: Calling onResponse callback for parsing tools');
                this.onResponse(response, this.role);
            } else {
                this.logger.debug('🔍 DEBUG: No onResponse callback defined for parsing tools');
            }

            // Set state to finalizing before returning
            this._setProcessingState(ProcessingState.FINALIZING);

            // Set state back to idle when processing is complete
            this._setProcessingState(ProcessingState.IDLE);
            return content || '';
        }
    }

    addUserMessage(userMessage) {
        this._pushMessage({ role: 'user', content: userMessage });
    }

    /**
     * Add a message to the conversation
     * @param {Object} message - Message object with role and content
     */
    addMessage(message) {
        this._pushMessage(message);
    }

    /**
     * Pure function that sorts messages to ensure tool responses come directly after their corresponding assistant tool_calls
     * @param {Array} messages - Array of message objects to sort
     * @returns {Array} - New array with properly ordered messages
     * @static
     */
    static sortMessagesForToolCalls(messages) {
        // Create a copy to avoid mutating the original array
        const sortedMessages = [...messages];

        // Find all tool messages that need to be repositioned
        const toolMessages = [];
        for (let i = 0; i < sortedMessages.length; i++) {
            const message = sortedMessages[i];
            if (message.role === 'tool' && message.tool_call_id) {
                toolMessages.push({ message, index: i });
            }
        }

        // For each tool message, find its corresponding assistant message with tool_calls
        // and move the tool message to be directly after it
        for (const toolMsg of toolMessages) {
            const toolCallId = toolMsg.message.tool_call_id;

            // Find the assistant message with the matching tool_call_id
            let assistantIndex = -1;
            for (let i = 0; i < sortedMessages.length; i++) {
                const message = sortedMessages[i];
                if (message.role === 'assistant' && message.tool_calls) {
                    const hasMatchingToolCall = message.tool_calls.some(
                        call => call.id === toolCallId
                    );
                    if (hasMatchingToolCall) {
                        assistantIndex = i;
                        break;
                    }
                }
            }

            if (assistantIndex !== -1) {
                // Find current position of the tool message
                const currentToolIndex = sortedMessages.findIndex(
                    msg => msg.role === 'tool' && msg.tool_call_id === toolCallId
                );

                if (currentToolIndex !== -1) {
                    // Calculate where the tool message should be placed
                    // It should be after the assistant message and after any other tool messages
                    // that belong to the same assistant message
                    let targetIndex = assistantIndex + 1;

                    // Find all tool messages that should come before this one
                    // (those that belong to the same assistant message and have earlier tool_call positions)
                    const assistantMessage = sortedMessages[assistantIndex];
                    const toolCallIds = assistantMessage.tool_calls.map(call => call.id);
                    const currentToolCallPosition = toolCallIds.indexOf(toolCallId);

                    // Count how many tool messages from the same assistant are already positioned correctly
                    for (
                        let i = assistantIndex + 1;
                        i < currentToolIndex && i < sortedMessages.length;
                        i++
                    ) {
                        const msg = sortedMessages[i];
                        if (msg.role === 'tool' && msg.tool_call_id) {
                            const msgToolCallPosition = toolCallIds.indexOf(msg.tool_call_id);
                            if (
                                msgToolCallPosition !== -1 &&
                                msgToolCallPosition < currentToolCallPosition
                            ) {
                                targetIndex = i + 1;
                            }
                        }
                    }

                    // Move the tool message to the correct position if it's not already there
                    if (currentToolIndex !== targetIndex) {
                        const toolMessage = sortedMessages.splice(currentToolIndex, 1)[0];
                        // Adjust target index if we removed an element before it
                        if (currentToolIndex < targetIndex) {
                            targetIndex--;
                        }
                        sortedMessages.splice(targetIndex, 0, toolMessage);
                    }
                }
            }
        }

        return sortedMessages;
    }

    /**
     * Ensures proper message ordering by applying the sorting function to this.messages
     * @private
     */
    _ensureMessageOrdering() {
        this.messages = AIAPIClient.sortMessagesForToolCalls(this.messages);
    }

    async _makeAPICall() {
        const config = ConfigManager.getInstance();

        this._setProcessingState(ProcessingState.API_CALLING);
        // Ensure proper message ordering before API call
        this._ensureMessageOrdering();

        // Prepare API request
        const requestData = {
            model: this.model,
            tools: this.tools.length > 0 ? this.tools : undefined,
            tool_choice: 'auto',
            messages: this.messages,
            max_completion_tokens: config.getMaxTokens(this.model),
            ...config.getModelParameters(this.model),
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

        this.logger.debug('🔍 DEBUG: Making API call .....');
        // Call OpenAI Compatible API
        const response = await this.client.chat.completions.create(requestData).catch(error => {
            this.logger.error(error, 'API call failed');
            this.logger.httpRequest(
                'POST',
                `${this.client.baseURL}/chat/completions`,
                requestData,
                error
            );
            this._setProcessingState(ProcessingState.IDLE);
            throw error;
        });
        // Note: Don't set to IDLE here - let the calling method manage state transitions
        this.logger.debug('🔍 DEBUG: API call completed');

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

    /**
     * Expand multicall tools into individual tool calls in the message
     * @param {Object} message - The assistant message containing tool calls
     * @returns {Promise<Object>} Modified message with expanded tool calls
     * @private
     */
    async _expandMulticallTools(message) {
        if (!message.tool_calls || message.tool_calls.length === 0) {
            return message;
        }

        // Check for multicall tools
        const multicallTools = message.tool_calls.filter(
            call => call.function.name === 'multicall'
        );
        const nonMulticallTools = message.tool_calls.filter(
            call => call.function.name !== 'multicall'
        );

        if (multicallTools.length === 0) {
            // No multicall tools, return original message
            return message;
        }

        this.logger.debug(`Found ${multicallTools.length} multicall tool(s) to expand`);

        // Process each multicall tool
        const expandedToolCalls = [...nonMulticallTools]; // Keep non-multicall tools as-is

        for (const multicallTool of multicallTools) {
            try {
                // Execute the multicall tool to get expanded tool calls
                const multicallResult = await this._executeMulticallTool(multicallTool);

                if (
                    multicallResult &&
                    multicallResult.expanded_tool_calls &&
                    Array.isArray(multicallResult.expanded_tool_calls)
                ) {
                    // Validate that expanded tool calls have proper format
                    const validExpandedCalls = multicallResult.expanded_tool_calls.filter(call => {
                        const isValid = call && call.id && call.function && call.function.name;
                        if (!isValid) {
                            this.logger.warn('Invalid expanded tool call format:', call);
                        }
                        return isValid;
                    });

                    if (validExpandedCalls.length > 0) {
                        expandedToolCalls.push(...validExpandedCalls);
                        this.logger.debug(
                            `Expanded multicall into ${validExpandedCalls.length} individual tool calls`
                        );

                        // Log details of expansion for debugging
                        this.logger.debug('Multicall expansion details:', {
                            original_multicall_id: multicallTool.id,
                            expanded_calls: validExpandedCalls.map(call => ({
                                id: call.id,
                                function_name: call.function.name,
                            })),
                        });
                    } else {
                        this.logger.warn(
                            'No valid expanded tool calls found, keeping original multicall'
                        );
                        expandedToolCalls.push(multicallTool);
                    }
                } else {
                    this.logger.warn(
                        'Multicall tool did not return valid expanded_tool_calls array'
                    );
                    // Keep the original multicall tool if expansion failed
                    expandedToolCalls.push(multicallTool);
                }
            } catch (error) {
                this.logger.error(
                    `Failed to expand multicall tool (ID: ${multicallTool.id}): ${error.message}`
                );
                this.logger.debug('Multicall expansion error details:', {
                    error_stack: error.stack,
                    original_multicall: multicallTool,
                });
                // Keep the original multicall tool if expansion failed
                expandedToolCalls.push(multicallTool);
            }
        }

        // Return modified message with expanded tool calls
        return {
            ...message,
            tool_calls: expandedToolCalls,
        };
    }

    /**
     * Execute a multicall tool to get expanded tool calls
     * @param {Object} multicallTool - The multicall tool call object
     * @returns {Promise<Object>} Result containing expanded_tool_calls
     * @private
     */
    async _executeMulticallTool(multicallTool) {
        if (!this.onToolExecution) {
            throw new Error('No tool execution handler available for multicall expansion');
        }

        try {
            // Execute the multicall tool
            const toolResult = await this.onToolExecution(multicallTool);

            // Parse the result to get expanded tool calls
            let parsedResult;
            try {
                parsedResult = JSON.parse(toolResult.content);
            } catch (parseError) {
                throw new Error(`Failed to parse multicall result: ${parseError.message}`);
            }

            if (!parsedResult.success) {
                throw new Error(
                    `Multicall execution failed: ${parsedResult.error || 'Unknown error'}`
                );
            }

            // Return the parsed result which should contain expanded_tool_calls
            return parsedResult;
        } catch (error) {
            this.logger.error(`Multicall tool execution failed: ${error.message}`);
            throw error;
        }
    }

    async _handleToolCalls(message) {
        // Check for multicall tools before adding message to conversation
        const expandedMessage = await this._expandMulticallTools(message);

        // Add the (potentially expanded) assistant message with tool calls to conversation
        this._pushMessage(expandedMessage);

        let currentMessage = expandedMessage;
        this._setProcessingState(ProcessingState.PROCESSING_TOOLS);

        // Continue processing tool calls until we get a final response without tool calls
        while (currentMessage.tool_calls && currentMessage.tool_calls.length > 0) {
            // Check if we've exceeded the maximum number of tool calls
            if (this.toolCallCount + currentMessage.tool_calls.length > this.maxToolCalls) {
                if (this.onMaxToolCallsExceeded) {
                    // Ask user for confirmation to continue
                    const shouldContinue = await this.onMaxToolCallsExceeded(this.maxToolCalls);
                    if (!shouldContinue) {
                        // User chose not to continue, return current response
                        return (
                            currentMessage.content ||
                            'Operation stopped due to maximum tool calls limit.'
                        );
                    }
                    // User chose to continue, increase the limit by the original max amount
                    // This gives them another full batch of tool calls before next confirmation
                    this.maxToolCalls += this.originalMaxToolCalls;
                } else {
                    this._setProcessingState(ProcessingState.IDLE);
                    // Fallback to throwing error if no callback is set
                    throw new Error(
                        `Maximum number of tool calls (${this.maxToolCalls}) exceeded. This may indicate an infinite loop or overly complex task.`
                    );
                }
            }

            // Execute each tool call in the current message
            for (const toolCall of currentMessage.tool_calls) {
                this.toolCallCount++;

                if (this.onToolExecution) {
                    try {
                        const toolResult = await this.onToolExecution(toolCall);
                        this.logger.debug('Tool call completed:', toolCall.function.name);
                        this.logger.debug('Tool result:', toolResult);
                        this._pushMessage(toolResult);
                    } catch (error) {
                        // Add error result to conversation
                        this._pushMessage({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: `Error: ${error.message}`,
                        });
                    }
                } else {
                    this.logger.error(
                        'No tool execution handler defined and no toolManager provided'
                    );
                    this._setProcessingState(ProcessingState.IDLE);
                    throw new Error(
                        'No tool execution handler defined. ' +
                            'Either set onToolExecution callback or provide toolManager in constructor.'
                    );
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
            // State will be managed by the calling method
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

        // Set state to finalizing before returning
        this._setProcessingState(ProcessingState.FINALIZING);

        // Set state back to idle when processing is complete
        this._setProcessingState(ProcessingState.IDLE);

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

    /**
     * Default tool execution handler when toolManager is provided
     * @param {Object} toolCall - Tool call object from AI response
     * @returns {Promise<Object>} Tool execution result
     * @private
     */
    async _defaultToolExecutionHandler(toolCall) {
        if (!this.toolManager) {
            throw new Error('No tool manager available for tool execution');
        }

        // Prepare standardized tool context
        const toolContext = {
            currentRole: this.role,
            currentAgentId: null, // Default for non-agent contexts
            agentManager: null, // Default for non-agent contexts
            costsManager: this.costsManager,
            toolManager: this.toolManager,
            app: null, // Default for non-main-app contexts
        };

        // Create minimal console interface for non-interactive contexts
        const consoleInterface = {
            showToolExecution: (toolName, args, role) => {
                this.logger.toolExecutionDetailed(toolName, role, args);
            },
            showToolResult: result => {
                this.logger.toolResult(result);
            },
            showToolCancelled: toolName => {
                this.logger.debug(`Tool cancelled: ${toolName}`);
            },
            promptForConfirmation: async () => {
                // Auto-approve for non-interactive contexts
                return true;
            },
        };

        try {
            return await this.toolManager.executeToolCall(
                toolCall,
                consoleInterface,
                null, // No snapshot manager
                toolContext
            );
        } catch (error) {
            this.logger.error(`Tool execution failed: ${error.message}`);
            throw error;
        }
    }
}

export default AIAPIClient;
