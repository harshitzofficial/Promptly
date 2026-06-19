import { BACKEND_URL } from '../utils/config';

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
  // Key: "cache:<hash>" -> { prompt, ratio, optimizedPrompt, tokensSaved, percentSaved, originalTokens, optimizedTokens, cachedAt }
  
  function levenshtein(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[a.length][b.length];
  }

  function similarity(a: string, b: string): number {
    const dist = levenshtein(a, b);
    return 1 - (dist / Math.max(a.length, b.length));
  }

  async function hashPrompt(prompt: string, ratio: number): Promise<string> {
    const normalized = prompt.trim().replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n') + `::${ratio}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function getCachedResult(prompt: string, ratio: number) {
    const all = await browser.storage.local.get(null);
    let bestMatch = null;
    let highestSim = 0;
    
    for (const key of Object.keys(all)) {
      if (key.startsWith('cache:')) {
        const cached = all[key];
        if (Date.now() - cached.cachedAt > 86400000) {
          await browser.storage.local.remove(key); // clear expired
          continue;
        }
        if (cached.ratio === ratio) {
          const sim = similarity(prompt.toLowerCase(), cached.prompt.toLowerCase());
          if (sim > highestSim && sim >= 0.95) {
            highestSim = sim;
            bestMatch = cached;
          }
        }
      }
    }
    return bestMatch;
  }

  async function setCachedResult(prompt: string, ratio: number, result: any) {
    const hash = await hashPrompt(prompt, ratio);
    const key = `cache:${hash}`;
    await browser.storage.local.set({
      [key]: { prompt, ratio, ...result, cachedAt: Date.now() }
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

  // ─── Provider Key Management ───
  // API keys are stored locally and NEVER sent to our backend.
  // Calls are made directly from this service worker to OpenAI/Anthropic.

  async function getProviderSettings() {
    const data = await browser.storage.local.get(['openaiKey', 'anthropicKey', 'geminiKey', 'preferredProvider']);
    return {
      preferredProvider: (data.preferredProvider as string) || 'gemini',
      hasOpenAiKey: !!data.openaiKey,
      hasAnthropicKey: !!data.anthropicKey,
      hasGeminiKey: !!data.geminiKey,
      openaiKey: (data.openaiKey as string) || null,
      anthropicKey: (data.anthropicKey as string) || null,
      geminiKey: (data.geminiKey as string) || null,
    };
  }

  const SYSTEM_INSTRUCTION = (targetPercent: number) =>
    `You are an expert context curator. The user is providing a prompt that needs to be shortened to save tokens. Your job is to condense the text while strictly preserving all instructions, facts, constraints, and the original intent. Remove conversational filler, redundant examples, and unnecessary politeness. Provide ONLY the optimized prompt, with no preamble. Target compression ratio: Keep approximately ${targetPercent}% of the original length.

CRITICAL CONSTRAINTS:
- NEVER modify or compress code blocks (e.g. \`\`\`...\`\`\`).
- NEVER modify or compress JSON payloads or structural objects.
- NEVER modify exact variable names or text inside quotes.

Example:
Original: "I would appreciate it if you could please write a python script that prints hello world."
Optimized: "Python script to print hello world."`;

  async function streamProvider(provider: string, prompt: string, ratio: number, apiKey: string, port: any): Promise<string> {
    const targetPercent = Math.round((ratio ?? 0.6) * 100);
    const system = SYSTEM_INSTRUCTION(targetPercent);
    
    let url = '', headers: any = {}, body = '';
    
    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = JSON.stringify({ model: 'gpt-4o-mini', messages: [{role:'system', content:system}, {role:'user', content:prompt}], stream: true, temperature: 0.3 });
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 4096, system, messages: [{role:'user', content:prompt}], stream: true });
    } else if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({ systemInstruction: { parts: [{text:system}] }, contents: [{parts:[{text:prompt}]}] });
    }

    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${provider} API Error: ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream');
    const decoder = new TextDecoder();
    
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            let textChunk = '';
            if (provider === 'openai') textChunk = data.choices?.[0]?.delta?.content || '';
            else if (provider === 'anthropic' && data.type === 'content_block_delta') textChunk = data.delta?.text || '';
            else if (provider === 'gemini' && data.candidates) textChunk = data.candidates[0]?.content?.parts?.[0]?.text || '';
            
            if (textChunk) {
              fullText += textChunk;
              port.postMessage({ type: 'chunk', text: textChunk });
            }
          } catch(e) {}
        }
      }
    }
    return fullText.trim();
  }

  // ─── Message Handler ───
  
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'providerStream') {
      port.onMessage.addListener(async (msg) => {
        try {
          const { prompt, ratio } = msg;
          const settings = await getProviderSettings();
          let method = '';
          let provider = '';
          let key = '';

          if (settings.preferredProvider === 'openai' && settings.openaiKey) {
            provider = 'openai'; key = settings.openaiKey; method = 'openai';
          } else if (settings.preferredProvider === 'anthropic' && settings.anthropicKey) {
            provider = 'anthropic'; key = settings.anthropicKey; method = 'anthropic';
          } else if (settings.preferredProvider === 'gemini' && settings.geminiKey) {
            provider = 'gemini'; key = settings.geminiKey; method = 'gemini-agent';
          } else {
            port.postMessage({ type: 'error', useBackend: true });
            return;
          }

          const fullText = await streamProvider(provider, prompt, ratio, key, port);
          port.postMessage({ type: 'done', method, fullText });
        } catch (err: any) {
          port.postMessage({ type: 'error', error: err.message });
        }
      });
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = getPlatform(sender.tab?.url);

    
    if (message.action === 'trackUsage') {
      getSessionId().then(baseId => {
        const sessionId = `${baseId}-${platform}`;
        fetch(`${BACKEND_URL}/api/track`, {
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
          const res = await fetch(`${BACKEND_URL}/api/session/${sessionId}`);
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
        const cached = await getCachedResult(message.prompt, message.ratio ?? 0.6);
        if (cached) {
          await incrementCacheHits();
          sendResponse({ hit: true, data: { ...cached, fromCache: true } });
        } else {
          sendResponse({ hit: false });
        }
      })();
      return true;
    }

    if (message.action === 'setCache') {
      (async () => {
        await setCachedResult(message.prompt, message.ratio ?? 0.6, message.result);
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

    // ── Provider Settings ──────────────────────────────────────────────────
    if (message.action === 'getProviderSettings') {
      (async () => {
        const settings = await getProviderSettings();
        // Never expose raw keys to the content script
        sendResponse({ success: true, data: {
          preferredProvider: settings.preferredProvider,
          hasOpenAiKey: settings.hasOpenAiKey,
          hasAnthropicKey: settings.hasAnthropicKey,
        }});
      })();
      return true;
    }

    if (message.action === 'setProviderKey') {
      (async () => {
        const { provider, key } = message;
        if (provider === 'openai') {
          await browser.storage.local.set({ openaiKey: key, preferredProvider: 'openai' });
        } else if (provider === 'anthropic') {
          await browser.storage.local.set({ anthropicKey: key, preferredProvider: 'anthropic' });
        } else if (provider === 'gemini') {
          // Gemini key is optional — save it but keep gemini as provider (uses server by default)
          await browser.storage.local.set({ geminiKey: key, preferredProvider: 'gemini' });
        } else {
          await browser.storage.local.set({ preferredProvider: 'gemini' });
        }
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.action === 'removeProviderKey') {
      (async () => {
        const { provider } = message;
        if (provider === 'openai') {
          await browser.storage.local.remove('openaiKey');
        } else if (provider === 'anthropic') {
          await browser.storage.local.remove('anthropicKey');
        } else if (provider === 'gemini') {
          await browser.storage.local.remove('geminiKey');
        }
        // Always fall back to server-managed gemini
        await browser.storage.local.set({ preferredProvider: 'gemini' });
        sendResponse({ success: true });
      })();
      return true;
    }

    
  });
});
