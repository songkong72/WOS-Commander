const fs = require('fs');
const path = require('path');
const https = require('https');

const icons = [
    { name: 'hero_skill_icon_500251.png', date: '2023/10' },
    { name: 'hero_skill_icon_500252.png', date: '2023/10' },
    { name: 'hero_skill_icon_500253.png', date: '2023/10' },
    { name: 'hero_skill_icon_500254.png', date: '2023/10' },
    { name: 'hero_skill_icon_500255.png', date: '2023/10' },
    { name: 'hero_skill_icon_500256.png', date: '2023/10' },
    { name: 'hero_skill_icon_500257.png', date: '2023/10' },
    { name: 'hero_skill_icon_500258.png', date: '2023/10' },
    { name: 'equipment_icon_1050025.png', date: '2024/01' } // HTML says 2024/01/equipment_icon_1050025.png
];

const baseUrl = 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/';
const destDir = path.join(__dirname, '../assets/images/skill-icons');

const downloadFile = (iconInfo) => {
    return new Promise((resolve, reject) => {
        const url = `${baseUrl}${iconInfo.date}/${iconInfo.name}`;
        console.log(`Downloading ${iconInfo.name} from ${url}`);

        const file = fs.createWriteStream(path.join(destDir, iconInfo.name));
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`[SUCCESS] ${iconInfo.name}`);
                    resolve(true);
                });
            } else {
                console.log(`[FAILED] ${iconInfo.name} Status: ${response.statusCode}`);
                file.close();
                fs.unlink(path.join(destDir, iconInfo.name), () => { }); // delete empty file
                resolve(false);
            }
        }).on('error', (err) => {
            console.log(`[ERROR] ${iconInfo.name} ${err.message}`);
            resolve(false);
        });
    });
};

const main = async () => {
    console.log('Starting Nora icon download...');
    for (const icon of icons) {
        await downloadFile(icon);
    }
    console.log('Download complete.');
};

main();
