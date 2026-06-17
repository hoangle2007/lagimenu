import api from './api';

export interface Merchant {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'merchant';
}

export interface AuthState {
  token: string;
  merchant: Merchant;
}

const TOKEN_KEY = 'token';
const MERCHANT_KEY = 'user';

export const authStorage = {
  save: (state: AuthState) => {
    localStorage.setItem(TOKEN_KEY, state.token);
    localStorage.setItem(MERCHANT_KEY, JSON.stringify(state.merchant));
    // Set default authorization header
    api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
  },
  load: (): AuthState | null => {
    const token = localStorage.getItem(TOKEN_KEY);
    const merchantStr = localStorage.getItem(MERCHANT_KEY);
    if (!token || !merchantStr) return null;
    try {
      const merchant = JSON.parse(merchantStr) as Merchant;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { token, merchant };
    } catch {
      return null;
    }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MERCHANT_KEY);
    delete api.defaults.headers.common['Authorization'];
  },
  getMerchantId: (): string | null => {
    const merchantStr = localStorage.getItem(MERCHANT_KEY);
    if (!merchantStr) return null;
    try {
      return JSON.parse(merchantStr).id;
    } catch {
      return null;
    }
  },
};

export const authApi = {
  login: async (email: string, password: string): Promise<AuthState> => {
    const res = await api.post('/auth/login', { email, password });
    const state: AuthState = {
      token: res.data.token || res.data.access_token,
      merchant: res.data.user || res.data.merchant,
    };
    authStorage.save(state);
    return state;
  },
  register: async (name: string, email: string, password: string): Promise<AuthState> => {
    const res = await api.post('/auth/register', { name, email, password });
    const state: AuthState = {
      token: res.data.token || res.data.access_token,
      merchant: res.data.user || res.data.merchant,
    };
    authStorage.save(state);
    return state;
  },
  logout: () => {
    authStorage.clear();
  },
};
