export type ThemeMode = 'auto' | 'light' | 'sepia' | 'dark';
export type AiProvider = 'openai' | 'deepseek' | 'dashscope';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface Settings {
  fontSize: number;
  lineHeight: number;
  measure: number;
  theme: ThemeMode;
  fontFamily: 'serif' | 'sans';
  showAds: boolean;
  locale: 'auto' | 'zh' | 'en';
  ai: AiConfig;
}

export const AI_ENDPOINTS: Record<AiProvider, { label: string; base: string; host: string; models: string[] }> = {
  openai: {
    label: 'OpenAI',
    base: 'https://api.openai.com/v1',
    host: 'https://api.openai.com/*',
    models: ['gpt-4o-mini', 'gpt-4.1-mini'],
  },
  deepseek: {
    label: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    host: 'https://api.deepseek.com/*',
    models: ['deepseek-chat'],
  },
  dashscope: {
    label: '通义千问',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    host: 'https://dashscope.aliyuncs.com/*',
    models: ['qwen-plus', 'qwen-turbo'],
  },
};

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 16,
  lineHeight: 1.75,
  measure: 38,
  theme: 'auto',
  fontFamily: 'serif',
  showAds: true,
  locale: 'auto',
  ai: { provider: 'deepseek', apiKey: '', model: 'deepseek-chat' },
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY);
  const stored = (got[KEY] || {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai || {}) },
  };
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  if (patch.ai) next.ai = { ...current.ai, ...patch.ai };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChange(cb: (s: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[KEY]) return;
    const stored = (changes[KEY].newValue || {}) as Partial<Settings>;
    cb({
      ...DEFAULT_SETTINGS,
      ...stored,
      ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai || {}) },
    });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
