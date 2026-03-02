import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  // Supabase processes the invite/recovery token from the URL hash automatically.
  // We wait for a valid session before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Check if already signed in (e.g. token already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    // If no session after 5s, token is likely expired
    const timeout = setTimeout(() => {
      if (!ready) setExpired(true);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Minimaal 8 tekens'); return; }
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return; }

    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    // Sign out so they must log in with their new password
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true, state: { passwordSet: true } });
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
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg font-bold border border-white/10">B</div>
              <span className="text-lg font-bold tracking-tight">Bellure</span>
            </div>
          </div>
          <div className="max-w-sm">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">Welkom bij<br />het team.</h1>
            <p className="mt-4 text-violet-200 text-[15px] leading-relaxed">Stel je wachtwoord in en je kunt direct aan de slag met je salon.</p>
          </div>
          <p className="text-violet-300/60 text-[12px]">&copy; 2026 Bellure — Onderdeel van Ensalabs</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white text-xl font-bold shadow-[0_8px_24px_rgba(124,58,237,0.25)]">B</div>
            <h1 className="text-xl font-bold text-gray-900 mt-4 tracking-tight">Bellure</h1>
          </div>

          {/* Expired state */}
          {expired && !ready && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">Link verlopen</h3>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                  Deze uitnodigingslink is niet meer geldig. Vraag de salon eigenaar om een nieuwe uitnodiging te sturen.
                </p>
              </div>
              <button onClick={() => navigate('/admin/login', { replace: true })}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Naar inloggen
              </button>
            </div>
          )}

          {/* Loading state */}
          {!ready && !expired && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto">
                <svg className="animate-spin h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-[13px] text-gray-500">Uitnodiging verwerken...</p>
            </div>
          )}

          {/* Password form */}
          {ready && (
            <>
              <div className="hidden lg:block mb-8">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Wachtwoord instellen</h2>
                <p className="text-gray-500 text-[14px] mt-1">Kies een wachtwoord waarmee je voortaan kunt inloggen.</p>
              </div>

              <div className="lg:hidden text-center mb-8">
                <p className="text-gray-500 text-[13px]">Kies een wachtwoord om in te loggen</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span className="text-[13px] text-red-700 font-medium">{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-gray-700">Wachtwoord</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
                    placeholder="Minimaal 8 tekens" />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-gray-700">Herhaal wachtwoord</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 hover:border-gray-300 transition-all duration-200 placeholder:text-gray-400"
                    placeholder="Nogmaals invoeren" />
                </div>

                <button type="submit" disabled={saving}
                  className="w-full py-3 px-4 bg-violet-600 text-white text-[14px] font-semibold rounded-xl hover:bg-violet-700 hover:shadow-[0_4px_12px_rgba(124,58,237,0.25)] disabled:opacity-50 transition-all duration-200 active:scale-[0.98]">
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Opslaan...
                    </span>
                  ) : 'Wachtwoord instellen'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-[11px] text-gray-400 mt-8 lg:mt-12">Powered by Bellure</p>
        </div>
      </div>
    </div>
  );
}
