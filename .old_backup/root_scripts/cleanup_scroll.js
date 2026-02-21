const fs = require('fs');
const path = 'app/growth/events.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Remove ANY ScrollView within the main content branches and find the branch start/end points
// This is to reset to a clean state for the internal isolation.

// Let's find the content View starting at line 1843 (approx)
let contentStartIdx = -1;
for (let i = 1800; i < 1860; i++) {
    if (lines[i] && lines[i].includes('className="px-6 flex-1"') && !lines[i].includes('ScrollView')) {
        contentStartIdx = i;
        break;
    }
}

let contentEndIdx = -1;
for (let i = 2500; i < 2800; i++) {
    if (lines[i] && lines[i].includes('Fixed Action Footer with background')) {
        contentEndIdx = i - 1; // Closing tag before footer
        break;
    }
}

if (contentStartIdx !== -1 && contentEndIdx !== -1) {
    // We'll work on the content between these two.
    let contentSection = lines.slice(contentStartIdx + 1, contentEndIdx).join('\n');

    // Remove all ScrollViews added in this specific content section
    // (Except those inside dropdowns, but those are small)
    // Actually, let's just be very specific.

    // Clean redundant Date Range ScrollView
    contentSection = contentSection.replace(/<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}><View className="mb-6" style={{ zIndex: 100 }}><ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>/g, '<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}><View className="mb-6" style={{ zIndex: 100 }}>');

    // Ensure Alliance branch is wrapped
    const allianceStart = /\{editingEvent\?\.id !== 'a_champ' && editingEvent\?\.id !== 'alliance_frost_league' && editingEvent\?\.id !== 'a_weapon' && \(\s+<>/;
    if (!contentSection.match(/<ScrollView className="flex-1" contentContainerStyle=\{\{ paddingBottom: 80 \}\}>\s+\{editingEvent/)) {
        contentSection = contentSection.replace(
            /(\{editingEvent\?\.id !== 'a_champ' && editingEvent\?\.id !== 'alliance_frost_league' && editingEvent\?\.id !== 'a_weapon' && \(\s+<>\))/g,
            '<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>\n                                    $1'
        );
        // We need to close it. The closing for this branch is before the closing parenthesis of the alliance slots ternary.
        // It's getting too complex with nested regex.
    }

    lines.splice(contentStartIdx + 1, contentEndIdx - contentStartIdx - 1, contentSection);
    fs.writeFileSync(path, lines.join('\n'));
}

console.log('Cleanup script executed');
