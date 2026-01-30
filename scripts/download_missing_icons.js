const fs = require('fs');
const path = require('path');
const https = require('https');

// S5 Heroes Icon IDs (from heroes.json)
const icons = [
    // Hector (S5)
    'hero_skill_icon_501511.png', 'hero_skill_icon_501512.png', 'hero_skill_icon_501513.png',
    'hero_skill_icon_501514.png', 'hero_skill_icon_501515.png', 'hero_skill_icon_501516.png',
    'equipment_icon_1050151.png', 'hero_skill_icon_501517.png', 'hero_skill_icon_501518.png',

    // Nora (S5)
    'hero_skill_icon_501611.png', 'hero_skill_icon_501612.png', 'hero_skill_icon_501613.png',
    'hero_skill_icon_501614.png', 'hero_skill_icon_501615.png', 'hero_skill_icon_501616.png',
    'equipment_icon_1050161.png', 'hero_skill_icon_501617.png', 'hero_skill_icon_501618.png',

    // Gwen (S5)
    'hero_skill_icon_501711.png', 'hero_skill_icon_501712.png', 'hero_skill_icon_501713.png',
    'hero_skill_icon_501714.png', 'hero_skill_icon_501715.png', 'hero_skill_icon_501716.png',
    'equipment_icon_1050171.png', 'hero_skill_icon_501717.png', 'hero_skill_icon_501718.png',

    // User mentioned ID (just in case)
    'hero_skill_icon_500251.png'
];

// User found one in 2023/10, so let's expand the search
const dates = [
    '2023/10', '2023/11', '2023/12',
    '2023/09', '2023/08', '2023/07', '2023/06', '2023/05',
    '2024/01', '2024/02'
];

const baseUrl = 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/';
const destDir = path.join(__dirname, '../assets/images/skill-icons');

const checkUrl = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'HEAD' }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', (err) => resolve(false));
        req.end();
    });
};

const downloadFile = (icon) => {
    return new Promise(async (resolve, reject) => {
        for (const date of dates) {
            const url = `${baseUrl}${date}/${icon}`;
            try {
                const available = await checkUrl(url);
                if (available) {
                    console.log(`[FOUND] ${icon} at ${url}`);
                    const file = fs.createWriteStream(path.join(destDir, icon));
                    https.get(url, (response) => {
                        response.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve(true);
                        });
                    });
                    return;
                }
            } catch (e) {
                // ignore
            }
        }
        console.log(`[RequestFailed] Could not find ${icon}`);
        resolve(false);
    });
};

const main = async () => {
    console.log('Starting search for icons...');
    for (const icon of icons) {
        await downloadFile(icon);
    }
    console.log('Search complete.');
};

main();
