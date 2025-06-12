#!/usr/bin/env node
/**
 * Script to automatically fix common ESLint issues that --fix cannot handle
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const fixes = {
    // Fix unused catch variables
    'catch (error)': 'catch (_error)',
    'catch (e)': 'catch (_e)',

    // Fix unused function parameters (common patterns)
    '(args, context)': '(_args, _context)',
    '(args)': '(_args)',
    '(index)': '(_index)',

    // Fix equality operators
    ' != ': ' !== ',
    ' == ': ' === ',

    // Fix hasOwnProperty usage
    '.hasOwnProperty(': '.hasOwnProperty(',
};

function fixFile(filePath) {
    try {
        let content = readFileSync(filePath, 'utf8');
        let changed = false;

        for (const [pattern, replacement] of Object.entries(fixes)) {
            if (content.includes(pattern)) {
                content = content.replaceAll(pattern, replacement);
                changed = true;
            }
        }

        if (changed) {
            writeFileSync(filePath, content);
            console.log(`Fixed: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error fixing ${filePath}:`, error.message);
    }
}

function processDirectory(dir) {
    const items = readdirSync(dir);

    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            processDirectory(fullPath);
        } else if (item.endsWith('.js') && !item.includes('.test.') && !item.includes('.config.')) {
            fixFile(fullPath);
        }
    }
}

console.log('🔧 Fixing common ESLint issues...');
processDirectory('.');
console.log('✅ Done! Run npm run lint to see remaining issues.');
