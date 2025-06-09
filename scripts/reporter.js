import { diff } from 'util';

// ./scripts/reporter.js
export default class SimpleReporter {
    constructor(options) {
        this.failedTests = [];
        // Default to showing failures unless explicitly told otherwise.
        this.options = { showFailures: true, ...options };
        console.log('🚀 SimpleReporter initialized with options:', this.options);
    }

    onInit() {
        console.log('🚀 Starting Vitest run...\n');
    }

    onTestFailed(test) {
        console.log(`❌ Test failed: ${test.name}`);
        this.failedTests.push(test);
    }

    onFinished(files, results) {
        const passedFiles = files.filter(f => f.result?.state !== 'fail');
        const failedFilesCount = files.length - passedFiles.length;

        let totalTests = 0,
            passedTests = 0,
            failedTestsCount = 0,
            skippedTests = 0;

        for (const file of files) {
            const countTasks = tasks => {
                for (const task of tasks) {
                    if (task.type === 'test') {
                        totalTests++;
                        if (task.result?.state === 'pass') {
                            passedTests++;
                        } else if (task.result?.state === 'fail') {
                            failedTestsCount++;
                            if (this.options.showFailures) {
                                this.failedTests.push(task);
                            }
                        } else {
                            skippedTests++;
                        }
                    } else if (task.type === 'suite' && task.tasks) {
                        countTasks(task.tasks);
                    }
                }
            };
            countTasks(file.tasks);
        }

        const timeResult = results.find(r => r.type === 'result');
        const duration = timeResult ? `${(timeResult.duration / 1000).toFixed(2)}s` : 'N/A';

        console.log('\n📊 Test Summary:');
        console.log(
            `     Files: ${passedFiles.length} passed | ${failedFilesCount} failed | ${files.length} total`
        );
        console.log(
            `     Tests: ${passedTests} passed | ${failedTestsCount} failed | ${skippedTests} skipped | ${totalTests} total`
        );
        console.log(`      Time: ${duration}\n`);

        // --- CORRECTED LOGIC ---
        // First, check if there are any failures at all.
        if (this.failedTests.length > 0) {
            // Then, check if we are allowed to show them.
            if (this.options.showFailures) {
                this.printFailureDetails();
            }
        } else {
            // This 'else' block only runs if failedTests.length is 0.
            console.log('✅ All tests passed!');
        }
    }

    printFailureDetails() {
        console.log('─────────────────── ❌ FAILED TESTS ───────────────────\n');

        const failuresByFile = new Map();
        for (const test of this.failedTests) {
            const fileName = test.file?.name || 'Unknown File';
            if (!failuresByFile.has(fileName)) {
                failuresByFile.set(fileName, []);
            }
            failuresByFile.get(fileName)?.push(test);
        }

        for (const [fileName, tests] of failuresByFile.entries()) {
            console.log(`  ● ${fileName}`);
            for (const test of tests) {
                const fullName = this.getTaskFullName(test);
                console.log(`    └─ ❌ ${fullName}`);

                if (test.result?.errors) {
                    for (const err of test.result.errors) {
                        const errorMessage = err.message.split('\n')[0];
                        console.log(`         ${errorMessage}`);
                        console.log(`Diff: ${err.diff ? err.diff : 'N/A'}`);
                    }
                }
            }
            console.log('');
        }
    }

    getTaskFullName(task) {
        if (task.suite) {
            return `${this.getTaskFullName(task.suite)} > ${task.name}`;
        }
        return task.name;
    }
}
