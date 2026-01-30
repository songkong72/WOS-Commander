const fs = require('fs');
const path = require('path');
const https = require('https');

const icons = [
    'hero_skill_icon_501511.png',
    'hero_skill_icon_501512.png',
    'hero_skill_icon_501513.png',
    'hero_skill_icon_501514.png',
    'hero_skill_icon_501515.png',
    'hero_skill_icon_501516.png',
    'equipment_icon_1050151.png',
    'hero_skill_icon_501517.png',
    'hero_skill_icon_501518.png'
];

const dates = [
    '2023/05', '2023/04', '2023/03', '2023/02', '2023/01',
    '2022/12', '2022/11', '2022/10',
    '2024/01', '2024/02', '2024/03'
];

const baseUrl = 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/';
const destDir = path.join(__dirname, '../assets/images/skill-icons');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const downloadFile = (icon) => {
    return new Promise(async (resolve, reject) => {
        for (const date of dates) {
            const url = `${baseUrl}${date}/${icon}`;
            try {
                const available = await checkUrl(url);
                if (available) {
                    console.log(`Found ${icon} at ${url}`);
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
        console.log(`Could not find ${icon}`);
        resolve(false);
    });
};

const checkUrl = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'HEAD' }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', reject);
        req.end();
    });
};

const main = async () => {
    for (const icon of icons) {
        await downloadFile(icon);
    }
};

main();
