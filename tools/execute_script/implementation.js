/**
 * Execute Script tool implementation
 * Executes JavaScript scripts in a sandboxed environment with AI-powered safety checks
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { OpenAI } from 'openai';
import ConfigManager from '../../configManager.js';
import { CommandBaseTool } from '../common/base-tool.js';
import { getLogger } from '../../logger.js';

class ExecuteScriptTool extends CommandBaseTool {
    constructor() {
        super(
            'execute_script',
            'Execute a JavaScript script as a child process for calculations, text transformations, and data aggregation'
        );

        // Define parameter validation
        this.requiredParams = ['script'];
        this.parameterTypes = {
            script: 'string',
            timeout: 'number',
        };
    }
    /**
     * Perform AI-powered safety assessment of the script
     * @param {string} script - JavaScript code to validate
     * @returns {Promise<Object>} Safety check result
     */
    async performAISafetyCheck(script) {
        try {
            // Initialize AI client for safety assessment
            const config = ConfigManager.getInstance();
            let aiClient = null;
            let aiModel = null;

            // Use fast model for safety checks to optimize cost and speed
            const modelConfig = config.hasFastModelConfig()
                ? config.getModel('fast')
                : config.getModel('base');

            aiClient = new OpenAI({
                apiKey: modelConfig.apiKey,
                baseURL: modelConfig.baseUrl,
            });

            aiModel = config.hasFastModelConfig()
                ? modelConfig.model
                : modelConfig.baseModel || modelConfig.model;

            // Create detailed safety assessment prompt
            const safetyPrompt = `You are a security expert analyzing JavaScript code for safety. Assess the following script and determine if it's safe to execute in a sandboxed environment.

ALLOWED OPERATIONS (these are SAFE):
- Reading files: fs.readFileSync, fs.readFile, fs.existsSync, fs.statSync, fs.readdirSync
- Built-in modules: Math, JSON, console, path operations, crypto (for hashing only)
- Data processing: calculations, text transformations, array/object manipulation
- Requiring safe modules: require('fs'), require('path'), require('crypto')

FORBIDDEN OPERATIONS (these are UNSAFE):
- File modifications: fs.writeFile, fs.appendFile, fs.createWriteStream, fs.mkdir, fs.rmdir, fs.unlink, fs.rename, fs.copy
- System commands: child_process, spawn, exec, fork, execSync
- Network access: http, https, net, dgram, tls, fetch, XMLHttpRequest, WebSocket
- Dynamic code execution: eval(), Function(), setTimeout, setInterval
- Dangerous globals: process.exit, process.kill, global modifications, process.env modifications
- Infinite loops: while(true), for(;;) without break conditions

SCRIPT TO ANALYZE:
\`\`\`javascript
${script}
\`\`\`

Respond with a JSON object in this exact format:
{
  "safe": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of specific security issues found"],
  "reasoning": "brief explanation of the assessment",
  "recommendations": ["suggestions if unsafe"]
}

Mark as SAFE if script only uses allowed operations. Mark as UNSAFE only if it uses forbidden operations. Be precise and focus on actual security violations.`;

            // Make AI safety assessment call
            const response = await aiClient.chat.completions.create({
                model: aiModel,
                messages: [{ role: 'user', content: safetyPrompt }],
                max_tokens: 500,
                temperature: 0.1, // Low temperature for consistent security assessment
            });
            this.costsManager.addUsage(aiModel, response.usage);

            const aiResponse = response.choices[0].message.content.trim();

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
                    issues: ['AI safety assessment failed - could not parse response'],
                    reasoning: 'Failed to parse AI safety assessment response',
                    recommendations: ['Review script manually for safety'],
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
            safetyResult.model_used = aiModel;
            safetyResult.tokens_used = response.usage
                ? response.usage.prompt_tokens + response.usage.completion_tokens
                : 0;

            return safetyResult;
        } catch (error) {
            // Fallback to basic pattern matching if AI assessment fails
            const logger = getLogger();
            logger.warn(
                'AI safety assessment failed, falling back to pattern matching:',
                error.message
            );
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

        // Dangerous patterns that should be blocked
        const dangerousPatterns = [
            // File modification operations
            {
                pattern:
                    /fs\.write|fs\.append|fs\.create|fs\.mkdir|fs\.rmdir|fs\.unlink|fs\.rename|fs\.copy/i,
                reason: 'File modification operations not allowed',
            },
            {
                pattern: /writeFile|appendFile|createWriteStream/i,
                reason: 'File writing operations not allowed',
            },

            // Process and system operations
            { pattern: /child_process|spawn|exec|fork/i, reason: 'Process execution not allowed' },
            { pattern: /process\.exit|process\.kill/i, reason: 'Process control not allowed' },

            // Network operations
            {
                pattern: /http|https|net|dgram|tls|url\.request/i,
                reason: 'Network operations not allowed',
            },
            { pattern: /fetch|XMLHttpRequest|WebSocket/i, reason: 'Network requests not allowed' },

            // Dangerous globals and eval
            {
                pattern: /eval\s*\(|Function\s*\(|setTimeout|setInterval/i,
                reason: 'Dynamic code execution not allowed',
            },
            {
                pattern: /global\.|globalThis\.|process\.env/i,
                reason: 'Global object access restricted',
            },

            // Module loading restrictions
            {
                pattern:
                    /require\s*\(\s*['"`][^'"`]*(?:child_process|fs|http|https|net|crypto)[^'"`]*['"`]\s*\)/i,
                reason: 'Restricted module access',
            },

            // Potential infinite loops (basic detection)
            {
                pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/i,
                reason: 'Potential infinite loop detected',
            },
        ];

        // Check for dangerous patterns
        for (const { pattern, reason } of dangerousPatterns) {
            if (pattern.test(script)) {
                safetyIssues.push(reason);
            }
        }

        // Check script length (prevent extremely large scripts)
        if (script.length > 50000) {
            safetyIssues.push('Script too large (max 50KB)');
        }

        return {
            safe: safetyIssues.length === 0,
            confidence: safetyIssues.length === 0 ? 0.8 : 0.2,
            issues: safetyIssues,
            reasoning: 'Basic pattern matching assessment',
            recommendations:
                safetyIssues.length > 0 ? ['Remove dangerous operations and try again'] : [],
            assessment_method: 'pattern_matching',
            model_used: 'none',
            tokens_used: 0,
        };
    }

    async implementation(params) {
        const { script, timeout = 10000 } = params;

        // Validate timeout
        if (timeout < 1000 || timeout > 30000) {
            return this.createErrorResponse('Timeout must be between 1000 and 30000 milliseconds', {
                timeout,
                valid_range: '1000-30000',
            });
        }

        // Perform AI-powered safety check
        const safetyCheck = await this.performAISafetyCheck(script);
        if (!safetyCheck.safe) {
            return this.createErrorResponse('Script failed AI safety validation', {
                safety_assessment: safetyCheck,
                script_preview: script.substring(0, 200) + (script.length > 200 ? '...' : ''),
            });
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

            return this.createErrorResponse(`Failed to execute script: ${error.message}`, {
                script: script.length > 500 ? `${script.substring(0, 500)}...` : script,
                safety_check: safetyCheck,
                error_details: error.message,
            });
        }
    }
}

// Create and export the tool instance
const executeScriptTool = new ExecuteScriptTool();

export default async function executeScript(params) {
    return await executeScriptTool.execute(params);
}
