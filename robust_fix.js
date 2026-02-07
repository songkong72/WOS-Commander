const fs = require('fs');
const path = 'app/growth/events.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix HeroPicker structure accurately
content = content.replace(
    /\s+\}\)\s+<\/ScrollView>\s+<\/View>\s+\)\s+\}\s+\}\s+<\/View >\s+/,
    '\n                        })}\n                    </ScrollView>\n                </View>\n            )}\n        </View>\n    '
);

// 2. Fix the messy line 2392
// 2392:                             </ScrollView></View></ScrollView>) : (
content = content.replace(/<\/ScrollView><\/View><\/ScrollView>\) : \(/g, '</View></ScrollView>) : (');

// 3. Check for other unbalanced tags introduced by scripts
// Alliance Slots closing branch?
// Usually it ends with </ScrollView></View> before the footer

fs.writeFileSync(path, content);
console.log('Robust syntax fixes applied');
