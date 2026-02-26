import { ref, computed, type InjectionKey, type Ref, type ComputedRef } from 'vue';
import type { Environment, EnvServiceConfig } from '@/types/mock';

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

/** 移除对象中值为 undefined 的字段 */
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

export interface UseEnvironmentsReturn {
  environments: Ref<Environment[]>;
  activeEnvId: Ref<number | null>;
  activeEnvironment: ComputedRef<Environment | undefined>;
  resolveVariables: (input: string, serviceId?: number, projectId?: number) => string;
  resolveServiceConfig: (serviceId: number, projectId?: number) => EnvServiceConfig;
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

  function resolveVariables(input: string, serviceId?: number, projectId?: number): string {
    const env = activeEnvironment.value;
    if (!env) return input;

    // 合并变量：全局 → 项目覆盖 → 服务覆盖（后者同名覆盖前者）
    const varMap = new Map<string, string>();
    env.variables.filter(v => v.enabled).forEach(v => varMap.set(v.key, v.value));

    if (projectId != null && env.overrides) {
      const po = env.overrides.find(o => o.scope === 'project' && o.targetId === projectId);
      po?.variables?.filter(v => v.enabled).forEach(v => varMap.set(v.key, v.value));
    }
    if (serviceId != null && env.overrides) {
      const so = env.overrides.find(o => o.scope === 'service' && o.targetId === serviceId);
      so?.variables?.filter(v => v.enabled).forEach(v => varMap.set(v.key, v.value));
    }

    return input.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return varMap.get(varName) ?? match;
    });
  }

  function resolveServiceConfig(serviceId: number, projectId?: number): EnvServiceConfig {
    const env = activeEnvironment.value;
    if (!env) return {};

    // 基础层：环境全局配置
    let merged: EnvServiceConfig = { ...(env.serviceConfig || {}) };

    // 第二层：项目覆盖
    if (projectId != null && env.overrides) {
      const projOverride = env.overrides.find(
        o => o.scope === 'project' && o.targetId === projectId
      );
      if (projOverride?.serviceConfig) {
        merged = { ...merged, ...stripUndefined(projOverride.serviceConfig) };
      }
    }

    // 第三层：服务覆盖
    if (env.overrides) {
      const serviceOverride = env.overrides.find(
        o => o.scope === 'service' && o.targetId === serviceId
      );
      if (serviceOverride?.serviceConfig) {
        merged = { ...merged, ...stripUndefined(serviceOverride.serviceConfig) };
      }
    }

    return merged;
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
    resolveServiceConfig,
    loadEnvironments,
    saveEnvironment,
    deleteEnvironment,
    setActiveEnv,
  };
}
