import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export function LoginPage() {
  const { user, loading: authLoading, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const passwordJustSet = (location.state as any)?.passwordSet === true;

  const redirectTo = (location.state as any)?.redirectTo as string | undefined;

  if (authLoading) return null;
  if (user) return <Navigate to={redirectTo || '/admin'} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch {
      setError('Ongeldige inloggegevens');
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Vul je e-mailadres in'); return; }
    setError('');
    setResetLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/set-password`,
    });
    if (err) {
      setError('Kon geen reset-link versturen. Probeer het later opnieuw.');
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800">
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-60 h-60 rounded-full bg-violet-300/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-indigo-300/15 blur-2xl" />
        </div>
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center border border-white/20">
                <img src="/logo-mark-blue.png" alt="Bellure" className="w-6 h-6 object-contain" />
              </div>
              <span className="text-lg font-bold tracking-tight">Bellure</span>
            </div>
          </div>
          <div className="max-w-sm">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">Jouw salon,<br />slim beheerd.</h1>
            <p className="mt-4 text-violet-200 text-[15px] leading-relaxed">Boekingen, agenda en klanten op een plek. Zodat jij kunt focussen op wat je het beste doet.</p>
          </div>
          <p className="text-violet-300/60 text-[12px]">&copy; 2026 Bellure — Onderdeel van Ensalabs</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-gray-200/70 shadow-[0_8px_24px_rgba(59,78,108,0.25)]">
              <img src="/logo-mark-blue.png" alt="Bellure" className="w-8 h-8 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-4 tracking-tight">Bellure</h1>
            <p className="text-gray-500 text-[13px] mt-1">
              {mode === 'login' ? 'Log in om je salon te beheren' : 'Wachtwoord herstellen'}
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              {mode === 'login' ? 'Welkom terug' : 'Wachtwoord herstellen'}
            </h2>
            <p className="text-gray-500 text-[14px] mt-1">
              {mode === 'login'
                ? 'Log in met je e-mailadres en wachtwoord'
                : 'Vul je e-mailadres in om een herstelmail te ontvangen'}
            </p>
          </div>

          {/* Login form */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {passwordJustSet && (
                <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" className="flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-[13px] text-emerald-700 font-medium">Wachtwoord ingesteld. Je kunt nu inloggen.</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="text-[13px] text-red-700 font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-gray-700">E-mailadres</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
                  placeholder="naam@salon.nl" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[13px] font-semibold text-gray-700">Wachtwoord</label>
                  <button type="button" onClick={() => { setMode('reset'); setError(''); setResetSent(false); }}
                    className="text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors">
                    Wachtwoord vergeten?
                  </button>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
                  placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-violet-600 text-white text-[14px] font-semibold rounded-xl hover:bg-violet-700 hover:shadow-[0_4px_12px_rgba(124,58,237,0.25)] disabled:opacity-50 transition-all duration-200 active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Inloggen...
                  </span>
                ) : 'Inloggen'}
              </button>
            </form>
          )}

          {/* Reset form */}
          {mode === 'reset' && !resetSent && (
            <form onSubmit={handleReset} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="text-[13px] text-red-700 font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-gray-700">E-mailadres</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
                  placeholder="naam@salon.nl" />
              </div>

              <button type="submit" disabled={resetLoading}
                className="w-full py-3 px-4 bg-violet-600 text-white text-[14px] font-semibold rounded-xl hover:bg-violet-700 hover:shadow-[0_4px_12px_rgba(124,58,237,0.25)] disabled:opacity-50 transition-all duration-200 active:scale-[0.98]">
                {resetLoading ? 'Versturen...' : 'Herstelmail versturen'}
              </button>

              <button type="button" onClick={() => { setMode('login'); setError(''); }}
                className="w-full text-center text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
                Terug naar inloggen
              </button>
            </form>
          )}

          {/* Reset sent confirmation */}
          {mode === 'reset' && resetSent && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">Herstelmail verstuurd</h3>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                  We hebben een link naar <strong>{email}</strong> gestuurd waarmee je een nieuw wachtwoord kunt instellen. Check ook je spam-map.
                </p>
              </div>
              <button onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Terug naar inloggen
              </button>
            </div>
          )}

          <p className="text-center text-[11px] text-gray-400 mt-8 lg:mt-12">Powered by Bellure</p>
        </div>
      </div>
    </div>
  );
}
