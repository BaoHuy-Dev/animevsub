import React from 'react';
import { useFloating, offset, flip, shift } from '@floating-ui/react';
import { DictionaryEntry } from '@animevsub/shared';
import { cn } from '../lib/utils';

export interface DictionaryPopupProps {
  entry: DictionaryEntry | null;
  referenceElement: HTMLElement | null;
}

export const DictionaryPopup: React.FC<DictionaryPopupProps> = ({ entry, referenceElement }) => {
  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: referenceElement,
    },
    placement: 'top',
    middleware: [offset(10), flip(), shift()],
  });

  if (!entry || !referenceElement) return null;

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className={cn(
        "bg-gray-900 text-white rounded-lg shadow-xl p-4 min-w-[300px] z-[9999999]",
        "border border-gray-700"
      )}
    >
      <div className="flex justify-between items-baseline mb-2">
        <h2 className="text-2xl font-bold">{entry.kanji[0] || entry.readings[0]}</h2>
        <span className="text-gray-400 text-sm">{entry.readings.join(', ')}</span>
      </div>
      
      {entry.partOfSpeech.length > 0 && (
        <div className="text-xs text-blue-400 mb-2">
          {entry.partOfSpeech.join(', ')}
        </div>
      )}
      
      <ol className="list-decimal list-inside space-y-1">
        {entry.meanings.map((meaning, i) => (
          <li key={i} className="text-sm text-gray-200">
            {meaning}
          </li>
        ))}
      </ol>
      
      {entry.jlpt && (
        <div className="mt-3 text-xs bg-indigo-900/50 text-indigo-300 inline-block px-2 py-1 rounded">
          JLPT N{entry.jlpt}
        </div>
      )}
    </div>
  );
};
