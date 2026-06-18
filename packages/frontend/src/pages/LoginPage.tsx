import React, { useState } from 'react';
import { Eye, EyeOff, ShoppingBag, ArrowRight, Loader2, Store, Mail, Lock, UtensilsCrossed, Coffee, Pizza, Sandwich } from 'lucide-react';
import { authApi } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const { login: setAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { setError('Vui lòng điền đầy đủ thông tin.'); return; }
    setLoading(true); setError('');
    try {
      const state = await authApi.login(loginEmail, loginPassword);
      setAuth(state.token, state.merchant as any);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg === 'Invalid credentials' ? 'Email hoặc mật khẩu không đúng.' : 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) { setError('Vui lòng điền đầy đủ thông tin.'); return; }
    if (regPassword !== regConfirm) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (regPassword.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    setLoading(true); setError('');
    try {
      const state = await authApi.register(regName, regEmail, regPassword);
      setAuth(state.token, state.merchant as any);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg === 'Email already registered' ? 'Email này đã được đăng ký.' : 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row font-sans overflow-hidden">

      {/* ─── LEFT SIDE: Decorative & Image ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary/5 items-center justify-center overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
          <div className="grid grid-cols-6 gap-20 p-20 transform -rotate-12 translate-x-[-10%] translate-y-[-10%] scale-150">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="text-primary flex items-center justify-center">
                {[<Coffee key="c" />, <Pizza key="p" />, <UtensilsCrossed key="u" />, <Sandwich key="s" />][i % 4]}
              </div>
            ))}
          </div>
        </div>

        {/* Floating "Wow" Card with actual image */}
        <div className="relative z-10 w-4/5 max-w-lg aspect-[4/5] rounded-[3rem] bg-surface shadow-2xl p-4 transform rotate-2 hover:rotate-0 transition-transform duration-700 overflow-hidden">
          <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-surface-container-low">
            <img 
              src="/des2.png" 
              alt="Kivo Menu Concept" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-10 -right-10 bg-surface p-6 rounded-[2rem] shadow-2xl border border-slate-50 flex items-center gap-4 animate-bounce-slow">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kinh doanh hiệu quả</p>
              <p className="text-lg font-black text-slate-800 tracking-tight">+120% Đơn hàng</p>
            </div>
          </div>

          <div className="absolute -top-6 -left-6 bg-primary p-6 rounded-[2rem] shadow-2xl text-white transform -rotate-6">
            <p className="text-xs font-black uppercase tracking-widest leading-none">Chuyên cho</p>
            <p className="text-2xl font-black tracking-tight">Cửa hàng F&B</p>
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDE: Authentication Forms ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-20 relative bg-surface-container-low/50">
        <div className="w-full max-w-md">

          {/* Header (Mobile Logo) */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/25">
              <ShoppingBag size={24} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Kivo Menu</h1>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
              {mode === 'login' ? 'Chào mừng trở lại! 👋' : 'Bắt đầu ngay hôm nay 🚀'}
            </h2>
            <p className="text-slate-500 font-medium">
              {mode === 'login'
                ? 'Hãy đăng nhập để quản lý cửa hàng của bạn một cách dễ dàng nhất.'
                : 'Trở thành đối tác của Kivo Menu để tối ưu hóa quy trình bán hàng.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-surface shadow-sm border border-slate-200/50 rounded-2xl p-1.5 mb-8">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all duration-300 ${mode === 'login' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all duration-300 ${mode === 'register' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Đăng ký quán
            </button>
          </div>

          {/* Form Area */}
          <div className="bg-surface rounded-[2.5rem] p-8 lg:p-10 shadow-premium border border-slate-100">
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm font-bold animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tài khoản / Email</label>
                  <div className="relative group">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="Email hoặc tên đăng nhập"
                      className="w-full pl-12 pr-4 h-14 bg-surface-container-low border-2 border-transparent rounded-2xl text-slate-800 font-bold focus:bg-surface focus:border-primary/20 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                  <div className="relative group">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 h-14 bg-surface-container-low border-2 border-transparent rounded-2xl text-slate-800 font-bold focus:bg-surface focus:border-primary/20 outline-none transition-all placeholder:text-slate-300"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:bg-slate-200"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <>Đăng nhập ngay <ArrowRight size={20} /></>}
                </button>

                <div className="pt-4 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-primary rounded-full" /> Bạn chưa có tài khoản?
                  </p>
                  <button type="button" onClick={() => setMode('register')} className="text-sm font-black text-primary hover:underline">Đăng ký quán mới tại đây</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên cửa hàng</label>
                  <div className="relative group">
                    <Store size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="Tên quán của bạn"
                      className="w-full pl-12 pr-4 h-14 bg-surface-container-low border-2 border-transparent rounded-2xl text-slate-800 font-bold focus:bg-surface focus:border-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email đăng ký</label>
                  <div className="relative group">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="mail@yourstore.vn"
                      className="w-full pl-12 pr-4 h-14 bg-surface-container-low border-2 border-transparent rounded-2xl text-slate-800 font-bold focus:bg-surface focus:border-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 h-14 bg-surface-container-low border-2 border-transparent rounded-2xl text-slate-800 font-bold focus:bg-surface focus:border-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nhập lại</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 h-14 bg-surface-container-low border-2 border-transparent rounded-2xl text-slate-800 font-bold focus:bg-surface focus:border-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/25 hover:rotate-1 transition-all flex items-center justify-center gap-2 mt-2 disabled:bg-slate-200"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <>Khởi tạo quán ngay <ArrowRight size={20} /></>}
                </button>
              </form>
            )}
          </div>


        </div>
      </div>

      {/* ─── STYLE OVERRIDE ─── */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5px); }
          50% { transform: translateY(5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .shadow-premium {
          box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  );
};
