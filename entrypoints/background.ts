
/**
 * ==========================================================
 * BACKGROUND.TS
 * ==========================================================
 *
 * This is the extension's background service worker.
 *
 * Responsibilities:
 *
 * 1. Create right-click context menu
 * 2. Store and manage API keys
 * 3. Cache optimized prompts
 * 4. Handle communication between:
 *      - Popup UI
 *      - Content Scripts
 *      - Backend Server
 *      - AI Providers
 * 5. Stream responses from OpenAI/Claude/Gemini
 *
 * Architecture:
 *
 * Popup
 *   ↓
 * Background Script
 *   ↓
 * ├── Browser Storage
 * ├── Backend API
 * ├── OpenAI API
 * ├── Anthropic API
 * └── Gemini API
 *
 */


// Start background service worker when extension loads
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



  // ─── Persistent Session Storage ───
  // Mirrors backend session data locally so stats survive backend restarts


  // ─── Provider Key Management ───
  // API keys are stored locally and NEVER sent to our backend.
  // Calls are made directly from this service worker to OpenAI/Anthropic.

  async function getProviderSettings() {
    const data = await browser.storage.local.get(['openaiKey', 'anthropicKey', 'geminiKey', 'ollamaModel', 'preferredProvider']);
    return {
      preferredProvider: (data.preferredProvider as string) || 'gemini',
      hasOpenAiKey: !!data.openaiKey,
      hasAnthropicKey: !!data.anthropicKey,
      hasGeminiKey: !!data.geminiKey,
      hasOllamaModel: !!data.ollamaModel,
      openaiKey: (data.openaiKey as string) || null,
      anthropicKey: (data.anthropicKey as string) || null,
      geminiKey: (data.geminiKey as string) || null,
      ollamaModel: (data.ollamaModel as string) || null,
    };
  }

  const TONE_INSTRUCTIONS: Record<string, string> = {
    professional: 'Write the enhanced prompt in a formal, structured, business-appropriate style. Use clear headings, numbered steps, and professional language.',
    creative: 'Write the enhanced prompt in an imaginative, expressive, open-ended style. Encourage exploration, storytelling, and unconventional thinking.',
    technical: 'Write the enhanced prompt in a precise, expert-level technical style. Include specific technical constraints, expected formats (e.g., JSON, code), and edge cases.',
    simple: 'Write the enhanced prompt in a clear, concise, plain-English style. Avoid jargon. Make it easy for anyone to understand the instructions.',
  };

  const SYSTEM_INSTRUCTION = (tone: string) => {
    const toneGuide = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS['professional'];
    return `You are a world-class Prompt Engineer. Your only job is to take a user's rough, vague, or broken draft prompt and rewrite it into a perfectly structured, highly effective prompt that will extract the best possible output from an AI model.

YOUR PROCESS:
1. Deeply understand the user's true goal and intent.
2. Assign the ideal expert PERSONA/ROLE to the AI (e.g., "Act as a senior software engineer", "Act as a Harvard professor", "Act as a professional chef", etc.) — choose based on the topic.
3. Expand the prompt with rich context, specific constraints, output format instructions, and any other details that will maximise the quality of the AI's response.
4. Ask the AI to reason step-by-step where relevant.

TONE: ${toneGuide}

CRITICAL RULES:
- Output ONLY the final enhanced prompt. No preamble, no explanation, no commentary.
- NEVER answer the user's question. Only rewrite the prompt.
- NEVER shorten or summarise. Always expand.
- The enhanced prompt MUST be more detailed and longer than the original.
- DO NOT use Markdown formatting (like **, ##, etc.). Use plain text formatting only (e.g., UPPERCASE for emphasis or standard numbers for lists).
- Example input: "what is an api" → Example output: "Act as an expert computer science professor teaching a beginner. Explain what an API (Application Programming Interface) is, starting with a simple real-world analogy. Cover: what it is, how it works, why it matters, types of APIs (REST, SOAP, GraphQL), and include a short code example. Structure your answer with clear headings and think step-by-step."`;
  };

  async function streamProvider(provider: string, prompt: string, apiKey: string, port: any, actionOverride?: string): Promise<string> {
    const prefData = await browser.storage.local.get(['selectedTone', 'selectedDetail']);
    const tone = (prefData.selectedTone as string) || 'professional';
    const detail = (prefData.selectedDetail as string) || 'balanced';

    // Detail constraints
    let detailInstruction = '';
    if (detail === 'concise') {
      detailInstruction = 'Keep the prompt as concise and brief as possible. Remove all unnecessary filler words. Focus only on the core instructions.';
    } else if (detail === 'comprehensive') {
      detailInstruction = 'Make the prompt extremely detailed. Add comprehensive context, explicitly list all edge cases, and provide highly specific formatting rules.';
    } else {
      detailInstruction = 'Provide a balanced level of detail. Include enough context to be clear, but avoid overwhelming the AI with unnecessary verbosity.';
    }

    let system = SYSTEM_INSTRUCTION(tone) + `\n\nLEVEL OF DETAIL: ${detailInstruction}`;
    let wrappedPrompt = `Rewrite and enhance the following draft prompt. DO NOT answer the prompt — only rewrite it.\n\nDRAFT PROMPT:\n"""\n${prompt}\n"""`;
    
    if (actionOverride) {
      if (actionOverride === 'Fix Grammar') {
        system = `You are a professional editor. Your ONLY job is to fix spelling, grammar, and punctuation mistakes in the provided text. DO NOT change the tone, DO NOT expand it, and DO NOT answer the prompt. Just output the corrected text. DO NOT use Markdown formatting (like **, ##, etc.). Use plain text formatting only. CRITICAL: Output ONLY the raw corrected text. Do NOT include any conversational filler, introductions, or explanations (e.g., do not say "Here is the corrected text").`;
        wrappedPrompt = `Fix the grammar of this text. Return ONLY the corrected text and nothing else:\n\n"""\n${prompt}\n"""`;
      } else if (actionOverride === 'Make Professional') {
        system = `You are an expert prompt engineer. Your ONLY job is to rewrite the provided text to be highly professional, clear, and articulate. DO NOT format it as an email or letter (e.g. no "Dear..." or "Best regards"). The text is a prompt for an AI, so it should remain a prompt. DO NOT answer the prompt. DO NOT use Markdown formatting (like **, ##, etc.). Use plain text formatting only. CRITICAL: Output ONLY the raw rewritten text without any introductory phrases, filler, or commentary (e.g., do not say "Here is the rewritten text").`;
        wrappedPrompt = `Rewrite this prompt to sound highly professional. Return ONLY the rewritten text and nothing else:\n\n"""\n${prompt}\n"""`;
      } else if (actionOverride === 'Summarize') {
        system = `You are an expert editor. Your ONLY job is to rewrite the provided text to be as concise and short as possible while keeping its original meaning and intent intact. DO NOT answer the prompt, DO NOT describe the text. Just output the shortened version of the text. DO NOT use Markdown formatting (like **, ##, etc.). Use plain text formatting only. CRITICAL: Output ONLY the raw summarized text without any introductory phrases, filler, or commentary (e.g., do not say "Here is the rewritten text").`;
        wrappedPrompt = `Rewrite this text to be more concise. Return ONLY the summarized text and nothing else:\n\n"""\n${prompt}\n"""`;
      }
    }
    
    let url = '', headers: any = {}, body = '';
    
    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      body = JSON.stringify({ model: 'gpt-4o-mini', messages: [{role:'system', content:system}, {role:'user', content:wrappedPrompt}], stream: true, temperature: 0.3 });
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 4096, system, messages: [{role:'user', content:wrappedPrompt}], stream: true });
    } else if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({ systemInstruction: { parts: [{text:system}] }, contents: [{parts:[{text:wrappedPrompt}]}] });
    } else if (provider === 'ollama') {
      url = 'http://localhost:11434/api/generate';
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({ model: apiKey, system, prompt: wrappedPrompt, stream: true });
    }

    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) errMsg = errJson.error.message;
        else if (typeof errJson.error === 'string') errMsg = errJson.error;
      } catch (e) {}
      throw new Error(`${provider} API Error: ${errMsg}`);
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
        if (!line.trim()) continue;
        
        let data;
        if (provider === 'ollama') {
          try {
            data = JSON.parse(line);
          } catch(e) { continue; }
        } else if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            data = JSON.parse(line.slice(6));
          } catch(e) { continue; }
        } else {
          continue;
        }

        let textChunk = '';
        if (provider === 'openai') textChunk = data.choices?.[0]?.delta?.content || '';
        else if (provider === 'anthropic' && data.type === 'content_block_delta') textChunk = data.delta?.text || '';
        else if (provider === 'gemini' && data.candidates) textChunk = data.candidates[0]?.content?.parts?.[0]?.text || '';
        else if (provider === 'ollama') textChunk = data.response || '';
        
        if (textChunk) {
          fullText += textChunk;
          port.postMessage({ type: 'chunk', text: textChunk });
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
          const { prompt, actionOverride } = msg;
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
          } else if (settings.preferredProvider === 'ollama' && settings.ollamaModel) {
            provider = 'ollama'; key = settings.ollamaModel; method = 'ollama';
          } else {
            port.postMessage({ type: 'error', error: 'No AI provider configured. Please open extension settings and add an API key or configure Ollama.' });
            return;
          }

          const fullText = await streamProvider(provider, prompt, key, port, actionOverride);
          port.postMessage({ type: 'done', method, fullText });
        } catch (err: any) {
          port.postMessage({ type: 'error', error: err.message });
        }
      });
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = getPlatform(sender.tab?.url);

    if (message.action === 'getSessionId') {
      getSessionId().then(baseId => {
        const sessionId = `${baseId}-${platform}`;
        sendResponse({ success: true, sessionId });
      });
      return true;
    }



    if (message.action === 'addToHistory') {
      (async () => {
        const histData = await browser.storage.local.get('localHistory');
        const history: any[] = (histData.localHistory as any[]) || [];
        history.unshift({
          id: Date.now(),
          timestamp: Date.now(),
          prompt: message.prompt,
          compressed: message.result.optimizedPrompt || message.result.fullText || '',
          method: message.result.method || 'gemini-agent',
        });
        await browser.storage.local.set({ localHistory: history.slice(0, 15) });

        sendResponse({ success: true });
      })();
      return true;
    }



    if (message.action === 'getHistory') {
      (async () => {
        const histData = await browser.storage.local.get('localHistory');
        sendResponse({ success: true, history: histData.localHistory || [] });
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
          hasGeminiKey: settings.hasGeminiKey,
          hasOllamaModel: settings.hasOllamaModel,
          ollamaModel: settings.ollamaModel,
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
          await browser.storage.local.set({ geminiKey: key, preferredProvider: 'gemini' });
        } else if (provider === 'ollama') {
          await browser.storage.local.set({ ollamaModel: key, preferredProvider: 'ollama' });
        } else {
          await browser.storage.local.set({ preferredProvider: null });
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
        } else if (provider === 'ollama') {
          await browser.storage.local.remove('ollamaModel');
        }
        await browser.storage.local.set({ preferredProvider: null });
        sendResponse({ success: true });
      })();
      return true;
    }

  });
});
