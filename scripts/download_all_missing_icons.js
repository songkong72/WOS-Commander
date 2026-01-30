const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const heroesPath = path.join(__dirname, '../data/heroes.json');
const iconsDir = path.join(__dirname, '../assets/images/skill-icons');

// Known S3 base URLs to try (from newest to oldest)
const baseUrls = [
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/06/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/04/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/02/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/01/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/12/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/08/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/07/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/06/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/04/'
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve(true));
                });
            } else {
                fs.unlink(dest, () => { }); // Delete empty file
                resolve(false);
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            resolve(false);
        });
    });
}

async function main() {
    const heroesData = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));
    const missingIcons = new Set();

    // Collect all icon filenames
    heroesData.forEach(hero => {
        // Hero image
        if (hero.image && !fs.existsSync(path.join(iconsDir, hero.image))) {
            // Hero portraits might be in a different folder, but checking just in case
        }

        if (hero.skills) {
            ['exploration', 'expedition', 'special'].forEach(type => {
                if (hero.skills[type]) {
                    hero.skills[type].forEach(skill => {
                        if (skill.icon) missingIcons.add(skill.icon);
                    });
                }
            });
        }
        if (hero.equipment && hero.equipment.icon) {
            missingIcons.add(hero.equipment.icon);
            if (hero.equipment.skills) {
                hero.equipment.skills.forEach(skill => {
                    if (skill.icon) missingIcons.add(skill.icon);
                });
            }
        }
    });

    // Check availability locally
    const toDownload = [];
    missingIcons.forEach(icon => {
        if (!fs.existsSync(path.join(iconsDir, icon))) {
            toDownload.push(icon);
        }
    });

    console.log(`Found ${toDownload.length} missing icons. Starting download...`);

    for (const icon of toDownload) {
        let downloaded = false;
        console.log(`Trying to find: ${icon}`);

        for (const baseUrl of baseUrls) {
            const url = baseUrl + icon;
            const dest = path.join(iconsDir, icon);

            // Try downloading
            const success = await downloadFile(url, dest);
            if (success) {
                console.log(`  [OK] Downloaded from ${baseUrl}`);
                downloaded = true;
                break;
            }
        }

        if (!downloaded) {
            console.log(`  [FAILED] Could not find ${icon} in any known paths.`);
        }
    }

    console.log('Download process completed.');

    // Regenerate index
    console.log('Regenerating skill icons index...');
    try {
        const scriptPath = path.join(__dirname, 'generate_skill_icons_index.js');
        execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error('Failed to regenerate index:', e);
    }
}

main();
