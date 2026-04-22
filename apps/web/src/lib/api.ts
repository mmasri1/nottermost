import type { ApiError } from "@nottermost/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("nottermost.token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) window.localStorage.removeItem("nottermost.token");
  else window.localStorage.setItem("nottermost.token", token);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let err: ApiError | null = null;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    throw new Error(err?.error ?? `http_${res.status}`);
  }

  return (await res.json()) as T;
}

export async function apiUploadFile(args: {
  workspaceId: string;
  channelId?: string;
  threadId?: string;
  file: File;
}): Promise<{ id: string; filename: string; contentType: string; sizeBytes: number; createdAt: string; url: string }> {
  const token = getToken();
  if (!token) throw new Error("missing_token");

  const params = new URLSearchParams({ workspaceId: args.workspaceId });
  if (args.channelId) params.set("channelId", args.channelId);
  if (args.threadId) params.set("threadId", args.threadId);

  const form = new FormData();
  form.append("file", args.file);

  const res = await fetch(`${API_URL}/files/upload?${params.toString()}`, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  if (!res.ok) {
    let err: ApiError | null = null;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    throw new Error(err?.error ?? `http_${res.status}`);
  }

  return (await res.json()) as { id: string; filename: string; contentType: string; sizeBytes: number; createdAt: string; url: string };
}

