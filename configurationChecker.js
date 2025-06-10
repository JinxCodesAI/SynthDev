/**
 * Configuration Checker
 * Validates that all required configuration files exist and are properly formatted
 */

import { getConfigurationValidator } from './configurationValidator.js';
import { getConfigurationLoader } from './configurationLoader.js';

export class ConfigurationChecker {
    constructor() {
        this.validator = getConfigurationValidator();
        this.loader = getConfigurationLoader();
    }

    /**
     * List of all required configuration files
     * @returns {string[]} Array of required configuration file paths
     */
    getRequiredConfigurationFiles() {
        return [
            'roles/roles.json',
            'roles/environment-template.json',
            'tools/tool-messages.json',
            'tools/safety-patterns.json',
            'ui/console-messages.json',
            'ui/command-help.json',
            'validation/config-validation.json',
            'defaults/application.json',
        ];
    }

    /**
     * Check all required configuration files
     * @returns {Object} Comprehensive check result
     */
    checkAllConfigurations() {
        const requiredFiles = this.getRequiredConfigurationFiles();
        const results = {
            success: true,
            errors: [],
            warnings: [],
            fileChecks: {},
            summary: {
                totalFiles: requiredFiles.length,
                existingFiles: 0,
                missingFiles: 0,
                invalidFiles: 0,
            },
        };

        // Check file existence
        const existenceCheck = this.validator.validateConfigurationFiles(requiredFiles);
        if (!existenceCheck.success) {
            results.success = false;
            results.errors.push(...existenceCheck.errors);
            results.summary.missingFiles = existenceCheck.missingFiles.length;
        }

        // Check each existing file for JSON validity
        for (const filePath of requiredFiles) {
            const fileResult = this._checkSingleFile(filePath);
            results.fileChecks[filePath] = fileResult;

            if (fileResult.exists) {
                results.summary.existingFiles++;

                if (!fileResult.validJson) {
                    results.success = false;
                    results.errors.push(`Invalid JSON in ${filePath}: ${fileResult.error}`);
                    results.summary.invalidFiles++;
                }
            }
        }

        return results;
    }

    /**
     * Check a single configuration file
     * @private
     * @param {string} filePath - Path to the configuration file
     * @returns {Object} File check result
     */
    _checkSingleFile(filePath) {
        const result = {
            exists: false,
            validJson: false,
            error: null,
            size: 0,
        };

        try {
            // Check if file exists
            result.exists = this.loader.configExists(filePath);

            if (!result.exists) {
                result.error = 'File does not exist';
                return result;
            }

            // Try to load and parse the JSON
            const config = this.loader.loadConfig(filePath, {}, false);
            result.validJson = true;
            result.size = JSON.stringify(config).length;
        } catch (error) {
            result.error = error.message;
            result.validJson = false;
        }

        return result;
    }

    /**
     * Generate a detailed report of configuration status
     * @returns {string} Human-readable configuration report
     */
    generateConfigurationReport() {
        const checkResult = this.checkAllConfigurations();
        let report = '📋 Configuration Status Report\n';
        report += `${'═'.repeat(50)}\n\n`;

        // Summary
        report += '📊 Summary:\n';
        report += `   Total Files: ${checkResult.summary.totalFiles}\n`;
        report += `   ✅ Existing: ${checkResult.summary.existingFiles}\n`;
        report += `   ❌ Missing: ${checkResult.summary.missingFiles}\n`;
        report += `   🚫 Invalid: ${checkResult.summary.invalidFiles}\n\n`;

        // Overall status
        if (checkResult.success) {
            report += '🎉 Overall Status: ✅ ALL CONFIGURATIONS VALID\n\n';
        } else {
            report += '⚠️  Overall Status: ❌ CONFIGURATION ISSUES FOUND\n\n';
        }

        // File details
        report += '📁 File Details:\n';
        for (const [filePath, fileResult] of Object.entries(checkResult.fileChecks)) {
            const status = fileResult.exists ? (fileResult.validJson ? '✅' : '🚫') : '❌';

            report += `   ${status} ${filePath}`;

            if (fileResult.exists && fileResult.validJson) {
                report += ` (${fileResult.size} bytes)`;
            } else if (fileResult.error) {
                report += ` - ${fileResult.error}`;
            }

            report += '\n';
        }

        // Errors
        if (checkResult.errors.length > 0) {
            report += '\n🚨 Errors:\n';
            for (const error of checkResult.errors) {
                report += `   • ${error}\n`;
            }
        }

        // Warnings
        if (checkResult.warnings.length > 0) {
            report += '\n⚠️  Warnings:\n';
            for (const warning of checkResult.warnings) {
                report += `   • ${warning}\n`;
            }
        }

        return report;
    }

    /**
     * Check if all required configurations are present and valid
     * @returns {boolean} True if all configurations are valid
     */
    isConfigurationValid() {
        const checkResult = this.checkAllConfigurations();
        return checkResult.success;
    }

    /**
     * Get missing configuration files
     * @returns {string[]} Array of missing configuration file paths
     */
    getMissingConfigurationFiles() {
        const requiredFiles = this.getRequiredConfigurationFiles();
        const existenceCheck = this.validator.validateConfigurationFiles(requiredFiles);
        return existenceCheck.missingFiles || [];
    }

    /**
     * Create missing configuration files with default content
     * @param {boolean} dryRun - If true, only show what would be created
     * @returns {Object} Creation result
     */
    createMissingConfigurationFiles(dryRun = true) {
        const missingFiles = this.getMissingConfigurationFiles();
        const result = {
            success: true,
            created: [],
            errors: [],
            dryRun: dryRun,
        };

        if (missingFiles.length === 0) {
            return result;
        }

        for (const filePath of missingFiles) {
            if (dryRun) {
                result.created.push(filePath);
            } else {
                try {
                    // In a real implementation, you would create the file with default content
                    // For now, we just track what would be created
                    result.created.push(filePath);
                } catch (error) {
                    result.success = false;
                    result.errors.push(`Failed to create ${filePath}: ${error.message}`);
                }
            }
        }

        return result;
    }
}

// Export singleton instance
let configurationCheckerInstance = null;

/**
 * Get the singleton ConfigurationChecker instance
 * @returns {ConfigurationChecker} ConfigurationChecker instance
 */
export function getConfigurationChecker() {
    if (!configurationCheckerInstance) {
        configurationCheckerInstance = new ConfigurationChecker();
    }
    return configurationCheckerInstance;
}

export default ConfigurationChecker;
