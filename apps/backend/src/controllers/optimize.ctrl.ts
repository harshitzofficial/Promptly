import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { getEncoding } from 'js-tiktoken';
import { getPlatformConfig } from '../utils/pricing.util.js';
import { updateSessionUsage, logHistory } from '../services/session.service.js';
import { regexCompress } from '../services/optimize.service.js';

const encoding = getEncoding('cl100k_base');

export async function optimizeStream(req: Request, res: Response) {
  const { prompt, sessionId, ratio } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const countRes = await ai.models.countTokens({ model: 'gemini-2.5-flash-lite', contents: prompt });
    const originalTokens = countRes.totalTokens;
    const targetPercent = Math.round((ratio ?? 0.6) * 100);
    
    const systemInstruction = `You are an expert context curator. The user is providing a prompt that needs to be shortened to save tokens. Your job is to condense the text while strictly preserving all instructions, facts, constraints, and the original intent. Remove conversational filler, redundant examples, and unnecessary politeness. Provide ONLY the optimized prompt, with no preamble. Target compression ratio: Keep approximately ${targetPercent}% of the original length.

CRITICAL CONSTRAINTS:
- NEVER modify or compress code blocks (e.g. \`\`\`...\`\`\`).
- NEVER modify or compress JSON payloads or structural objects.
- NEVER modify exact variable names or text inside quotes.

Example:
Original: "I would appreciate it if you could please write a python script that prints hello world."
Optimized: "Python script to print hello world."`;

    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
        config: { systemInstruction }
    });

    let compressed = '';

    for await (const chunk of responseStream) {
      if (chunk.text) {
        compressed += chunk.text;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
      }
    }

    const optCountRes = await ai.models.countTokens({ model: 'gemini-2.5-flash-lite', contents: compressed });
    const optimizedTokens = optCountRes.totalTokens;
    const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
    let costSaved = 0;

    if (sessionId) {
      const config = getPlatformConfig(sessionId);
      updateSessionUsage(sessionId, 0, tokensSaved);
      costSaved = Number(((tokensSaved / 1000000) * config.pricePerMillion).toFixed(6));
      logHistory(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, 'gemini-agent');
    }

    res.write(`data: ${JSON.stringify({
      type: 'done', method: 'gemini-agent',
      originalTokens, optimizedTokens, tokensSaved,
      percentSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0,
      optimizedPrompt: compressed,
      costSaved: Number(costSaved.toFixed(6))
    })}\n\n`);
    res.end();

  } catch (err) {
    console.warn('[stream] AI offline or error, using regex fallback', err);
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
    let costSaved = 0;

    if (sessionId) {
      costSaved = (tokensSaved / 1000000) * config.pricePerMillion;
      updateSessionUsage(sessionId, 0, tokensSaved);
      logHistory(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, 'fallback');
    }

    res.write(`data: ${JSON.stringify({
      type: 'done', method: 'fallback',
      originalTokens, optimizedTokens, tokensSaved,
      percentSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0,
      optimizedPrompt: compressed,
      costSaved: Number(costSaved.toFixed(6))
    })}\n\n`);
    res.end();
  }
}
