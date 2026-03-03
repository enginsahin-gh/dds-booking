import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || '';

export function RegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (authLoading) return null;
  if (user) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/trial/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salonName, ownerName, ownerEmail: email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Er ging iets mis');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/admin/login'), 3000);
    } catch {
      setError('Kon geen verbinding maken. Probeer het later opnieuw.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex">
        <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800">
          <div className="absolute inset-0">
            <div className="absolute top-20 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-20 right-10 w-60 h-60 rounded-full bg-violet-300/20 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg font-bold border border-white/10">B</div>
              <span className="text-lg font-bold tracking-tight">Bellure</span>
            </div>
            <div className="max-w-sm">
              <h1 className="text-3xl font-bold leading-tight tracking-tight">30 dagen gratis.<br />Alle functies.</h1>
              <p className="mt-4 text-violet-200 text-[15px] leading-relaxed">Geen creditcard nodig. Probeer het boekingssysteem vrijblijvend uit.</p>
            </div>
            <p className="text-violet-300/60 text-[12px]">&copy; 2026 Bellure — Onderdeel van Ensalabs</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
          <div className="w-full max-w-[380px] text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Account aangemaakt</h2>
            <p className="text-gray-500 mb-6">Je proefperiode van 30 dagen is gestart. Je wordt doorgestuurd naar de inlogpagina.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex">
      {/* Left panel */}
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg font-bold border border-white/10">B</div>
            <span className="text-lg font-bold tracking-tight">Bellure</span>
          </div>
          <div className="max-w-sm">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">30 dagen gratis.<br />Alle functies.</h1>
            <p className="mt-4 text-violet-200 text-[15px] leading-relaxed">Geen creditcard nodig. Probeer het boekingssysteem vrijblijvend uit.</p>
          </div>
          <p className="text-violet-300/60 text-[12px]">&copy; 2026 Bellure — Onderdeel van Ensalabs</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm font-bold">B</div>
            <span className="text-base font-bold tracking-tight text-gray-900">Bellure</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium mb-4">
            30 dagen gratis
          </div>

          <h2 className="text-[22px] font-bold tracking-tight text-gray-900">Account aanmaken</h2>
          <p className="text-gray-500 text-[14px] mt-1 mb-6">Start je gratis proefperiode. Geen creditcard nodig.</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[13px]">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Salonnaam</label>
              <input
                type="text"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                placeholder="Bijv. Salon Amara"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Je naam</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                placeholder="Je volledige naam"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                placeholder="jouw@email.nl"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                placeholder="Minimaal 8 tekens"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Wachtwoord bevestigen</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                placeholder="Herhaal je wachtwoord"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-[14px] transition-colors disabled:opacity-50"
            >
              {loading ? 'Bezig...' : 'Gratis beginnen'}
            </button>
          </form>

          <p className="text-center text-[13px] text-gray-500 mt-6">
            Al een account? <a href="/admin/login" className="text-violet-600 font-medium hover:underline">Inloggen</a>
          </p>
          <p className="text-center text-[11px] text-gray-400 mt-4">
            Door te registreren ga je akkoord met onze <a href="https://bellure.nl/voorwaarden" className="underline" target="_blank" rel="noopener">voorwaarden</a> en <a href="https://bellure.nl/privacy" className="underline" target="_blank" rel="noopener">privacyverklaring</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
