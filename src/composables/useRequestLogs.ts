import { ref, computed } from 'vue';
import type { RequestLog } from '@/types/mock';

const STORAGE_KEY = 'mock-api-request-logs';
const MAX_LOGS = 200;
const MAX_BODY_LENGTH = 5000;

/** 模块级单例，所有消费者共享 */
const logs = ref<RequestLog[]>(loadFromStorage());

function loadFromStorage(): RequestLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.value));
  } catch {}
}

function truncate(str: string | undefined, maxLen: number): string | undefined {
  if (!str) return str;
  return str.length > maxLen ? str.slice(0, maxLen) + '...[truncated]' : str;
}

export function useRequestLogs() {
  const logCount = computed(() => logs.value.length);

  function addLog(log: Omit<RequestLog, 'id'>) {
    const entry: RequestLog = {
      ...log,
      id: Date.now(),
      responseBody: truncate(log.responseBody, MAX_BODY_LENGTH),
      requestBody: truncate(log.requestBody, MAX_BODY_LENGTH),
    };
    logs.value.unshift(entry);
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(0, MAX_LOGS);
    }
    saveToStorage();
  }

  function clearLogs() {
    logs.value = [];
    saveToStorage();
  }

  return { logs, addLog, clearLogs, logCount };
}
