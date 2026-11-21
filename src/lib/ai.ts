import { AI_ENDPOINTS, type AiConfig } from './settings';
import type { Item } from './db';

export class AiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AiError';
  }
}

export async function ensureAiPermission(cfg: AiConfig): Promise<boolean> {
  const ep = AI_ENDPOINTS[cfg.provider];
  if (!ep) return false;
  const origins = [ep.host];
  const has = await chrome.permissions.contains({ origins });
  if (has) return true;
  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

const SYSTEM_PROMPT_ZH =
  '你是阅读助手。用中文写一段摘要：80 到 120 字，直接陈述文章的核心论点与结论，' +
  '不要以“本文”“这篇文章”开头，不要分点，不要加标题，不要复述免责声明。';

const SYSTEM_PROMPT_EN =
  'You are a reading assistant. Write a summary in 80-120 words. State the core argument and ' +
  'conclusion directly. Do not start with "This article". No bullets, no heading.';

export async function summarize(item: Item, cfg: AiConfig, lang: 'zh' | 'en' = 'zh'): Promise<string> {
  if (!cfg.apiKey) throw new AiError('no-key', lang === 'zh' ? '还没填 API Key' : 'No API key yet');
  const ep = AI_ENDPOINTS[cfg.provider];
  if (!ep) throw new AiError('bad-provider', 'Unknown provider');

  const body = item.contentText.slice(0, 8000);
  if (body.length < 200) {
    throw new AiError('too-short', lang === 'zh' ? '正文太短，没法摘要' : 'Not enough text to summarize');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${ep.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || ep.models[0],
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          { role: 'system', content: lang === 'zh' ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN },
          { role: 'user', content: `${item.title}\n\n${body}` },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new AiError('auth', lang === 'zh' ? 'API Key 无效或已失效' : 'Invalid API key');
    }
    if (res.status === 429) {
      throw new AiError('rate', lang === 'zh' ? '额度用尽或请求过快' : 'Rate limited');
    }
    if (!res.ok) {
      throw new AiError('http', `HTTP ${res.status}`);
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new AiError('empty', lang === 'zh' ? '模型返回为空' : 'Empty response');
    }
    return text.trim().replace(/^["“]|["”]$/g, '');
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AiError('timeout', lang === 'zh' ? '请求超时' : 'Request timed out');
    }
    throw new AiError('network', lang === 'zh' ? '网络请求失败' : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}
