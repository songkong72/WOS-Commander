const fs = require('fs');
const path = require('path');

const heroesPath = path.join(__dirname, '../data/heroes.json');
const iconsDir = path.join(__dirname, '../assets/images/skill-icons');

const heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));
const missingMap = {}; // heroId -> [missing icons]

heroes.forEach(hero => {
    const missing = [];

    // Check skills
    if (hero.skills) {
        ['exploration', 'expedition', 'special'].forEach(type => {
            if (hero.skills[type]) {
                hero.skills[type].forEach(skill => {
                    if (skill.icon && !fs.existsSync(path.join(iconsDir, skill.icon))) {
                        missing.push(skill.icon);
                    }
                });
            }
        });
    }

    // Check equipment
    if (hero.equipment && hero.equipment.icon) {
        if (!fs.existsSync(path.join(iconsDir, hero.equipment.icon))) {
            missing.push(hero.equipment.icon);
        }
        if (hero.equipment.skills) {
            hero.equipment.skills.forEach(skill => {
                if (skill.icon && !fs.existsSync(path.join(iconsDir, skill.icon))) {
                    missing.push(skill.icon);
                }
            });
        }
    }

    if (missing.length > 0) {
        missingMap[hero.id] = missing;
    }
});

console.log(JSON.stringify(missingMap, null, 2));
