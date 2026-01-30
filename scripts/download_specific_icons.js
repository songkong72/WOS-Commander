const fs = require('fs');
const path = require('path');
const https = require('https');

const missingIcons = [
    'hero_skill_icon_500458-1.png'
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
    console.log('Downloading missing valid skill icons...\n');

    for (const icon of missingIcons) {
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

    console.log('\nDone!');
}

main();
