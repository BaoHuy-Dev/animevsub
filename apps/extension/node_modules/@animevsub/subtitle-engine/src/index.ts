import { SubtitleCue } from '@animevsub/shared';
import { parse as parseAss } from 'ass-compiler';

export class SubtitleEngine {
  constructor() {}
  
  parse(content: string, type: 'ass' | 'srt' | 'vtt'): SubtitleCue[] {
    if (type === 'srt') {
      return this.parseSrt(content);
    } else if (type === 'vtt') {
      return this.parseVtt(content);
    } else if (type === 'ass') {
      return this.parseAssFile(content);
    }
    return [];
  }

  private parseAssFile(content: string): SubtitleCue[] {
    try {
      const parsed = parseAss(content);
      return parsed.events.dialogue.map((dialogue, index) => {
        // Strip out styling tags from ASS text
        const text = dialogue.Text.combined.replace(/{[^}]+}/g, '').replace(/\\N/g, '\n');
        return {
          id: `ass_${index}`,
          start: dialogue.Start, // ass-compiler parses time to seconds
          end: dialogue.End,
          text: text.trim()
        };
      });
    } catch (e) {
      console.error('Failed to parse ASS file', e);
      return [];
    }
  }

  private parseVtt(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = content.trim().split(/\r?\n\r?\n/);
    let idCounter = 1;
    
    for (const block of blocks) {
      if (block.startsWith('WEBVTT')) continue;
      
      const lines = block.split(/\r?\n/);
      let timeLineIdx = 0;
      
      if (!lines[0].includes('-->')) {
        timeLineIdx = 1; // It has an identifier
      }
      
      if (lines.length > timeLineIdx && lines[timeLineIdx].includes('-->')) {
        const timeLine = lines[timeLineIdx];
        const textLines = lines.slice(timeLineIdx + 1).join('\n');
        
        const [startStr, endStr] = timeLine.split(/ --> /).map(s => s.split(' ')[0]);
        if (startStr && endStr) {
          const start = this.timeToSeconds(startStr);
          const end = this.timeToSeconds(endStr);
          
          cues.push({
            id: `vtt_${idCounter++}`,
            start,
            end,
            text: textLines,
            tokens: []
          });
        }
      }
    }
    
    return cues;
  }

  private parseSrt(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = content.trim().split(/\r?\n\r?\n/);
    
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      if (lines.length >= 3) {
        const id = lines[0];
        const timeLine = lines[1];
        const textLines = lines.slice(2).join('\n');
        
        const [startStr, endStr] = timeLine.split(' --> ');
        if (startStr && endStr) {
          const start = this.timeToSeconds(startStr);
          const end = this.timeToSeconds(endStr);
          
          cues.push({
            id: `srt_${id}`,
            start,
            end,
            text: textLines,
            tokens: [] // Will be populated by the parser
          });
        }
      }
    }
    
    return cues;
  }

  private timeToSeconds(timeStr: string): number {
    // 00:00:20,000 or 00:00:20.000 -> seconds
    // some formats are 00:20.000 (missing hours)
    const normalized = timeStr.replace(',', '.');
    const parts = normalized.split(':');
    
    let hours = 0, minutes = 0, seconds = 0;
    
    if (parts.length === 3) {
      hours = parseFloat(parts[0]);
      minutes = parseFloat(parts[1]);
      seconds = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      minutes = parseFloat(parts[0]);
      seconds = parseFloat(parts[1]);
    }
    
    return hours * 3600 + minutes * 60 + seconds;
  }
}
