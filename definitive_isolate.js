const fs = require('fs');
const path = 'app/growth/events.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Reset the area to a known state if possible or just be very clever.
// We know line 1842 is the header close and 1843 is the content View.
// Let's find the content View.
let contentStartIdx = -1;
for (let i = 1800; i < 1860; i++) {
    if (lines[i] && lines[i].includes('className="px-6 flex-1"') && !lines[i].includes('ScrollView')) {
        contentStartIdx = i;
        break;
    }
}

if (contentStartIdx !== -1) {
    // Branch 1: Fortress/Citadel
    // Already mostly done, but let's ensure it's clean.
}

// Actually, let's use a very robust content replace with regex on the whole thing
let content = lines.join('\n');

// Remove any existing inner ScrollViews to start fresh in this problematic area
// BUT keep the outer View
// Actually, let's just target the Alliance part since Fortress is mostly okay.

// Alliance Branch start
content = content.replace(
    /\{\(\(\) => \{[\s\S]+?\}\)\(\)\}\s+\{editingEvent\?\.id !== 'a_champ' && editingEvent\?\.id !== 'alliance_frost_league' && editingEvent\?\.id !== 'a_weapon' && \(/g,
    (match) => {
        if (match.includes('<ScrollView')) return match;
        return match + '\n                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>';
    }
);

// Alliance Branch closing
// Find the end of the alliance branch
// It's before the closing paren of the main content 
// Actually, let's target the exact text from Step 1140 but with more flex matching
content = content.replace(
    /<\/s+>\s+<\/View>\s+<\/View>\s+<\/View>\s+<\/View>/, // This is too specific
    '</ScrollView>'
);

// Let's try something else. I'll search for the footer and insert the closing tag before it if needed.
const footerMarker = '{/* Fixed Action Footer with background */}\n                            <View';
if (content.includes(footerMarker)) {
    // Calculate how many </ScrollView> we have vs <ScrollView
    const scrollOpenTimes = (content.match(/<ScrollView/g) || []).length;
    const scrollCloseTimes = (content.match(/<\/ScrollView>/g) || []).length;

    if (scrollOpenTimes > scrollCloseTimes) {
        // We need to close them.
        // Let's close one before the footer View.
        content = content.replace(footerMarker, '</ScrollView>\n\n                            ' + footerMarker);
    }
}

// Clean up redundant ScrollViews in Date Range if found
content = content.replace(/<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}><View className="mb-6" style={{ zIndex: 100 }}><ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>/g, '<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}><View className="mb-6" style={{ zIndex: 100 }}>');

fs.writeFileSync(path, content);
console.log('Definitive scroll isolation cleanup applied');
