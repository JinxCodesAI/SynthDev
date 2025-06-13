#!/usr/bin/env node

/**
 * Demonstration of the enhanced excludedTools pattern matching functionality
 * This script shows how the new pattern matching features work with different types of patterns
 */

import SystemMessages from '../systemMessages.js';

console.log('🎭 Enhanced excludedTools Pattern Matching Demo\n');

// Test tools to demonstrate pattern matching
const testTools = [
    'read_file',
    'write_file',
    'edit_file',
    'execute_command',
    'execute_script',
    'execute_terminal',
    'get_time',
    'calculate',
    'list_directory',
    'search_files',
    'run_terminal',
    'RUN_TERMINAL', // case test
];

console.log('📋 Available test tools:');
testTools.forEach(tool => console.log(`   • ${tool}`));
console.log();

// Test different pattern types
const patternTests = [
    {
        name: 'Exact String Match',
        patterns: ['get_time', 'calculate'],
        description: 'Traditional exact string matching (backward compatible)',
    },
    {
        name: 'Wildcard - End Match',
        patterns: ['*file'],
        description: 'Tools ending with "file" using wildcard pattern',
    },
    {
        name: 'Wildcard - Start Match',
        patterns: ['execute_*'],
        description: 'Tools starting with "execute_" using wildcard pattern',
    },
    {
        name: 'Wildcard - Multiple',
        patterns: ['*_file', 'execute_*'],
        description: 'Multiple wildcard patterns combined',
    },
    {
        name: 'Regex - Start Pattern',
        patterns: ['/^execute_/'],
        description: 'Tools starting with "execute_" using regex',
    },
    {
        name: 'Regex - Case Insensitive End',
        patterns: ['/terminal$/i'],
        description: 'Tools ending with "terminal" (case insensitive) using regex',
    },
    {
        name: 'Regex - Complex Pattern',
        patterns: ['/^(read|write)_file$/'],
        description: 'Tools matching "read_file" or "write_file" exactly using regex',
    },
    {
        name: 'Mixed Patterns',
        patterns: ['get_time', '*file', '/^execute_/', '/terminal$/i'],
        description: 'Combination of exact, wildcard, and regex patterns',
    },
];

// Run pattern matching tests
patternTests.forEach(test => {
    console.log(`🔍 ${test.name}`);
    console.log(`   Description: ${test.description}`);
    console.log(`   Patterns: ${test.patterns.join(', ')}`);

    const excludedTools = [];
    const allowedTools = [];

    testTools.forEach(tool => {
        const isExcluded = test.patterns.some(pattern =>
            SystemMessages._matchesExclusionPattern(tool, pattern)
        );

        if (isExcluded) {
            excludedTools.push(tool);
        } else {
            allowedTools.push(tool);
        }
    });

    console.log(`   ❌ Excluded (${excludedTools.length}): ${excludedTools.join(', ') || 'none'}`);
    console.log(`   ✅ Allowed (${allowedTools.length}): ${allowedTools.join(', ') || 'none'}`);
    console.log();
});

// Test the pattern_test role from configuration
console.log('🧪 Testing pattern_test role from configuration:');
try {
    const patternTestExcluded = SystemMessages.getExcludedTools('pattern_test');
    console.log(`   Configured patterns: ${patternTestExcluded.join(', ')}`);

    const excludedByRole = [];
    const allowedByRole = [];

    testTools.forEach(tool => {
        if (SystemMessages.isToolExcluded('pattern_test', tool)) {
            excludedByRole.push(tool);
        } else {
            allowedByRole.push(tool);
        }
    });

    console.log(
        `   ❌ Excluded (${excludedByRole.length}): ${excludedByRole.join(', ') || 'none'}`
    );
    console.log(`   ✅ Allowed (${allowedByRole.length}): ${allowedByRole.join(', ') || 'none'}`);
} catch (error) {
    console.log(`   ⚠️  Error testing pattern_test role: ${error.message}`);
}

console.log('\n✨ Pattern matching demo completed!');
console.log('\n💡 Key Features:');
console.log('   • Backward compatible with exact string matches');
console.log('   • Wildcard support using * (e.g., "*file", "execute_*")');
console.log('   • Regular expression support with /pattern/flags syntax');
console.log('   • Graceful error handling for invalid patterns');
console.log('   • Mix and match different pattern types in the same role');
