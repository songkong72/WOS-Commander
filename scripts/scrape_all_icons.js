const fs = require('fs');
const path = require('path');
const https = require('https');

const targetHeroes = [
    // S1-S8 (Already mostly done, but keeping for safety)
    { id: 'hector', url: 'https://www.whiteoutsurvival.wiki/heroes/hector/' },
    { id: 'gwen', url: 'https://www.whiteoutsurvival.wiki/heroes/gwen-2/' },
    { id: 'magnus', url: 'https://www.whiteoutsurvival.wiki/heroes/magnus/' },
    { id: 'fred', url: 'https://www.whiteoutsurvival.wiki/heroes/fred/' },
    { id: 'sonia', url: 'https://www.whiteoutsurvival.wiki/heroes/sonya/' },
    // Basic/Epic
    { id: 'eugene', url: 'https://www.whiteoutsurvival.wiki/heroes/eugene/' },
    { id: 'cloris', url: 'https://www.whiteoutsurvival.wiki/heroes/cloris-2/' },
    { id: 'charlie', url: 'https://www.whiteoutsurvival.wiki/heroes/charlie/' },
    { id: 'jere', url: 'https://www.whiteoutsurvival.wiki/heroes/jasser/' }, // Jere maps to Jasser in Wiki
    // S9-S15
    { id: 'seurat', url: 'https://www.whiteoutsurvival.wiki/heroes/seurat/' },
    { id: 'gregory', url: 'https://www.whiteoutsurvival.wiki/heroes/greg/' },
    { id: 'freya', url: 'https://www.whiteoutsurvival.wiki/heroes/freya/' },
    { id: 'blanche', url: 'https://www.whiteoutsurvival.wiki/heroes/blanche/' },
    { id: 'eleonora', url: 'https://www.whiteoutsurvival.wiki/heroes/eleonora/' },
    { id: 'lloyd', url: 'https://www.whiteoutsurvival.wiki/heroes/lloyd/' },
    { id: 'rufus', url: 'https://www.whiteoutsurvival.wiki/heroes/rufus/' },
    { id: 'hervor', url: 'https://www.whiteoutsurvival.wiki/heroes/hervor/' },
    { id: 'karol', url: 'https://www.whiteoutsurvival.wiki/heroes/karol/' },
    { id: 'ligeia', url: 'https://www.whiteoutsurvival.wiki/heroes/ligeia/' },
    { id: 'gisela', url: 'https://www.whiteoutsurvival.wiki/heroes/gisela/' },
    { id: 'flora', url: 'https://www.whiteoutsurvival.wiki/heroes/flora/' },
    { id: 'vulcanus', url: 'https://www.whiteoutsurvival.wiki/heroes/vulcanus/' },
    { id: 'elif', url: 'https://www.whiteoutsurvival.wiki/heroes/elif/' },
    { id: 'dominica', url: 'https://www.whiteoutsurvival.wiki/heroes/dominica/' },
    { id: 'cara', url: 'https://www.whiteoutsurvival.wiki/heroes/cara/' },
    { id: 'hank', url: 'https://www.whiteoutsurvival.wiki/heroes/hank/' },
    { id: 'estella', url: 'https://www.whiteoutsurvival.wiki/heroes/estella/' },
    { id: 'vivica', url: 'https://www.whiteoutsurvival.wiki/heroes/vivica/' }
];

const destDir = path.join(__dirname, '../assets/images/skill-icons');

async function downloadFile(url, dest) {
    if (fs.existsSync(dest)) return; // Already have it
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status ${res.statusCode}`));
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

async function scrapeHero(hero) {
    console.log(`Scraping ${hero.id}...`);
    return new Promise((resolve) => {
        https.get(hero.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', async () => {
                const skillRegex = /https:\/\/gom-s3-user-avatar\.s3\.us-west-2\.amazonaws\.com\/wp-content\/uploads\/[^\s"']+\/hero_skill_icon_\d+\.png/g;
                const equipRegex = /https:\/\/gom-s3-user-avatar\.s3\.us-west-2\.amazonaws\.com\/wp-content\/uploads\/[^\s"']+\/equipment_icon_\d+\.png/g;
                const matches = [...(data.match(skillRegex) || []), ...(data.match(equipRegex) || [])];
                const uniqueUrls = [...new Set(matches)];

                for (const url of uniqueUrls) {
                    const filename = path.basename(url);
                    const destPath = path.join(destDir, filename);
                    try {
                        await downloadFile(url, destPath);
                    } catch (e) { }
                }
                resolve();
            });
        }).on('error', () => resolve());
    });
}

async function run() {
    for (const hero of targetHeroes) {
        await scrapeHero(hero);
    }
    console.log('Final scraping finished. Regenerating index...');
    try {
        require('child_process').execSync('node scripts/generate_skill_icons_index.js', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
    } catch (e) { }
}

run();
