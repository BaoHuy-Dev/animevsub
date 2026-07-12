import { TranslatorEngine } from '@animevsub/translator';

const translator = new TranslatorEngine();

console.log('[Sandbox] Initializing...');

(async () => {
  try {
    // In sandbox, we can use a relative or absolute URL, but it's hosted at chrome-extension://
    await translator.init('/dict/');
    console.log('[Sandbox] Kuroshiro initialized successfully.');
    window.parent.postMessage({ type: 'KUROSHIRO_READY' }, '*');
  } catch (e: any) {
    console.error('[Sandbox] Failed to initialize Kuroshiro', e);
    window.parent.postMessage({ type: 'KUROSHIRO_ERROR', error: e.message }, '*');
  }
})();

window.addEventListener('message', async (event) => {
  if (event.data?.type === 'TRANSLATE') {
    const { id, text } = event.data;
    try {
      const romaji = await translator.toRomaji(text);
      window.parent.postMessage({ type: 'TRANSLATE_RESULT', id, romaji }, '*');
    } catch (e: any) {
      window.parent.postMessage({ type: 'TRANSLATE_ERROR', id, error: e.message }, '*');
    }
  }
});
