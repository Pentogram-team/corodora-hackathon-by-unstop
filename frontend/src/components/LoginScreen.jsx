import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();
      sessionStorage.setItem('vault_admin_token', data.token);
      onLogin();
    } catch (err) {
      setError(true);
      // Remove animation class to allow re-triggering if clicked again
      setTimeout(() => setError(false), 500); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 select-none">
      <div className={`w-full max-w-md p-8 border bg-slate-900/60 rounded-xl backdrop-blur-sm shadow-2xl transition-transform ${error ? 'animate-shake border-red-500/50' : 'border-slate-700/60'}`}>
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-6 rounded border border-violet-500/30 bg-violet-950/20 flex items-center justify-center text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <span className="text-3xl">⬡</span>
          </div>
          <h1 className="text-lg font-mono tracking-widest text-slate-200 mb-2">HEISENBERG VAULT // ADMIN ACCESS</h1>
          <p className="text-[11px] font-mono tracking-wider text-slate-500">Classified medical record vault — authorised personnel only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-slate-400 mb-1.5 ml-1">USERNAME</label>
            <input
              type="text"
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors placeholder:text-slate-800 text-slate-300"
              placeholder="vault_admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono tracking-wider text-slate-400 mb-1.5 ml-1">PASSPHRASE</label>
            <input
              type="password"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors placeholder:text-slate-800 text-slate-300 tracking-widest"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="pt-6 h-20">
            {error ? (
              <div className="w-full py-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-400 text-center font-mono text-sm tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
                ACCESS DENIED
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-mono text-sm tracking-widest transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              >
                {loading ? 'AUTHENTICATING...' : 'INITIALIZE UPLINK'}
              </button>
            )}
          </div>
        </form>

      </div>
      
      {/* Required keyframes for CSS shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-7px); }
          40%, 80% { transform: translateX(7px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
