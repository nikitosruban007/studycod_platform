import fetch from 'node-fetch';
import { pickOpenRouterKey } from './openRouterKeys';

export interface OpenRouterRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  response_format?: { type: string };
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
  };
}

export interface OpenRouterCallOptions {
  timeout?: number;
  maxRetries?: number;
  userId?: number;
  topicId?: number;
  traceId?: string;
}

/**
 * OpenRouter API client with timeout, retries, and fallback keys
 */
export async function callOpenRouter(
  request: OpenRouterRequest,
  options: OpenRouterCallOptions = {}
): Promise<OpenRouterResponse> {
  const {
    timeout = 30000, // 30 seconds default
    maxRetries = 2,
    userId,
    topicId,
    traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  } = options;

  const model = request.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const url = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';

  // Get all available API keys (primary + backups)
  const primary = (process.env.OPENROUTER_API_KEY || '').trim();
  const backups = (process.env.OPENROUTER_BACKUP_API_KEYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allKeys = [primary, ...backups].filter(Boolean);

  if (allKeys.length === 0) {
    throw new Error('AI_GENERATION_FAILED: No OpenRouter API keys configured');
  }

  let lastError: Error | null = null;

  // Try each API key
  for (const apiKey of allKeys) {
    // Retry logic for each key
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const logContext = {
          traceId,
          userId,
          topicId,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          keyIndex: allKeys.indexOf(apiKey) + 1,
          model,
        };

        console.log(`[OpenRouter] Request started`, logContext);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://studycod.app',
            'X-Title': 'StudyCod Task Generator',
          },
          body: JSON.stringify({
            ...request,
            model,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);
          console.error(`[OpenRouter] Request failed`, { ...logContext, status: response.status, error: errorText });
          
          // If it's a rate limit or auth error, try next key
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            lastError = error;
            break; // Try next key
          }
          
          // For other errors, retry with same key
          if (attempt < maxRetries) {
            lastError = error;
            continue;
          }
          
          throw error;
        }

        const data = await response.json() as OpenRouterResponse;

        if (data.error) {
          const error = new Error(`OpenRouter API error: ${data.error.message || data.error.type}`);
          console.error(`[OpenRouter] API error`, { ...logContext, error: data.error });
          
          if (attempt < maxRetries) {
            lastError = error;
            continue;
          }
          
          throw error;
        }

        const responseId = data.id || 'unknown';
        console.log(`[OpenRouter] Request succeeded`, { ...logContext, responseId });

        return data;
      } catch (err: any) {
        lastError = err;
        
        // If timeout or abort, don't retry
        if (err.name === 'AbortError' || err.message?.includes('timeout')) {
          console.error(`[OpenRouter] Request timeout`, { traceId, userId, topicId, attempt: attempt + 1 });
          throw new Error('AI_GENERATION_FAILED: Request timeout (30s exceeded)');
        }

        // If it's the last attempt for this key, try next key
        if (attempt >= maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`[OpenRouter] Retrying after ${delay}ms`, { traceId, userId, topicId, attempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All keys and retries exhausted
  throw new Error(`AI_GENERATION_FAILED: All API keys exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
}

