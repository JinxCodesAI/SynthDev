/**
 * Get Time tool implementation
 * Get current date and time in various formats and timezones
 */

import { BaseTool } from '../common/base-tool.js';

class GetTimeTool extends BaseTool {
    constructor() {
        super('get_time', 'Get current date and time in various formats and timezones');
        
        // Define parameter validation
        this.requiredParams = []; // No required parameters
        this.parameterTypes = {
            format: 'string',
            timezone: 'string',
            custom_format: 'string'
        };
    }

    async implementation(params) {
        const { 
            format = 'iso', 
            timezone = 'local', 
            custom_format
        } = params;

        // Validate format
        const validFormats = ['iso', 'unix', 'readable', 'custom'];
        if (!validFormats.includes(format)) {
            return this.createErrorResponse(
                `Invalid format. Must be one of: ${validFormats.join(', ')}`,
                { format, valid_formats: validFormats }
            );
        }

        // Validate custom_format when format is 'custom'
        if (format === 'custom' && (!custom_format || typeof custom_format !== 'string')) {
            return this.createErrorResponse(
                'custom_format parameter is required when format is "custom"',
                { format, custom_format }
            );
        }

        try {
            const now = new Date();
            let formattedTime;
            let timezoneInfo = timezone;

            // Handle timezone conversion
            if (timezone !== 'local') {
                try {
                    // Validate timezone by attempting to format
                    const testFormat = new Intl.DateTimeFormat('en-US', { 
                        timeZone: timezone,
                        hour: 'numeric'
                    }).format(now);
                    
                    // If we get here, timezone is valid
                    timezoneInfo = timezone;
                } catch (timezoneError) {
                    return this.createErrorResponse(
                        `Invalid timezone: ${timezone}`,
                        { timezone, error: timezoneError.message }
                    );
                }
            } else {
                timezoneInfo = Intl.DateTimeFormat().resolvedOptions().timeZone;
            }

            // Format time based on requested format
            switch (format) {
                case 'iso':
                    if (timezone === 'local') {
                        formattedTime = now.toISOString();
                    } else {
                        // Convert to target timezone and format as ISO-like string
                        const options = {
                            timeZone: timezone,
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        };
                        const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
                        const partsObj = parts.reduce((acc, part) => {
                            acc[part.type] = part.value;
                            return acc;
                        }, {});
                        formattedTime = `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`;
                    }
                    break;

                case 'unix':
                    formattedTime = Math.floor(now.getTime() / 1000);
                    break;

                case 'readable':
                    if (timezone === 'local') {
                        formattedTime = now.toLocaleString();
                    } else {
                        const options = {
                            timeZone: timezone,
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZoneName: 'short'
                        };
                        formattedTime = new Intl.DateTimeFormat('en-US', options).format(now);
                    }
                    break;

                case 'custom':
                    // Basic custom formatting support
                    let customResult = custom_format;
                    const timeObj = timezone === 'local' 
                        ? {
                            year: now.getFullYear(),
                            month: (now.getMonth() + 1).toString().padStart(2, '0'),
                            day: now.getDate().toString().padStart(2, '0'),
                            hour: now.getHours().toString().padStart(2, '0'),
                            minute: now.getMinutes().toString().padStart(2, '0'),
                            second: now.getSeconds().toString().padStart(2, '0')
                        }
                        : (() => {
                            const options = {
                                timeZone: timezone,
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            };
                            const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
                            return parts.reduce((acc, part) => {
                                acc[part.type] = part.value;
                                return acc;
                            }, {});
                        })();

                    // Replace common format tokens
                    customResult = customResult
                        .replace(/YYYY/g, timeObj.year)
                        .replace(/MM/g, timeObj.month)
                        .replace(/DD/g, timeObj.day)
                        .replace(/HH/g, timeObj.hour)
                        .replace(/mm/g, timeObj.minute)
                        .replace(/ss/g, timeObj.second);

                    formattedTime = customResult;
                    break;
            }

            return this.createSuccessResponse({
                current_time: formattedTime,
                timezone: timezoneInfo,
                format,
                iso_string: now.toISOString(),
                unix_timestamp: Math.floor(now.getTime() / 1000),
                readable_format: now.toLocaleString()
            });

        } catch (error) {
            return this.createErrorResponse(
                `Time formatting failed: ${error.message}`,
                { format, timezone, stack: error.stack }
            );
        }
    }
}

// Create and export the tool instance
const getTimeTool = new GetTimeTool();

export default async function getTime(params) {
    return await getTimeTool.execute(params);
} 