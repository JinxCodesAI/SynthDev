/**
 * Tests for EnvFileManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnvFileManager } from '../../../utils/EnvFileManager.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
}));

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

describe('EnvFileManager', () => {
    let envManager;

    beforeEach(() => {
        envManager = new EnvFileManager();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('File Existence Check', () => {
        it('should check if .env file exists', () => {
            existsSync.mockReturnValue(true);

            const exists = envManager.envFileExists();

            expect(exists).toBe(true);
            expect(existsSync).toHaveBeenCalledWith(envManager.envFilePath);
        });

        it('should return false when .env file does not exist', () => {
            existsSync.mockReturnValue(false);

            const exists = envManager.envFileExists();

            expect(exists).toBe(false);
        });
    });

    describe('Reading Environment Files', () => {
        it('should read existing .env file', () => {
            const mockContent = 'SYNTHDEV_API_KEY=test-key\nSYNTHDEV_BASE_MODEL=gpt-4';
            existsSync.mockReturnValue(true);
            readFileSync.mockReturnValue(mockContent);

            const result = envManager.readEnvFile();

            expect(result).toEqual({
                SYNTHDEV_API_KEY: 'test-key',
                SYNTHDEV_BASE_MODEL: 'gpt-4',
            });
        });

        it('should return empty object when .env file does not exist', () => {
            existsSync.mockReturnValue(false);

            const result = envManager.readEnvFile();

            expect(result).toEqual({});
        });

        it('should handle read errors gracefully', () => {
            existsSync.mockReturnValue(true);
            readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const result = envManager.readEnvFile();

            expect(result).toEqual({});
        });

        it('should read example .env file', () => {
            const mockContent =
                '# Example config\nSYNTHDEV_API_KEY=your_api_key\nSYNTHDEV_BASE_MODEL=default-model';
            readFileSync.mockReturnValue(mockContent);

            const result = envManager.readExampleEnvFile();

            expect(result).toEqual({
                SYNTHDEV_API_KEY: 'your_api_key',
                SYNTHDEV_BASE_MODEL: 'default-model',
            });
        });
    });

    describe('Writing Environment Files', () => {
        it('should write .env file successfully', () => {
            const envVars = {
                SYNTHDEV_API_KEY: 'test-key',
                SYNTHDEV_BASE_MODEL: 'gpt-4',
                SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            };

            existsSync.mockReturnValue(false); // No example file
            writeFileSync.mockImplementation(() => {});

            const result = envManager.writeEnvFile(envVars, false);

            expect(result).toBe(true);
            expect(writeFileSync).toHaveBeenCalledWith(
                envManager.envFilePath,
                expect.stringContaining('SYNTHDEV_API_KEY=test-key'),
                'utf8'
            );
        });

        it('should preserve comments when writing with example file', () => {
            const envVars = {
                SYNTHDEV_API_KEY: 'test-key',
            };
            const exampleContent =
                '# General AI Provider Configuration\nSYNTHDEV_API_KEY=your_base_model_api_key\n# Comment';

            existsSync.mockReturnValue(true); // Example file exists
            readFileSync.mockReturnValue(exampleContent);
            writeFileSync.mockImplementation(() => {});

            const result = envManager.writeEnvFile(envVars, true);

            expect(result).toBe(true);
            expect(writeFileSync).toHaveBeenCalledWith(
                envManager.envFilePath,
                expect.stringContaining('SYNTHDEV_API_KEY=test-key'),
                'utf8'
            );
        });

        it('should handle write errors gracefully', () => {
            const envVars = { SYNTHDEV_API_KEY: 'test-key' };

            existsSync.mockReturnValue(false);
            writeFileSync.mockImplementation(() => {
                throw new Error('Write error');
            });

            const result = envManager.writeEnvFile(envVars);

            expect(result).toBe(false);
        });
    });

    describe('Updating Environment Files', () => {
        it('should update existing variables', () => {
            const currentVars = {
                SYNTHDEV_API_KEY: 'old-key',
                SYNTHDEV_BASE_MODEL: 'old-model',
            };
            const updates = {
                SYNTHDEV_API_KEY: 'new-key',
            };

            existsSync.mockReturnValue(true);
            readFileSync.mockReturnValue('SYNTHDEV_API_KEY=old-key\nSYNTHDEV_BASE_MODEL=old-model');
            writeFileSync.mockImplementation(() => {});

            const result = envManager.updateEnvFile(updates);

            expect(result).toBe(true);
            expect(writeFileSync).toHaveBeenCalledWith(
                envManager.envFilePath,
                expect.stringContaining('SYNTHDEV_API_KEY=new-key'),
                'utf8'
            );
        });
    });

    describe('Content Parsing', () => {
        it('should parse environment content correctly', () => {
            const content = `# Comment
SYNTHDEV_API_KEY=test-key
SYNTHDEV_BASE_MODEL=gpt-4
# Another comment
SYNTHDEV_BASE_URL=https://api.openai.com/v1`;

            const result = envManager._parseEnvContent(content);

            expect(result).toEqual({
                SYNTHDEV_API_KEY: 'test-key',
                SYNTHDEV_BASE_MODEL: 'gpt-4',
                SYNTHDEV_BASE_URL: 'https://api.openai.com/v1',
            });
        });

        it('should handle values with equals signs', () => {
            const content = 'SYNTHDEV_BASE_URL=https://api.example.com/v1?key=value';

            const result = envManager._parseEnvContent(content);

            expect(result).toEqual({
                SYNTHDEV_BASE_URL: 'https://api.example.com/v1?key=value',
            });
        });

        it('should ignore empty lines and comments', () => {
            const content = `
# This is a comment

SYNTHDEV_API_KEY=test-key

# Another comment
`;

            const result = envManager._parseEnvContent(content);

            expect(result).toEqual({
                SYNTHDEV_API_KEY: 'test-key',
            });
        });
    });

    describe('Content Update', () => {
        it('should update existing variables while preserving structure', () => {
            const content = `# General Configuration
SYNTHDEV_API_KEY=old-key
SYNTHDEV_BASE_MODEL=old-model

# Advanced Settings
SYNTHDEV_VERBOSITY_LEVEL=2`;

            const updates = {
                SYNTHDEV_API_KEY: 'new-key',
                SYNTHDEV_NEW_VAR: 'new-value',
            };

            const result = envManager._updateEnvContent(content, updates);

            expect(result).toContain('SYNTHDEV_API_KEY=new-key');
            expect(result).toContain('SYNTHDEV_BASE_MODEL=old-model');
            expect(result).toContain('SYNTHDEV_NEW_VAR=new-value');
            expect(result).toContain('# General Configuration');
        });
    });

    describe('File Paths', () => {
        it('should return correct .env file path', () => {
            const path = envManager.getEnvFilePath();
            expect(path).toContain('.env');
        });

        it('should return correct example .env file path', () => {
            const path = envManager.getExampleEnvFilePath();
            expect(path).toContain('config.example.env');
        });
    });
});
