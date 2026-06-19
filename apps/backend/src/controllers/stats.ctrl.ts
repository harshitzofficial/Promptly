import type { Request, Response } from 'express';
import { getEncoding } from 'js-tiktoken';
import db from '../config/db.js';
import { getPlatformConfig } from '../utils/pricing.util.js';
import { getSession, updateSessionUsage, logHistory } from '../services/session.service.js';

const encoding = getEncoding('cl100k_base');

export function getPricingApi(req: Request, res: Response) {
  try {
    const pricing = db.prepare('SELECT * FROM pricing').all();
    res.json({ success: true, pricing });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export function updatePricingApi(req: Request, res: Response) {
  const { platform, pricePerMillion } = req.body;
  if (!platform || typeof pricePerMillion !== 'number') {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }
  try {
    db.prepare('UPDATE pricing SET pricePerMillion = ? WHERE platform = ?').run(pricePerMillion, platform);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export function trackApi(req: Request, res: Response) {
  const { prompt, sessionId } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  const tokens = encoding.encode(prompt).length;

  if (sessionId) {
    updateSessionUsage(sessionId, tokens, 0);
  }

  res.json({ success: true, tokensUsedAdded: tokens });
}

export function getSessionApi(req: Request, res: Response) {
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
}

export function getStatsApi(req: Request, res: Response) {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 7));
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const since = now - days * oneDay;

    // History for the selected range (last 100 for display)
    const history = db.prepare(
      'SELECT * FROM history ORDER BY timestamp DESC LIMIT 100'
    ).all();

    // Total money saved — sum costSaved directly from ALL history
    // (works for all providers: Gemini, OpenAI, Anthropic, cache)
    const totalRow = db.prepare(
      'SELECT COALESCE(SUM(costSaved), 0) as total FROM history'
    ).get() as any;
    const totalMoneySaved = Number(totalRow.total.toFixed(4));

    // Chart data — group by day or week depending on range
    const useWeekly = days > 60;
    const chartData: { date: string; tokens: number }[] = [];

    if (useWeekly) {
      // Weekly buckets
      const weeks = Math.ceil(days / 7);
      for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = now - (i + 1) * 7 * oneDay;
        const weekEnd = now - i * 7 * oneDay;
        const weekLabel = new Date(weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const logs = db.prepare(
          'SELECT originalTokens, optimizedTokens FROM history WHERE timestamp > ? AND timestamp <= ?'
        ).all(weekStart, weekEnd) as any[];
        const tokens = logs.reduce((sum: number, l: any) => sum + Math.max(0, l.originalTokens - l.optimizedTokens), 0);
        chartData.push({ date: weekLabel, tokens });
      }
    } else {
      // Daily buckets
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now - i * oneDay);
        const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + oneDay;
        const logs = db.prepare(
          'SELECT originalTokens, optimizedTokens FROM history WHERE timestamp >= ? AND timestamp < ?'
        ).all(dayStart, dayEnd) as any[];
        const tokens = logs.reduce((sum: number, l: any) => sum + Math.max(0, l.originalTokens - l.optimizedTokens), 0);
        chartData.push({ date: dateStr, tokens });
      }
    }

    res.json({
      success: true,
      totalMoneySaved,
      chartData,
      history,
      days,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export function logCacheApi(req: Request, res: Response) {
  const { sessionId, prompt, compressed, originalTokens, optimizedTokens } = req.body;
  if (!sessionId || !prompt || !compressed) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }
  const config = getPlatformConfig(sessionId);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const costSaved = Number(((tokensSaved / 1000000) * config.pricePerMillion).toFixed(6));
  
  updateSessionUsage(sessionId, 0, tokensSaved);
  logHistory(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, 'cache');
  
  res.json({ success: true, tokensSaved, costSaved });
}

export function logCustomApi(req: Request, res: Response) {
  const { sessionId, prompt, compressed, originalTokens, optimizedTokens, method } = req.body;
  if (!sessionId || !prompt || !compressed || !method) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }
  const config = getPlatformConfig(sessionId);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const costSaved = Number(((tokensSaved / 1000000) * config.pricePerMillion).toFixed(6));
  
  updateSessionUsage(sessionId, 0, tokensSaved);
  logHistory(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, method);
  
  res.json({ success: true, tokensSaved, costSaved });
}
