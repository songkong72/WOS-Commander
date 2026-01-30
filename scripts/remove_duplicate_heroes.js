const fs = require('fs');
const path = require('path');

const heroesFile = path.join(__dirname, '../data/heroes.json');
const heroes = require(heroesFile);

console.log(`Original count: ${heroes.length}`);

const uniqueHeroes = [];
const seenIds = new Set();

heroes.forEach(hero => {
    if (!seenIds.has(hero.id)) {
        seenIds.add(hero.id);
        uniqueHeroes.push(hero);
    } else {
        console.log(`Removing duplicate: ${hero.id} (${hero.name})`);
    }
});

console.log(`New count: ${uniqueHeroes.length}`);

if (heroes.length !== uniqueHeroes.length) {
    fs.writeFileSync(heroesFile, JSON.stringify(uniqueHeroes, null, 4), 'utf8');
    console.log('heroes.json updated successfully.');
} else {
    console.log('No duplicates found.');
}
