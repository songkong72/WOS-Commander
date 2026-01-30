const fs = require('fs');
const path = require('path');
const https = require('https');

const downloadDir = path.join(__dirname, '../assets/images/skill-icons');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

const images = [
    // Exploration Skills
    { name: 'hero_skill_icon_500321.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500321.png' },
    { name: 'hero_skill_icon_500322.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500322.png' },
    { name: 'hero_skill_icon_500323.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500323.png' },

    // Expedition Skills
    { name: 'hero_skill_icon_500324.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500324.png' },
    { name: 'hero_skill_icon_500325.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500325.png' },
    { name: 'hero_skill_icon_500326.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500326.png' },

    // Exclusive Equipment (Special)
    { name: 'equipment_icon_1050032-1.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/01/equipment_icon_1050032-1.png' },
    { name: 'hero_skill_icon_500327.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500327.png' },
    { name: 'hero_skill_icon_500328.png', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/hero_skill_icon_500328.png' }
];

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status code ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

async function run() {
    console.log('Downloading Edith images...');
    for (const img of images) {
        const filepath = path.join(downloadDir, img.name);
        try {
            await downloadImage(img.url, filepath);
            console.log(`✓ Downloaded ${img.name}`);
        } catch (error) {
            console.error(`✗ Failed to download ${img.name}:`, error.message);
        }
    }
    console.log('Done.');
}

run();
