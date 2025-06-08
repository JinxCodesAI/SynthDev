/**
 * Calculate tool implementation
 * Performs mathematical calculations with comprehensive error handling
 */

import { BaseTool } from '../common/base-tool.js';

class CalculateTool extends BaseTool {
    constructor() {
        super(
            'calculate',
            'Perform mathematical calculations including basic arithmetic, trigonometry, and advanced functions'
        );

        // Define parameter validation
        this.requiredParams = ['expression'];
        this.parameterTypes = {
            expression: 'string',
            precision: 'number',
        };
    }

    async implementation(params) {
        const { expression, precision = 6 } = params;

        // Additional validation for precision
        if (typeof precision !== 'number' || precision < 0 || precision > 15) {
            return this.createErrorResponse('Precision must be a number between 0 and 15', {
                expression,
                precision,
                valid_range: '0-15',
            });
        }

        try {
            // Clean and prepare the expression
            let cleanExpression = expression.trim();

            // Replace mathematical constants and functions
            const mathReplacements = {
                pi: Math.PI.toString(),
                e: Math.E.toString(),
                sin: 'Math.sin',
                cos: 'Math.cos',
                tan: 'Math.tan',
                asin: 'Math.asin',
                acos: 'Math.acos',
                atan: 'Math.atan',
                sinh: 'Math.sinh',
                cosh: 'Math.cosh',
                tanh: 'Math.tanh',
                log: 'Math.log',
                log10: 'Math.log10',
                log2: 'Math.log2',
                exp: 'Math.exp',
                sqrt: 'Math.sqrt',
                cbrt: 'Math.cbrt',
                abs: 'Math.abs',
                ceil: 'Math.ceil',
                floor: 'Math.floor',
                round: 'Math.round',
                pow: 'Math.pow',
                min: 'Math.min',
                max: 'Math.max',
            };

            // Apply replacements
            for (const [key, value] of Object.entries(mathReplacements)) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                cleanExpression = cleanExpression.replace(regex, value);
            }

            // Security check: only allow safe mathematical operations
            const allowedChars = /^[0-9+\-*/.() ,Math.a-z]*$/;
            if (!allowedChars.test(cleanExpression)) {
                return this.createErrorResponse('Expression contains invalid characters', {
                    expression,
                    clean_expression: cleanExpression,
                });
            }

            // Prevent dangerous operations
            const dangerousPatterns = [
                /require\s*\(/,
                /import\s+/,
                /eval\s*\(/,
                /Function\s*\(/,
                /process\./,
                /global\./,
                /window\./,
                /document\./,
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(cleanExpression)) {
                    return this.createErrorResponse(
                        'Expression contains potentially dangerous operations',
                        { expression, security_violation: true }
                    );
                }
            }

            // Evaluate the expression safely
            const result = Function(`"use strict"; return (${cleanExpression})`)();

            // Validate result
            if (typeof result !== 'number') {
                return this.createErrorResponse('Expression did not evaluate to a number', {
                    expression,
                    result_type: typeof result,
                });
            }

            if (isNaN(result)) {
                return this.createErrorResponse('Expression resulted in NaN', { expression });
            }

            if (!isFinite(result)) {
                return this.createErrorResponse('Expression resulted in infinity', { expression });
            }

            // Format result with specified precision
            const formattedResult = Number(result.toFixed(precision));

            return this.createSuccessResponse({
                expression,
                result: formattedResult,
                precision,
            });
        } catch (error) {
            return this.createErrorResponse(`Calculation failed: ${error.message}`, {
                expression,
                stack: error.stack,
            });
        }
    }
}

// Create and export the tool instance
const calculateTool = new CalculateTool();

export default async function calculate(params) {
    return await calculateTool.execute(params);
}
