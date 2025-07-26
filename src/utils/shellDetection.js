/**
 * Shell Detection Utility
 * Provides functionality to detect the appropriate shell for command execution
 * based on the operating system and available shells
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Shell types supported by the system
 */
export const SHELL_TYPES = {
    POWERSHELL: 'powershell',
    CMD: 'cmd',
    BASH: 'bash',
    ZSH: 'zsh',
    SH: 'sh',
};

/**
 * Operating system types
 */
export const OS_TYPES = {
    WINDOWS: 'win32',
    MACOS: 'darwin',
    LINUX: 'linux',
};

/**
 * Shell configuration for different operating systems
 */
const SHELL_CONFIG = {
    [OS_TYPES.WINDOWS]: {
        primary: SHELL_TYPES.POWERSHELL,
        fallback: SHELL_TYPES.CMD,
        executable: {
            [SHELL_TYPES.POWERSHELL]: 'powershell.exe',
            [SHELL_TYPES.CMD]: 'cmd.exe',
        },
        flags: {
            [SHELL_TYPES.POWERSHELL]: ['-Command'],
            [SHELL_TYPES.CMD]: ['/c'],
        },
    },
    [OS_TYPES.MACOS]: {
        primary: SHELL_TYPES.ZSH,
        fallback: SHELL_TYPES.BASH,
        executable: {
            [SHELL_TYPES.ZSH]: '/bin/zsh',
            [SHELL_TYPES.BASH]: '/bin/bash',
            [SHELL_TYPES.SH]: '/bin/sh',
        },
        flags: {
            [SHELL_TYPES.ZSH]: ['-c'],
            [SHELL_TYPES.BASH]: ['-c'],
            [SHELL_TYPES.SH]: ['-c'],
        },
    },
    [OS_TYPES.LINUX]: {
        primary: SHELL_TYPES.BASH,
        fallback: SHELL_TYPES.SH,
        executable: {
            [SHELL_TYPES.BASH]: '/bin/bash',
            [SHELL_TYPES.SH]: '/bin/sh',
        },
        flags: {
            [SHELL_TYPES.BASH]: ['-c'],
            [SHELL_TYPES.SH]: ['-c'],
        },
    },
};

/**
 * Cache for shell detection results to avoid repeated checks
 */
let shellCache = null;

/**
 * Detect the current operating system
 * @returns {string} Operating system type
 */
export function detectOS() {
    return process.platform;
}

/**
 * Check if a shell is available on the system
 * @param {string} shellType - The shell type to check
 * @returns {Promise<boolean>} True if shell is available
 */
async function isShellAvailable(shellType) {
    const os = detectOS();
    const config = SHELL_CONFIG[os];

    if (!config || !config.executable[shellType]) {
        return false;
    }

    const executable = config.executable[shellType];

    try {
        if (os === OS_TYPES.WINDOWS) {
            // On Windows, try to execute the shell with a simple command
            await execAsync(`${executable} -Command "echo test"`, { timeout: 5000 });
        } else {
            // On Unix-like systems, check if the executable exists
            await execAsync(`which ${executable}`, { timeout: 5000 });
        }
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Detect the best available shell for the current operating system
 * @returns {Promise<Object>} Shell configuration object
 */
export async function detectShell() {
    // Return cached result if available
    if (shellCache) {
        return shellCache;
    }

    const os = detectOS();
    const config = SHELL_CONFIG[os];

    if (!config) {
        throw new Error(`Unsupported operating system: ${os}`);
    }

    // Try primary shell first
    if (await isShellAvailable(config.primary)) {
        shellCache = {
            type: config.primary,
            executable: config.executable[config.primary],
            flags: config.flags[config.primary],
            os: os,
        };
        return shellCache;
    }

    // Try fallback shell
    if (await isShellAvailable(config.fallback)) {
        shellCache = {
            type: config.fallback,
            executable: config.executable[config.fallback],
            flags: config.flags[config.fallback],
            os: os,
        };
        return shellCache;
    }

    // If no shells are available, throw an error
    throw new Error(`No compatible shell found for ${os}`);
}

/**
 * Determine if a command is PowerShell-specific
 * @param {string} command - The command to analyze
 * @returns {boolean} True if the command appears to be PowerShell-specific
 */
export function isPowerShellCommand(command) {
    if (!command || typeof command !== 'string') {
        return false;
    }

    const powerShellCmdlets = [
        'Get-ChildItem',
        'Get-Content',
        'Get-Process',
        'Get-Service',
        'Get-Location',
        'Set-Location',
        'New-Item',
        'Remove-Item',
        'Copy-Item',
        'Move-Item',
        'Test-Path',
        'Select-String',
        'Where-Object',
        'ForEach-Object',
        'Sort-Object',
        'Group-Object',
        'Measure-Object',
        'Compare-Object',
        'Out-File',
        'Out-String',
        'Write-Host',
        'Write-Output',
    ];

    const powerShellOperators = [
        '-eq',
        '-ne',
        '-lt',
        '-le',
        '-gt',
        '-ge',
        '-like',
        '-notlike',
        '-match',
        '-notmatch',
        '-contains',
        '-notcontains',
        '-in',
        '-notin',
    ];

    const lowerCommand = command.toLowerCase();

    // Check for PowerShell cmdlets
    for (const cmdlet of powerShellCmdlets) {
        if (lowerCommand.includes(cmdlet.toLowerCase())) {
            return true;
        }
    }

    // Check for PowerShell operators
    for (const operator of powerShellOperators) {
        if (lowerCommand.includes(operator)) {
            return true;
        }
    }

    // Check for PowerShell-specific syntax patterns
    const powerShellPatterns = [
        /\$\w+/, // Variables like $var
        /\|\s*Where-Object/i, // Pipeline with Where-Object
        /\|\s*ForEach-Object/i, // Pipeline with ForEach-Object
        /\|\s*Select-Object/i, // Pipeline with Select-Object
        /-\w+\s+\w+/, // Parameters like -Path value
    ];

    for (const pattern of powerShellPatterns) {
        if (pattern.test(command)) {
            return true;
        }
    }

    return false;
}

/**
 * Get the appropriate shell for executing a specific command
 * @param {string} command - The command to be executed
 * @returns {Promise<Object>} Shell configuration object
 */
export async function getShellForCommand(command) {
    const detectedShell = await detectShell();

    // If we're on Windows and the command is PowerShell-specific, ensure we use PowerShell
    if (detectedShell.os === OS_TYPES.WINDOWS && isPowerShellCommand(command)) {
        if (detectedShell.type !== SHELL_TYPES.POWERSHELL) {
            // Force PowerShell for PowerShell-specific commands
            if (await isShellAvailable(SHELL_TYPES.POWERSHELL)) {
                const config = SHELL_CONFIG[OS_TYPES.WINDOWS];
                return {
                    type: SHELL_TYPES.POWERSHELL,
                    executable: config.executable[SHELL_TYPES.POWERSHELL],
                    flags: config.flags[SHELL_TYPES.POWERSHELL],
                    os: detectedShell.os,
                };
            }
        }
    }

    return detectedShell;
}

/**
 * Clear the shell detection cache (useful for testing)
 */
export function clearShellCache() {
    shellCache = null;
}
