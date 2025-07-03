#!/usr/bin/env node

/**
 * Test script for the configuration wizard
 * This script allows manual testing of the wizard functionality
 */

import { ConfigurationWizard } from './utils/ConfigurationWizard.js';

console.log('🧪 Configuration Wizard Test Script');
console.log('═'.repeat(50));
console.log('This script will start the configuration wizard for testing.');
console.log('You can test the new selective configuration features.\n');

async function testWizard() {
    try {
        const wizard = new ConfigurationWizard();

        console.log('Starting wizard in manual mode (not auto-start)...\n');

        const success = await wizard.startWizard(false);

        if (success) {
            console.log('\n✅ Wizard completed successfully!');
            console.log('Check your .env file to see the changes.');
        } else {
            console.log('\n❌ Wizard was cancelled or failed.');
        }
    } catch (error) {
        console.error('\n💥 Error running wizard:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testWizard().catch(console.error);
