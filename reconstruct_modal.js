const fs = require('fs');
const path = 'app/growth/events.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Find the start and end indices for ScheduleModal accurately
let startIndex = -1;
let endIndex = -1;

for (let i = 1750; i < 1850; i++) {
    if (lines[i] && lines[i].includes('/* Schedule Edit Modal */')) {
        startIndex = i;
        break;
    }
}

for (let i = 2600; i < 2750; i++) {
    if (lines[i] && lines[i].includes('Attendee Modal')) {
        for (let j = i - 1; j > i - 50; j--) {
            if (lines[j] && lines[j].includes('</Modal>')) {
                endIndex = j;
                break;
            }
        }
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    console.log(`Resetting ScheduleModal from line ${startIndex + 1} to ${endIndex + 1}`);

    // I will use a placeholder-based reconstruction to ensure perfect balancing.
    // I'll rebuild the code in parts.

    // We'll use a simplified structural template and fill in the logic.
    const modalBody = lines.slice(startIndex, endIndex + 1).join('\n');

    // Actually, I'll just write the WHOLE structure here. 
    // It's safer than regex because the current code is corrupted.

    // I'll extract the Date Selector logic specifically since it's complex.
    const dateSelectorMatch = modalBody.match(/const RenderDateSelector = [\s\S]+?return \(\n\s+<>\n\s+<RenderDateSelector label="시작 일시"[\s\S]+?<\/ScrolView>/);
    // Wait, let's use a simpler approach. 
    // I'll just fix the tags in the existing modalBody.

    let fixedBody = modalBody;

    // 1. Reset all ScrollViews in the modalBody to a flat structure first
    // fixedBody = fixedBody.replace(/<ScrollView[^>]*>/g, '<VIEW_HOLDER>');
    // fixedBody = fixedBody.replace(/<\/ScrollView>/g, '</VIEW_HOLDER>');

    // Actually, the most robust way is to replace the WHOLE file from line 1802 to 2653 
    // with a copy obtained from a RECENT GOOD STATE if I had one, 
    // but I don't have a full copy of the whole modal in one go.

    // I'll use `replace` with extreme care for the specific branches.

    // FIX 1: Fortress/Citadel branch isolation
    // Locate: {editingEvent?.id === 'a_fortress' ? (
    // Ensure it's wrapped in a View and each sub-tab is a ScrollView.

    // FIX 2: Date Range branch isolation
    // Locate: (() => { const dateRangeIDs = ... })() ? (
    // Ensure it's wrapped in a ScrollView.

    // FIX 3: Alliance branch isolation
    // The final branch.

    // I'll just rewrite the WHOLE damn modal in a separate string and replace it.
    // I'll use the code I've seen in the `view_file` calls.
}
