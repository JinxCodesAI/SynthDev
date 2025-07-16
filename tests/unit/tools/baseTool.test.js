// tests/unit/tools/baseTool.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseTool } from '../../../src/tools/common/base-tool.js';

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('BaseTool', () => {
    let baseTool;

    beforeEach(() => {
        // Mock process.cwd() before creating baseTool
        process.cwd = vi.fn(() => '/test/workspace');
        baseTool = new BaseTool('test_tool', 'Test tool description');
    });

    afterEach(() => {
        // Restore original process.cwd
        process.cwd = originalCwd;
    });

    describe('constructor', () => {
        it('should initialize with name and description', () => {
            expect(baseTool.name).toBe('test_tool');
            expect(baseTool.description).toBe('Test tool description');
            expect(baseTool.timestamp).toBeDefined();
        });
    });

    describe('createSuccessResponse', () => {
        it('should create standardized success response', () => {
            const response = baseTool.createSuccessResponse({ result: 'test' });

            expect(response.success).toBe(true);
            expect(response.tool_name).toBe('test_tool');
            expect(response.timestamp).toBeDefined();
            expect(response.result).toBe('test');
        });

        it('should work with empty data', () => {
            const response = baseTool.createSuccessResponse();

            expect(response.success).toBe(true);
            expect(response.tool_name).toBe('test_tool');
            expect(response.timestamp).toBeDefined();
        });
    });

    describe('createErrorResponse', () => {
        it('should create standardized error response', () => {
            const response = baseTool.createErrorResponse('Test error', { code: 'TEST_ERROR' });

            expect(response.success).toBe(false);
            expect(response.tool_name).toBe('test_tool');
            expect(response.error).toBe('Test error');
            expect(response.code).toBe('TEST_ERROR');
            expect(response.timestamp).toBeDefined();
        });
    });

    describe('validateRequiredParams', () => {
        it('should return null for valid parameters', () => {
            const params = { param1: 'value1', param2: 'value2' };
            const result = baseTool.validateRequiredParams(params, ['param1', 'param2']);

            expect(result).toBeNull();
        });

        it('should return error for missing required parameter', () => {
            const params = { param1: 'value1' };
            const result = baseTool.validateRequiredParams(params, ['param1', 'param2']);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Required parameter missing: param2');
            expect(result.missing_parameter).toBe('param2');
        });

        it('should return error for null parameter', () => {
            const params = { param1: 'value1', param2: null };
            const result = baseTool.validateRequiredParams(params, ['param1', 'param2']);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Required parameter missing: param2');
        });

        it('should return error for undefined parameter', () => {
            const params = { param1: 'value1', param2: undefined };
            const result = baseTool.validateRequiredParams(params, ['param1', 'param2']);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Required parameter missing: param2');
        });
    });

    describe('validateParameterTypes', () => {
        it('should return null for correct types', () => {
            const params = {
                stringParam: 'test',
                numberParam: 42,
                arrayParam: [1, 2, 3],
                booleanParam: true,
            };
            const typeMap = {
                stringParam: 'string',
                numberParam: 'number',
                arrayParam: 'array',
                booleanParam: 'boolean',
            };

            const result = baseTool.validateParameterTypes(params, typeMap);
            expect(result).toBeNull();
        });

        it('should return error for incorrect string type', () => {
            const params = { stringParam: 123 };
            const typeMap = { stringParam: 'string' };

            const result = baseTool.validateParameterTypes(params, typeMap);

            expect(result.success).toBe(false);
            expect(result.error).toBe(
                'Invalid parameter type for stringParam: expected string, got number'
            );
            expect(result.expected_type).toBe('string');
            expect(result.actual_type).toBe('number');
        });

        it('should return error for incorrect array type', () => {
            const params = { arrayParam: 'not an array' };
            const typeMap = { arrayParam: 'array' };

            const result = baseTool.validateParameterTypes(params, typeMap);

            expect(result.success).toBe(false);
            expect(result.error).toBe(
                'Invalid parameter type for arrayParam: expected array, got string'
            );
            expect(result.expected_type).toBe('array');
            expect(result.actual_type).toBe('string');
        });

        it('should skip validation for undefined optional parameters', () => {
            const params = { requiredParam: 'test' };
            const typeMap = {
                requiredParam: 'string',
                optionalParam: 'number',
            };

            const result = baseTool.validateParameterTypes(params, typeMap);
            expect(result).toBeNull();
        });
    });

    describe('validateAndResolvePath', () => {
        it('should return error for invalid path types', () => {
            const result = baseTool.validateAndResolvePath(null);
            expect(result.error.success).toBe(false);
            expect(result.error.error).toContain('file_path parameter is required');
        });

        it('should return error for empty string', () => {
            const result = baseTool.validateAndResolvePath('');
            expect(result.error.success).toBe(false);
            expect(result.error.error).toContain('file_path parameter is required');
        });

        it('should resolve valid relative path', () => {
            const result = baseTool.validateAndResolvePath('test.txt');
            expect(result.resolvedPath).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });
});
