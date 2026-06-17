import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck } from 'lucide-react';
import api from '../../lib/api';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login: setAuth } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin quản trị.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('auth/login', { email, password });
      const token = data.token || data.access_token;
      const user = data.user;
      const role = user?.role as string;

      if (role === 'admin' || role === 'ADMIN' || role === 'super_admin') {
        setAuth(token, user);
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError('Tài khoản này không có quyền truy cập hệ thống quản trị.');
      }
    } catch {
      setError('Đăng nhập quản trị thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 mx-auto mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Hệ thống Quản trị</h1>
          <p className="text-slate-400 mt-2 font-medium">Lagi Menu Core Engine</p>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl border border-slate-800">
          {error && (
            <div className="mb-6 bg-red-500/10 border-l-4 border-red-500 p-4 text-red-400 text-sm font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Admin Email / ID</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@lagi.vn"
                  className="w-full pl-12 pr-4 h-14 bg-slate-800/50 border-2 border-transparent rounded-2xl text-white font-bold focus:bg-slate-800 focus:border-blue-500/30 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mật khẩu bảo mật</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 h-14 bg-slate-800/50 border-2 border-transparent rounded-2xl text-white font-bold focus:bg-slate-800 focus:border-blue-500/30 outline-none transition-all placeholder:text-slate-600"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:bg-slate-800 disabled:text-slate-600"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <>Đăng nhập Admin <ShieldCheck size={20} /></>}
            </button>
          </form>
        </div>
        
        <p className="text-center text-slate-600 text-xs mt-8">
          Hệ thống bảo mật cao. Mọi hành vi truy cập trái phép sẽ bị ghi lại.
        </p>
      </div>
    </div>
  );
};
