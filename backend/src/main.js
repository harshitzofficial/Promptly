import express from 'express';
import cors from 'cors';
import { getEncoding } from 'js-tiktoken';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
// Initialize tiktoken encoding (using o200k_base or cl100k_base)
// js-tiktoken provides 'cl100k_base' which is commonly used for ChatGPT
const encoding = getEncoding('cl100k_base');
// Simple in-memory store for sessions (in a real app, use Redis/DB)
// Maps sessionId -> { tokensUsed: number, lastReset: number }
const sessions = {};
const DAILY_LIMIT = 10000;
// Basic prompt compression logic (mock)
// A real version would use an LLM API or advanced NLP library
function compressPrompt(text) {
    let compressed = text;
    // 1. Remove common filler phrases
    const fillers = [
        /please/gi,
        /can you/gi,
        /could you/gi,
        /would you mind/gi,
        /I was wondering if/gi,
        /I would like you to/gi,
        /make sure to/gi,
        /it would be great if/gi
    ];
    for (const regex of fillers) {
        compressed = compressed.replace(regex, '');
    }
    // 2. Remove extra whitespace and newlines
    compressed = compressed.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
    compressed = compressed.replace(/[ \t]{2,}/g, ' '); // Max 1 space
    // 3. Trim
    return compressed.trim();
}
app.post('/api/optimize', (req, res) => {
    const { prompt, sessionId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    const originalTokens = encoding.encode(prompt).length;
    const optimizedPrompt = compressPrompt(prompt);
    const optimizedTokens = encoding.encode(optimizedPrompt).length;
    const tokensSaved = originalTokens - optimizedTokens;
    // Track session usage if a sessionId is provided
    if (sessionId) {
        if (!sessions[sessionId]) {
            sessions[sessionId] = { tokensUsed: 0, lastReset: Date.now() };
        }
        // Reset daily (86400000 ms)
        if (Date.now() - sessions[sessionId].lastReset > 86400000) {
            sessions[sessionId].tokensUsed = 0;
            sessions[sessionId].lastReset = Date.now();
        }
        sessions[sessionId].tokensUsed += optimizedTokens;
    }
    res.json({
        originalTokens,
        optimizedTokens,
        tokensSaved,
        optimizedPrompt,
        percentSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0
    });
});
app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessions[sessionId]) {
        sessions[sessionId] = { tokensUsed: 0, lastReset: Date.now() };
    }
    const session = sessions[sessionId];
    const timeUntilRefresh = 86400000 - (Date.now() - session.lastReset);
    res.json({
        tokensUsed: session.tokensUsed,
        limit: DAILY_LIMIT,
        remaining: Math.max(0, DAILY_LIMIT - session.tokensUsed),
        timeUntilRefreshMs: timeUntilRefresh
    });
});
app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
});
//# sourceMappingURL=main.js.map