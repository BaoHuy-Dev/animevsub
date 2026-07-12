import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import tailwindCss from '../popup/index.css?inline';
import { useSettingsStore } from '../store/settings';
import { SubtitleEngine } from '@animevsub/subtitle-engine';
import { SubtitleCue } from '@animevsub/shared';

// Global Sandbox Setup
const TRANSLATOR_URL = chrome.runtime?.getURL('sandbox.html');
let sandboxIframe: HTMLIFrameElement | null = null;
let isSandboxReady = false;
let sandboxError = '';
const pendingTranslations = new Map<string, { resolve: (val: string) => void, reject: (err: any) => void }>();

function initSandbox() {
  if (document.getElementById('animevsub-sandbox')) return;
  sandboxIframe = document.createElement('iframe');
  sandboxIframe.id = 'animevsub-sandbox';
  sandboxIframe.src = TRANSLATOR_URL;
  sandboxIframe.style.display = 'none';
  document.body.appendChild(sandboxIframe);

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'KUROSHIRO_READY') {
      isSandboxReady = true;
      window.dispatchEvent(new Event('sandbox-ready'));
      console.log('[Content] Kuroshiro sandbox is ready');
    } else if (event.data?.type === 'KUROSHIRO_ERROR') {
      sandboxError = event.data.error;
      console.error('[Content] Kuroshiro sandbox failed', sandboxError);
    } else if (event.data?.type === 'TRANSLATE_RESULT') {
      const { id, romaji } = event.data;
      if (pendingTranslations.has(id)) {
        pendingTranslations.get(id)!.resolve(romaji);
        pendingTranslations.delete(id);
      }
    } else if (event.data?.type === 'TRANSLATE_ERROR') {
      const { id, error } = event.data;
      if (pendingTranslations.has(id)) {
        pendingTranslations.get(id)!.reject(new Error(error));
        pendingTranslations.delete(id);
      }
    }
  });
}

const translateText = async (text: string): Promise<string> => {
  if (sandboxError) throw new Error(`Sandbox Error: ${sandboxError}`);
  if (!isSandboxReady || !sandboxIframe?.contentWindow) {
    throw new Error('Sandbox not ready yet');
  }
  
  const id = Math.random().toString(36).substr(2, 9);
  return new Promise((resolve, reject) => {
    pendingTranslations.set(id, { resolve, reject });
    sandboxIframe!.contentWindow!.postMessage({ type: 'TRANSLATE', id, text }, '*');
    
    setTimeout(() => {
      if (pendingTranslations.has(id)) {
        pendingTranslations.get(id)!.reject(new Error('Translation timeout'));
        pendingTranslations.delete(id);
      }
    }, 5000);
  });
}

const OverlayApp: React.FC<{ videoElement: HTMLVideoElement }> = ({ videoElement }) => {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  
  const rafRef = useRef<number>();
  const toolbarTimeoutRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settings = useSettingsStore();
  const [sandboxReadyState, setSandboxReadyState] = useState(isSandboxReady);

  const engineRef = useRef(new SubtitleEngine());

  useEffect(() => {
    const handleReady = () => setSandboxReadyState(true);
    window.addEventListener('sandbox-ready', handleReady);
    return () => window.removeEventListener('sandbox-ready', handleReady);
  }, []);

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
      setIsToolbarVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', showToolbarTemporary);
    return () => window.removeEventListener('mousemove', showToolbarTemporary);
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
    const type = file.name.endsWith('.srt') ? 'srt' : file.name.endsWith('.vtt') ? 'vtt' : 'ass';
    const parsedCues = engineRef.current.parse(content, type);
    
    setCues(parsedCues);
    setIsProcessing(false);
    console.log(`Loaded ${parsedCues.length} cues`);

    const pageUrl = window.location.href.split('?')[0];
    chrome.storage?.local.set({ [`subtitles_${pageUrl}`]: parsedCues });
  };

  // Real-time Just-In-Time Romaji Generation
  useEffect(() => {
    if (!activeCue || activeCue.romaji || !sandboxReadyState) return;

    let isMounted = true;
    const generateRomaji = async () => {
      try {
        const romaji = await translateText(activeCue.text);
        if (!isMounted) return;
        
        setCues(prevCues => {
          const newCues = [...prevCues];
          const cueIndex = newCues.findIndex(c => c.id === activeCue.id);
          if (cueIndex !== -1) {
            newCues[cueIndex] = { ...newCues[cueIndex], romaji };
            // Background save to cache
            const pageUrl = window.location.href.split('?')[0];
            chrome.storage?.local.set({ [`subtitles_${pageUrl}`]: newCues });
          }
          return newCues;
        });
      } catch (err: any) {
        if (err.message === 'Sandbox not ready yet') return;
        if (!isMounted) return;
        setCues(prevCues => {
          const newCues = [...prevCues];
          const cueIndex = newCues.findIndex(c => c.id === activeCue.id);
          if (cueIndex !== -1) {
            newCues[cueIndex] = { ...newCues[cueIndex], romaji: `[Err: ${err.message}]` };
          }
          return newCues;
        });
      }
    };
    
    generateRomaji();
    return () => { isMounted = false; };
  }, [activeCue]);

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
        className={`absolute bottom-4 right-4 pointer-events-auto flex items-center gap-2 transition-opacity duration-500 ${isToolbarVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {isCollapsed ? (
          <button 
            onClick={() => setIsCollapsed(false)}
            className="bg-black/80 hover:bg-black text-white text-xs px-3 py-1.5 rounded-full border border-gray-700 shadow-md flex items-center gap-1"
          >
            <span>+</span> Subtitles
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-black/80 px-3 py-1.5 rounded-full text-[11px] text-white border border-gray-700 shadow-md">
              <span className={`cursor-pointer ${settings.showJapanese ? 'text-blue-400 font-bold' : 'text-gray-400'}`} onClick={() => settings.toggleJapanese()}>JP</span>
              <span className={`cursor-pointer ${settings.showRomaji ? 'text-blue-400 font-bold' : 'text-gray-400'}`} onClick={() => settings.toggleRomaji()}>Romaji</span>
              <div className="w-[1px] h-3 bg-gray-600"></div>
              <span className="font-mono cursor-pointer hover:text-white text-gray-300" onClick={() => settings.setSubtitleOffset(settings.subtitleOffset - 500)} title="Lùi 500ms">⏪</span>
              <span className="font-mono text-gray-300 w-10 text-center">{settings.subtitleOffset > 0 ? '+' : ''}{settings.subtitleOffset}ms</span>
              <span className="font-mono cursor-pointer hover:text-white text-gray-300" onClick={() => settings.setSubtitleOffset(settings.subtitleOffset + 500)} title="Tiến 500ms">⏩</span>
              <div className="w-[1px] h-3 bg-gray-600"></div>
              <span className="cursor-pointer text-gray-400 hover:text-white" onClick={() => setIsCollapsed(true)} title="Thu gọn">✖</span>
            </div>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-full shadow-md whitespace-nowrap"
            >
              Load File
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".srt,.vtt,.ass"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
            />
          </>
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
initSandbox();
console.log('Anime Subtitle Learning Content Script loaded.');
