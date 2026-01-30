const fs = require('fs');
const path = require('path');

const heroesDir = path.join(__dirname, '../assets/images/heroes');
const indexFile = path.join(heroesDir, 'index.ts');

const files = fs.readdirSync(heroesDir).filter(file => file.endsWith('.png') || file.endsWith('.jpg'));

let content = `// Auto-generated hero images index\n\n`;
content += `export const heroImages: { [key: string]: any } = {\n`;

files.forEach(file => {
    content += `    '${file}': require('./${file}'),\n`;
});

content += `};\n`;

fs.writeFileSync(indexFile, content);
console.log(`Generated index.ts with ${files.length} images.`);
