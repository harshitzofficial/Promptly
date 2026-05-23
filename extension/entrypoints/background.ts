export default defineBackground(() => {
  console.log('Background script initialized');

  // Create context menu (wrap in try-catch for hot reloading)
  browser.contextMenus.create({
    id: 'optimize-prompt',
    title: '✨ Optimize Prompt',
    contexts: ['all']
  }, () => {
    if (browser.runtime.lastError) {
      // Ignore error if it already exists
    }
  });

  // Handle context menu click
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'optimize-prompt' && tab?.id) {
      browser.tabs.sendMessage(tab.id, { action: 'trigger-optimize' });
    }
  });

  // Generate or get UUID
  async function getSessionId() {
    const data = await browser.storage.local.get('sessionId');
    if (data.sessionId) return data.sessionId;
    
    const newId = crypto.randomUUID();
    await browser.storage.local.set({ sessionId: newId });
    return newId;
  }

  function getPlatform(url?: string) {
    if (!url) return 'default';
    if (url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('gemini.google.com')) return 'gemini';
    return 'default';
  }

  // ─── Prompt Cache ───
  // Uses chrome.storage.local to cache optimized prompts.
  // Key: "cache:<hash>" -> { optimizedPrompt, tokensSaved, percentSaved, originalTokens, optimizedTokens, cachedAt }
  
  async function hashPrompt(prompt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(prompt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function getCachedResult(prompt: string) {
    const hash = await hashPrompt(prompt);
    const key = `cache:${hash}`;
    const data = await browser.storage.local.get(key);
    if (data[key]) {
      const cached = data[key];
      // Cache entries expire after 24 hours
      if (Date.now() - cached.cachedAt < 86400000) {
        return cached;
      }
      // Expired, remove it
      await browser.storage.local.remove(key);
    }
    return null;
  }

  async function setCachedResult(prompt: string, result: any) {
    const hash = await hashPrompt(prompt);
    const key = `cache:${hash}`;
    await browser.storage.local.set({
      [key]: { ...result, cachedAt: Date.now() }
    });
  }

  // ─── Cache Stats ───
  async function getCacheStats() {
    const all = await browser.storage.local.get(null);
    let hits = 0;
    let entries = 0;
    for (const key of Object.keys(all)) {
      if (key.startsWith('cache:')) {
        entries++;
      }
    }
    const statsData = await browser.storage.local.get('cacheHits');
    hits = statsData.cacheHits || 0;
    return { entries, hits };
  }

  async function incrementCacheHits() {
    const data = await browser.storage.local.get('cacheHits');
    const current = data.cacheHits || 0;
    await browser.storage.local.set({ cacheHits: current + 1 });
  }

  // ─── Persistent Session Storage ───
  // Mirrors backend session data locally so stats survive backend restarts

  async function persistSessionData(sessionId: string, data: any) {
    const key = `session:${sessionId}`;
    await browser.storage.local.set({ [key]: { ...data, persistedAt: Date.now() } });
  }

  async function getPersistedSession(sessionId: string) {
    const key = `session:${sessionId}`;
    const data = await browser.storage.local.get(key);
    return data[key] || null;
  }

  // ─── Message Handler ───
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = getPlatform(sender.tab?.url);

    if (message.action === 'optimize') {
      (async () => {
        try {
          const baseId = await getSessionId();
          const sessionId = `${baseId}-${platform}`;

          // Check cache first
          const cached = await getCachedResult(message.prompt);
          if (cached) {
            await incrementCacheHits();
            sendResponse({ success: true, data: { ...cached, fromCache: true } });
            return;
          }

          // Cache miss — call backend
          const res = await fetch('http://localhost:3005/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message.prompt, sessionId })
          });
          const data = await res.json();

          // Store in cache
          await setCachedResult(message.prompt, data);

          sendResponse({ success: true, data: { ...data, fromCache: false } });
        } catch (error: any) {
          sendResponse({ success: false, error: error.toString() });
        }
      })();
      return true;
    }
    
    if (message.action === 'trackUsage') {
      getSessionId().then(baseId => {
        const sessionId = `${baseId}-${platform}`;
        fetch('http://localhost:3005/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: message.prompt, sessionId })
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.toString() }));
      });
      return true;
    }

    if (message.action === 'getSession') {
      (async () => {
        try {
          const baseId = await getSessionId();
          const sessionId = `${baseId}-${platform}`;
          const res = await fetch(`http://localhost:3005/api/session/${sessionId}`);
          const data = await res.json();

          // Persist locally
          await persistSessionData(sessionId, data);

          sendResponse({ success: true, data: { ...data, sessionId } });
        } catch (error: any) {
          // Backend is down — try to serve persisted data
          const baseId = await getSessionId();
          const sessionId = `${baseId}-${platform}`;
          const persisted = await getPersistedSession(sessionId);
          if (persisted) {
            sendResponse({ success: true, data: { ...persisted, sessionId }, fromCache: true });
          } else {
            sendResponse({ success: false, error: error.toString() });
          }
        }
      })();
      return true;
    }

    if (message.action === 'getCacheStats') {
      getCacheStats().then(stats => {
        sendResponse({ success: true, data: stats });
      });
      return true;
    }

    if (message.action === 'checkCache') {
      (async () => {
        const cached = await getCachedResult(message.prompt);
        if (cached) {
          await incrementCacheHits();
          sendResponse({ hit: true, data: { ...cached, fromCache: true } });
        } else {
          sendResponse({ hit: false });
        }
      })();
      return true;
    }

    if (message.action === 'cacheResult') {
      (async () => {
        await setCachedResult(message.prompt, message.result);
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.action === 'clearCache') {
      (async () => {
        const all = await browser.storage.local.get(null);
        const cacheKeys = Object.keys(all).filter(k => k.startsWith('cache:'));
        if (cacheKeys.length > 0) {
          await browser.storage.local.remove(cacheKeys);
        }
        await browser.storage.local.set({ cacheHits: 0 });
        sendResponse({ success: true, cleared: cacheKeys.length });
      })();
      return true;
    }
  });
});
