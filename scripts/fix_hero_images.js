const fs = require('fs');
const path = require('path');
const https = require('https');

const imagesDir = path.join(__dirname, '../assets/images/heroes');

// URL 매핑 (중국어 URL -> 영문 파일명)
const imageMappings = [
    // S15
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E6%B1%89%E5%85%8B.png',
        filename: 'hank.png'
    },
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E8%89%be%E6%96%AF%E9%BB%9B%E6%8B%89%EF%BC%88%E7%94%BB%E5%AE%B6%EF%BC%89.png',
        filename: 'estella.png'
    },
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E7%BB%B4%E8%96%87%E5%8D%A1.png',
        filename: 'vivica.png'
    },
    // S14
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/Elif.png',
        filename: 'elif.png'
    },
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/Dominic.png',
        filename: 'dominica.png'
    },
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/cara.png',
        filename: 'cara.png'
    },
    // S13
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fgisela.jpg',
        filename: 'gisela.png' // png로 통일
    },
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FFlora.jpg',
        filename: 'flora.png'
    },
    {
        url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fvulcanus.jpg',
        filename: 'vulcanus.png'
    }
];

if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

const downloadImage = (url, filename) => {
    const dest = path.join(imagesDir, filename);
    const file = fs.createWriteStream(dest);

    console.log(`Downloading ${filename}...`);

    https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Completed: ${filename}`);
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => { });
        console.error(`Error downloading ${filename}: ${err.message}`);
    });
};

imageMappings.forEach(mapping => {
    // URL에 한글/한자가 포함되어 있으므로 encodeURI 사용
    const encodedUrl = encodeURI(mapping.url);
    downloadImage(encodedUrl, mapping.filename);
});

// heroes.json 업데이트
const heroesFile = path.join(__dirname, '../data/heroes.json');
const heroes = require(heroesFile);
let updated = false;

const heroImageMap = {
    'hank': 'hank.png',
    'estella': 'estella.png',
    'vivica': 'vivica.png',
    'elif': 'elif.png',
    'dominica': 'dominica.png',
    'cara': 'cara.png',
    'gisela': 'gisela.png',
    'flora': 'flora.png',
    'vulcanus': 'vulcanus.png'
};

heroes.forEach(hero => {
    if (heroImageMap[hero.id]) {
        if (hero.image !== heroImageMap[hero.id]) {
            console.log(`Updating image for ${hero.id}: ${hero.image} -> ${heroImageMap[hero.id]}`);
            hero.image = heroImageMap[hero.id];
            updated = true;
        }
    }
});

if (updated) {
    fs.writeFileSync(heroesFile, JSON.stringify(heroes, null, 4), 'utf8');
    console.log('heroes.json updated successfully.');
} else {
    console.log('heroes.json is already up to date.');
}
