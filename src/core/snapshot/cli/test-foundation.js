#!/usr/bin/env node

/**
 * CLI Tool for Testing Snapshot Foundation Components
 * Allows product owners to validate foundation functionality
 */

import { initializeSnapshotSystem, Snapshot, getSystemInfo, IdGenerator } from '../index.js';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Test runner for foundation components
 */
class FoundationTester {
    constructor() {
        this.system = null;
        this.testResults = [];
        this.tempFiles = [];
    }

    /**
     * Initialize the test system
     */
    async initialize() {
        console.log('🔧 Initializing Snapshot System...');
        this.system = initializeSnapshotSystem();
        await this.system.memoryStore.initialize();
        console.log('✅ System initialized successfully\n');
    }

    /**
     * Run all foundation tests
     */
    async runAllTests() {
        console.log('🧪 Running Foundation Component Tests\n');
        console.log('='.repeat(60));

        await this.testSystemInfo();
        await this.testConfiguration();
        await this.testEventSystem();
        await this.testIdGeneration();
        await this.testChangeDetection();
        await this.testDataModels();
        await this.testMemoryStorage();
        await this.testSerialization();
        await this.testIntegrityValidation();
        await this.testPerformanceOptimization();

        await this.cleanup();
        this.printSummary();
    }

    /**
     * Test system information
     */
    async testSystemInfo() {
        console.log('📋 Testing System Information...');

        try {
            const info = getSystemInfo();
            this.assert(info.name === 'SynthDev Snapshots', 'System name is correct');
            this.assert(info.version, 'Version is defined');
            this.assert(Array.isArray(info.components), 'Components list is available');
            this.assert(info.components.length > 0, 'Components are listed');

            console.log(`   Name: ${info.name}`);
            console.log(`   Version: ${info.version}`);
            console.log(`   Components: ${info.components.length}`);

            this.recordTest('System Information', true);
        } catch (error) {
            this.recordTest('System Information', false, error.message);
        }
        console.log('');
    }

    /**
     * Test configuration system
     */
    async testConfiguration() {
        console.log('⚙️  Testing Configuration System...');

        try {
            const config = this.system.config;

            // Test default configuration
            const snapshotConfig = config.getSnapshotConfig();
            this.assert(snapshotConfig.mode === 'auto', 'Default mode is auto');
            this.assert(snapshotConfig.file.maxSnapshots === 50, 'Default max snapshots is 50');

            // Test memory limit parsing
            const memoryLimit = config.parseMemoryLimit('100MB');
            this.assert(memoryLimit === 100 * 1024 * 1024, 'Memory limit parsing works');

            // Test configuration update
            config.updateConfig('snapshots.file.maxSnapshots', 75);
            this.assert(config.getFileConfig().maxSnapshots === 75, 'Configuration update works');

            console.log(`   Mode: ${snapshotConfig.mode}`);
            console.log(`   Max Snapshots: ${config.getFileConfig().maxSnapshots}`);
            console.log(`   Memory Limit: ${config.getFileConfig().memoryLimit}`);

            this.recordTest('Configuration System', true);
        } catch (error) {
            this.recordTest('Configuration System', false, error.message);
        }
        console.log('');
    }

    /**
     * Test event system
     */
    async testEventSystem() {
        console.log('📡 Testing Event System...');

        try {
            const emitter = this.system.eventEmitter;
            let eventFired = false;
            let eventData = null;

            // Test event emission and listening
            emitter.on('test:event', data => {
                eventFired = true;
                eventData = data;
            });

            emitter.emit('test:event', { test: 'data' });

            this.assert(eventFired, 'Event was fired');
            this.assert(eventData && eventData.test === 'data', 'Event data was passed correctly');

            // Test listener count
            this.assert(emitter.listenerCount('test:event') === 1, 'Listener count is correct');

            console.log(`   Event fired: ${eventFired}`);
            console.log(`   Listener count: ${emitter.listenerCount('test:event')}`);

            this.recordTest('Event System', true);
        } catch (error) {
            this.recordTest('Event System', false, error.message);
        }
        console.log('');
    }

    /**
     * Test ID generation
     */
    async testIdGeneration() {
        console.log('🆔 Testing ID Generation...');

        try {
            // Test snapshot ID generation
            const snapshotId = IdGenerator.generateSnapshotId('test instruction');
            this.assert(snapshotId.startsWith('snap_'), 'Snapshot ID has correct prefix');
            this.assert(IdGenerator.validateId(snapshotId, 'snapshot'), 'Snapshot ID is valid');

            // Test branch name generation
            const branchName = IdGenerator.generateBranchName('Add authentication system');
            this.assert(branchName.startsWith('synth-dev/'), 'Branch name has correct prefix');
            this.assert(
                branchName.includes('add-authentication-system'),
                'Branch name is sanitized'
            );

            // Test content hash
            const hash = IdGenerator.generateContentHash('test content');
            this.assert(hash.length === 32, 'MD5 hash has correct length');
            this.assert(/^[a-f0-9]+$/.test(hash), 'Hash contains only hex characters');

            console.log(`   Snapshot ID: ${snapshotId.substring(0, 20)}...`);
            console.log(`   Branch Name: ${branchName}`);
            console.log(`   Content Hash: ${hash.substring(0, 16)}...`);

            this.recordTest('ID Generation', true);
        } catch (error) {
            this.recordTest('ID Generation', false, error.message);
        }
        console.log('');
    }

    /**
     * Test change detection
     */
    async testChangeDetection() {
        console.log('🔍 Testing Change Detection...');

        try {
            const changeDetector = this.system.changeDetector;

            // Create a temporary test file
            const testFile = path.join(os.tmpdir(), `test-${Date.now()}.txt`);
            this.tempFiles.push(testFile);

            await writeFile(testFile, 'initial content');

            // First check should detect change (new file)
            const firstCheck = await changeDetector.hasFileChanged(testFile);
            this.assert(firstCheck === true, 'New file detected as changed');

            // Second check should not detect change
            const secondCheck = await changeDetector.hasFileChanged(testFile);
            this.assert(secondCheck === false, 'Unchanged file detected correctly');

            // Modify file and check again
            await writeFile(testFile, 'modified content');
            const thirdCheck = await changeDetector.hasFileChanged(testFile);
            this.assert(thirdCheck === true, 'Modified file detected as changed');

            // Test performance metrics
            const metrics = changeDetector.getPerformanceMetrics();
            this.assert(metrics.hashCalculations > 0, 'Hash calculations recorded');
            this.assert(typeof metrics.cacheHitRate === 'number', 'Cache hit rate calculated');

            console.log(`   Hash calculations: ${metrics.hashCalculations}`);
            console.log(`   Cache hit rate: ${Math.round(metrics.cacheHitRate * 100)}%`);
            console.log(`   Cached files: ${metrics.cachedFiles}`);

            this.recordTest('Change Detection', true);
        } catch (error) {
            this.recordTest('Change Detection', false, error.message);
        }
        console.log('');
    }

    /**
     * Test data models
     */
    async testDataModels() {
        console.log('📊 Testing Data Models...');

        try {
            // Test Snapshot model
            const snapshot = new Snapshot({
                instruction: 'Test snapshot creation',
                mode: 'file',
            });

            this.assert(snapshot.id, 'Snapshot ID is generated');
            this.assert(snapshot.instruction === 'Test snapshot creation', 'Instruction is set');
            this.assert(snapshot.mode === 'file', 'Mode is set');

            // Test file operations
            snapshot.addFile('test.txt', 'test content', 'checksum123');
            this.assert(snapshot.hasFile('test.txt'), 'File was added');
            this.assert(
                snapshot.getFileContent('test.txt') === 'test content',
                'File content is correct'
            );

            // Test serialization
            const obj = snapshot.toObject();
            const restored = Snapshot.fromObject(obj);
            this.assert(restored.id === snapshot.id, 'Snapshot serialization works');
            this.assert(restored.hasFile('test.txt'), 'File data preserved in serialization');

            // Test size calculation
            const size = snapshot.calculateSize();
            this.assert(size > 0, 'Size calculation works');

            console.log(`   Snapshot ID: ${snapshot.id.substring(0, 20)}...`);
            console.log(`   File count: ${snapshot.files.size}`);
            console.log(`   Size: ${size} bytes`);

            this.recordTest('Data Models', true);
        } catch (error) {
            this.recordTest('Data Models', false, error.message);
        }
        console.log('');
    }

    /**
     * Test memory storage
     */
    async testMemoryStorage() {
        console.log('💾 Testing Memory Storage...');

        try {
            const store = this.system.memoryStore;

            // Create test snapshot
            const snapshot = new Snapshot({
                instruction: 'Test storage',
                mode: 'file',
            });
            snapshot.addFile('test.txt', 'test content');

            // Test storage
            await store.storeSnapshot(snapshot);
            const retrieved = await store.getSnapshot(snapshot.id);
            this.assert(retrieved !== null, 'Snapshot was stored and retrieved');
            this.assert(retrieved.id === snapshot.id, 'Retrieved snapshot has correct ID');

            // Test listing
            const allSnapshots = await store.getAllSnapshots();
            this.assert(allSnapshots.length > 0, 'All snapshots can be retrieved');

            // Test statistics
            const stats = await store.getStats();
            this.assert(stats.type === 'memory', 'Storage type is correct');
            this.assert(stats.totalSnapshots > 0, 'Statistics show stored snapshots');

            console.log(`   Total snapshots: ${stats.totalSnapshots}`);
            console.log(`   Memory usage: ${stats.memoryUsage.current} bytes`);
            console.log(`   Memory percentage: ${stats.memoryUsage.percentage}%`);

            this.recordTest('Memory Storage', true);
        } catch (error) {
            this.recordTest('Memory Storage', false, error.message);
        }
        console.log('');
    }

    /**
     * Test serialization
     */
    async testSerialization() {
        console.log('📦 Testing Serialization...');

        try {
            const serializer = this.system.serializer;

            // Create test snapshot
            const snapshot = new Snapshot({
                instruction: 'Test serialization',
                mode: 'file',
            });
            snapshot.addFile('test.txt', 'test content');
            snapshot.addTag('test');

            // Test JSON serialization
            const serialized = await serializer.serializeToJSON(snapshot, false);
            const deserialized = await serializer.deserializeFromJSON(serialized, false);

            this.assert(deserialized.id === snapshot.id, 'JSON serialization preserves ID');
            this.assert(deserialized.hasFile('test.txt'), 'JSON serialization preserves files');
            this.assert(deserialized.hasTag('test'), 'JSON serialization preserves tags');

            // Test readable format
            const readable = serializer.exportToReadableFormat(snapshot);
            this.assert(readable.includes('SNAPSHOT:'), 'Readable format contains header');
            this.assert(
                readable.includes('Test serialization'),
                'Readable format contains instruction'
            );

            console.log(`   JSON size: ${serialized.length} characters`);
            console.log(`   Readable format: ${readable.split('\n').length} lines`);

            this.recordTest('Serialization', true);
        } catch (error) {
            this.recordTest('Serialization', false, error.message);
        }
        console.log('');
    }

    /**
     * Test integrity validation
     */
    async testIntegrityValidation() {
        console.log('🔒 Testing Integrity Validation...');

        try {
            const validator = this.system.integrityValidator;

            // Create valid snapshot
            const validSnapshot = new Snapshot({
                instruction: 'Test validation',
                mode: 'file',
            });
            validSnapshot.addFile('test.txt', 'test content');

            // Test validation
            const result = await validator.validateSnapshot(validSnapshot);
            this.assert(result.valid === true, 'Valid snapshot passes validation');

            // Test quick validation
            const quickResult = validator.quickValidate(validSnapshot);
            this.assert(quickResult === true, 'Quick validation works');

            // Test structure validation
            const structureResult = validator.validateSnapshotStructure(validSnapshot);
            this.assert(structureResult.valid === true, 'Structure validation passes');
            this.assert(structureResult.errors.length === 0, 'No structure errors found');

            console.log(`   Validation result: ${result.valid ? 'PASS' : 'FAIL'}`);
            console.log(`   Summary: ${result.summary}`);

            this.recordTest('Integrity Validation', true);
        } catch (error) {
            this.recordTest('Integrity Validation', false, error.message);
        }
        console.log('');
    }

    /**
     * Test performance optimization
     */
    async testPerformanceOptimization() {
        console.log('⚡ Testing Performance Optimization...');

        try {
            const optimizer = this.system.performanceOptimizer;

            // Test memory usage monitoring
            const memoryUsage = optimizer.getMemoryUsage();
            this.assert(typeof memoryUsage.rss === 'number', 'Memory usage RSS is reported');
            this.assert(typeof memoryUsage.heapUsed === 'number', 'Heap usage is reported');

            // Test LRU cache
            const cache = optimizer.createLRUCache(3);
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            this.assert(cache.size() === 3, 'LRU cache respects size limit');
            this.assert(cache.get('key1') === 'value1', 'LRU cache retrieval works');

            // Test performance recommendations
            const recommendations = optimizer.getPerformanceRecommendations();
            this.assert(Array.isArray(recommendations), 'Performance recommendations are provided');

            console.log(`   Memory usage: ${memoryUsage.heapUsed}MB`);
            console.log(`   Cache size: ${cache.size()}`);
            console.log(`   Recommendations: ${recommendations.length}`);

            this.recordTest('Performance Optimization', true);
        } catch (error) {
            this.recordTest('Performance Optimization', false, error.message);
        }
        console.log('');
    }

    /**
     * Assert a condition
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    /**
     * Record test result
     */
    recordTest(testName, passed, error = null) {
        this.testResults.push({
            name: testName,
            passed,
            error,
        });

        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status}: ${testName}`);
        if (error) {
            console.log(`   Error: ${error}`);
        }
    }

    /**
     * Clean up temporary files
     */
    async cleanup() {
        for (const file of this.tempFiles) {
            try {
                if (existsSync(file)) {
                    await unlink(file);
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));

        const passed = this.testResults.filter(r => r.passed).length;
        const failed = this.testResults.filter(r => !r.passed).length;
        const total = this.testResults.length;

        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

        if (failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => {
                    console.log(`   - ${r.name}: ${r.error}`);
                });
        }

        console.log(`\n${failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed.'}`);

        process.exit(failed === 0 ? 0 : 1);
    }
}

// Run tests if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('test-foundation.js')) {
    const tester = new FoundationTester();

    tester
        .initialize()
        .then(() => tester.runAllTests())
        .catch(error => {
            console.error('❌ Test execution failed:', error);
            process.exit(1);
        });
}

export default FoundationTester;
