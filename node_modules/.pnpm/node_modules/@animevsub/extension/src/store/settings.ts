import { create } from 'zustand';

interface SettingsState {
  showJapanese: boolean;
  showRomaji: boolean;
  subtitleOffset: number; // in milliseconds
  
  // Styling
  fontSize: number; // px
  fontColor: string; // hex
  outlineWidth: number; // px
  outlineColor: string; // hex
  opacity: number; // 0 to 1
  bottomOffset: number; // px

  toggleJapanese: () => void;
  toggleRomaji: () => void;
  setSubtitleOffset: (offset: number) => void;
  setStyle: (key: keyof SettingsState, value: any) => void;
  loadFromStorage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showJapanese: true,
  showRomaji: false,
  subtitleOffset: 0,
  
  fontSize: 32,
  fontColor: '#ffffff',
  outlineWidth: 2,
  outlineColor: '#000000',
  opacity: 1,
  bottomOffset: 48,

  toggleJapanese: () => {
    const next = !get().showJapanese;
    set({ showJapanese: next });
    chrome.storage?.local.set({ showJapanese: next });
  },
  toggleRomaji: () => {
    const next = !get().showRomaji;
    set({ showRomaji: next });
    chrome.storage?.local.set({ showRomaji: next });
  },
  setSubtitleOffset: (offset: number) => {
    set({ subtitleOffset: offset });
    chrome.storage?.local.set({ subtitleOffset: offset });
  },
  setStyle: (key, value) => {
    set({ [key]: value } as Partial<SettingsState>);
    chrome.storage?.local.set({ [key]: value });
  },
  loadFromStorage: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get([
        'showJapanese', 'showRomaji', 'subtitleOffset',
        'fontSize', 'fontColor', 'outlineWidth', 'outlineColor', 'opacity', 'bottomOffset'
      ]);
      set({
        showJapanese: data.showJapanese ?? true,
        showRomaji: data.showRomaji ?? false,
        subtitleOffset: data.subtitleOffset ?? 0,
        fontSize: data.fontSize ?? 32,
        fontColor: data.fontColor ?? '#ffffff',
        outlineWidth: data.outlineWidth ?? 2,
        outlineColor: data.outlineColor ?? '#000000',
        opacity: data.opacity ?? 1,
        bottomOffset: data.bottomOffset ?? 48,
      });
    }
  }
}));
