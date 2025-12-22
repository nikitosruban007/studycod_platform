import * as crypto from "crypto";

/**
 * Picks primary OpenRouter API key with fallback to backup list.
 * Env:
 *  - OPENROUTER_API_KEY (primary)
 *  - OPENROUTER_BACKUP_API_KEYS (comma separated)
 */
export function pickOpenRouterKey(): string | null {
  const primary = (process.env.OPENROUTER_API_KEY || "").trim();
  const backups = (process.env.OPENROUTER_BACKUP_API_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const candidates = [primary, ...backups].filter(Boolean);
  if (!candidates.length) return null;

  // Simple rotation: pseudo-random pick to distribute load a bit
  const idx = crypto.randomInt(0, candidates.length);
  return candidates[idx];
}

