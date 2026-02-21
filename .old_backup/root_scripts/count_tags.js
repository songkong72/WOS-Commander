const fs = require('fs');
const path = 'app/growth/events.tsx';
const content = fs.readFileSync(path, 'utf8');

const scrollOpens = (content.match(/<ScrollView/g) || []).length;
const scrollCloses = (content.match(/<\/ScrollView>/g) || []).length;
const viewOpens = (content.match(/<View/g) || []).length;
const viewCloses = (content.match(/<\/View>/g) || []).length;

console.log(`ScrollView: ${scrollOpens} / ${scrollCloses}`);
console.log(`View: ${viewOpens} / ${viewCloses}`);

if (scrollOpens === scrollCloses && viewOpens === viewCloses) {
    console.log('All tags are balanced!');
} else {
    console.log('WARNING: Unbalanced tags detected!');
}
