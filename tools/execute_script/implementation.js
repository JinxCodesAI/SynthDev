/**
 * Execute Script tool implementation
 * Executes JavaScript scripts in a sandboxed environment with AI-powered safety checks
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import ConfigManager from '../../configManager.js';
import AIAPIClient from '../../aiAPIClient.js';
import { CommandBaseTool } from '../common/base-tool.js';
import { getLogger } from '../../logger.js';
import { getToolConfigManager } from '../../toolConfigManager.js';

class ExecuteScriptTool extends CommandBaseTool {
    constructor() {
        const toolConfig = getToolConfigManager();
        super('execute_script', toolConfig.getToolDescription('execute_script'));

        // Define parameter validation
        this.requiredParams = ['script'];
        this.parameterTypes = {
            script: 'string',
            timeout: 'number',
        };

        this.toolConfig = toolConfig;
    }
    /**
     * Perform AI-powered safety assessment of the script
     * @param {string} script - JavaScript code to validate
     * @returns {Promise<Object>} Safety check result
     */
    async performAISafetyCheck(script) {
        try {
            // Initialize AI client for safety assessment using AIAPIClient for centralized logging
            const config = ConfigManager.getInstance();

            // Use fast model for safety checks to optimize cost and speed
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');

            const aiClient = new AIAPIClient(
                this.costsManager,
                modelConfig.apiKey,
                modelConfig.baseUrl,
                modelConfig.model || modelConfig.baseModel
            );

            // Create detailed safety assessment prompt from configuration
            const safetyPrompt = this.toolConfig.getSafetyPrompt(script);

            // Set up response handler to capture the AI response
            let aiResponseContent = null;
            let aiError = null;

            aiClient.setCallbacks({
                onResponse: response => {
                    aiResponseContent = response.choices[0].message.content;
                },
                onError: error => {
                    aiError = error;
                },
            });

            // Make AI safety assessment call through centralized method
            await aiClient.sendUserMessage(safetyPrompt);

            // Check for errors
            if (aiError) {
                throw aiError;
            }

            if (!aiResponseContent) {
                throw new Error('No response received from AI safety assessment');
            }

            const aiResponse = aiResponseContent.trim();

            // Parse AI response
            let safetyResult;
            try {
                // Extract JSON from response (in case AI adds extra text)
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    safetyResult = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in AI response');
                }
            } catch (parseError) {
                // Fallback if AI response is not valid JSON
                return {
                    safe: false,
                    confidence: 0.0,
                    issues: [this.toolConfig.getErrorMessage('parse_error')],
                    reasoning: 'Failed to parse AI safety assessment response',
                    recommendations: this.toolConfig.getSafetyLimits().fallback_recommendations,
                    ai_response: aiResponse,
                    parse_error: parseError.message,
                };
            }

            // Validate AI response structure
            if (typeof safetyResult.safe !== 'boolean') {
                safetyResult.safe = false;
            }
            if (typeof safetyResult.confidence !== 'number') {
                safetyResult.confidence = 0.0;
            }
            if (!Array.isArray(safetyResult.issues)) {
                safetyResult.issues = [];
            }

            // Add metadata
            safetyResult.assessment_method = 'ai_powered';
            safetyResult.model_used = aiClient.getModel();
            safetyResult.tokens_used = 0; // Token usage is tracked by AIAPIClient internally

            return safetyResult;
        } catch (error) {
            // Fallback to basic pattern matching if AI assessment fails
            const logger = getLogger();
            logger.warn(this.toolConfig.getErrorMessage('ai_assessment_failed'), error.message);
            return this.performBasicSafetyCheck(script);
        }
    }

    /**
     * Fallback basic safety check using pattern matching
     * @param {string} script - JavaScript code to validate
     * @returns {Object} Safety check result
     */
    performBasicSafetyCheck(script) {
        const safetyIssues = [];
        const safetyLimits = this.toolConfig.getSafetyLimits();

        // Get dangerous patterns from configuration
        const dangerousPatterns = this.toolConfig.getDangerousPatterns();

        // Check for dangerous patterns
        for (const { pattern, reason } of dangerousPatterns) {
            if (pattern.test(script)) {
                safetyIssues.push(reason);
            }
        }

        // Check script length (prevent extremely large scripts)
        if (script.length > safetyLimits.max_script_size) {
            safetyIssues.push(this.toolConfig.getErrorMessage('script_too_large'));
        }

        return {
            safe: safetyIssues.length === 0,
            confidence: safetyIssues.length === 0 ? 0.8 : 0.2,
            issues: safetyIssues,
            reasoning: 'Basic pattern matching assessment',
            recommendations: safetyIssues.length > 0 ? safetyLimits.fallback_recommendations : [],
            assessment_method: 'pattern_matching',
            model_used: 'none',
            tokens_used: 0,
        };
    }

    async implementation(params) {
        const { script, timeout = this.toolConfig.getSafetyLimits().default_timeout } = params;
        const safetyLimits = this.toolConfig.getSafetyLimits();

        // Validate timeout
        if (timeout < safetyLimits.min_timeout || timeout > safetyLimits.max_timeout) {
            return this.createErrorResponse(this.toolConfig.getErrorMessage('timeout_invalid'), {
                timeout,
                valid_range: `${safetyLimits.min_timeout}-${safetyLimits.max_timeout}`,
            });
        }

        // Perform AI-powered safety check
        const safetyCheck = await this.performAISafetyCheck(script);
        if (!safetyCheck.safe) {
            return this.createErrorResponse(
                this.toolConfig.getErrorMessage('safety_validation_failed'),
                {
                    safety_assessment: safetyCheck,
                    script_preview: script.substring(0, 200) + (script.length > 200 ? '...' : ''),
                }
            );
        }

        // Create a temporary script file
        const tempScriptPath = join(
            process.cwd(),
            `temp_script_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.js`
        );

        try {
            // Write script to temporary file
            writeFileSync(tempScriptPath, script, 'utf8');

            const startTime = Date.now();

            // Execute script as child process
            return new Promise(resolve => {
                const child = spawn('node', [tempScriptPath], {
                    cwd: process.cwd(),
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                let stdout = '';
                let stderr = '';
                let killed = false;

                // Set timeout
                const timeoutId = setTimeout(() => {
                    if (!killed) {
                        killed = true;
                        child.kill('SIGTERM');
                        resolve(
                            this.createErrorResponse('Script execution timed out', {
                                timeout_ms: timeout,
                                execution_time: Date.now() - startTime,
                                safety_check: safetyCheck,
                            })
                        );
                    }
                }, timeout);

                // Collect output
                child.stdout.on('data', data => {
                    stdout += data.toString();
                });

                child.stderr.on('data', data => {
                    stderr += data.toString();
                });

                // Handle process completion
                child.on('close', code => {
                    if (!killed) {
                        clearTimeout(timeoutId);
                        const executionTime = Date.now() - startTime;

                        // Clean up temporary file
                        try {
                            if (existsSync(tempScriptPath)) {
                                unlinkSync(tempScriptPath);
                            }
                        } catch (cleanupError) {
                            // Log cleanup error but don't fail the operation
                            const logger = getLogger();
                            logger.warn(
                                'Failed to cleanup temp script file:',
                                cleanupError.message
                            );
                        }

                        if (code === 0) {
                            if (stdout.length > 50000) {
                                stdout = `${stdout.substring(0, 50000)}...`;
                            } else if (stdout.length === 0) {
                                resolve(
                                    this.createErrorResponse(
                                        'Script execution returned no output',
                                        {
                                            script:
                                                script.length > 500
                                                    ? `${script.substring(0, 500)}...`
                                                    : script,
                                            output: stdout,
                                            stderr: stderr,
                                            execution_time: executionTime,
                                            safety_check: safetyCheck,
                                            exit_code: code,
                                        }
                                    )
                                );
                            }
                            resolve(
                                this.createSuccessResponse({
                                    script:
                                        script.length > 500
                                            ? `${script.substring(0, 500)}...`
                                            : script,
                                    output: stdout,
                                    stderr: stderr,
                                    execution_time: executionTime,
                                    safety_check: safetyCheck,
                                    exit_code: code,
                                })
                            );
                        } else {
                            resolve(
                                this.createErrorResponse(
                                    `Script execution failed with exit code ${code}`,
                                    {
                                        script:
                                            script.length > 500
                                                ? `${script.substring(0, 500)}...`
                                                : script,
                                        output: stdout,
                                        stderr: stderr,
                                        execution_time: executionTime,
                                        safety_check: safetyCheck,
                                        exit_code: code,
                                    }
                                )
                            );
                        }
                    }
                });

                // Handle process errors
                child.on('error', error => {
                    if (!killed) {
                        clearTimeout(timeoutId);
                        resolve(
                            this.createErrorResponse(`Script execution error: ${error.message}`, {
                                script:
                                    script.length > 500 ? `${script.substring(0, 500)}...` : script,
                                execution_time: Date.now() - startTime,
                                safety_check: safetyCheck,
                                error_details: error.message,
                            })
                        );
                    }
                });
            });
        } catch (error) {
            // Clean up temporary file in case of error
            try {
                if (existsSync(tempScriptPath)) {
                    unlinkSync(tempScriptPath);
                }
            } catch (_cleanupError) {
                // Ignore cleanup errors
            }

            return this.createErrorResponse(
                this.toolConfig.getErrorMessage('execution_failed', { error: error.message }),
                {
                    script: script.length > 500 ? `${script.substring(0, 500)}...` : script,
                    safety_check: safetyCheck,
                    error_details: error.message,
                }
            );
        }
    }
}

// Create and export the tool instance
const executeScriptTool = new ExecuteScriptTool();

export default async function executeScript(params) {
    return await executeScriptTool.execute(params);
}
