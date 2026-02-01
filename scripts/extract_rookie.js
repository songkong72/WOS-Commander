const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const htmlPath = path.join(__dirname, '../data/rookie_events_raw.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(html);

const events = [];

$('.blue-bg-card-item').each((i, el) => {
    const img = $(el).find('img.blue-bg-image').attr('src');
    const titleEl = $(el).find('h5.small-title a');
    const title = titleEl.text().trim();
    const link = titleEl.attr('href');

    if (title) {
        events.push({
            id: 'rookie_' + i + '_' + Date.now(),
            title: title,
            category: '초보자',
            imageUrl: img,
            link: link,
            day: '', // To be filled by user
            time: '',
            strategy: ''
        });
    }
});

console.log(JSON.stringify(events, null, 2));
