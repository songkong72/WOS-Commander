const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../assets/images');
const heroImagesDir = path.join(rootDir, 'heroes');
const skillIconsDir = path.join(rootDir, 'skill-icons');

// 1. 빈 파일 삭제 함수
function removeEmptyFiles(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    let removedCount = 0;

    files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
            const stats = fs.statSync(filePath);
            if (stats.isFile() && stats.size === 0) {
                console.log(`[DELETE] Empty file removed: ${file}`);
                fs.unlinkSync(filePath);
                removedCount++;
            }
        } catch (err) {
            console.error(`Error checking ${file}:`, err);
        }
    });

    console.log(`Cleaned up ${dir}: ${removedCount} empty files removed.`);
}

// 2. 영웅 이미지 인덱스 생성
function generateHeroIndex() {
    console.log('Generating hero images index...');
    if (!fs.existsSync(heroImagesDir)) return;

    const files = fs.readdirSync(heroImagesDir).filter(file => {
        return (file.endsWith('.png') || file.endsWith('.jpg')) && !file.startsWith('.');
    });

    let content = `// Auto-generated hero images index\n\n`;
    content += `export const heroImages: { [key: string]: any } = {\n`;

    files.forEach(file => {
        content += `    '${file}': require('./${file}'),\n`;
    });

    content += `};\n`;

    fs.writeFileSync(path.join(heroImagesDir, 'index.ts'), content);
    console.log(`Generated heroes/index.ts with ${files.length} images.`);
}

// 3. 스킬 아이콘 인덱스 생성
function generateSkillIndex() {
    console.log('Generating skill icons index...');
    if (!fs.existsSync(skillIconsDir)) return;

    const files = fs.readdirSync(skillIconsDir).filter(file => {
        return (file.endsWith('.png') || file.endsWith('.jpg')) && !file.startsWith('.');
    });

    let content = '// Auto-generated skill icons index\n\n';
    content += 'export const skillIcons: { [key: string]: any } = {\n';

    files.forEach(file => {
        content += `  '${file}': require('./${file}'),\n`;
    });

    content += '};\n';

    fs.writeFileSync(path.join(skillIconsDir, 'index.ts'), content);
    console.log(`Generated skill-icons/index.ts with ${files.length} icons.`);
}

// 실행
console.log('Starting cleanup and re-indexing...');
removeEmptyFiles(heroImagesDir);
removeEmptyFiles(skillIconsDir);
generateHeroIndex();
generateSkillIndex();
console.log('Done.');
