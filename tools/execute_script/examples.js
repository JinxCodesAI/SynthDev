/**
 * Example scripts for the execute_script tool
 * These examples demonstrate various use cases and capabilities
 */

// Example 1: Mathematical calculations
const mathExample = `
// Complex mathematical calculation
const radius = 5;
const area = Math.PI * Math.pow(radius, 2);
const circumference = 2 * Math.PI * radius;

console.log('Circle with radius', radius);
console.log('Area:', area.toFixed(2));
console.log('Circumference:', circumference.toFixed(2));

// Statistical calculations
const numbers = [12, 45, 23, 67, 34, 89, 56, 78, 90, 23];
const sum = numbers.reduce((a, b) => a + b, 0);
const mean = sum / numbers.length;
const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
const stdDev = Math.sqrt(variance);

console.log('Numbers:', numbers.join(', '));
console.log('Mean:', mean.toFixed(2));
console.log('Standard Deviation:', stdDev.toFixed(2));
`;

// Example 2: Text processing and analysis
const textExample = `
// Text analysis script
const text = \`
Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
\`;

const words = text.trim().split(/\\s+/);
const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
const paragraphs = text.split(/\\n\\s*\\n/).filter(p => p.trim().length > 0);

console.log('Text Analysis Results:');
console.log('Characters:', text.length);
console.log('Words:', words.length);
console.log('Sentences:', sentences.length);
console.log('Paragraphs:', paragraphs.length);

// Word frequency analysis
const wordFreq = {};
words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length > 0) {
        wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
});

const topWords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

console.log('Top 5 words:');
topWords.forEach(([word, count]) => {
    console.log(\`  \${word}: \${count}\`);
});
`;

// Example 3: Data processing and aggregation
const dataExample = `
// Data processing example
const salesData = [
    { month: 'Jan', sales: 12000, region: 'North' },
    { month: 'Jan', sales: 15000, region: 'South' },
    { month: 'Feb', sales: 13000, region: 'North' },
    { month: 'Feb', sales: 16000, region: 'South' },
    { month: 'Mar', sales: 14000, region: 'North' },
    { month: 'Mar', sales: 17000, region: 'South' }
];

// Monthly totals
const monthlyTotals = salesData.reduce((acc, item) => {
    acc[item.month] = (acc[item.month] || 0) + item.sales;
    return acc;
}, {});

// Regional totals
const regionalTotals = salesData.reduce((acc, item) => {
    acc[item.region] = (acc[item.region] || 0) + item.sales;
    return acc;
}, {});

// Overall statistics
const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
const avgMonthlySales = Object.values(monthlyTotals).reduce((a, b) => a + b, 0) / Object.keys(monthlyTotals).length;

console.log('Sales Analysis:');
console.log('Total Sales:', totalSales.toLocaleString());
console.log('Average Monthly Sales:', avgMonthlySales.toLocaleString());
console.log('\\nMonthly Breakdown:');
Object.entries(monthlyTotals).forEach(([month, total]) => {
    console.log(\`  \${month}: $\${total.toLocaleString()}\`);
});
console.log('\\nRegional Breakdown:');
Object.entries(regionalTotals).forEach(([region, total]) => {
    console.log(\`  \${region}: $\${total.toLocaleString()}\`);
});
`;

// Example 4: File reading and processing (if files exist)
const fileExample = `
// File processing example (requires files to exist)
const fs = require('fs');
const path = require('path');

try {
    // Check if package.json exists
    if (fs.existsSync('package.json')) {
        const packageData = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        console.log('Package name:', packageData.name || 'Unknown');
        console.log('Version:', packageData.version || 'Unknown');
        console.log('Dependencies:', Object.keys(packageData.dependencies || {}).length);
        console.log('Dev Dependencies:', Object.keys(packageData.devDependencies || {}).length);
    } else {
        console.log('package.json not found');
    }
    
    // List JavaScript files in current directory
    const files = fs.readdirSync('.');
    const jsFiles = files.filter(file => file.endsWith('.js'));
    console.log('\\nJavaScript files found:', jsFiles.length);
    jsFiles.forEach(file => {
        const stats = fs.statSync(file);
        console.log(\`  \${file}: \${stats.size} bytes\`);
    });
    
} catch (error) {
    console.log('Error reading files:', error.message);
}
`;

// Example 5: JSON data transformation
const jsonExample = `
// JSON data transformation
const rawData = {
    users: [
        { id: 1, name: 'Alice Johnson', email: 'alice@example.com', age: 28, department: 'Engineering' },
        { id: 2, name: 'Bob Smith', email: 'bob@example.com', age: 34, department: 'Marketing' },
        { id: 3, name: 'Carol Davis', email: 'carol@example.com', age: 29, department: 'Engineering' },
        { id: 4, name: 'David Wilson', email: 'david@example.com', age: 42, department: 'Sales' }
    ]
};

// Transform data
const departmentStats = rawData.users.reduce((acc, user) => {
    if (!acc[user.department]) {
        acc[user.department] = { count: 0, totalAge: 0, users: [] };
    }
    acc[user.department].count++;
    acc[user.department].totalAge += user.age;
    acc[user.department].users.push(user.name);
    return acc;
}, {});

// Calculate averages and format output
console.log('Department Statistics:');
Object.entries(departmentStats).forEach(([dept, stats]) => {
    const avgAge = (stats.totalAge / stats.count).toFixed(1);
    console.log(\`\\n\${dept}:\`);
    console.log(\`  Employees: \${stats.count}\`);
    console.log(\`  Average Age: \${avgAge}\`);
    console.log(\`  Members: \${stats.users.join(', ')}\`);
});

// Create summary report
const summary = {
    totalEmployees: rawData.users.length,
    departments: Object.keys(departmentStats).length,
    averageAge: (rawData.users.reduce((sum, user) => sum + user.age, 0) / rawData.users.length).toFixed(1),
    departmentBreakdown: Object.fromEntries(
        Object.entries(departmentStats).map(([dept, stats]) => [dept, stats.count])
    )
};

console.log('\\nSummary Report:');
console.log(JSON.stringify(summary, null, 2));
`;

// Export examples for use
export const examples = {
    math: mathExample,
    text: textExample,
    data: dataExample,
    file: fileExample,
    json: jsonExample,
};

// Usage instructions
console.log('Execute Script Tool Examples');
console.log('============================');
console.log('');
console.log('To use these examples with the execute_script tool:');
console.log('');
console.log('1. Mathematical calculations:');
console.log('   executeScript({ script: examples.math })');
console.log('');
console.log('2. Text processing:');
console.log('   executeScript({ script: examples.text })');
console.log('');
console.log('3. Data aggregation:');
console.log('   executeScript({ script: examples.data })');
console.log('');
console.log('4. File processing:');
console.log('   executeScript({ script: examples.file })');
console.log('');
console.log('5. JSON transformation:');
console.log('   executeScript({ script: examples.json })');
console.log('');
console.log('All examples include comprehensive output and demonstrate');
console.log("different aspects of the tool's capabilities.");
