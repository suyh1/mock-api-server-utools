import { reactive, watch } from 'vue';
import type { InjectionKey } from 'vue';
import type { HttpMethod } from '@/types/mock';

/** 所有可配置的侧边栏模块 key */
export type SidebarModuleKey = 'dashboard' | 'project' | 'api' | 'template' | 'scenario' | 'tools' | 'environment' | 'doc' | 'log' | 'websocket';

/** 默认一级入口 */
export const DEFAULT_PRIMARY: SidebarModuleKey[] = ['dashboard', 'api', 'template', 'scenario', 'tools'];

/** 默认更多面板 */
export const DEFAULT_MORE: SidebarModuleKey[] = ['project', 'environment', 'doc', 'log', 'websocket'];

export interface AppSettings {
  editorFontSize: number;
  editorTabSize: number;
  defaultPort: number;
  defaultPrefix: string;
  defaultMethod: HttpMethod;
  defaultDelay: number;
  sidebarPrimary: SidebarModuleKey[];
  sidebarMore: SidebarModuleKey[];
}

const STORAGE_KEY = 'mock-api-settings';

const defaults: AppSettings = {
  editorFontSize: 13,
  editorTabSize: 2,
  defaultPort: 3888,
  defaultPrefix: '',
  defaultMethod: 'GET',
  defaultDelay: 0,
  sidebarPrimary: [...DEFAULT_PRIMARY],
  sidebarMore: [...DEFAULT_MORE],
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function save(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export const settingsKey: InjectionKey<AppSettings> = Symbol('app-settings');

export function useSettings() {
  const settings = reactive<AppSettings>(load());

  watch(settings, (val) => {
    save({ ...val });
  });

  return settings;
}
