const fs = require('fs');
const path = require('path');

const filesToCopy = [
  { src: 'kuromoji/build/kuromoji.js', dest: 'public/lib/kuromoji.js' },
  { src: 'kuroshiro/dist/kuroshiro.min.js', dest: 'public/lib/kuroshiro.min.js' },
  { src: 'kuroshiro-analyzer-kuromoji/dist/kuroshiro-analyzer-kuromoji.min.js', dest: 'public/lib/kuroshiro-analyzer-kuromoji.min.js' }
];

const destDir = path.resolve(__dirname, '../public/lib');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

for (const file of filesToCopy) {
  try {
    const srcPath = require.resolve(file.src);
    const destPath = path.resolve(__dirname, '../', file.dest);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file.src} to ${file.dest}`);
  } catch (err) {
    console.error(`Failed to copy ${file.src}:`, err.message);
  }
}
