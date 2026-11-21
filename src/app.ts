import type { Settings } from './lib/settings';
import type { Lang, T } from './lib/i18n';

export type View = 'shelf' | 'reader' | 'settings';
export type Filter = 'all' | 'unread' | 'starred';

export interface State {
  view: View;
  query: string;
  filter: Filter;
  tag: string | null;
  currentId: number | null;
}

export interface AppCtx {
  readonly lang: Lang;
  readonly t: T;
  readonly settings: Settings;
  readonly state: State;
  navigate(view: View): Promise<void>;
  openItem(id: number): Promise<void>;
  refresh(): Promise<void>;
  setRefresh(fn: () => Promise<void>): void;
  toast(message: string): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  saveCurrentPage(tabId?: number): Promise<{ ok: boolean; message: string }>;
}
