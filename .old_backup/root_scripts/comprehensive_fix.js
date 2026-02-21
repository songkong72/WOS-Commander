const fs = require('fs');
const path = 'app/growth/events.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Precise fix for HeroPicker (Lines 228-230)
// Replacing lines 228 to 230 with correct closing
let heroIdx = -1;
for (let i = 210; i < 240; i++) {
    if (lines[i] && lines[i].includes('228:') || (lines[i].includes(')}') && lines[i + 1].includes('}') && lines[i + 2].includes('</View >'))) {
        // Double check by content
        if (lines[i].includes(')}')) {
            heroIdx = i;
            break;
        }
    }
}
// Based on Step 1300 numbering:
// 228:             )}
// 229: }
// 230:         </View >
// We want to replace 229 and 230.
// Let's just find the pattern and replace in full content for safety.

let content = lines.join('\n');

// Fix HeroPicker stray } and extra space in </View >
content = content.replace(/\)\}\s+\}\s+<\/View >/g, ')}\n        </View>');

// Fix the missing </ScrollView> before footer
// The Alliance branch starts a ScrollView but might not close it
const footerMarker = '{/* Fixed Action Footer with background */}';
if (content.includes(footerMarker)) {
    // Check if the last opened ScrollView is closed before this point
    // We already moved the main ScrollView to View.
    // So there should be a closing </ScrollView> for the last content branch.

    // Let's find the count of <ScrollView and </ScrollView>
    const openCount = (content.match(/<ScrollView/g) || []).length;
    const closeCount = (content.match(/<\/ScrollView>/g) || []).length;

    if (openCount > closeCount) {
        console.log(`Unbalanced ScrollViews: ${openCount} open, ${closeCount} closed. Adding closing tag before footer.`);
        // We need to add (openCount - closeCount) closing tags before the footer's closing </View> for the content area
        // Actually, usually just one is missing.
        const closingTags = Array(openCount - closeCount).fill('                            </ScrollView>').join('\n');
        content = content.replace(footerMarker, closingTags + '\n\n                        ' + footerMarker);
    }
}

fs.writeFileSync(path, content);
console.log('Comprehensive fixes applied');
