const fs = require('fs');
const path = 'app/growth/events.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix Fortress Scroll Closing tag
// It should be after line 2076 (})} ) and before line 2078 ( </View> )
content = content.replace(
    /(fortressList\.map\([\s\S]+?\}\)\})\s+<\/View>\s+<\/View>\s+\) : \(/,
    '$1\n                                                    </ScrollView>\n                                                </View>\n                                            ) : ('
);

// 2. Fix Citadel Scroll Start and Closing tag
// Based on Step 1104, Citadel start wasn't wrapped yet.
content = content.replace(
    /(Citadel Strategic Hub\s+<\/Text>\s+<\/View>\s+<\/View>\s+<TouchableOpacity[\s\S]+?<\/TouchableOpacity>\s+<\/View>\s+)<View className="overflow-visible">/,
    '$1<ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>'
);
content = content.replace(
    /(citadelList\.map\([\s\S]+?\}\)\})\s+<\/View>\s+<\/View>\s+<\/View>\s+\) : \(\(\) => \{/,
    '$1\n                                                    </ScrollView>\n                                                </View>\n                                            </View>\n                                        ) : (() => {'
);

// 3. Date Range (Check if it's already done)
// Based on Step 1090 it should be.

// 4. Alliance Slots (Check if it's already done)
// Based on Step 1090 it should be.

fs.writeFileSync(path, content);
console.log('Structural balance applied');
