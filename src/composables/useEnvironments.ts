import { ref, computed, type InjectionKey, type Ref, type ComputedRef } from 'vue';
import type { Environment } from '@/types/mock';

const STORAGE_KEY = 'mock-api-environments';
const ACTIVE_KEY = 'mock-api-active-env';

/** Module-level singleton state */
const environments = ref<Environment[]>(loadFromStorage());
const activeEnvId = ref<number | null>(loadActiveId());

function loadFromStorage(): Environment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(environments.value));
  } catch {}
}

function loadActiveId(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveActiveId() {
  try {
    if (activeEnvId.value === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeEnvId.value));
  } catch {}
}

export interface UseEnvironmentsReturn {
  environments: Ref<Environment[]>;
  activeEnvId: Ref<number | null>;
  activeEnvironment: ComputedRef<Environment | undefined>;
  resolveVariables: (input: string) => string;
  loadEnvironments: () => void;
  saveEnvironment: (env: Environment) => void;
  deleteEnvironment: (id: number) => void;
  setActiveEnv: (id: number | null) => void;
}

export const environmentsKey: InjectionKey<UseEnvironmentsReturn> = Symbol('environments');

export function useEnvironments(): UseEnvironmentsReturn {
  const activeEnvironment = computed(() => {
    if (activeEnvId.value === null) return undefined;
    return environments.value.find(e => e.id === activeEnvId.value);
  });

  function resolveVariables(input: string): string {
    const env = activeEnvironment.value;
    if (!env) return input;
    return input.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const v = env.variables.find(v => v.enabled && v.key === varName);
      return v ? v.value : match;
    });
  }

  function loadEnvironments() {
    environments.value = loadFromStorage();
    activeEnvId.value = loadActiveId();
  }

  function saveEnvironment(env: Environment) {
    const idx = environments.value.findIndex(e => e.id === env.id);
    if (idx !== -1) {
      environments.value[idx] = { ...env, updatedAt: Date.now() };
    } else {
      environments.value.push({ ...env, id: Date.now(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    saveToStorage();
  }

  function deleteEnvironment(id: number) {
    environments.value = environments.value.filter(e => e.id !== id);
    if (activeEnvId.value === id) {
      activeEnvId.value = null;
      saveActiveId();
    }
    saveToStorage();
  }

  function setActiveEnv(id: number | null) {
    activeEnvId.value = id;
    saveActiveId();
  }

  return {
    environments,
    activeEnvId,
    activeEnvironment,
    resolveVariables,
    loadEnvironments,
    saveEnvironment,
    deleteEnvironment,
    setActiveEnv,
  };
}
