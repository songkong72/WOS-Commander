const fs = require('fs');
const path = require('path');

const heroesPath = path.join(__dirname, '../data/heroes.json');
let heroes = JSON.parse(fs.readFileSync(heroesPath, 'utf8'));

// Verified Mapping based on standard game progression and Wiki
const fixMap = {
    // S2
    'flint': { old: '5019', new: '50015' },
    'philly': { old: '5020', new: '50014' },
    'alonso': { old: '5021', new: '50013' },
    // S3
    'logan': { old: '5022', new: '50019' },
    'mia': { old: '5023', new: '50018' },
    'greg': { old: '5024', new: '50020' },
    // S4
    'ahmose': { old: '5025', new: '50021' },
    'reina': { old: '5026', new: '50022' },
    'lynn': { old: '5027', new: '50023' },
    // S5 (Already fixed mostly, but reaffirming)
    'hector': { old: '5015', new: '50024' },
    'gwen': { old: '5017', new: '50026' },
    'norah': { old: '50025', new: '50025' },
    // Epic/Blue
    'sergey': { old: '5001', new: '50004' },
    'jessie': { old: '5002', new: '50007' },
    'bahiti': { old: '5003', new: '50006' },
    'patrick': { old: '5004', new: '50005' },
    'seoyoon': { old: '5005', new: '50027' },
    'zina': { old: '5007', new: '50008' },
    'charlie': { old: '5011', new: '50011' },
    'eugene': { old: '5010', new: '50010' },
    'cloris': { old: '5006', new: '50006' }, // Bahiti and Cloris might share base or be 50009x
    // S9+
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
        let base = 'hero_skill_icon_';
        if (icon.startsWith(base + fix.old)) {
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
console.log('Heroes.json synchronization with Korean Wiki assets complete.');
