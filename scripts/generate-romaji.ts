import fs from 'fs';
import path from 'path';
import { SubtitleEngine } from '../packages/subtitle-engine/src/index';
const kuroshiroModule = require('kuroshiro');
const Kuroshiro = kuroshiroModule.default || kuroshiroModule;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: pnpm tsx scripts/generate-romaji.ts <subtitle-file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), inputFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`[1/3] Reading file: ${inputFile}`);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  
  const ext = path.extname(inputFile).toLowerCase();
  const type = ext === '.srt' ? 'srt' : ext === '.vtt' ? 'vtt' : 'ass';
  
  const engine = new SubtitleEngine();
  const cues = engine.parse(content, type);
  console.log(`[1/3] Parsed ${cues.length} subtitles.`);

  console.log(`[2/3] Initializing Kuroshiro...`);
  const kuroshiro = new Kuroshiro();
  
  // Use absolute path to the kuromoji dictionary
  // The 'kuromoji' package includes the dict folder inside it
  const kuromojiModulePath = require.resolve('kuromoji');
  const dictPath = path.join(path.dirname(kuromojiModulePath), '../dict');
  
  await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
  console.log(`[2/3] Kuroshiro initialized successfully.`);

  console.log(`[3/3] Generating Romaji for ${cues.length} lines...`);
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
      process.stdout.write(`\rProgress: ${count} / ${cues.length}`);
    }
  }
  console.log('\n[3/3] Romaji generation complete.');

  const outputFile = absolutePath.replace(ext, '_romaji.json');
  fs.writeFileSync(outputFile, JSON.stringify(cues, null, 2), 'utf-8');
  console.log(`\n✅ Success! Saved to: ${path.basename(outputFile)}`);
  console.log(`Now you can open the Extension and Load File -> Select ${path.basename(outputFile)}`);
}

main().catch(err => {
  console.error('\nFatal Error:', err);
  process.exit(1);
});
