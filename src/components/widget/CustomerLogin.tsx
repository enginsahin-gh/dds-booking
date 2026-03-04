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
  const [mode, setMode] = useState<'none' | 'login' | 'signup' | 'otp'>('none');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(true);

  const hasPassword = methods.includes('password');
  const hasOtp = methods.includes('otp');

  useEffect(() => {
    if (!enabled) return;

    const handleCallback = async () => {
      // Handle magic link hash tokens
      if (window.location.hash.includes('access_token')) {
        const params = new URLSearchParams(window.location.hash.replace('#', ''));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // Handle PKCE code flows
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

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

    handleCallback().then(loadSession);

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
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    if (error) {
      setError('Kon e‑maillink niet versturen.');
      setLoading(false);
      return;
    }
    setOtpSent(true);
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
          <div className="bellure-login-sub">Gegevens automatisch ingevuld</div>
        </div>
        <button className="bellure-btn bellure-btn-secondary" onClick={handleLogout}>
          Uitloggen
        </button>
      </div>
    );
  }

  return (
    <div className={`bellure-login ${collapsed ? 'collapsed' : 'open'}`}>
      <div className="bellure-login-row">
        <div>
          <div className="bellure-login-title">Sneller boeken met account</div>
          <div className="bellure-login-sub">Je gegevens worden automatisch ingevuld.</div>
        </div>
        <span className={`bellure-login-badge ${guestAllowed ? 'optional' : 'required'}`}>
          {guestAllowed ? 'Optioneel' : 'Verplicht'}
        </span>
      </div>

      <div className="bellure-login-actions">
        <button className="bellure-login-action primary" onClick={() => { setCollapsed(false); setMode('login'); }}>Terugkomer?</button>
        <button className="bellure-login-action" onClick={() => { setCollapsed(false); setMode('otp'); }}>Link per e‑mail</button>
        {hasPassword && (
          <button className={`bellure-login-link ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setCollapsed(false); setMode('signup'); }}>Nieuw? Maak account</button>
        )}
        {!collapsed && (
          <button className="bellure-login-link" onClick={() => { setCollapsed(true); setMode('none'); setError(null); }}>Sluit</button>
        )}
      </div>

      {!collapsed && error && <div className="bellure-login-error">{error}</div>}

      {!collapsed && mode === 'login' && hasPassword && (
        <div className="bellure-login-form">
          <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="bellure-form-input" placeholder="Wachtwoord" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="bellure-btn bellure-btn-primary" onClick={handlePasswordLogin} disabled={loading}>Inloggen</button>
        </div>
      )}

      {!collapsed && mode === 'signup' && hasPassword && (
        <div className="bellure-login-form">
          <input className="bellure-form-input" placeholder="Naam" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="bellure-form-input" placeholder="Telefoon (optioneel)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="bellure-form-input" placeholder="Wachtwoord" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="bellure-btn bellure-btn-primary" onClick={handlePasswordSignup} disabled={loading}>Account maken</button>
        </div>
      )}

      {!collapsed && mode === 'otp' && hasOtp && (
        <div className="bellure-login-form">
          <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {!otpSent ? (
            <button className="bellure-btn bellure-btn-primary" onClick={handleSendOtp} disabled={loading}>Stuur link</button>
          ) : (
            <div className="bellure-login-note">
              Open de link in je e‑mail om in te loggen. Je komt automatisch terug in de boeking.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
