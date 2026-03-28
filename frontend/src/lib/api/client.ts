import axios from 'axios';

// ── Token key helpers ──────────────────────────────────────────
// Each role stores tokens under its own localStorage key so
// sessions never interfere with each other.

type TokenRole = 'player' | 'module-admin' | 'platform-admin';

const TOKEN_KEYS: Record<TokenRole, { access: string; refresh: string }> = {
  player:           { access: 'playerAccessToken',        refresh: 'playerRefreshToken' },
  'module-admin':   { access: 'moduleAdminAccessToken',   refresh: 'moduleAdminRefreshToken' },
  'platform-admin': { access: 'platformAdminAccessToken', refresh: 'platformAdminRefreshToken' },
};

/** Detect which role the current page belongs to by pathname. */
function detectRoleFromPath(): TokenRole {
  if (typeof window === 'undefined') return 'platform-admin';
  const p = window.location.pathname;
  if (p.startsWith('/public') || p.startsWith('/auth')) return 'player';
  if (p.startsWith('/module') || p.startsWith('/originals')) return 'module-admin';
  return 'platform-admin';
}

/** Get the access token for the current page's role. */
export function getAccessToken(role?: TokenRole): string | null {
  const r = role ?? detectRoleFromPath();
  return localStorage.getItem(TOKEN_KEYS[r].access);
}

/** Get the refresh token for the current page's role. */
export function getRefreshToken(role?: TokenRole): string | null {
  const r = role ?? detectRoleFromPath();
  return localStorage.getItem(TOKEN_KEYS[r].refresh);
}

/** Save tokens for a specific role. */
export function setTokens(role: TokenRole, accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEYS[role].access, accessToken);
  localStorage.setItem(TOKEN_KEYS[role].refresh, refreshToken);
}

/** Clear tokens for a specific role. */
export function clearTokens(role: TokenRole) {
  localStorage.removeItem(TOKEN_KEYS[role].access);
  localStorage.removeItem(TOKEN_KEYS[role].refresh);
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

// Response interceptor - handle 401 auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const role = detectRoleFromPath();

      // Skip auto-refresh for player tokens
      if (role === 'player') {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken(role);
        if (!refreshToken) throw new Error('No refresh token');

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const refreshUrl = role === 'module-admin'
          ? `${baseUrl}/modules/originals/admin-auth/refresh`
          : `${baseUrl}/auth/refresh`;

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
