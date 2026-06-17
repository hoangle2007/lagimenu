import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL
    ? `${(import.meta as any).env.VITE_API_URL}/api`
    : '/api',
});

// ─── Request interceptor: inject token & normalize URL ───────────────────────
api.interceptors.request.use((config) => {
  // Fix double /api/api if it happens
  if (config.url?.startsWith('/api/')) {
    config.url = config.url.substring(5);
  } else if (config.url?.startsWith('/api')) {
    config.url = config.url.substring(4);
  }

  const path = (config.url || '').replace(/^\//, '');
  if ((config.headers as Record<string, unknown> | undefined)?.Authorization) {
    return config;
  }

  const isPublicMenuAlias = /^menu\/[^/]+$/.test(path);
  const isMerchantOrderGuard = /^merchants\/[^/]+\/order-guard$/.test(path);
  const isAuthPublic =
    path.startsWith('auth/login') ||
    path.startsWith('auth/register') ||
    path.startsWith('auth/customer/') ||
    path.startsWith('auth/google') ||
    path.startsWith('public/') ||
    isPublicMenuAlias ||
    isMerchantOrderGuard;
  if (isAuthPublic) {
    if (config.headers && 'Authorization' in config.headers) {
      delete (config.headers as Record<string, unknown>).Authorization;
    }
    return config;
  }

  const isAdminReq = path.startsWith('admin/');
  const token = isAdminReq ? localStorage.getItem('admin_token') : localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  } else if (config.headers && 'Authorization' in config.headers) {
    delete (config.headers as Record<string, unknown>).Authorization;
  }

  // Let the browser set multipart boundary (manual Content-Type breaks uploads)
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers as Record<string, unknown> | undefined;
    if (h && 'Content-Type' in h) delete h['Content-Type'];
  }

  return config;
});

// ─── Response interceptor: auto-refresh on 401 ───────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only retry once; skip if the failed request is already the refresh call
    if (originalRequest.url?.includes('admin/')) {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentToken = localStorage.getItem('token');
        const res = await axios.post(
          '/api/auth/refresh',
          {},
          { headers: { Authorization: `Bearer ${currentToken}` } }
        );

        const newToken: string = res.data.access_token;
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Only redirect if NOT on a public page (like customer menu)
        const p = window.location.pathname;
        const isPublicPath =
          p.startsWith('/m/') ||
          p.startsWith('/order/') ||
          p.startsWith('/menu/') ||
          (p.startsWith('/shop/') && p.endsWith('/login'));

        if (!isPublicPath) {
          // Token completely expired — clear session and redirect to login
          const lastSlug = localStorage.getItem('last_shop_slug');
          const userData = localStorage.getItem('user');
          let isEmployee = false;
          try {
            const user = JSON.parse(userData || '{}');
            isEmployee = ['EMPLOYEE', 'employee', 'staff', 'nhan_vien'].includes(user.role);
          } catch {
            /* ignore invalid user JSON */
          }

          localStorage.removeItem('token');
          localStorage.removeItem('user');

          if (isEmployee && lastSlug) {
            window.location.href = `/shop/${lastSlug}/login`;
          } else {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export { api };
export default api;
