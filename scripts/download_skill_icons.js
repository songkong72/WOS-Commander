const fs = require('fs');
const path = require('path');
const https = require('https');

const heroesData = require('../data/heroes.json');

// Create skill icons directory
const skillIconsDir = path.join(__dirname, '../assets/images/skill-icons');
if (!fs.existsSync(skillIconsDir)) {
    fs.mkdirSync(skillIconsDir, { recursive: true });
}

// Collect all unique skill icons
const skillIcons = new Set();

heroesData.forEach(hero => {
    if (hero.skills) {
        // Exploration skills
        if (hero.skills.exploration) {
            hero.skills.exploration.forEach(skill => {
                if (skill.icon) skillIcons.add(skill.icon);
            });
        }
        // Expedition skills
        if (hero.skills.expedition) {
            hero.skills.expedition.forEach(skill => {
                if (skill.icon) skillIcons.add(skill.icon);
            });
        }
        // Special skills
        if (hero.skills.special) {
            hero.skills.special.forEach(skill => {
                if (skill.icon) skillIcons.add(skill.icon);
            });
        }
    }

    // Equipment skills
    if (hero.equipment && hero.equipment.skills) {
        hero.equipment.skills.forEach(skill => {
            if (skill.icon) skillIcons.add(skill.icon);
        });
    }

    // Equipment icon
    if (hero.equipment && hero.equipment.icon) {
        skillIcons.add(hero.equipment.icon);
    }
});

console.log(`Found ${skillIcons.size} unique skill icons to download`);

// Download function
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
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

// Download all icons
let downloaded = 0;
let failed = 0;

async function downloadAll() {
    for (const icon of skillIcons) {
        const filename = icon;
        const filepath = path.join(skillIconsDir, filename);

        // Skip if already exists
        if (fs.existsSync(filepath)) {
            console.log(`Skipping ${filename} (already exists)`);
            continue;
        }

        // Try different base URLs
        const baseUrls = [
            'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/04/',
            'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/01/',
            'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/',
        ];

        let success = false;
        for (const baseUrl of baseUrls) {
            try {
                const url = baseUrl + filename;
                console.log(`Downloading ${filename} from ${baseUrl}...`);
                await downloadImage(url, filepath);
                downloaded++;
                success = true;
                console.log(`✓ Downloaded ${filename}`);
                break;
            } catch (err) {
                // Try next URL
            }
        }

        if (!success) {
            console.log(`✗ Failed to download ${filename}`);
            failed++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nDownload complete!`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${skillIcons.size}`);
}

downloadAll().catch(console.error);
