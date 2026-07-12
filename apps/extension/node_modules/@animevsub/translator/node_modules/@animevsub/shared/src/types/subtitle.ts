export interface SubtitleToken {
  text: string;
  baseForm: string;
  reading: string;
  partOfSpeech: string;
  isUnknown: boolean;
}

export interface SubtitleCue {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  text: string; // original japanese text
  romaji?: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  cues: SubtitleCue[];
  type: 'ass' | 'srt' | 'vtt';
}
