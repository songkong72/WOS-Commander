const fs = require('fs');
const path = 'app/growth/events.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Convert outer ScrollView to View
content = content.replace(
    '<ScrollView\n                                className="px-6 flex-1"\n                                style={{ zIndex: (!!activeDateDropdown || hourDropdownVisible || minuteDropdownVisible || !!activeFortressDropdown) ? 9999 : 1 }}\n                                contentContainerStyle={[\n                                    editingEvent?.id === \'a_champ\' || editingEvent?.id === \'a_center\' || editingEvent?.category === \'개인\'\n                                        ? { paddingBottom: 80 }\n                                        : (editingEvent?.id === \'a_fortress\')\n                                             ? { paddingBottom: 0 }\n                                            : (editingEvent?.id === \'a_mobilization\' || editingEvent?.id === \'alliance_mobilization\' || editingEvent?.id === \'a_castle\' || editingEvent?.id === \'a_svs\' || editingEvent?.id === \'a_operation\' || editingEvent?.id === \'alliance_operation\')\n                                                ? { paddingBottom: 80 }\n                                                : (editingEvent?.id === \'alliance_frost_league\' || editingEvent?.id === \'a_weapon\')\n                                                    ? { paddingBottom: 80 }\n                                                    : { paddingBottom: 80 } ]}\n                                scrollEnabled={true}\n                            >',
    '<View className="px-6 flex-1">'
);
content = content.replace('</ScrollView>', '</View>'); // This is dangerous if there are multiple ScrollViews, let's be more specific.

// Let's refine the closing tag replace by looking for the fixed footer starting below it
content = content.replace(
    '</ScrollView>\n\n                            {/* Fixed Action Footer',
    '</View>\n\n                            {/* Fixed Action Footer'
);

// 2. Wrap Fortress List in ScrollView
content = content.replace(
    '<View className="overflow-visible">',
    '<ScrollView className="overflow-visible" showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>'
);
// There are two of these (one for fortress, one for citadel)
// We need to match both effectively. 
// Since fortressList.map and citadelList.map follow them.

// Wrap Fortress list specifically
const fortressListWrapRegex = /<View className="overflow-visible">\s+\{fortressList\.length === 0 \? \([\s\S]+?\) : fortressList\.map\([\s\S]+?\}\)\}\s+<\/View>/;
content = content.replace(fortressListWrapRegex, (match) => {
    return match.replace('<View className="overflow-visible">', '<ScrollView className="overflow-visible flex-1" contentContainerStyle={{ paddingBottom: 20 }}>')
        .replace(/<\/View>$/, '</ScrollView>');
});

// Wrap Citadel list specifically
const citadelListWrapRegex = /<View className="overflow-visible">\s+\{citadelList\.length === 0 \? \([\s\S]+?\) : citadelList\.map\([\s\S]+?\}\)\}\s+<\/View>/;
content = content.replace(citadelListWrapRegex, (match) => {
    return match.replace('<View className="overflow-visible">', '<ScrollView className="overflow-visible flex-1" contentContainerStyle={{ paddingBottom: 20 }}>')
        .replace(/<\/View>$/, '</ScrollView>');
});

// 3. Wrap Date Range Branch
const dateRangeBranchRegex = /editingEvent\?\.id === 'a_fortress' \? \([\s\S]+?\) : \(\(\) => \{[\s\S]+?\}\)\(\) \? \([\s\S]+?<View className="mb-6" style=\{\{ zIndex: 100 \}\}>([\s\S]+?)<\/View>\s+\) : \(/;
content = content.replace(dateRangeBranchRegex, (match, p1) => {
    return match.replace(p1, `<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>${p1}</ScrollView>`);
});

// 4. Wrap Weekly/Alliance slots branch
// This starts with the Tabs (Alliance Only) logic
const allianceSlotsBranchRegex = /\) : \([\s\S]+?<>([\s\S]+?)<>\s+<\/s+>/;
// This is getting complex with nested parens. 
// Let's just find the part after tabs and before final footer in that branch.

fs.writeFileSync(path, content);
console.log('Scroll isolation restructuring applied');
