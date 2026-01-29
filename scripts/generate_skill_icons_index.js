const fs = require('fs');
const path = require('path');

const skillIconsDir = path.join(__dirname, '../assets/images/skill-icons');
const files = fs.readdirSync(skillIconsDir);

// Generate TypeScript index file
let tsContent = '// Auto-generated skill icons index\n\n';
tsContent += 'export const skillIcons: { [key: string]: any } = {\n';

files.forEach(file => {
    if (file.endsWith('.png')) {
        const name = file.replace('.png', '');
        tsContent += `  '${file}': require('./${file}'),\n`;
    }
});

tsContent += '};\n';

fs.writeFileSync(path.join(skillIconsDir, 'index.ts'), tsContent);
console.log(`Generated index.ts with ${files.length} skill icons`);
