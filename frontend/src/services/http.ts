import type { ApiError } from "../types/api";

export type DebugLogEntry = {
  id: string;
  kind: "request" | "response" | "error";
  label: string;
  payload: unknown;
  timestamp: string;
};

const listeners = new Set<(entry: DebugLogEntry) => void>();

function emit(entry: Omit<DebugLogEntry, "id" | "timestamp">) {
  const fullEntry: DebugLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString()
  };

  listeners.forEach((listener) => listener(fullEntry));
}

export function subscribeDebugLog(listener: (entry: DebugLogEntry) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeError(body: any, fallbackCode: string, fallbackMessage: string): ApiError {
  return {
    code: body?.error ?? body?.code ?? fallbackCode,
    message: body?.message ?? fallbackMessage
  };
}

export async function getJson<T>(url: string, label: string): Promise<T> {
  emit({ kind: "request", label, payload: { method: "GET", url } });
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = normalizeError(body, "HTTP_ERROR", `HTTP ${res.status}`);
    emit({ kind: "error", label, payload: error });
    throw error;
  }

  emit({ kind: "response", label, payload: body });
  return body as T;
}

export async function postJson<T>(url: string, payload: unknown, label: string): Promise<T> {
  emit({ kind: "request", label, payload: { method: "POST", url, body: payload } });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = normalizeError(body, "HTTP_ERROR", `HTTP ${res.status}`);
    emit({ kind: "error", label, payload: error });
    throw error;
  }

  emit({ kind: "response", label, payload: body });
  return body as T;
}
