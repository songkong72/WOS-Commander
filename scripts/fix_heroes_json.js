const fs = require('fs');
const path = require('path');

const heroesPath = path.join(__dirname, '../data/heroes.json');
let heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));

const fixMap = {
    'sergey': { old: '5001', new: '50004' },
    'jessie': { old: '5002', new: '50007' },
    'bahiti': { old: '5003', new: '50006' },
    'patrick': { old: '5004', new: '50005' },
    'seoyoon': { old: '5005', new: '50027' },
    'zina': { old: '5007', new: '50008' },
    'hector': { old: '5015', new: '50024' },
    'gwen': { old: '5017', new: '50026' },
    'seurat': { old: '5029', new: '50044' },
    'gregory': { old: '5030', new: '50045' },
    'freya': { old: '5031', new: '50046' },
    'blanche': { old: '5032', new: '50047' },
    'eleonora': { old: '5033', new: '50048' },
    'lloyd': { old: '5034', new: '50049' },
    'rufus': { old: '5035', new: '50050' },
    'hervor': { old: '5036', new: '50051' },
    'karol': { old: '5037', new: '50052' },
    'ligeia': { old: '5038', new: '50053' },
    'gisela': { old: '5039', new: '50054' },
    'flora': { old: '5040', new: '50055' }
};

heroes = heroes.map(hero => {
    const fix = fixMap[hero.id];
    if (!fix) return hero;

    const updateIcon = (icon) => {
        if (!icon) return icon;
        // Match both 5 and 6 digit old IDs
        // e.g., 50011 (5-digit) or 501511 (6-digit)
        // If it starts with hero_skill_icon_ + fix.old
        let base = 'hero_skill_icon_';
        if (icon.startsWith(base + fix.old)) {
            // Check if it was 5-digit like 5001-1 or 6-digit like 5015-11
            const suffix = icon.substring((base + fix.old).length);
            return base + fix.new + suffix;
        }

        base = 'equipment_icon_10';
        if (icon.startsWith(base + fix.old)) {
            const suffix = icon.substring((base + fix.old).length);
            return base + fix.new + suffix;
        }
        return icon;
    };

    if (hero.skills) {
        ['exploration', 'expedition', 'special'].forEach(type => {
            if (hero.skills[type]) {
                hero.skills[type].forEach(skill => {
                    skill.icon = updateIcon(skill.icon);
                });
            }
        });
    }

    if (hero.equipment) {
        hero.equipment.icon = updateIcon(hero.equipment.icon);
        if (hero.equipment.skills) {
            hero.equipment.skills.forEach(skill => {
                skill.icon = updateIcon(skill.icon);
            });
        }
    }

    return hero;
});

fs.writeFileSync(heroesPath, JSON.stringify(heroes, null, 4));
console.log('Final heroes.json migration complete.');
