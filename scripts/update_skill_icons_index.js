const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../assets/images/skill-icons');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

let content = '// Auto-generated mapping\n';
content += 'export const skillIcons: { [key: string]: any } = {\n';

files.forEach(file => {
    content += `  '${file}': require('./${file}'),\n`;
});

content += '};\n';

fs.writeFileSync(path.join(dir, 'index.ts'), content);
console.log('Skill icons index updated successfully with ' + files.length + ' icons.');
