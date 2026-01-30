const fs = require('fs');
const path = require('path');
const https = require('https');

const HEROES_LIST_URL = 'https://www.whiteoutsurvival.wiki/ko/heroes/';
const ICONS_DIR = path.join(__dirname, '../assets/images/skill-icons');

if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function downloadImage(url, dest) {
    if (fs.existsSync(dest)) return;
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('Fetching hero list...');
    const listHtml = await fetchHtml(HEROES_LIST_URL);

    // Extract hero detail page links
    const heroLinkRegex = /https:\/\/www\.whiteoutsurvival\.wiki\/ko\/heroes\/[^\/\s"']+\//g;
    const heroLinks = [...new Set(listHtml.match(heroLinkRegex))].filter(link => link !== HEROES_LIST_URL);

    console.log(`Found ${heroLinks.length} hero pages. Starting scrape...`);

    for (const link of heroLinks) {
        console.log(`Scraping hero page: ${link}...`);
        try {
            const heroHtml = await fetchHtml(link);

            // Extract skill and equipment icon URLs
            const skillRegex = /https:\/\/gom-s3-user-avatar\.s3\.us-west-2\.amazonaws\.com\/wp-content\/uploads\/[^\s"']+\/hero_skill_icon_\d+\.png/g;
            const equipRegex = /https:\/\/gom-s3-user-avatar\.s3\.us-west-2\.amazonaws\.com\/wp-content\/uploads\/[^\s"']+\/equipment_icon_\d+\.png/g;

            const matches = [...(heroHtml.match(skillRegex) || []), ...(heroHtml.match(equipRegex) || [])];
            const uniqueUrls = [...new Set(matches)];

            for (const url of uniqueUrls) {
                const filename = path.basename(url);
                const destPath = path.join(ICONS_DIR, filename);
                try {
                    await downloadImage(url, destPath);
                    console.log(`  Downloaded: ${filename}`);
                } catch (e) {
                    // Skip failed downloads silently
                }
            }
        } catch (e) {
            console.error(`  Failed to scrape ${link}: ${e.message}`);
        }
    }

    console.log('Scraping complete. Regenerating index...');
    try {
        require('child_process').execSync('node scripts/generate_skill_icons_index.js', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
    } catch (e) {
        console.error('Failed to regenerate index:', e.message);
    }
}

run();
