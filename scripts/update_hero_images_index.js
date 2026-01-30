const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../assets/images/heroes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

let content = '// Auto-generated mapping\n';
content += 'export const heroImages: { [key: string]: any } = {\n';

files.forEach(file => {
    content += `    '${file}': require('./${file}'),\n`;
});

content += '};\n';

fs.writeFileSync(path.join(dir, 'index.ts'), content);
console.log('Hero images index updated successfully with ' + files.length + ' images.');
