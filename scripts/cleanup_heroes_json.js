const fs = require('fs');
const path = require('path');

const heroesFile = path.join(__dirname, '../data/heroes.json');
const heroes = require(heroesFile);

console.log(`Original count: ${heroes.length}`);

const uniqueHeroes = [];
const seenIds = new Set();
const seenNames = new Set();

heroes.forEach(hero => {
    // ID 중복 체크
    if (seenIds.has(hero.id)) {
        console.log(`[DELETE] Removing duplicate ID: ${hero.id} (${hero.name})`);
        return;
    }

    // 이름 체크 (기젤라 중복 제거를 위해)
    // 단, 이름이 같아도 ID가 다르면 다른 영웅일 수 있으나, 현재 상황에서는 기젤라가 문제임.
    // 기젤라일 경우 이미 등록된 게 있으면 스킵
    if (hero.name === '기젤라' && seenNames.has('기젤라')) {
        console.log(`[DELETE] Removing duplicate Name: ${hero.name} (ID: ${hero.id})`);
        return;
    }

    seenIds.add(hero.id);
    seenNames.add(hero.name);
    uniqueHeroes.push(hero);
});

console.log(`New count: ${uniqueHeroes.length}`);

// 파일 저장
fs.writeFileSync(heroesFile, JSON.stringify(uniqueHeroes, null, 4), 'utf8');
console.log('heroes.json cleaned and overwritten.');
