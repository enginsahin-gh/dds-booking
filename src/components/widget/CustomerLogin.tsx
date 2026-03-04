import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface CustomerLoginProps {
  salonId: string;
  apiBase: string;
  enabled: boolean;
  methods: string[];
  guestAllowed: boolean;
  onAuthenticated: (params: { session: any; customer: { name: string; email: string; phone: string | null } | null }) => void;
}

export function CustomerLogin({ salonId, apiBase, enabled, methods, guestAllowed, onAuthenticated }: CustomerLoginProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'otp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  const hasPassword = methods.includes('password');
  const hasOtp = methods.includes('otp');

  useEffect(() => {
    if (!enabled) return;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setSession(data.session);
        await fetchProfile(data.session);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        setSession(newSession);
        await fetchProfile(newSession);
      } else {
        setSession(null);
        onAuthenticated({ session: null, customer: null });
      }
    });

    loadSession();

    return () => { sub?.subscription?.unsubscribe(); };
  }, [enabled, salonId]);

  const fetchProfile = async (sess: any) => {
    try {
      const res = await fetch(`${apiBase}/api/customers/profile?salonId=${salonId}`, {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      });
      const data = await res.json();
      onAuthenticated({ session: sess, customer: data.customer || null });
    } catch {
      onAuthenticated({ session: sess, customer: null });
    }
  };

  const ensureProfile = async (sess: any) => {
    if (!name.trim()) return;
    await fetch(`${apiBase}/api/customers/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
      body: JSON.stringify({ salonId, name: name.trim(), phone: phone.trim(), email: email.trim() }),
    }).catch(() => null);
  };

  const handlePasswordLogin = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      setError('Inloggen mislukt. Controleer je gegevens.');
      setLoading(false);
      return;
    }
    setSession(data.session);
    await fetchProfile(data.session);
    setLoading(false);
  };

  const handlePasswordSignup = async () => {
    setLoading(true); setError(null);
    if (!name.trim()) {
      setError('Vul je naam in');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data?.session) {
      setError('Account aanmaken mislukt.');
      setLoading(false);
      return;
    }
    await ensureProfile(data.session);
    setSession(data.session);
    await fetchProfile(data.session);
    setLoading(false);
  };

  const handleSendOtp = async () => {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      setError('Kon e‑mailcode niet versturen.');
      setLoading(false);
      return;
    }
    setOtpSent(true);
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' });
    if (error || !data?.session) {
      setError('Code ongeldig of verlopen.');
      setLoading(false);
      return;
    }
    // Optionally create profile if name is provided
    if (name.trim()) {
      await ensureProfile(data.session);
    }
    setSession(data.session);
    await fetchProfile(data.session);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (!enabled) return null;

  if (session) {
    return (
      <div className="bellure-login-card">
        <div>
          <div className="bellure-login-title">Ingelogd</div>
          <div className="bellure-login-sub">Je bent ingelogd met {session.user?.email}</div>
        </div>
        <button className="bellure-btn bellure-btn-secondary" onClick={handleLogout}>
          Uitloggen
        </button>
      </div>
    );
  }

  return (
    <div className="bellure-login">
      <div className="bellure-login-header">
        <div>
          <div className="bellure-login-title">Heb je al een account?</div>
          <div className="bellure-login-sub">Log in voor sneller boeken. {guestAllowed ? 'Gast boeken blijft mogelijk.' : 'Gast boeken is uitgeschakeld.'}</div>
        </div>
      </div>

      <div className="bellure-login-tabs">
        {hasPassword && (
          <button className={`bellure-login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Inloggen</button>
        )}
        {hasPassword && (
          <button className={`bellure-login-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>Account maken</button>
        )}
        {hasOtp && (
          <button className={`bellure-login-tab ${mode === 'otp' ? 'active' : ''}`} onClick={() => setMode('otp')}>E‑mailcode</button>
        )}
      </div>

      {error && <div className="bellure-login-error">{error}</div>}

      {mode === 'login' && hasPassword && (
        <div className="bellure-login-form">
          <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="bellure-form-input" placeholder="Wachtwoord" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="bellure-btn bellure-btn-primary" onClick={handlePasswordLogin} disabled={loading}>Inloggen</button>
        </div>
      )}

      {mode === 'signup' && hasPassword && (
        <div className="bellure-login-form">
          <input className="bellure-form-input" placeholder="Naam" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="bellure-form-input" placeholder="Telefoon (optioneel)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="bellure-form-input" placeholder="Wachtwoord" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="bellure-btn bellure-btn-primary" onClick={handlePasswordSignup} disabled={loading}>Account maken</button>
        </div>
      )}

      {mode === 'otp' && hasOtp && (
        <div className="bellure-login-form">
          <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {!otpSent ? (
            <button className="bellure-btn bellure-btn-primary" onClick={handleSendOtp} disabled={loading}>Stuur code</button>
          ) : (
            <>
              <input className="bellure-form-input" placeholder="Code uit e‑mail" type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
              <input className="bellure-form-input" placeholder="Naam (optioneel)" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="bellure-form-input" placeholder="Telefoon (optioneel)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button className="bellure-btn bellure-btn-primary" onClick={handleVerifyOtp} disabled={loading}>Verifiëren</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
