import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { getEncoding } from 'js-tiktoken';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const encoding = getEncoding('cl100k_base');

function getPricing(platform: string): number {
  const stmt = db.prepare('SELECT pricePerMillion FROM pricing WHERE platform = ?');
  const result = stmt.get(platform) as any;
  if (result) return result.pricePerMillion;
  
  const defaultResult = stmt.get('default') as any;
  return defaultResult ? defaultResult.pricePerMillion : 1.00;
}

function getPlatformConfig(sessionId: string) {
  if (sessionId.endsWith('-chatgpt')) return { limit: 40000, refreshMs: 3 * 3600 * 1000, pricePerMillion: getPricing('chatgpt') }; // GPT-4o
  if (sessionId.endsWith('-claude')) return { limit: 200000, refreshMs: 5 * 3600 * 1000, pricePerMillion: getPricing('claude') }; // Claude 3.5 Sonnet
  if (sessionId.endsWith('-gemini')) return { limit: 1000000, refreshMs: 24 * 3600 * 1000, pricePerMillion: getPricing('gemini') }; // Gemini 1.5 Pro
  return { limit: 10000, refreshMs: 24 * 3600 * 1000, pricePerMillion: getPricing('default') };
}

function getSession(sessionId: string) {
  const stmt = db.prepare('SELECT * FROM sessions WHERE sessionId = ?');
  let session = stmt.get(sessionId) as any;
  const config = getPlatformConfig(sessionId);

  if (!session) {
    session = { sessionId, tokensUsed: 0, tokensSaved: 0, lastReset: Date.now() };
    db.prepare('INSERT INTO sessions (sessionId, tokensUsed, tokensSaved, lastReset) VALUES (?, ?, ?, ?)').run(
      session.sessionId, session.tokensUsed, session.tokensSaved, session.lastReset
    );
  } else if (Date.now() - session.lastReset > config.refreshMs) {
    session.tokensUsed = 0;
    session.lastReset = Date.now();
    db.prepare('UPDATE sessions SET tokensUsed = ?, lastReset = ? WHERE sessionId = ?').run(
      session.tokensUsed, session.lastReset, sessionId
    );
  }
  return session;
}

function updateSessionUsage(sessionId: string, addedTokensUsed: number, addedTokensSaved: number) {
  const session = getSession(sessionId);
  db.prepare('UPDATE sessions SET tokensUsed = tokensUsed + ?, tokensSaved = tokensSaved + ? WHERE sessionId = ?').run(
    addedTokensUsed, addedTokensSaved, sessionId
  );
}

function logHistory(
  sessionId: string, prompt: string, compressed: string, 
  originalTokens: number, optimizedTokens: number, 
  costSaved: number, method: string
) {
  db.prepare(`
    INSERT INTO history (sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, timestamp, method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, Date.now(), method);
}

const LLMLINGUA_URL = 'http://localhost:3006/compress';
const LLMLINGUA_TIMEOUT_MS = 15000;

function regexCompress(text: string): string {
  let compressed = text;
  const fillers = [
    /\bplease\b/gi, /\bcan you\b/gi, /\bcould you\b/gi,
    /\bwould you mind\b/gi, /\bI was wondering if\b/gi,
    /\bI would like you to\b/gi, /\bmake sure to\b/gi,
    /\bit would be great if\b/gi, /\bkindly\b/gi,
  ];
  for (const regex of fillers) compressed = compressed.replace(regex, '');
  compressed = compressed.replace(/\n{3,}/g, '\n\n');
  compressed = compressed.replace(/[ \t]{2,}/g, ' ');
  return compressed.trim();
}

app.get('/api/pricing', (req, res) => {
  try {
    const pricing = db.prepare('SELECT * FROM pricing').all();
    res.json({ success: true, pricing });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pricing', (req, res) => {
  const { platform, pricePerMillion } = req.body;
  if (!platform || typeof pricePerMillion !== 'number') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  try {
    db.prepare('UPDATE pricing SET pricePerMillion = ? WHERE platform = ?').run(pricePerMillion, platform);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/track', (req, res) => {
  const { prompt, sessionId } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const tokens = encoding.encode(prompt).length;

  if (sessionId) {
    updateSessionUsage(sessionId, tokens, 0);
  }

  res.json({ success: true, tokensUsedAdded: tokens });
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const config = getPlatformConfig(sessionId);
  const session = getSession(sessionId);
  const timeUntilRefresh = config.refreshMs - (Date.now() - session.lastReset);

  res.json({
    tokensUsed: session.tokensUsed,
    tokensSaved: session.tokensSaved,
    limit: config.limit,
    remaining: Math.max(0, config.limit - session.tokensUsed),
    timeUntilRefreshMs: timeUntilRefresh,
    totalCostSaved: Number(((session.tokensSaved / 1000000) * config.pricePerMillion).toFixed(6))
  });
});

app.get('/api/stats', (req, res) => {
  try {
    // 1. Get history logs (latest 50)
    const history = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50').all();

    // 2. Aggregate total money saved
    const sessions = db.prepare('SELECT sessionId, tokensSaved FROM sessions').all() as any[];
    let totalMoneySaved = 0;
    for (const s of sessions) {
      const price = getPlatformConfig(s.sessionId).pricePerMillion;
      totalMoneySaved += (s.tokensSaved / 1000000) * price;
    }

    // 3. Aggregate daily tokens saved for the chart (last 7 days)
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const dailyData: Record<string, number> = {};
    
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * oneDay);
      const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
      dailyData[dateStr] = 0;
    }

    const logs = db.prepare('SELECT originalTokens, optimizedTokens, timestamp FROM history WHERE timestamp > ?').all(now - 7 * oneDay) as any[];
    for (const log of logs) {
      const d = new Date(log.timestamp);
      const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
      if (dailyData[dateStr] !== undefined) {
        dailyData[dateStr] += (log.originalTokens - log.optimizedTokens);
      }
    }

    const chartData = Object.entries(dailyData).map(([date, tokens]) => ({ date, tokens }));

    res.json({
      success: true,
      totalMoneySaved: Number(totalMoneySaved.toFixed(4)),
      chartData,
      history
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/optimize/stream', async (req, res) => {
  const { prompt, sessionId, ratio } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const streamUrl = process.env.LLMLINGUA_URL || 'http://localhost:3006/compress/stream';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ratio: ratio ?? 0.6 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.body) throw new Error('No stream body from LLMLingua');

    const reader = (upstream.body as any).getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'done' && sessionId) {
            const config = getPlatformConfig(sessionId);
            updateSessionUsage(sessionId, 0, data.tokensSaved ?? 0);
            data.costSaved = Number(((data.tokensSaved / 1000000) * config.pricePerMillion).toFixed(6));
            
            logHistory(sessionId, prompt, data.optimizedPrompt, data.originalTokens, data.optimizedTokens, data.costSaved, data.method);
          }
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch { /* skip malformed lines */ }
      }
    }
    res.end();

  } catch (err) {
    console.warn('[stream] Python offline, using regex fallback');
    const compressed = regexCompress(prompt);
    const originalTokens = encoding.encode(prompt).length;
    const optimizedTokens = encoding.encode(compressed).length;
    const tokensSaved = Math.max(0, originalTokens - optimizedTokens);

    const words = compressed.split(' ');
    for (let i = 0; i < words.length; i++) {
      const text = i === 0 ? words[i] : ' ' + words[i];
      res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
      await new Promise(r => setTimeout(r, 20));
    }
    const config = getPlatformConfig(sessionId);
    const costSaved = (tokensSaved / 1000000) * config.pricePerMillion;

    if (sessionId) {
      updateSessionUsage(sessionId, 0, tokensSaved);
      logHistory(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, 'fallback');
    }

    res.write(`data: ${JSON.stringify({
      type: 'done', method: 'fallback',
      originalTokens, optimizedTokens, tokensSaved,
      percentSaved: Math.round((tokensSaved / originalTokens) * 100),
      optimizedPrompt: compressed,
      costSaved: Number(costSaved.toFixed(6))
    })}\n\n`);
    res.end();
  }
});

app.post('/api/log-cache', (req, res) => {
  const { sessionId, prompt, compressed, originalTokens, optimizedTokens } = req.body;
  if (!sessionId || !prompt || !compressed) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  const config = getPlatformConfig(sessionId);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const costSaved = Number(((tokensSaved / 1000000) * config.pricePerMillion).toFixed(6));
  
  updateSessionUsage(sessionId, 0, tokensSaved);
  logHistory(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, 'cache');
  
  res.json({ success: true, tokensSaved, costSaved });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
