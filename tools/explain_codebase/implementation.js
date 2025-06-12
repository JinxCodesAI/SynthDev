import { readFileSync } from 'fs';
import { join } from 'path';
import ConfigManager from '../../configManager.js';
import AIAPIClient from '../../aiAPIClient.js';
import SystemMessages from '../../systemMessages.js';
import { CommandBaseTool } from '../common/base-tool.js';
import { getLogger } from '../../logger.js';

class ExplainCodebaseTool extends CommandBaseTool {
    constructor() {
        super(
            'explain_codebase',
            'Provides AI-generated explanations in markdown format for natural language questions about the indexed codebase summaries from ".index/codebase-index.json"'
        );
        this.requiredParams = ['question'];
        this.parameterTypes = {
            question: 'string',
        };
    }

    /**
     * Load the indexed codebase summaries
     */
    _loadIndex() {
        try {
            const indexPath = join(process.cwd(), '.index', 'codebase-index.json');
            const content = readFileSync(indexPath, 'utf8');
            return JSON.parse(content);
        } catch (_error) {
            return null;
        }
    }

    /**
     * Construct the user prompt with summaries and question
     */
    _constructUserPrompt(indexData, question) {
        // Extract summaries from files and directories
        const fileSummaries = [];
        const directorySummaries = [];

        if (!indexData || !indexData.files) {
            return null;
        }

        for (const [path, info] of Object.entries(indexData.files)) {
            if (info.ai_summary) {
                if (info.type === 'file') {
                    fileSummaries.push(`File: ${path}\nSummary: ${info.ai_summary}\n`);
                } else if (info.type === 'directory') {
                    directorySummaries.push(`Directory: ${path}\nSummary: ${info.ai_summary}\n`);
                }
            }
        }

        const combinedSummaries = `${fileSummaries.join('\n')}\n${directorySummaries.join('\n')}`;

        const prompt = `Below are summaries of the indexed codebase files and directories. Use them to answer the question. If you need more information, use available tools like exact_search, read_file, or list_directory.

Summaries:

${combinedSummaries}

Question: ${question}
`;

        return prompt;
    }

    showLastAPICall(aiClient) {
        const logger = getLogger();
        const lastCall = aiClient.getLastAPICall();

        if (!lastCall.request || !lastCall.response) {
            logger.info('📋 No API calls have been made yet');
            return;
        }

        logger.raw('\n📋 Last API Call Review');
        logger.raw('═'.repeat(80));
        logger.raw(`🕒 Timestamp: ${lastCall.timestamp}`);
        logger.raw();

        // Show Request
        logger.raw('📤 REQUEST:');
        logger.raw('─'.repeat(40));
        logger.raw(JSON.stringify(lastCall.request, null, 3));
        logger.raw();

        // Show Response
        logger.raw('📥 RESPONSE:');
        logger.raw('─'.repeat(40));
        logger.raw(JSON.stringify(lastCall.response, null, 3));
        logger.raw('═'.repeat(80));
        logger.raw();
    }
    async implementation(params) {
        const { question } = params;

        if (!question || typeof question !== 'string' || question.trim() === '') {
            return this.createErrorResponse(
                'question parameter is required and must be a non-empty string'
            );
        }

        // Load indexed codebase summaries
        const indexData = this._loadIndex();
        if (!indexData) {
            return this.createErrorResponse('Codebase index not found or could not be read');
        }

        // Construct user prompt with summaries
        const userPrompt = this._constructUserPrompt(indexData, question);
        if (!userPrompt) {
            return this.createErrorResponse(
                'Failed to construct prompt from codebase index summaries'
            );
        }

        // Initialize AI client with configuration
        const config = ConfigManager.getInstance();
        let aiClient = null;

        try {
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');
            aiClient = new AIAPIClient(
                this.costsManager,
                modelConfig.apiKey,
                modelConfig.baseUrl,
                modelConfig.model || modelConfig.baseModel
            );

            // Set the codebase_explainer role
            const systemMessage = SystemMessages.getSystemMessage('codebase_explainer');
            await aiClient.setSystemMessage(systemMessage, 'codebase_explainer');

            // Create a promise to capture the response
            let responseContent = null;
            let responseError = null;

            // Set up response callback
            aiClient.setCallbacks({
                onResponse: response => {
                    if (
                        response &&
                        response.choices &&
                        response.choices[0] &&
                        response.choices[0].message
                    ) {
                        responseContent = response.choices[0].message.content;
                    }
                },
                onError: error => {
                    responseError = error;
                },
                onReminder: reminder => {
                    return `${reminder}\n Original question was ${question}`;
                },
            });

            // Send the user message and wait for response
            await aiClient.sendUserMessage(userPrompt);

            //this.showLastAPICall(aiClient);

            // Check for errors
            if (responseError) {
                return this.createErrorResponse('AI processing failed', {
                    error: responseError.message,
                });
            }

            // Check if we got a response
            if (!responseContent) {
                return this.createErrorResponse('No response received from AI');
            }

            return this.createSuccessResponse({
                question,
                markdown: responseContent.trim(),
            });
        } catch (error) {
            return this.createErrorResponse('Failed to initialize AI client or process request', {
                error: error.message,
            });
        }
    }
}

const explainCodebaseTool = new ExplainCodebaseTool();

export default async function explainCodebase(params) {
    return await explainCodebaseTool.execute(params);
}
