const fs = require('fs');
const path = 'app/growth/events.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Replace outer ScrollView (Lines 1842-1856 based on previous view_file)
// We'll search for the specific content to be sure.
let startIdx = -1;
let endIdx = -1;
for (let i = 1800; i < 1900; i++) {
    if (lines[i] && lines[i].includes('<ScrollView') && lines[i + 1] && lines[i + 1].includes('className="px-6 flex-1"')) {
        startIdx = i;
        // Find closing >
        for (let j = i; j < i + 20; j++) {
            if (lines[j] && lines[j].trim() === '>') {
                endIdx = j;
                break;
            }
        }
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx + 1, '                            <View className="px-6 flex-1">');
}

// Note: lines array has changed size now. 
// It's better to reload or adjust indices. 
// Let's just do one major splice per run or use content replace with regex.

let content = lines.join('\n');

// 2. Wrap Fortress List (View className="overflow-visible" followed by fortressList.length === 0)
content = content.replace(
    /<View className="overflow-visible">\s+\{fortressList\.length === 0/g,
    '<ScrollView className="overflow-visible flex-1" contentContainerStyle={{ paddingBottom: 20 }}>\n                                                    {fortressList.length === 0'
);
// We need to close it too. The closing View for this is before the closing paren of activeFortressTab === 'fortress' ? ( ... )
// It's easier to replace the mapping block.

// Fortress List Block
content = content.replace(
    /(<ScrollView className="overflow-visible flex-1" contentContainerStyle=\{\{ paddingBottom: 20 \}\}>[\s\S]+?)\s+<\/View>\s+<\/View>\s+\) : \(/,
    '$1\n                                                    </ScrollView>\n                                                </View>\n                                            ) : ('
);

// Citadel List Block
content = content.replace(
    /<View className="overflow-visible">\s+\{citadelList\.length === 0/g,
    '<ScrollView className="overflow-visible flex-1" contentContainerStyle={{ paddingBottom: 20 }}>\n                                                    {citadelList.length === 0'
);

content = content.replace(
    /(<ScrollView className="overflow-visible flex-1" contentContainerStyle=\{\{ paddingBottom: 20 \}\}>[\s\S]+?)\s+<\/View>\s+<\/View>\s+<\/View>\s+\) : \(\(\) => \{/,
    '$1\n                                                    </ScrollView>\n                                                </View>\n                                            </View>\n                                        ) : (() => {'
);

fs.writeFileSync(path, content);
console.log('Precision scroll isolation applied');
