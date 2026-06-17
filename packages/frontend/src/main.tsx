import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ─── Global Error Collector ───────────────────────────────────────────────────
const _errorLog: string[] = [];
const _origError = console.error.bind(console);
const _origWarn = console.warn.bind(console);
console.error = (...args: any[]) => {
  const msg = `[ERR] ${args.map(a => (a instanceof Error ? a.stack || a.message : String(a))).join(' ')}`;
  _errorLog.push(msg);
  if (_errorLog.length > 50) _errorLog.shift();
  _origError(...args);
};

// Also capture top-level script errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error(`Global Error: ${message} at ${source}:${lineno}:${colno}`, error);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
};
console.warn = (...args: any[]) => {
  _errorLog.push(`[WARN] ${args.map(a => String(a)).join(' ')}`);
  if (_errorLog.length > 50) _errorLog.shift();
  _origWarn(...args);
};
window.addEventListener('unhandledrejection', (e) => {
  _errorLog.push(`[UNHANDLED] ${e.reason?.message || String(e.reason)}`);
});
(window as any).__getErrorLog = () => _errorLog;

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error: Error | null; info: ErrorInfo | null }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, info: null };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error;
    const logs = (window as any).__getErrorLog?.() || [];
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'monospace',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px', boxSizing: 'border-box'
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>Đã xảy ra lỗi</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Ứng dụng gặp sự cố. Thử tải lại trang.</p>

          <div style={{
            background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16,
            border: '1px solid #334155', wordBreak: 'break-word'
          }}>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Lỗi:</p>
            <code style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.6 }}>
              {err?.message || 'Unknown error'}
            </code>
          </div>

          {logs.length > 0 && (
            <div style={{
              background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16,
              border: '1px solid #334155', maxHeight: 200, overflowY: 'auto'
            }}>
              <p style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>Console logs gần đây:</p>
              {logs.slice(-15).map((l: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: l.startsWith('[ERR') ? '#f87171' : '#64748b', marginBottom: 4, lineHeight: 1.5 }}>
                  {l}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: '#3b82f6', color: 'white', border: 'none',
              fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: '0.05em'
            }}
          >
            🔄 Tải lại trang
          </button>

          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, marginTop: 8,
              background: 'transparent', color: '#64748b', border: '1px solid #334155',
              fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}
          >
            🗑️ Xóa cache & tải lại
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
