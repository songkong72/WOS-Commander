const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../assets/images/skill-icons');
const files = fs.readdirSync(iconsDir);
let brokenCount = 0;

console.log(`Scanning ${files.length} files in ${iconsDir}...`);

files.forEach(file => {
    const filePath = path.join(iconsDir, file);
    const stats = fs.statSync(filePath);

    // Check for empty or very small files (less than 100 bytes is suspicious for an image)
    if (stats.size < 100 && file.endsWith('.png')) {
        console.log(`Found broken file: ${file} (${stats.size} bytes). Deleting...`);
        try {
            fs.unlinkSync(filePath);
            brokenCount++;
        } catch (e) {
            console.error(`Failed to delete ${file}:`, e);
        }
    }
});

console.log(`Cleanup complete. Deleted ${brokenCount} broken files.`);

if (brokenCount > 0) {
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
    console.log('No broken files found.');
}
