import db from '../config/db.js';
import { getPlatformConfig } from '../utils/pricing.util.js';

export function getSession(sessionId: string) {
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

export function updateSessionUsage(sessionId: string, addedTokensUsed: number, addedTokensSaved: number) {
  const session = getSession(sessionId);
  db.prepare('UPDATE sessions SET tokensUsed = tokensUsed + ?, tokensSaved = tokensSaved + ? WHERE sessionId = ?').run(
    addedTokensUsed, addedTokensSaved, sessionId
  );
}

export function logHistory(
  sessionId: string, prompt: string, compressed: string, 
  originalTokens: number, optimizedTokens: number, 
  costSaved: number, method: string
) {
  db.prepare(`
    INSERT INTO history (sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, timestamp, method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, prompt, compressed, originalTokens, optimizedTokens, costSaved, Date.now(), method);
}
