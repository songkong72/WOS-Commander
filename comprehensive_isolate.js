const fs = require('fs');
const path = 'app/growth/events.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Ensure outer ScrollView is gone and footer is fixed. 
// (Done partially, but let's make sure it's clean)
content = content.replace(/<ScrollView\s+className="px-6 flex-1"[\s\S]+?>/g, '<View className="px-6 flex-1">');
content = content.replace(/<\/ScrollView>\s+<View\s+className={`px-6 pt-6 pb-10 border-t/g, '</View>\n\n                            {/* Fixed Action Footer with background */}\n                            <View\n                                className={`px-6 pt-6 pb-10 border-t');

// 2. Wrap Fortress List
content = content.replace(
    /(<View className="flex-row justify-between items-center mt-4 mb-3 px-4">[\s\S]+?<\/TouchableOpacity>\s+<\/View>\s+)<ScrollView className="overflow-visible" showsVerticalScrollIndicator=\{true\} contentContainerStyle=\{\{ paddingBottom: 20 \}\}>/,
    '$1<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>'
);
// Make sure Fortress scroll has a closing tag
// (Handled by the next replace for Citadel start)

// 3. Wrap Citadel List
content = content.replace(
    /(\)\s+:\s+\([\s\S]+?<View className="flex-row justify-between items-center mt-4 mb-3 px-4">[\s\S]+?<\/TouchableOpacity>\s+<\/View>\s+)<View className="overflow-visible">/,
    '$1<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>'
);

// 4. Wrap Date Range Branch
content = content.replace(
    /(\)\(\) \? \([\s\S]+?)(<View className="mb-6" style=\{\{ zIndex: 100 \}\}>)/,
    '$1<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>$2'
);
// Close it
content = content.replace(
    /(<ScrollView className="flex-1" contentContainerStyle=\{\{ paddingBottom: 80 \}\}>[\s\S]+?<\/View>)\s+\) : \(/,
    '$1</ScrollView>) : ('
);

// 5. Wrap Alliance Slots Branch
// The Alliance slots branch starts after the Date Range check
content = content.replace(
    /(\) : \([\s\S]+?<>\s+)([\s\S]+?)(<>\s+<\/View>)/,
    (match, p1, p2, p3) => {
        // p2 contains the Tabs and the slots
        // We want to keep Tabs outside the ScrollView
        const tabMatch = p2.match(/\{\(\(\) => \{[\s\S]+?\}\)\(\)\}/);
        if (tabMatch) {
            const tabs = tabMatch[0];
            const remaining = p2.replace(tabs, '');
            return `${p1}${tabs}\n                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>${remaining}</ScrollView>${p3}`;
        }
        return match;
    }
);

fs.writeFileSync(path, content);
console.log('Comprehensive scroll isolation applied');
