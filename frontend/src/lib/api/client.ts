import axios from 'axios';

// ── Token key helpers ──────────────────────────────────────────
// Each role stores tokens under its own localStorage key so
// sessions never interfere with each other.

type TokenRole = 'player' | 'module-admin' | 'platform-admin' | 'agent';

const TOKEN_KEYS: Record<TokenRole, { access: string; refresh: string }> = {
  player:           { access: 'playerAccessToken',        refresh: 'playerRefreshToken' },
  'module-admin':   { access: 'moduleAdminAccessToken',   refresh: 'moduleAdminRefreshToken' },
  'platform-admin': { access: 'platformAdminAccessToken', refresh: 'platformAdminRefreshToken' },
  agent:            { access: 'agentAccessToken',         refresh: 'agentRefreshToken' },
};

/** Detect which role the current page belongs to by pathname. */
function detectRoleFromPath(): TokenRole {
  if (typeof window === 'undefined') return 'platform-admin';
  const p = window.location.pathname;
  if (p.startsWith('/agent')) return 'agent';
  if (p.startsWith('/public') || p.startsWith('/auth')) return 'player';
  if (p.startsWith('/module') || p.startsWith('/originals')) return 'module-admin';
  return 'platform-admin';
}

/** 解析 JWT exp 判斷是否過期；無法解析時視為過期（保守處理）。 */
function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (typeof payload.exp !== 'number') return false; // 沒有 exp 欄位就不擋
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Get the access token for the current page's role.
 * 若 token 已過期，會自動清掉並回傳 null（過期 token 等同於沒登入）。
 */
export function getAccessToken(role?: TokenRole): string | null {
  const r = role ?? detectRoleFromPath();
  const token = localStorage.getItem(TOKEN_KEYS[r].access);
  if (!token) return null;
  if (isJwtExpired(token)) {
    clearTokens(r);
    return null;
  }
  return token;
}

/** Get the refresh token for the current page's role. */
export function getRefreshToken(role?: TokenRole): string | null {
  const r = role ?? detectRoleFromPath();
  return localStorage.getItem(TOKEN_KEYS[r].refresh);
}

/** 同分頁 token 變動事件名稱（跨分頁有原生的 'storage' 事件） */
export const AUTH_CHANGED_EVENT = 'auth-token-changed';

function emitAuthChanged(role: TokenRole) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { role } }));
  }
}

/** Save tokens for a specific role. */
export function setTokens(role: TokenRole, accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEYS[role].access, accessToken);
  localStorage.setItem(TOKEN_KEYS[role].refresh, refreshToken);
  emitAuthChanged(role);
}

/** Clear tokens for a specific role. */
export function clearTokens(role: TokenRole) {
  localStorage.removeItem(TOKEN_KEYS[role].access);
  localStorage.removeItem(TOKEN_KEYS[role].refresh);
  emitAuthChanged(role);
}

// ── Axios instance ─────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token for the current role
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - handle 401 auto-refresh / 429 rate limit
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 429 限流：顯示後端給的友善訊息，告訴使用者要等多久；不自動重試
    if (error.response?.status === 429) {
      const data = error.response.data as {
        message?: string;
        retryAfter?: number;
      };
      const tip = data?.message || '操作過於頻繁，請稍後再試';
      if (typeof window !== 'undefined') {
        // 動態 import 避免 SSR 階段載入 antd
        import('antd').then(({ message }) => {
          const seconds = Number(data?.retryAfter) || 60;
          message.warning({ content: tip, duration: Math.min(seconds, 8) });
        });
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const role = detectRoleFromPath();

      // Skip auto-refresh for player tokens
      // 但要把失效的 token 清掉，讓 UI（PublicHeader 等）下一次 render 顯示為登出狀態
      if (role === 'player') {
        clearTokens('player');
        return Promise.reject(error);
      }

      // Agent token：沒有 refresh 機制，失效就清掉導去登入頁
      if (role === 'agent') {
        clearTokens('agent');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/agent/login')) {
          window.location.href = '/agent/login';
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken(role);
        if (!refreshToken) throw new Error('No refresh token');

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        // 統一使用 /auth/refresh 端點
        const refreshUrl = `${baseUrl}/auth/refresh`;

        const { data } = await axios.post(
          refreshUrl,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } },
        );

        setTokens(role, data.data.accessToken, data.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;

        return apiClient(originalRequest);
      } catch {
        clearTokens(role);
        if (typeof window !== 'undefined') {
          if (role === 'module-admin') {
            window.location.href = '/originals/admin-login';
          } else {
            window.location.href = '/admin/login';
          }
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
