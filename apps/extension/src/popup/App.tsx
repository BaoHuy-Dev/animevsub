import React, { useEffect } from 'react';
import { useSettingsStore } from '../store/settings';

const App: React.FC = () => {
  const settings = useSettingsStore();

  useEffect(() => {
    settings.loadFromStorage();
  }, []);

  return (
    <div className="p-6 min-w-[320px] bg-gray-900 text-white min-h-[400px]">
      <h1 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Subtitle Settings</h1>
      
      <div className="space-y-4">
        {/* Toggles */}
        <div className="flex items-center justify-between">
          <label className="text-sm">Show Japanese [Alt+J]</label>
          <input type="checkbox" checked={settings.showJapanese} onChange={settings.toggleJapanese} className="w-4 h-4" />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm">Show Romaji [Alt+R]</label>
          <input type="checkbox" checked={settings.showRomaji} onChange={settings.toggleRomaji} className="w-4 h-4" />
        </div>

        <hr className="border-gray-700 my-2" />

        {/* Styling */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Font Size: {settings.fontSize}px</label>
          <input type="range" min="12" max="72" value={settings.fontSize} onChange={(e) => settings.setStyle('fontSize', parseInt(e.target.value))} className="w-full" />
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Font Color</label>
            <input type="color" value={settings.fontColor} onChange={(e) => settings.setStyle('fontColor', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Outline Color</label>
            <input type="color" value={settings.outlineColor} onChange={(e) => settings.setStyle('outlineColor', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Outline Width: {settings.outlineWidth}px</label>
          <input type="range" min="0" max="10" value={settings.outlineWidth} onChange={(e) => settings.setStyle('outlineWidth', parseInt(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Opacity: {settings.opacity}</label>
          <input type="range" min="0" max="1" step="0.1" value={settings.opacity} onChange={(e) => settings.setStyle('opacity', parseFloat(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Bottom Offset: {settings.bottomOffset}px</label>
          <input type="range" min="0" max="300" value={settings.bottomOffset} onChange={(e) => settings.setStyle('bottomOffset', parseInt(e.target.value))} className="w-full" />
        </div>

      </div>
    </div>
  );
};

export default App;
