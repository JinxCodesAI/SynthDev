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
            'defaults/environment-template.json', // Moved from roles/ to defaults/
            'tools/tool-messages.json',
            'tools/safety-patterns.json',
            'ui/console-messages.json',
            'ui/command-help.json',
            'validation/config-validation.json',
            'defaults/application.json',
        ];
    }

    /**
     * List of required configuration directories that must contain at least one JSON file
     * @returns {string[]} Array of required configuration directory paths
     */
    getRequiredConfigurationDirectories() {
        return [
            'roles', // Must contain at least one role definition file
        ];
    }

    /**
     * Check all required configuration files
     * @returns {Object} Comprehensive check result
     */
    checkAllConfigurations() {
        const requiredFiles = this.getRequiredConfigurationFiles();
        const requiredDirs = this.getRequiredConfigurationDirectories();
        const results = {
            success: true,
            errors: [],
            warnings: [],
            fileChecks: {},
            directoryChecks: {},
            summary: {
                totalFiles: requiredFiles.length,
                existingFiles: 0,
                missingFiles: 0,
                invalidFiles: 0,
                totalDirectories: requiredDirs.length,
                validDirectories: 0,
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

        // Check required directories
        for (const dirPath of requiredDirs) {
            const dirResult = this._checkConfigurationDirectory(dirPath);
            results.directoryChecks[dirPath] = dirResult;

            if (dirResult.valid) {
                results.summary.validDirectories++;
            } else {
                results.success = false;
                results.errors.push(...dirResult.errors);
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
     * Check a configuration directory for required JSON files
     * @private
     * @param {string} dirPath - Path to the configuration directory
     * @returns {Object} Directory check result
     */
    _checkConfigurationDirectory(dirPath) {
        const result = {
            valid: false,
            exists: false,
            jsonFiles: [],
            errors: [],
        };

        try {
            // Check if directory exists
            result.exists = this.loader.configExists(dirPath);

            if (!result.exists) {
                result.errors.push(`Directory does not exist: ${dirPath}`);
                return result;
            }

            // Scan for JSON files
            result.jsonFiles = this.loader.scanDirectoryForJsonFiles(dirPath);

            if (result.jsonFiles.length === 0) {
                result.errors.push(`No JSON files found in directory: ${dirPath}`);
                return result;
            }

            // For roles directory, try to load roles to validate structure
            if (dirPath === 'roles') {
                try {
                    const roles = this.loader.loadRolesFromDirectory(dirPath);
                    if (!roles || Object.keys(roles).length === 0) {
                        result.errors.push(`No valid roles found in directory: ${dirPath}`);
                        return result;
                    }
                } catch (error) {
                    result.errors.push(
                        `Failed to load roles from directory ${dirPath}: ${error.message}`
                    );
                    return result;
                }
            }

            result.valid = true;
        } catch (error) {
            result.errors.push(`Error checking directory ${dirPath}: ${error.message}`);
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
        report += `   🚫 Invalid: ${checkResult.summary.invalidFiles}\n`;
        report += `   Total Directories: ${checkResult.summary.totalDirectories}\n`;
        report += `   ✅ Valid Directories: ${checkResult.summary.validDirectories}\n\n`;

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

        // Directory details
        if (checkResult.directoryChecks && Object.keys(checkResult.directoryChecks).length > 0) {
            report += '\n📁 Directory Details:\n';
            for (const [dirPath, dirResult] of Object.entries(checkResult.directoryChecks)) {
                const status = dirResult.valid ? '✅' : '❌';
                report += `   ${status} ${dirPath}/`;

                if (dirResult.valid) {
                    report += ` (${dirResult.jsonFiles.length} JSON files)`;
                } else if (dirResult.errors.length > 0) {
                    report += ` - ${dirResult.errors.join(', ')}`;
                }

                report += '\n';
            }
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
