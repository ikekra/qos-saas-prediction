import { supabase } from "@/integrations/supabase/client";

type InvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

export async function getLiveAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

export async function invokeWithLiveToken<T = unknown>(
  functionName: string,
  options: InvokeOptions = {},
) {
  const token = await getLiveAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers,
  });
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getLiveAccessToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function extractFunctionErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as {
    message?: string;
    context?: { json?: () => Promise<unknown> };
  };

  let message = maybeError?.message || fallback;

  if (typeof message !== "string") {
    try {
      message = JSON.stringify(message);
    } catch {
      message = fallback;
    }
  }

  if (message === "[object Object]") {
    try {
      message = JSON.stringify(error);
    } catch {
      message = fallback;
    }
  }

  if (maybeError?.context && typeof maybeError.context.json === "function") {
    try {
      const payload = (await maybeError.context.json()) as { error?: string; details?: string };
      if (payload?.error) {
        message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
      }
    } catch {
      // Ignore parse errors for non-JSON function responses.
    }
  }

  return message;
}
