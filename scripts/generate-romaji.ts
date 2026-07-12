import fs from 'fs';
import path from 'path';
import { SubtitleEngine } from '../packages/subtitle-engine/src/index';
const kuroshiroModule = require('kuroshiro');
const Kuroshiro = kuroshiroModule.default || kuroshiroModule;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

async function processFile(filePath: string, kuroshiro: any) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.ass', '.srt', '.vtt'].includes(ext)) return false;
  if (filePath.endsWith('_romaji.json')) return false;

  const outputFile = filePath.replace(ext, '_romaji.json');
  if (fs.existsSync(outputFile)) {
    console.log(`⏭️  Skipping (already exists): ${path.basename(filePath)}`);
    return false;
  }

  console.log(`\n⏳ Processing: ${path.basename(filePath)}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const type = ext === '.srt' ? 'srt' : ext === '.vtt' ? 'vtt' : 'ass';
  
  const engine = new SubtitleEngine();
  const cues = engine.parse(content, type);
  
  let count = 0;
  for (const cue of cues) {
    if (cue.text.trim()) {
      try {
        cue.romaji = await kuroshiro.convert(cue.text, { to: 'romaji', mode: 'spaced' });
      } catch (err: any) {
        cue.romaji = `[Err: ${err.message}]`;
      }
    }
    count++;
    if (count % 50 === 0 || count === cues.length) {
      process.stdout.write(`\r   Progress: ${count} / ${cues.length}`);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(cues, null, 2), 'utf-8');
  console.log(`\n✅ Saved: ${path.basename(outputFile)}`);
  return true;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: pnpm romaji <file-or-directory>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Path not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`[1/2] Initializing Kuroshiro...`);
  const kuroshiro = new Kuroshiro();
  const kuromojiModulePath = require.resolve('kuromoji');
  const dictPath = path.join(path.dirname(kuromojiModulePath), '../dict');
  await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
  console.log(`[1/2] Kuroshiro initialized successfully.`);

  const stats = fs.statSync(absolutePath);
  let filesToProcess: string[] = [];

  if (stats.isDirectory()) {
    console.log(`[2/2] Scanning directory: ${absolutePath}`);
    const files = fs.readdirSync(absolutePath);
    for (const file of files) {
      const fullPath = path.join(absolutePath, file);
      if (fs.statSync(fullPath).isFile()) {
        filesToProcess.push(fullPath);
      }
    }
  } else {
    filesToProcess.push(absolutePath);
  }

  let successCount = 0;
  for (const file of filesToProcess) {
    const processed = await processFile(file, kuroshiro);
    if (processed) successCount++;
  }

  console.log(`\n🎉 All done! Successfully processed ${successCount} files.`);
}

main().catch(err => {
  console.error('\nFatal Error:', err);
  process.exit(1);
});
