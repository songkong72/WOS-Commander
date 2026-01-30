const fs = require('fs');
const path = require('path');

const heroesFile = path.join(__dirname, '../data/heroes.json');
const heroes = require(heroesFile);
const imagesDir = path.join(__dirname, '../assets/images/heroes');

// S13 영웅: .png -> .jpg 복구
const fixMap = {
    'gisela': { from: 'gisela.png', to: 'gisela.jpg' },
    'flora': { from: 'flora.png', to: 'flora.jpg' },
    'vulcanus': { from: 'vulcanus.png', to: 'vulcanus.jpg' }
};

let jsonUpdated = false;

// 1. JSON 업데이트
heroes.forEach(hero => {
    if (fixMap[hero.id]) {
        if (hero.image === fixMap[hero.id].from) {
            hero.image = fixMap[hero.id].to;
            jsonUpdated = true;
            console.log(`Updated JSON for ${hero.id}: ${fixMap[hero.id].from} -> ${fixMap[hero.id].to}`);
        }
    }
});

if (jsonUpdated) {
    fs.writeFileSync(heroesFile, JSON.stringify(heroes, null, 4), 'utf8');
    console.log('heroes.json updated.');
}

// 2. 파일 이름 변경 (png -> jpg)
Object.keys(fixMap).forEach(id => {
    const fromPath = path.join(imagesDir, fixMap[id].from);
    const toPath = path.join(imagesDir, fixMap[id].to);

    // png 파일이 존재하면 jpg로 이름 변경 (내용은 이미 jpg이므로 확장자만 변경)
    if (fs.existsSync(fromPath)) {
        // 이미 toPath가 있으면 fromPath 삭제, 없으면 rename
        if (fs.existsSync(toPath)) {
            fs.unlinkSync(fromPath);
            console.log(`Removed duplicate ${fixMap[id].from}, keeping ${fixMap[id].to}`);
        } else {
            fs.renameSync(fromPath, toPath);
            console.log(`Renamed file: ${fixMap[id].from} -> ${fixMap[id].to}`);
        }
    } else if (!fs.existsSync(toPath)) {
        console.warn(`Warning: Image for ${id} not found (${fixMap[id].from} or ${fixMap[id].to})`);
    }
});
