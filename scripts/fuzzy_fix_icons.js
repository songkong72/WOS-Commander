const fs = require('fs');
const path = require('path');

const heroesPath = path.join(__dirname, '../data/heroes.json');
let heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));
const iconsDir = path.join(__dirname, '../assets/images/skill-icons');
const availableIcons = new Set(fs.readdirSync(iconsDir));

heroes = heroes.map(hero => {
    const fixIcon = (icon) => {
        if (!icon) return icon;
        if (availableIcons.has(icon)) return icon;

        // Try removing the last '1' if it's 7 digits/extra suffix
        // e.g. 5005511 -> 500551
        let name = icon.replace('.png', '');
        if (name.length > 20) { // hero_skill_icon_XXXXXXX
            let newName = name.slice(0, -1) + '.png';
            if (availableIcons.has(newName)) return newName;
        }

        // Try other common patterns
        return icon;
    };

    if (hero.skills) {
        ['exploration', 'expedition', 'special'].forEach(type => {
            if (hero.skills[type]) {
                hero.skills[type].forEach(skill => {
                    skill.icon = fixIcon(skill.icon);
                });
            }
        });
    }
    if (hero.equipment) {
        hero.equipment.icon = fixIcon(hero.equipment.icon);
        if (hero.equipment.skills) {
            hero.equipment.skills.forEach(skill => {
                skill.icon = fixIcon(skill.icon);
            });
        }
    }
    return hero;
});

fs.writeFileSync(heroesPath, JSON.stringify(heroes, null, 4));
console.log('Fuzzy ID matching complete.');
