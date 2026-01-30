const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// S6-S15 영웅 목록
const heroes = [
    // S6
    'wuming', 'rene', 'wayne',
    // S7
    'edith', 'gordon', 'bradley',
    // S8
    'gato', 'sonya', 'hendrick',
    // S9
    'magnus', 'fred', 'xura',
    // S10
    'gregory', 'freya', 'blanchette',
    // S11
    'eleonora', 'lloyd', 'rufus',
    // S12
    'hervor', 'garoal', 'ligeia',
    // S13
    'flora', 'vulcanus',
    // S14
    'elif', 'dominica', 'cara',
    // S15
    'hank', 'estella', 'vivica'
];

const heroesJsonPath = path.join(__dirname, '../data/heroes.json');
const heroesData = JSON.parse(fs.readFileSync(heroesJsonPath, 'utf8'));

function extractSkillInfo(htmlPath) {
    if (!fs.existsSync(htmlPath)) {
        console.log(`[SKIP] ${htmlPath} not found`);
        return null;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html);

    const skillIcons = [];
    const skillInfo = {
        exploration: [],
        expedition: [],
        equipment: { skills: [] }
    };

    // 탐험 스킬 추출
    $('#exploration-skills .bg-dark').each((i, elem) => {
        const $elem = $(elem);
        const icon = $elem.find('img').attr('src');
        const name = $elem.find('h5').text().trim();
        const desc = $elem.find('p').text().trim();

        if (icon && name) {
            const iconFilename = icon.split('/').pop();
            skillIcons.push(iconFilename);
            skillInfo.exploration.push({ name, desc, icon: iconFilename });
        }
    });

    // 원정 스킬 추출
    $('#expedition-skills .bg-dark').each((i, elem) => {
        const $elem = $(elem);
        const icon = $elem.find('img').attr('src');
        const name = $elem.find('h5').text().trim();
        const desc = $elem.find('p').text().trim();

        if (icon && name) {
            const iconFilename = icon.split('/').pop();
            skillIcons.push(iconFilename);
            skillInfo.expedition.push({ name, desc, icon: iconFilename });
        }
    });

    // 장비 스킬 추출
    $('#special .row img').each((i, elem) => {
        const icon = $(elem).attr('src');
        // hero_skill_icon 외에도 IMG_, Dominic_ 등 다양한 패턴 허용 (혹은 필터링 제거)
        if (icon) {
            const iconFilename = icon.split('/').pop();
            skillIcons.push(iconFilename);

            // 스킬 이름과 설명 찾기
            const $parent = $(elem).closest('.row');
            const name = $parent.find('h5').text().trim();
            const desc = $parent.find('p').text().trim();

            if (name) {
                skillInfo.equipment.skills.push({ name, desc, icon: iconFilename });
            }
        }
    });

    return { skillIcons, skillInfo };
}

console.log('Parsing wiki pages for skill information...\n');

const allSkillIcons = new Set();
const updatedHeroes = [];

for (const heroId of heroes) {
    const htmlPath = path.join(__dirname, `../docs/${heroId}_wiki_ko.html`);
    console.log(`Processing ${heroId}...`);

    const result = extractSkillInfo(htmlPath);
    if (!result) continue;

    const { skillIcons, skillInfo } = result;

    // 아이콘 목록에 추가
    skillIcons.forEach(icon => allSkillIcons.add(icon));

    // heroes.json 업데이트
    const hero = heroesData.find(h => h.id === heroId);
    if (hero) {
        // 기존 스킬 정보 보존하면서 업데이트
        if (skillInfo.exploration.length > 0) {
            hero.skills = hero.skills || {};
            hero.skills.exploration = skillInfo.exploration;
        }
        if (skillInfo.expedition.length > 0) {
            hero.skills = hero.skills || {};
            hero.skills.expedition = skillInfo.expedition;
        }
        if (skillInfo.equipment.skills.length > 0 && hero.equipment) {
            hero.equipment.skills = skillInfo.equipment.skills;
        }

        console.log(`  ✓ Found ${skillInfo.exploration.length} exploration + ${skillInfo.expedition.length} expedition skills`);
        console.log(`  ✓ Icons: ${skillIcons.join(', ')}`);
        updatedHeroes.push(heroId);
    } else {
        console.log(`  ✗ Hero ID '${heroId}' not found in heroes.json`);
    }
}

// heroes.json 저장
fs.writeFileSync(heroesJsonPath, JSON.stringify(heroesData, null, 4), 'utf8');
console.log(`\n✓ Updated ${updatedHeroes.length} heroes in heroes.json`);
console.log(`✓ Total unique skill icons found: ${allSkillIcons.size}`);

// 누락된 아이콘 확인
const iconsDir = path.join(__dirname, '../assets/images/skill-icons');
const missingIcons = [];

for (const icon of allSkillIcons) {
    if (!fs.existsSync(path.join(iconsDir, icon))) {
        missingIcons.push(icon);
    }
}

if (missingIcons.length > 0) {
    console.log(`\n! ${missingIcons.length} icons are missing:`);
    missingIcons.forEach(icon => console.log(`  - ${icon}`));
}

console.log('\nDone!');
