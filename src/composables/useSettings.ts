import { reactive, watch } from 'vue';
import type { InjectionKey } from 'vue';
import type { HttpMethod } from '@/types/mock';

export interface AppSettings {
  editorFontSize: number;
  editorTabSize: number;
  defaultPort: number;
  defaultPrefix: string;
  defaultMethod: HttpMethod;
  defaultDelay: number;
}

const STORAGE_KEY = 'mock-api-settings';

const defaults: AppSettings = {
  editorFontSize: 13,
  editorTabSize: 2,
  defaultPort: 3888,
  defaultPrefix: '',
  defaultMethod: 'GET',
  defaultDelay: 0,
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
