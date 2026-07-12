import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

export class TranslatorEngine {
  private kuroshiro: Kuroshiro;
  private isKuroshiroReady = false;

  constructor() {
    this.kuroshiro = new Kuroshiro();
  }

  async init(dictPath: string = '/dict/') {
    await this.kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
    this.isKuroshiroReady = true;
  }

  async toRomaji(japaneseText: string): Promise<string> {
    if (!this.isKuroshiroReady) throw new Error('Kuroshiro not initialized');
    return this.kuroshiro.convert(japaneseText, { to: 'romaji', mode: 'spaced' });
  }
}
