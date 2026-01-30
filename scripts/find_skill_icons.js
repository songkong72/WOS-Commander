
const https = require('https');

const icons = ['hero_skill_icon_501811.png', 'hero_skill_icon_501812.png', 'hero_skill_icon_501813.png'];
const years = [2023, 2024, 2025, 2026];
const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

function checkUrl(url) {
    return new Promise((resolve) => {
        https.request(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => resolve(false)).end();
    });
}

async function run() {
    for (const icon of icons) {
        console.log(`Checking ${icon}...`);
        let found = false;
        for (const year of years) {
            for (const month of months) {
                const url = `https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/${year}/${month}/${icon}`;
                if (await checkUrl(url)) {
                    console.log(`  FOUND: ${url}`);
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!found) console.log(`  NOT FOUND: ${icon}`);
    }
}

run();
