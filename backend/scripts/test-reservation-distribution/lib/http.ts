/**
 * API 呼叫包裝。自動帶上 admin token，統一處理 JSON 回應結構。
 */
// 容器內用 localhost:4000 也可以，因為 backend 就在同一容器；host 端打 4000
const BASE_URL =
  process.env.TEST_API_BASE ||
  (process.env.INSIDE_DOCKER === '1'
    ? 'http://localhost:4000/api'
    : 'http://localhost:4000/api');
const ADMIN_EMAIL = 'originals@gmail.com';
const ADMIN_PASSWORD = 'originals123';

let cachedToken: string | null = null;

export async function login(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${BASE_URL}/auth/module-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`login failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as {
    data?: { accessToken?: string };
    accessToken?: string;
  };
  const token = json.data?.accessToken ?? json.accessToken;
  if (!token) throw new Error('no accessToken in login response');
  cachedToken = token;
  return token;
}

export function resetAuth() {
  cachedToken = null;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  raw: unknown;
}

export async function callApi<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = await login();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let raw: unknown = null;
  try {
    raw = await res.json();
  } catch {
    raw = null;
  }
  const wrap = raw as { data?: T; success?: boolean; message?: unknown } | null;
  return {
    ok: res.ok,
    status: res.status,
    body: (wrap?.data ?? null) as T | null,
    raw,
  };
}
