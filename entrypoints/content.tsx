import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import { getActiveEditable, getEditableText, setEditableText } from '../utils/dom';
import { SidebarSlider } from '../components/SidebarSlider';
import { QuickActionPills } from '../components/QuickActionPills';
import { ToastNotification } from '../components/ToastNotification';

declare global {
  interface Window {
    __lastSubmitActionTime?: number;
  }
}

const App = () => {
  const [successNotice, setSuccessNotice] = useState<{ method: string, isCacheHit: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.action === 'trigger-optimize') {
        handleOptimize();
      } else if (msg.action === 'inject-prompt') {
        const target = getActiveEditable();
        if (target) setEditableText(target, msg.prompt);
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        e.stopPropagation();
        handleOptimize();
      }
    };
    document.addEventListener('keydown', handleShortcut, true);
    return () => document.removeEventListener('keydown', handleShortcut, true);
  });

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  const handleOptimize = async (actionOverride?: string) => {
    const target = getActiveEditable();
    if (!target) { showError('Please click inside the AI textbox first, then press Ctrl+Shift+O.'); return; }

    const text = getEditableText(target);
    if (!text.trim()) { showError('Please type a prompt first before enhancing.'); return; }

    try {
      const processOutput = (optText: string) => optText;

      // 1. Check cache first
      const cacheRes = await browser.runtime.sendMessage({ action: 'checkCache', prompt: text });
      if (cacheRes?.hit && cacheRes.data?.optimizedPrompt) {
        setEditableText(target, processOutput(cacheRes.data.optimizedPrompt));
        setSuccessNotice({ method: cacheRes.data.method, isCacheHit: true });
        setTimeout(() => setSuccessNotice(null), 4000);
        return;
      }

      // 2. Check for custom provider key
      const port = browser.runtime.connect({ name: 'providerStream' });

      const providerRes: any = await new Promise((resolve) => {
        let streamed = '';
        let started = false;

        port.onMessage.addListener((msg) => {
          if (msg.type === 'error') {
            showError(`${msg.error || 'Unknown error.'}`);
            resolve({ success: false });
          } else if (msg.type === 'chunk') {
            if (!started) { setEditableText(target, ''); started = true; }
            streamed += msg.text;
            setEditableText(target, processOutput(streamed));
          } else if (msg.type === 'done') {
            resolve({ success: true, optimizedPrompt: msg.fullText, method: msg.method });
          }
        });

        port.postMessage({ prompt: text, actionOverride });
      });

      if (providerRes?.success && providerRes.optimizedPrompt) {
        browser.runtime.sendMessage({
          action: 'setCache', prompt: text, result: {
            optimizedPrompt: providerRes.optimizedPrompt, method: providerRes.method
          }
        });
        setSuccessNotice({ method: providerRes.method, isCacheHit: false });
        setTimeout(() => setSuccessNotice(null), 4000);
        return;
      }

      if (providerRes && !providerRes.success) {
        return;
      }

    } catch (e: any) {
      console.error('[optimize stream]', e);
      showError(`❌ Enhancement failed: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <QuickActionPills handleOptimize={handleOptimize} />
      <ToastNotification errorMsg={errorMsg} setErrorMsg={setErrorMsg} successNotice={successNotice} />
      <SidebarSlider />
    </>
  );
};

export default defineContentScript({
  matches: ['*://chatgpt.com/*', '*://claude.ai/*', '*://gemini.google.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'promptly-ui',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
