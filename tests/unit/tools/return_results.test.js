import { describe, it, expect, beforeEach, vi } from 'vitest';
import return_results from '../../../src/tools/return_results/implementation.js';

describe('return_results tool', () => {
    let mockContext;
    let validResult;

    beforeEach(() => {
        mockContext = {
            agentManager: {
                reportResult: vi.fn().mockResolvedValue(),
            },
            currentAgentId: 'worker-agent-123',
        };

        validResult = {
            status: 'success',
            summary: 'Task completed successfully',
            artifacts: [
                {
                    file_path: 'src/utils/calculator.js',
                    description: 'Added error handling for division by zero',
                    change_type: 'modified',
                },
                {
                    file_path: 'tests/calculator.test.js',
                    description: 'Created comprehensive unit tests with 95% coverage',
                    change_type: 'created',
                },
            ],
            known_issues: [],
        };
    });

    describe('parameter validation', () => {
        it('should return error for missing result', async () => {
            const response = await return_results({
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('result');
        });

        it('should return error for invalid result type', async () => {
            const response = await return_results({
                result: 'not an object',
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('Invalid parameter type');
        });
    });

    describe('result structure validation', () => {
        it('should validate required status field', async () => {
            const invalidResult = { ...validResult };
            delete invalidResult.status;

            const response = await return_results({
                result: invalidResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('valid status');
        });

        it('should validate status enum values', async () => {
            const invalidResult = { ...validResult, status: 'invalid_status' };

            const response = await return_results({
                result: invalidResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('success, failure, or partial');
        });

        it('should validate required summary field', async () => {
            const invalidResult = { ...validResult };
            delete invalidResult.summary;

            const response = await return_results({
                result: invalidResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('summary string');
        });

        it('should validate artifacts structure', async () => {
            const invalidResult = {
                ...validResult,
                artifacts: [
                    {
                        file_path: 'test.js',
                        // missing description and change_type
                    },
                ],
            };

            const response = await return_results({
                result: invalidResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('file_path, description, and change_type');
        });

        it('should validate artifact change_type enum', async () => {
            const invalidResult = {
                ...validResult,
                artifacts: [
                    {
                        file_path: 'test.js',
                        description: 'Test file',
                        change_type: 'invalid_type',
                    },
                ],
            };

            const response = await return_results({
                result: invalidResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('created, modified, deleted, or referenced');
        });

        it('should validate known_issues as array', async () => {
            const invalidResult = { ...validResult, known_issues: 'not an array' };

            const response = await return_results({
                result: invalidResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('array of strings');
        });

        it('should allow all valid status values', async () => {
            const statuses = ['success', 'failure', 'partial'];

            for (const status of statuses) {
                const result = { ...validResult, status };
                const response = await return_results({
                    result,
                    context: mockContext,
                });

                expect(response.success).toBe(true);
            }
        });

        it('should allow all valid change_type values', async () => {
            const changeTypes = ['created', 'modified', 'deleted', 'referenced'];

            for (const changeType of changeTypes) {
                const result = {
                    ...validResult,
                    artifacts: [
                        {
                            file_path: 'test.js',
                            description: 'Test change',
                            change_type: changeType,
                        },
                    ],
                };

                const response = await return_results({
                    result,
                    context: mockContext,
                });

                expect(response.success).toBe(true);
            }
        });
    });

    describe('successful execution', () => {
        it('should report result successfully', async () => {
            const response = await return_results({
                result: validResult,
                context: mockContext,
            });

            expect(response.success).toBe(true);
            expect(response.task_completed).toBe(true);
            expect(response.agent_id).toBe('worker-agent-123');
            expect(response.result_status).toBe('success');
            expect(response.summary).toBe('Task completed successfully');
            expect(response.artifacts_count).toBe(2);
            expect(response.completed_at).toBeDefined();
            expect(response.message).toContain('Task completed successfully');

            // Verify AgentManager was called with enriched result
            expect(mockContext.agentManager.reportResult).toHaveBeenCalledWith(
                'worker-agent-123',
                expect.objectContaining({
                    ...validResult,
                    completed_at: expect.any(String),
                    agent_id: 'worker-agent-123',
                })
            );
        });

        it('should handle empty artifacts array', async () => {
            const resultWithoutArtifacts = { ...validResult, artifacts: [] };

            const response = await return_results({
                result: resultWithoutArtifacts,
                context: mockContext,
            });

            expect(response.success).toBe(true);
            expect(response.artifacts_count).toBe(0);
        });

        it('should handle missing artifacts property', async () => {
            const resultWithoutArtifacts = { ...validResult };
            delete resultWithoutArtifacts.artifacts;

            const response = await return_results({
                result: resultWithoutArtifacts,
                context: mockContext,
            });

            expect(response.success).toBe(true);
            expect(response.artifacts_count).toBe(0);
        });

        it('should handle known issues', async () => {
            const resultWithIssues = {
                ...validResult,
                known_issues: ['Memory leak in calculation loop', 'Edge case not covered in tests'],
            };

            const response = await return_results({
                result: resultWithIssues,
                context: mockContext,
            });

            expect(response.success).toBe(true);
            expect(mockContext.agentManager.reportResult).toHaveBeenCalledWith(
                'worker-agent-123',
                expect.objectContaining({
                    known_issues: [
                        'Memory leak in calculation loop',
                        'Edge case not covered in tests',
                    ],
                })
            );
        });
    });

    describe('error handling', () => {
        it('should handle missing currentAgentId', async () => {
            const contextWithoutAgentId = {
                agentManager: mockContext.agentManager,
                // currentAgentId is missing
            };

            const response = await return_results({
                result: validResult,
                context: contextWithoutAgentId,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('Cannot determine current agent ID');
        });

        it('should handle AgentManager errors', async () => {
            mockContext.agentManager.reportResult.mockRejectedValue(new Error('Agent not found'));

            const response = await return_results({
                result: validResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('Agent not found');
        });

        it('should include error context in failure response', async () => {
            mockContext.agentManager.reportResult.mockRejectedValue(new Error('Test error'));

            const response = await return_results({
                result: validResult,
                context: mockContext,
            });

            expect(response.success).toBe(false);
            expect(response.result).toEqual(validResult);
        });
    });

    describe('context handling', () => {
        it('should use agentId from context as fallback', async () => {
            const contextWithAgentId = {
                agentManager: mockContext.agentManager,
                agentId: 'fallback-agent-id',
                // currentAgentId is missing
            };

            const response = await return_results({
                result: validResult,
                context: contextWithAgentId,
            });

            expect(response.success).toBe(true);
            expect(response.agent_id).toBe('fallback-agent-id');
            expect(mockContext.agentManager.reportResult).toHaveBeenCalledWith(
                'fallback-agent-id',
                expect.any(Object)
            );
        });

        it('should handle missing agentManager', async () => {
            const contextWithoutManager = {
                currentAgentId: 'worker-agent-123',
                // agentManager is missing
            };

            const response = await return_results({
                result: validResult,
                context: contextWithoutManager,
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('AgentManager not available');
        });
    });

    describe('response format', () => {
        it('should include standard response fields', async () => {
            const response = await return_results({
                result: validResult,
                context: mockContext,
            });

            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('timestamp');
            expect(response).toHaveProperty('tool_name', 'return_results');
        });

        it('should include completion-specific response fields', async () => {
            const response = await return_results({
                result: validResult,
                context: mockContext,
            });

            expect(response).toHaveProperty('task_completed');
            expect(response).toHaveProperty('agent_id');
            expect(response).toHaveProperty('result_status');
            expect(response).toHaveProperty('summary');
            expect(response).toHaveProperty('artifacts_count');
            expect(response).toHaveProperty('completed_at');
            expect(response).toHaveProperty('message');
        });
    });

    describe('timestamp enrichment', () => {
        it('should add completion timestamp to result', async () => {
            const beforeCall = new Date().toISOString();

            await return_results({
                result: validResult,
                context: mockContext,
            });

            const afterCall = new Date().toISOString();

            const reportedResult = mockContext.agentManager.reportResult.mock.calls[0][1];
            expect(reportedResult.completed_at).toBeDefined();
            expect(reportedResult.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(reportedResult.completed_at >= beforeCall).toBe(true);
            expect(reportedResult.completed_at <= afterCall).toBe(true);
        });

        it('should add agent_id to result', async () => {
            await return_results({
                result: validResult,
                context: mockContext,
            });

            const reportedResult = mockContext.agentManager.reportResult.mock.calls[0][1];
            expect(reportedResult.agent_id).toBe('worker-agent-123');
        });
    });
});
