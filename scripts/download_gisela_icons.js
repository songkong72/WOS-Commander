const fs = require('fs');
const path = require('path');
const https = require('https');

const icons = [
    'hero_skill_icon_500501.png',
    'hero_skill_icon_500502.png',
    'hero_skill_icon_500503.png',
    'hero_skill_icon_500504.png',
    'hero_skill_icon_500505.png',
    'hero_skill_icon_500506.png',
    'hero_skill_icon_500507.png',
    'hero_skill_icon_500508.png'
];

const iconsDir = path.join(__dirname, '../assets/images/skill-icons');

const baseUrls = [
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/11/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/10/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/09/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/06/',
    'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/',
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
                fs.unlink(dest, () => { });
                resolve(false);
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            resolve(false);
        });
    });
}

async function main() {
    console.log('Downloading Gisela skill icons...\n');

    for (const icon of icons) {
        console.log(`Trying to find: ${icon}`);
        let found = false;

        for (const baseUrl of baseUrls) {
            const url = baseUrl + icon;
            const dest = path.join(iconsDir, icon);

            if (await downloadFile(url, dest)) {
                console.log(`  [OK] Downloaded from ${baseUrl}`);
                found = true;
                break;
            }
        }

        if (!found) {
            console.log(`  [FAILED] Could not find ${icon}`);
        }
    }

    console.log('\nDone! Now updating heroes.json...');

    // Update heroes.json with correct icon names
    const heroesPath = path.join(__dirname, '../data/heroes.json');
    const heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));

    const gisela = heroes.find(h => h.id === 'gisela');
    if (gisela && gisela.skills) {
        // Update exploration skills
        if (gisela.skills.exploration) {
            gisela.skills.exploration.forEach((skill, i) => {
                const iconNum = 500501 + i;
                skill.icon = `hero_skill_icon_${iconNum}.png`;
            });
        }
        // Update expedition skills  
        if (gisela.skills.expedition) {
            const startNum = 500504;
            gisela.skills.expedition.forEach((skill, i) => {
                const iconNum = startNum + i;
                skill.icon = `hero_skill_icon_${iconNum}.png`;
            });
        }
        // Update equipment skills
        if (gisela.equipment && gisela.equipment.skills) {
            gisela.equipment.skills.forEach((skill, i) => {
                const iconNum = 500507 + i;
                skill.icon = `hero_skill_icon_${iconNum}.png`;
            });
        }
    }

    fs.writeFileSync(heroesPath, JSON.stringify(heroes, null, 4));
    console.log('Updated heroes.json for Gisela!');
}

main();
