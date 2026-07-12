export interface DictionaryEntry {
  id: string;
  kanji: string[];
  readings: string[];
  meanings: string[];
  partOfSpeech: string[];
  jlpt?: number;
  frequency?: number;
  pitchAccent?: string;
  exampleSentence?: string;
}

export interface TranslationResult {
  text: string;
  translatedText: string;
  provider: 'openai' | 'gemini' | 'deepl' | 'google';
}
