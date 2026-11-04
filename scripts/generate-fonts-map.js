const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'src', 'core', 'fonts');
const targetFile = path.join(targetDir, 'qcfFontsMap.ts');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const lines = [
  '// Auto-generated static asset map for QCF V2 fonts (Pages 1 to 604)',
  'export const QCF_FONTS_MAP: Record<number, any> = {',
];

for (let i = 1; i <= 604; i++) {
  lines.push(`  ${i}: require('../../../assets/fonts/qcf_v2/p${i}.ttf'),`);
}

lines.push('};');
lines.push('');

fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
console.log(`Generated ${targetFile} with 604 page font entries.`);

