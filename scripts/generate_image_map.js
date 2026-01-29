const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../assets/images/heroes');
const OUTPUT_FILE = path.join(__dirname, '../assets/images/heroes/index.ts');

const files = fs.readdirSync(IMAGES_DIR).filter(f => f.match(/\.(png|jpg|jpeg)$/));

const content = `// Auto-generated mapping
export const heroImages: { [key: string]: any } = {
${files.map(f => `    '${f}': require('./${f}'),`).join('\n')}
};
`;

fs.writeFileSync(OUTPUT_FILE, content);
console.log('Generated index.ts');
