const fs = require('fs');
const path = require('path');
const https = require('https');

// 기젤라 스킬 아이콘 URLs (위키에서 확인)
const icons = [
    { file: 'hero_skill_icon_500501.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500501.png' },
    { file: 'hero_skill_icon_500502.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500502.png' },
    { file: 'hero_skill_icon_500503.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500503.png' },
    { file: 'hero_skill_icon_500504.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500504.png' },
    { file: 'hero_skill_icon_500505.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500505.png' },
    { file: 'hero_skill_icon_500506.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500506.png' },
    { file: 'hero_skill_icon_500507.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500507.png' },
    { file: 'hero_skill_icon_500508.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/hero_skill_icon_500508.png' }
];

const iconsDir = path.join(__dirname, '../assets/images/skill-icons');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(true);
                });
            } else {
                fs.unlink(dest, () => { });
                resolve(false);
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function main() {
    console.log('Downloading Gisela skill icons from wiki...\n');

    let success = 0;
    let failed = 0;

    for (const icon of icons) {
        const dest = path.join(iconsDir, icon.file);
        console.log(`Downloading ${icon.file}...`);

        try {
            const result = await downloadFile(icon.url, dest);
            if (result) {
                console.log(`  [OK] ${icon.file}`);
                success++;
            } else {
                console.log(`  [FAILED] ${icon.file}`);
                failed++;
            }
        } catch (err) {
            console.log(`  [ERROR] ${icon.file}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDownload complete!`);
    console.log(`Success: ${success}, Failed: ${failed}`);

    // Regenerate index
    console.log('\nRegenerating skill icons index...');
    require('./generate_skill_icons_index.js');
}

main();
