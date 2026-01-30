const fs = require('fs');
const path = require('path');

try {
    const heroes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/heroes.json'), 'utf8'));
    console.log('JSON is valid.');
} catch (e) {
    console.error('JSON Syntax Error:', e.message);
}
