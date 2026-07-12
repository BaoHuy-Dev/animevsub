import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import tailwindCss from '../popup/index.css?inline';
import { useSettingsStore } from '../store/settings';
import { SubtitleEngine } from '@animevsub/subtitle-engine';
import { SubtitleCue } from '@animevsub/shared';
import { SubtitleCue } from '@animevsub/shared';

const OverlayApp: React.FC<{ videoElement: HTMLVideoElement }> = ({ videoElement }) => {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isSettingsOpenRef = useRef(false);
  
  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);
  
  const rafRef = useRef<number>();
  const toolbarTimeoutRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settings = useSettingsStore();

  const engineRef = useRef(new SubtitleEngine());

  // Load Subtitles from storage for current URL
  useEffect(() => {
    const pageUrl = window.location.href.split('?')[0];
    chrome.storage?.local.get(`subtitles_${pageUrl}`).then((res) => {
      if (res && res[`subtitles_${pageUrl}`]) {
        console.log('Restoring cached subtitles for this episode.');
        setCues(res[`subtitles_${pageUrl}`]);
      }
    });
  }, []);

  useEffect(() => {
    settings.loadFromStorage();

    const updateLoop = () => {
      const time = videoElement.currentTime + (useSettingsStore.getState().subtitleOffset / 1000);
      
      if (cues.length > 0) {
        // Fast search
        let found = null;
        for (let i = 0; i < cues.length; i++) {
          if (time >= cues[i].start && time <= cues[i].end) {
            found = cues[i];
            break;
          }
        }
        
        setActiveCue((prev) => prev !== found ? found : prev);
      }

      rafRef.current = requestAnimationFrame(updateLoop);
    };
    rafRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoElement, cues]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle auto-hiding toolbar
  const showToolbarTemporary = useCallback(() => {
    setIsToolbarVisible(true);
    if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
    toolbarTimeoutRef.current = window.setTimeout(() => {
      if (!isSettingsOpenRef.current) {
        setIsToolbarVisible(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', showToolbarTemporary);
    window.addEventListener('touchstart', showToolbarTemporary);
    window.addEventListener('click', showToolbarTemporary);
    return () => {
      window.removeEventListener('mousemove', showToolbarTemporary);
      window.removeEventListener('touchstart', showToolbarTemporary);
      window.removeEventListener('click', showToolbarTemporary);
    };
  }, [showToolbarTemporary]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      showToolbarTemporary();
      switch (e.code) {
        case 'KeyR':
          e.preventDefault();
          settings.toggleRomaji();
          break;
        case 'KeyJ':
          e.preventDefault();
          settings.toggleJapanese();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          settings.setSubtitleOffset(useSettingsStore.getState().subtitleOffset - 500);
          break;
        case 'ArrowRight':
          e.preventDefault();
          settings.setSubtitleOffset(useSettingsStore.getState().subtitleOffset + 500);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, showToolbarTemporary]);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    const content = await file.text();
    const pageUrl = window.location.href.split('?')[0];

    if (file.name.endsWith('.json')) {
      try {
        const parsedCues = JSON.parse(content);
        setCues(parsedCues);
        console.log(`Loaded ${parsedCues.length} cues from JSON`);
        chrome.storage?.local.set({ [`subtitles_${pageUrl}`]: parsedCues });
      } catch (err) {
        console.error('Failed to parse JSON subtitle file', err);
      }
      setIsProcessing(false);
      return;
    }

    const type = file.name.endsWith('.srt') ? 'srt' : file.name.endsWith('.vtt') ? 'vtt' : 'ass';
    const parsedCues = engineRef.current.parse(content, type);
    
    setCues(parsedCues);
    setIsProcessing(false);
    console.log(`Loaded ${parsedCues.length} cues`);

    chrome.storage?.local.set({ [`subtitles_${pageUrl}`]: parsedCues });
  };



  const textStyle: React.CSSProperties = {
    color: settings.fontColor,
    fontSize: `${settings.fontSize}px`,
    WebkitTextStroke: `${settings.outlineWidth}px ${settings.outlineColor}`,
    opacity: settings.opacity,
    textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
    fontWeight: 'bold',
    lineHeight: '1.2'
  };

  const romajiStyle: React.CSSProperties = {
    color: '#fbbf24', // Yellowish for romaji
    fontSize: `${Math.max(12, settings.fontSize * 0.7)}px`,
    WebkitTextStroke: `${Math.max(1, settings.outlineWidth * 0.5)}px ${settings.outlineColor}`,
    opacity: settings.opacity,
    textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
    fontWeight: 'bold'
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none flex flex-col items-center"
      style={{ paddingBottom: `${settings.bottomOffset}px`, justifyContent: 'flex-end' }}
    >
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold bg-black/50 z-50 transition-opacity duration-300">
          Generating Romaji...
        </div>
      )}

      {/* Main Subtitle Box with fade transitions */}
      <div className={`flex flex-col items-center gap-1 text-center transition-opacity duration-300 ${activeCue ? 'opacity-100' : 'opacity-0'}`}>
        {settings.showJapanese && activeCue?.text && (
          <span style={textStyle}>{activeCue.text}</span>
        )}
        {settings.showRomaji && activeCue?.romaji && (
          <span style={romajiStyle}>{activeCue.romaji}</span>
        )}
      </div>

      {/* Floating Toolbar & Load Button */}
      <div 
        className={`absolute bottom-4 right-4 pointer-events-auto flex flex-col items-end gap-2 transition-opacity duration-500 ${isToolbarVisible || isSettingsOpen ? 'opacity-100' : 'opacity-0'}`}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {isSettingsOpen && (
          <div id="animevsub-settings-panel" className="w-[90vw] max-w-[320px] bg-black/70 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-2xl text-white pointer-events-auto transition-all mb-2">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-sm tracking-wide">✨ Appearance</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="space-y-5">
              {/* Vertical Position */}
              <div>
                <label className="flex justify-between text-xs text-gray-300 mb-2 font-medium">
                  <span>Vertical Position</span>
                  <span>{settings.bottomOffset}px</span>
                </label>
                <input type="range" min="0" max="800" value={settings.bottomOffset} onChange={(e) => settings.setStyle('bottomOffset', parseInt(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              </div>

              {/* Font Size */}
              <div>
                <label className="flex justify-between text-xs text-gray-300 mb-2 font-medium">
                  <span>Font Size</span>
                  <span>{settings.fontSize}px</span>
                </label>
                <input type="range" min="16" max="96" value={settings.fontSize} onChange={(e) => settings.setStyle('fontSize', parseInt(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              </div>

              {/* Colors */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-300 mb-2 font-medium">Text Color</label>
                  <div className="flex gap-2">
                    {['#ffffff', '#fbbf24', '#34d399', '#60a5fa'].map(c => (
                      <button key={c} onClick={() => settings.setStyle('fontColor', c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${settings.fontColor === c ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-300 mb-2 font-medium">Outline</label>
                  <div className="flex gap-2">
                    {['#000000', '#1e3a8a', '#7f1d1d', '#14532d'].map(c => (
                      <button key={c} onClick={() => settings.setStyle('outlineColor', c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${settings.outlineColor === c ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-gray-500'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Outline Width */}
              <div>
                <label className="flex justify-between text-xs text-gray-300 mb-2 font-medium">
                  <span>Outline Width</span>
                  <span>{settings.outlineWidth}px</span>
                </label>
                <input type="range" min="0" max="15" value={settings.outlineWidth} onChange={(e) => settings.setStyle('outlineWidth', parseInt(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {isCollapsed ? (
          <button 
            onClick={() => setIsCollapsed(false)}
            className="bg-black/80 hover:bg-black text-white text-xs px-4 py-2.5 rounded-full border border-gray-700 shadow-md flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span>+</span> Subtitles
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-3 bg-black/80 px-4 py-2.5 rounded-full text-[12px] text-white border border-gray-700 shadow-md">
              <span className={`cursor-pointer ${settings.showJapanese ? 'text-blue-400 font-bold' : 'text-gray-400'}`} onClick={() => settings.toggleJapanese()}>JP</span>
              <span className={`cursor-pointer ${settings.showRomaji ? 'text-blue-400 font-bold' : 'text-gray-400'}`} onClick={() => settings.toggleRomaji()}>Romaji</span>
              <div className="w-[1px] h-4 bg-gray-600"></div>
              <span className="font-mono cursor-pointer hover:text-white text-gray-300 text-sm px-1 active:scale-110" onClick={() => settings.setSubtitleOffset(settings.subtitleOffset - 500)} title="Lùi 500ms">⏪</span>
              <span className="font-mono text-gray-300 min-w-[48px] text-center">{settings.subtitleOffset > 0 ? '+' : ''}{settings.subtitleOffset}ms</span>
              <span className="font-mono cursor-pointer hover:text-white text-gray-300 text-sm px-1 active:scale-110" onClick={() => settings.setSubtitleOffset(settings.subtitleOffset + 500)} title="Tiến 500ms">⏩</span>
              <div className="w-[1px] h-4 bg-gray-600"></div>
              <span className="cursor-pointer text-gray-400 hover:text-white transition-colors px-1 active:scale-110" onClick={() => setIsCollapsed(true)} title="Thu gọn">✕</span>
            </div>

            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold py-2.5 px-4 rounded-full shadow-md border transition-colors active:scale-95 ${isSettingsOpen ? 'border-blue-500 text-blue-400' : 'border-gray-600'}`}
              title="Settings"
            >
              ⚙️
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold py-2.5 px-4 rounded-full shadow-md whitespace-nowrap active:scale-95 transition-transform"
            >
              Load File
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".srt,.vtt,.ass,.json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

function injectOverlay(video: HTMLVideoElement) {
  if (video.dataset.animeVsubInjected) return;
  video.dataset.animeVsubInjected = 'true';

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';

  const parent = video.parentElement;
  if (!parent) return;

  parent.style.position = 'relative';
  parent.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: 'open' });
  
  const styleBlock = document.createElement('style');
  styleBlock.textContent = tailwindCss;
  shadowRoot.appendChild(styleBlock);

  const rootElement = document.createElement('div');
  rootElement.style.width = '100%';
  rootElement.style.height = '100%';
  shadowRoot.appendChild(rootElement);

  const root = createRoot(rootElement);
  root.render(<OverlayApp videoElement={video} />);
}

function detectVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(injectOverlay);
}

detectVideos();

const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      hasNewNodes = true;
      break;
    }
  }
  if (hasNewNodes) {
    detectVideos();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
console.log('Anime Subtitle Learning Content Script loaded.');
