// tests/unit/core/systemMessages.test.js
import { describe, it, expect } from 'vitest';
import systemMessages from '../../../src/core/ai/systemMessages.js';

describe('SystemMessages', () => {
    describe('getSystemMessage', () => {
        it('should return coder role message', () => {
            const message = systemMessages.getSystemMessage('coder');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
            expect(message).toContain('You are an expert software developer');
        });

        it('should return reviewer role message', () => {
            const message = systemMessages.getSystemMessage('reviewer');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
            expect(message).toContain('You are a senior code reviewer');
        });

        it('should return architect role message', () => {
            const message = systemMessages.getSystemMessage('architect');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
            expect(message).toContain('You are a senior software architect');
        });

        it('should return dude role message', () => {
            const message = systemMessages.getSystemMessage('dude');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('should return file_summarizer role message', () => {
            const message = systemMessages.getSystemMessage('file_summarizer');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('should return directory_summarizer role message', () => {
            const message = systemMessages.getSystemMessage('directory_summarizer');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('should return codebase_explainer role message', () => {
            const message = systemMessages.getSystemMessage('codebase_explainer');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('should return prompt_enhancer role message', () => {
            const message = systemMessages.getSystemMessage('prompt_enhancer');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('should return command_generator role message', () => {
            const message = systemMessages.getSystemMessage('command_generator');

            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });

        it('should throw error for unknown role', () => {
            expect(() => {
                systemMessages.getSystemMessage('unknown_role');
            }).toThrow('Unknown role: unknown_role');
        });

        it('should throw error for null role', () => {
            expect(() => {
                systemMessages.getSystemMessage(null);
            }).toThrow('Unknown role: null');
        });

        it('should throw error for undefined role', () => {
            expect(() => {
                systemMessages.getSystemMessage(undefined);
            }).toThrow('Unknown role: undefined');
        });

        it('should throw error for empty string role', () => {
            expect(() => {
                systemMessages.getSystemMessage('');
            }).toThrow('Unknown role: ');
        });
    });

    describe('available roles', () => {
        it('should have predefined roles available', () => {
            // Test that the main roles are available
            expect(() => systemMessages.getSystemMessage('coder')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('reviewer')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('architect')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('dude')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('file_summarizer')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('directory_summarizer')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('codebase_explainer')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('prompt_enhancer')).not.toThrow();
            expect(() => systemMessages.getSystemMessage('command_generator')).not.toThrow();
        });
    });

    describe('role validation', () => {
        it('should have consistent role definitions', () => {
            const roles = [
                'coder',
                'reviewer',
                'architect',
                'dude',
                'file_summarizer',
                'directory_summarizer',
                'codebase_explainer',
                'prompt_enhancer',
                'command_generator',
            ];

            roles.forEach(role => {
                const message = systemMessages.getSystemMessage(role);
                expect(message).toBeDefined();
                expect(typeof message).toBe('string');
                expect(message.length).toBeGreaterThan(0);
            });
        });

        it('should have different messages for different roles', () => {
            const coderMessage = systemMessages.getSystemMessage('coder');
            const reviewerMessage = systemMessages.getSystemMessage('reviewer');
            const architectMessage = systemMessages.getSystemMessage('architect');

            expect(coderMessage).not.toBe(reviewerMessage);
            expect(reviewerMessage).not.toBe(architectMessage);
            expect(coderMessage).not.toBe(architectMessage);
        });
    });

    describe('message content validation', () => {
        it('should have meaningful content for each role', () => {
            const roles = ['coder', 'reviewer', 'architect'];

            roles.forEach(role => {
                const message = systemMessages.getSystemMessage(role);

                // Should be substantial content
                expect(message.length).toBeGreaterThan(100);

                // Should contain common professional terms
                expect(message.toLowerCase()).toMatch(
                    /(expert|senior|professional|experience|you are)/
                );
            });
        });

        it('should contain tool usage instructions', () => {
            const roles = ['coder', 'reviewer', 'architect'];

            roles.forEach(role => {
                const message = systemMessages.getSystemMessage(role);

                // Should mention tools or capabilities
                expect(message.toLowerCase()).toMatch(/(tool|function|capability|available|use)/);
            });
        });
    });

    describe('getExamples', () => {
        it('should return examples for prompt_enhancer role', () => {
            const examples = systemMessages.getExamples('prompt_enhancer');

            expect(examples).toBeDefined();
            expect(Array.isArray(examples)).toBe(true);
            expect(examples.length).toBeGreaterThan(0);

            // Check structure of first example
            expect(examples[0]).toHaveProperty('role');
            expect(examples[0]).toHaveProperty('content');
        });

        it('should return empty array for roles without examples', () => {
            const examples = systemMessages.getExamples('coder');

            expect(examples).toBeDefined();
            expect(Array.isArray(examples)).toBe(true);
            expect(examples.length).toBe(0);
        });

        it('should throw error for unknown role', () => {
            expect(() => {
                systemMessages.getExamples('unknown_role');
            }).toThrow('Unknown role: unknown_role');
        });

        it('should throw error for null role', () => {
            expect(() => {
                systemMessages.getExamples(null);
            }).toThrow('Unknown role: null');
        });

        it('should throw error for undefined role', () => {
            expect(() => {
                systemMessages.getExamples(undefined);
            }).toThrow('Unknown role: undefined');
        });
    });

    describe('edge cases', () => {
        it('should handle case sensitivity', () => {
            const lowerCase = systemMessages.getSystemMessage('coder');

            // Should throw for case mismatches
            expect(() => systemMessages.getSystemMessage('CODER')).toThrow();
            expect(() => systemMessages.getSystemMessage('Coder')).toThrow();

            // Lower case should work
            expect(lowerCase).toBeDefined();
        });

        it('should handle special characters in role name', () => {
            expect(() => {
                systemMessages.getSystemMessage('coder-test');
            }).toThrow('Unknown role: coder-test');
        });

        it('should handle numeric role names', () => {
            expect(() => {
                systemMessages.getSystemMessage('123');
            }).toThrow('Unknown role: 123');
        });
    });

    describe('performance', () => {
        it('should return messages quickly', () => {
            const startTime = Date.now();

            for (let i = 0; i < 100; i++) {
                systemMessages.getSystemMessage('coder');
            }

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute very quickly (less than 100ms for 100 calls)
            expect(executionTime).toBeLessThan(100);
        });

        it('should handle concurrent access', async () => {
            const promises = Array.from({ length: 10 }, (_, i) =>
                Promise.resolve(systemMessages.getSystemMessage('coder'))
            );

            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
            });
        });
    });
});
