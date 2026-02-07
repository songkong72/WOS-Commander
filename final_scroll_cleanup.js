const fs = require('fs');
const path = 'app/growth/events.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix redundant ScrollView in Date Range branch
content = content.replace(
    /<ScrollView className="flex-1" contentContainerStyle=\{\{ paddingBottom: 80 \}\}><View className="mb-6" style=\{\{ zIndex: 100 \}\}><ScrollView className="flex-1" contentContainerStyle=\{\{ paddingBottom: 80 \}\}>/,
    '<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}><View className="mb-6" style={{ zIndex: 100 }}>'
);

// 2. Wrap Alliance Slots Branch cleanly (ensure exactly one ScrollView)
// Check if it's already Correct
// The alliance slots branch starts after the Date Range check

// Let's reload and verify alliance part
fs.writeFileSync(path, content);
console.log('Final cleanup applied');
