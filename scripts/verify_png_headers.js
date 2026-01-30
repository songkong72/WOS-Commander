const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../assets/images/skill-icons');
const files = fs.readdirSync(iconsDir);
let badCount = 0;

console.log(`Verifying PNG headers for ${files.length} files...`);

files.forEach(file => {
    if (!file.endsWith('.png')) return;

    const filePath = path.join(iconsDir, file);
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
        console.log(`[BAD FILE] ${file} is not a valid PNG (Header: ${buffer.toString('hex')}). Deleting...`);
        try {
            fs.unlinkSync(filePath);
            badCount++;
        } catch (e) {
            console.error(`Failed to delete ${file}:`, e);
        }
    }
});

console.log(`Verification complete. Deleted ${badCount} invalid files.`);

if (badCount > 0) {
    console.log('Regenerating index.ts...');
    try {
        require('child_process').execSync('node scripts/generate_skill_icons_index.js', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
    } catch (e) {
        console.error('Failed to regenerate index:', e);
    }
} else {
    console.log('All files are valid PNGs.');
}
