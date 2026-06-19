import db from '../config/db.js';

export function getPricing(platform: string): number {
  const stmt = db.prepare('SELECT pricePerMillion FROM pricing WHERE platform = ?');
  const result = stmt.get(platform) as any;
  if (result) return result.pricePerMillion;
  
  const defaultResult = stmt.get('default') as any;
  return defaultResult ? defaultResult.pricePerMillion : 1.00;
}

export function getPlatformConfig(sessionId: string) {
  if (sessionId.endsWith('-chatgpt')) return { limit: 40000, refreshMs: 3 * 3600 * 1000, pricePerMillion: getPricing('chatgpt') }; // GPT-4o
  if (sessionId.endsWith('-claude')) return { limit: 200000, refreshMs: 5 * 3600 * 1000, pricePerMillion: getPricing('claude') }; // Claude 3.5 Sonnet
  if (sessionId.endsWith('-gemini')) return { limit: 1000000, refreshMs: 24 * 3600 * 1000, pricePerMillion: getPricing('gemini') }; // Gemini 1.5 Pro
  return { limit: 10000, refreshMs: 24 * 3600 * 1000, pricePerMillion: getPricing('default') };
}
