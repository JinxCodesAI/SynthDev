/**
 * Environment File Manager
 * Handles creation and modification of .env files
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class EnvFileManager {
    constructor() {
        this.logger = getLogger();
        this.envFilePath = join(dirname(__dirname), '.env');
        this.exampleFilePath = join(dirname(__dirname), 'config.example.env');
    }

    /**
     * Check if .env file exists
     * @returns {boolean} Whether .env file exists
     */
    envFileExists() {
        return existsSync(this.envFilePath);
    }

    /**
     * Read current .env file content
     * @returns {Object} Parsed environment variables
     */
    readEnvFile() {
        if (!this.envFileExists()) {
            return {};
        }

        try {
            const content = readFileSync(this.envFilePath, 'utf8');
            return this._parseEnvContent(content);
        } catch (error) {
            this.logger.warn(`Failed to read .env file: ${error.message}`);
            return {};
        }
    }

    /**
     * Read example .env file content
     * @returns {Object} Parsed example environment variables with comments
     */
    readExampleEnvFile() {
        try {
            const content = readFileSync(this.exampleFilePath, 'utf8');
            return this._parseEnvContent(content, true);
        } catch (error) {
            this.logger.warn(`Failed to read config.example.env file: ${error.message}`);
            return {};
        }
    }

    /**
     * Create or update .env file with provided values
     * @param {Object} envVars - Environment variables to set
     * @param {boolean} preserveComments - Whether to preserve comments from example file
     * @returns {boolean} Success status
     */
    writeEnvFile(envVars, preserveComments = true) {
        try {
            let content = '';

            if (preserveComments && existsSync(this.exampleFilePath)) {
                // Start with example file structure
                const exampleContent = readFileSync(this.exampleFilePath, 'utf8');
                content = this._updateEnvContent(exampleContent, envVars);
            } else {
                // Create simple .env file
                content = this._createSimpleEnvContent(envVars);
            }

            writeFileSync(this.envFilePath, content, 'utf8');
            this.logger.info(
                `✅ .env file ${this.envFileExists() ? 'updated' : 'created'} successfully`
            );
            return true;
        } catch (error) {
            this.logger.error(error, 'Failed to write .env file');
            return false;
        }
    }

    /**
     * Update specific environment variables in existing .env file
     * @param {Object} updates - Variables to update
     * @returns {boolean} Success status
     */
    updateEnvFile(updates) {
        const currentVars = this.readEnvFile();
        const mergedVars = { ...currentVars, ...updates };
        return this.writeEnvFile(mergedVars);
    }

    /**
     * Parse environment file content
     * @private
     * @param {string} content - File content
     * @param {boolean} includeComments - Whether to include comment lines
     * @returns {Object} Parsed variables
     */
    _parseEnvContent(content, includeComments = false) {
        const vars = {};
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            if (includeComments && trimmed.startsWith('#')) {
                // Store comments for reference
                continue;
            }

            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=').trim();
                vars[key.trim()] = value;
            }
        }

        return vars;
    }

    /**
     * Update environment content with new values while preserving structure
     * @private
     * @param {string} content - Original content
     * @param {Object} updates - Variables to update
     * @returns {string} Updated content
     */
    _updateEnvContent(content, updates) {
        const lines = content.split('\n');
        const updatedLines = [];
        const processedKeys = new Set();

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key] = trimmed.split('=');
                const cleanKey = key.trim();

                if (updates.hasOwnProperty(cleanKey)) {
                    updatedLines.push(`${cleanKey}=${updates[cleanKey]}`);
                    processedKeys.add(cleanKey);
                } else {
                    updatedLines.push(line);
                }
            } else {
                updatedLines.push(line);
            }
        }

        // Add any new variables that weren't in the original file
        for (const [key, value] of Object.entries(updates)) {
            if (!processedKeys.has(key)) {
                updatedLines.push(`${key}=${value}`);
            }
        }

        return updatedLines.join('\n');
    }

    /**
     * Create simple environment content
     * @private
     * @param {Object} envVars - Environment variables
     * @returns {string} Environment file content
     */
    _createSimpleEnvContent(envVars) {
        const lines = ['# Synth-Dev Configuration', ''];

        for (const [key, value] of Object.entries(envVars)) {
            lines.push(`${key}=${value}`);
        }

        return `${lines.join('\n')}\n`;
    }

    /**
     * Get the path to the .env file
     * @returns {string} Path to .env file
     */
    getEnvFilePath() {
        return this.envFilePath;
    }

    /**
     * Get the path to the example .env file
     * @returns {string} Path to config.example.env file
     */
    getExampleEnvFilePath() {
        return this.exampleFilePath;
    }
}

export default EnvFileManager;
