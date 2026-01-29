const fs = require('fs');
const path = require('path');
const https = require('https');

const HEROES_JSON_PATH = path.join(__dirname, '../data/heroes.json');
const IMAGES_DIR = path.join(__dirname, '../assets/images/heroes');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Data from user HTML
const rawData = [
    // Rare
    { name: '스미스', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/smith.png', gen: '상설', rarity: '레어', type: '보병' },
    { name: '유진', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/eugene.png', gen: '상설', rarity: '레어', type: '보병' },
    { name: '찰리', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/charlie.png', gen: '상설', rarity: '레어', type: '창병' },
    { name: '클로리스', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/cloris.png', gen: '상설', rarity: '레어', type: '궁병' },
    // Epic
    { name: '세르게이', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/sergey.png', gen: '상설', rarity: '에픽', type: '보병' },
    { name: '제시', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/jessie.png', gen: '상설', rarity: '에픽', type: '창병' },
    { name: '패트릭', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/patrick.png', gen: '상설', rarity: '에픽', type: '보병' },
    { name: '료유키', id: 'ryoyuki', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/4.jpg', gen: '상설', rarity: '에픽', type: '창병' }, // New
    { name: '룸 보겐', id: 'lumborgen', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/3.png', gen: '상설', rarity: '에픽', type: '창병' }, // New
    { name: '지나', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/Gina.png', gen: '상설', rarity: '에픽', type: '궁병' },
    { name: '바히티', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/bahiti.png', gen: '상설', rarity: '에픽', type: '궁병' },
    { name: '서윤', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/2.jpg', gen: '상설', rarity: '에픽', type: '궁병' },
    { name: '제셀', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/1.jpg', gen: '상설', rarity: '에픽', type: '궁병' },
    // S1
    { name: '제로니모', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/jeronimo.png', gen: 'S1', rarity: '전설', type: '보병' },
    { name: '나탈리아', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/natalia.png', gen: 'S1', rarity: '전설', type: '보병' },
    { name: '몰리', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/molly.png', gen: 'S1', rarity: '전설', type: '창병' },
    { name: '진먼', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/zinman.png', gen: 'S1', rarity: '전설', type: '궁병' },
    // S2
    { name: '플린트', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/flint.png', gen: 'S2', rarity: '전설', type: '보병' },
    { name: '필리', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/philly.png', gen: 'S2', rarity: '전설', type: '창병' },
    { name: '알론소', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/alonso.png', gen: 'S2', rarity: '전설', type: '궁병' },
    // S3
    { name: '로건', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/logan.png', gen: 'S3', rarity: '전설', type: '보병' },
    { name: '미야', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/mia.png', gen: 'S3', rarity: '전설', type: '창병' },
    { name: '그렉', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/greg.png', gen: 'S3', rarity: '전설', type: '궁병' },
    // S4
    { name: '아모세', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/ahmos.png', gen: 'S4', rarity: '전설', type: '보병' },
    { name: '레이나', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/1690429616516_7.jpg', gen: 'S4', rarity: '전설', type: '창병' },
    { name: '린', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/1690429616507_5.jpg', gen: 'S4', rarity: '전설', type: '궁병' },
    // S5
    { name: '헥터', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/1690429616489_3.jpg', gen: 'S5', rarity: '전설', type: '보병' },
    { name: '노라', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/1690429616480_2.jpg', gen: 'S5', rarity: '전설', type: '창병' },
    { name: '그웬', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/1690429616472_1.jpg', gen: 'S5', rarity: '전설', type: '궁병' },
    // S6
    { name: '무명', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/wuming.jpg', gen: 'S6', rarity: '전설', type: '보병' },
    { name: '레니', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/rene.jpg', gen: 'S6', rarity: '전설', type: '창병' },
    { name: '웨인', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/wayne.jpg', gen: 'S6', rarity: '전설', type: '궁병' },
    // S7
    { name: '에디스', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/20240222_2.jpg', gen: 'S7', rarity: '전설', type: '보병' },
    { name: '고든', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/20240222_1.jpg', gen: 'S7', rarity: '전설', type: '창병' },
    { name: '브레들리', id: 'bradley', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/20240222_3.jpg', gen: 'S7', rarity: '전설', type: '궁병' },
    // S8
    { name: '가토', id: 'gato', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/5.jpg', gen: 'S8', rarity: '전설', type: '보병' },
    { name: '소냐', id: 'sonya', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/6.jpg', gen: 'S8', rarity: '전설', type: '창병' },
    { name: '헨드릭', id: 'hendrick', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/7.jpg', gen: 'S8', rarity: '전설', type: '궁병' },
    // S9
    { name: '마그누스', id: 'magnus', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/magnus.jpg', gen: 'S9', rarity: '전설', type: '보병' },
    { name: '프레드', id: 'fred', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/fred.jpg', gen: 'S9', rarity: '전설', type: '창병' },
    { name: '쇠라', id: 'xura', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/xura.jpg', gen: 'S9', rarity: '전설', type: '궁병' },
    // S10
    { name: '그레고리', id: 'gregory', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/gregory350.jpg', gen: 'S10', rarity: '전설', type: '보병' },
    { name: '프레야', id: 'freya', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/freya350.jpg', gen: 'S10', rarity: '전설', type: '창병' },
    { name: '블랑쉬', id: 'blanchette', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/blanchette350.jpg', gen: 'S10', rarity: '전설', type: '궁병' },
    // S11
    { name: '엘레오노라', id: 'eleonora', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/eleonora.jpg', gen: 'S11', rarity: '전설', type: '보병' },
    { name: '로이드', id: 'lloyd', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/Lloyd.jpg', gen: 'S11', rarity: '전설', type: '창병' },
    { name: '루퍼스', id: 'rufus', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/rufus.jpg', gen: 'S11', rarity: '전설', type: '궁병' },
    // S12
    { name: '헤르보르', id: 'hervor', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FHervor-1.jpg', gen: 'S12', rarity: '전설', type: '보병' },
    { name: '가로얼', id: 'garoal', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fkarol-1.jpg', gen: 'S12', rarity: '전설', type: '창병' },
    { name: '리지아', id: 'ligeia', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FLigeia-1.jpg', gen: 'S12', rarity: '전설', type: '궁병' },
    // S13
    { name: '기젤라', id: 'gisela', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fgisela.jpg', gen: 'S13', rarity: '전설', type: '보병' },
    { name: '플로라', id: 'flora', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FFlora.jpg', gen: 'S13', rarity: '전설', type: '창병' },
    { name: '올카누스', id: 'vulcanus', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fvulcanus.jpg', gen: 'S13', rarity: '전설', type: '궁병' },
    // S14
    { name: '엘리프', id: 'elif', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/Elif.png', gen: 'S14', rarity: '전설', type: '보병' },
    { name: '도미니카', id: 'dominica', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/Dominic.png', gen: 'S14', rarity: '전설', type: '창병' },
    { name: '카라', id: 'cara', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/cara.png', gen: 'S14', rarity: '전설', type: '궁병' },
    // S15
    { name: '행크', id: 'hank', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E6%B1%89%E5%85%8B.png', gen: 'S15', rarity: '전설', type: '보병' },
    { name: '에스텔라', id: 'estella', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E8%89%BE%E6%96%AF%E9%BB%9B%E6%8B%89%EF%BC%88%E7%94%BB%E5%AE%B6%EF%BC%89.png', gen: 'S15', rarity: '전설', type: '창병' },
    { name: '비비카', id: 'vivika', url: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E7%BB%B4%E8%96%87%E5%8D%A1.png', gen: 'S15', rarity: '전설', type: '궁병' }
];

const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        if (url.startsWith('http')) {
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to consume url: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(filepath, () => reject(err));
            });
        } else {
            resolve(); // Verify manually if not http
        }
    });
};

const main = async () => {
    let heroes = [];
    try {
        if (fs.existsSync(HEROES_JSON_PATH)) {
            heroes = JSON.parse(fs.readFileSync(HEROES_JSON_PATH, 'utf8'));
        }
    } catch (e) {
        console.error("Error reading JSON:", e);
    }

    // 1. Download images and sync data
    for (const data of rawData) {
        if (!data.url) continue;
        const ext = path.extname(data.url).split('?')[0] || '.png';

        // Generate a clean filename (use ID if possible, else simplified name)
        let filename = data.id ? `${data.id}${ext}` : null;
        if (!filename) {
            // Try to find if hero exists
            const existing = heroes.find(h => h.name === data.name);
            if (existing && existing.id) {
                filename = `${existing.id}${ext}`;
            } else {
                // Determine ID from url filename or use a random one? Better use a standard.
                // Fallback: use english name derived from url or just unique id
                const urlName = path.basename(data.url, ext);
                filename = `${urlName}${ext}`;
            }
        }

        // Ensure unique IDs for new heroes
        let heroId = data.id;
        if (!heroId) {
            const existing = heroes.find(h => h.name === data.name);
            if (existing) heroId = existing.id;
            else {
                // Create ID from filename
                heroId = path.basename(filename, ext).toLowerCase().replace(/[^a-z0-9]/g, '');
            }
        }

        const localPath = path.join(IMAGES_DIR, filename);

        console.log(`Downloading ${data.name} to ${filename}...`);
        try {
            await downloadImage(data.url, localPath);
        } catch (e) {
            console.error(`Failed to download ${data.name}: ${e.message}`);
        }

        // Update JSON
        let heroIndex = heroes.findIndex(h => h.name === data.name);
        const imageRequirePath = `require('../../assets/images/heroes/${filename}')`;

        // We will store just the filename in JSON, and handle require in UI dynamically or update code to use dynamic requires? 
        // React Native dynamic requires are tricky. 
        // Best practice: "image": "filename.png" and in UI: functions to resolve or a big static map.
        // The user asked to "bring images into project".
        // Let's store just the filename in DB, and I will update UI to `require` specific paths? 
        // Actually, dynamic `require` like `require('../../assets/' + name)` DOES NOT work in React Native/Expo easily (bundler needs to know paths).
        // Solution: Create an index.ts in assets/images/heroes that exports all as a map, or use `require` string in JSON but that's not valid JSON.
        // Alternative: The JSON usually holds a string. Use a helper in the app that maps ID to `require`.
        // I will create `assets/images/heroes/index.ts` that exports an object map.

        const heroData = {
            id: heroId,
            name: data.name,
            type: data.type,
            gen: data.gen,
            rarity: data.rarity,
            image: filename, // Just filename
            displayInfo: {
                rarity: data.rarity === '전설' ? 'SSR 전설' : (data.rarity === '에픽' ? 'SR 영웅' : 'R 희귀'),
                class: data.type,
                subClass: '전투' // Default, will refine for existing
            }
        };

        if (heroIndex >= 0) {
            // Update existing
            heroes[heroIndex].image = filename;
            heroes[heroIndex].gen = data.gen;
            heroes[heroIndex].rarity = data.rarity; // Ensure rarity is synced
            // Preserve description/skills if existing
        } else {
            // Add new
            heroes.push(heroData);
        }
    }

    // 2. Sorting
    const typeOrder = { '보병': 1, '창병': 2, '궁병': 3 };
    const genOrder = (gen) => {
        if (gen.startsWith('S')) return parseInt(gen.substring(1));
        if (gen === '에픽' || gen === '상설') return 100; // After S15
        if (gen === '레어') return 101;
        return 999;
    };

    // Special handling: The user probably wants S1, S2, ... S15, then Epic, then Rare?
    // User HTML order: Rare tab, Epic tab, S1...S15.
    // But usually default view is "Latest" or "S1"? 
    // The sorting requirement was: "Sort heroes order by Shield > Spear > Bow". This applies *within* a generation.
    // The Generation list usually is sorted by Gen.
    // I will sort the whole array by Gen (S1->S15->Epic/Rare) + Type.

    heroes.sort((a, b) => {
        const genA = genOrder(a.gen);
        const genB = genOrder(b.gen);
        if (genA !== genB) return genA - genB;

        const typeA = typeOrder[a.type] || 4;
        const typeB = typeOrder[b.type] || 4;
        return typeA - typeB;
    });

    fs.writeFileSync(HEROES_JSON_PATH, JSON.stringify(heroes, null, 4));
    console.log("Updated heroes.json");
};

main();
