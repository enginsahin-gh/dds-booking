import { useEffect, useMemo, useState } from 'react';
import { format, isAfter, isSameDay, differenceInMinutes, differenceInDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import '../styles/widget.css';

interface Appointment {
  id: string;
  salon: { name: string; slug: string; phone?: string; address?: string; postal_code?: string; city?: string } | null;
  staff: { name: string } | null;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string;
  amount_total_cents: number;
  cancel_token: string | null;
  services: string[];
}

export function CustomerPortalPage() {
  const [session, setSession] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'history' | 'all'>('upcoming');
  const [search, setSearch] = useState('');
  const [salonFilter, setSalonFilter] = useState('all');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('otp');
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string; phone?: string | null } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    load();

    return () => { sub?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchAppointments = async () => {
      setLoading(true);
      const res = await fetch('https://api.bellure.nl/api/customers/appointments', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setAppointments(data.appointments || []);
      setLoading(false);
    };

    const fetchProfile = async () => {
      const res = await fetch('https://api.bellure.nl/api/customers/profile-global', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
    };

    fetchAppointments();
    fetchProfile();
  }, [session]);

  const salons = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((a) => {
      if (a.salon?.slug) map.set(a.salon.slug, a.salon.name);
    });
    return Array.from(map.entries());
  }, [appointments]);

  const filtered = useMemo(() => {
    const now = new Date();
    return appointments.filter((a) => {
      const isUpcoming = isAfter(new Date(a.start_at), now) && a.status !== 'cancelled';
      if (filter === 'upcoming' && !isUpcoming) return false;
      if (filter === 'history' && isUpcoming) return false;
      if (salonFilter !== 'all' && a.salon?.slug !== salonFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const sName = a.salon?.name?.toLowerCase() || '';
        const services = a.services.join(' ').toLowerCase();
        const staff = a.staff?.name?.toLowerCase() || '';
        if (!sName.includes(q) && !services.includes(q) && !staff.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, filter, search, salonFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filtered.forEach((a) => {
      const key = format(new Date(a.start_at), 'MMMM yyyy');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const getCountdown = (startAt: string) => {
    const now = new Date();
    const date = new Date(startAt);
    if (!isAfter(date, now)) return null;

    if (isSameDay(date, now)) {
      const diffMin = Math.max(0, differenceInMinutes(date, now));
      if (diffMin < 60) return `Over ${diffMin} min`;
      const hours = Math.floor(diffMin / 60);
      const minutes = diffMin % 60;
      return minutes > 0 ? `Over ${hours} uur ${minutes} min` : `Over ${hours} uur`;
    }

    const days = Math.max(1, differenceInDays(date, now));
    return `Nog ${days} dag${days === 1 ? '' : 'en'}`;
  };


  const handleLogin = async () => {
    if (!loginEmail) return;
    if (loginMode === 'otp') {
      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail,
        options: { emailRedirectTo: `${window.location.origin}/mijn-afspraken` },
      });
      setLoginMessage(error ? 'Kon link niet versturen.' : 'Check je e‑mail voor de loginlink.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      setLoginMessage(error ? 'Inloggen mislukt.' : null);
    }
  };

  const handleProfileSave = async () => {
    if (!profile) return;
    setProfileSaving(true);
    setProfileMessage(null);
    const res = await fetch('https://api.bellure.nl/api/customers/profile-global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: profile.name, phone: profile.phone || '' }),
    });
    const data = await res.json();
    setProfileSaving(false);
    setProfileMessage(res.ok ? 'Gegevens opgeslagen' : (data.error || 'Opslaan mislukt'));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (!session) {
    return (
      <div className="bellure-booking-page">
        <div className="bellure-shadow-host" style={{ maxWidth: 520, margin: '0 auto', background: '#fff', borderRadius: 18, padding: 24, border: '1px solid #ECE7E2', boxShadow: '0 12px 30px rgba(0,0,0,0.06)' }}>
          <div className="bellure-step-title" style={{ marginBottom: 8 }}>Mijn afspraken</div>
          <div className="bellure-step-subtitle" style={{ marginBottom: 20 }}>Log in om je afspraken te bekijken en beheren.</div>

          <div className="bellure-login-actions" style={{ justifyContent: 'center', marginBottom: 12 }}>
            <button className={`bellure-login-action ${loginMode === 'otp' ? 'active' : ''}`} onClick={() => setLoginMode('otp')}>Link per e‑mail</button>
            <button className={`bellure-login-action ${loginMode === 'password' ? 'active' : ''}`} onClick={() => setLoginMode('password')}>Wachtwoord</button>
          </div>

          <div className="bellure-login-form">
            <input className="bellure-form-input" placeholder="E-mailadres" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            {loginMode === 'password' && (
              <input className="bellure-form-input" placeholder="Wachtwoord" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            )}
            <button className="bellure-btn bellure-btn-primary" onClick={handleLogin}>Inloggen</button>
          </div>
          {loginMessage && <div className="bellure-login-note" style={{ marginTop: 12 }}>{loginMessage}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bellure-booking-page">
      <div className="bellure-shadow-host" style={{ maxWidth: 920, margin: '0 auto', background: 'transparent' }}>
        <div className="bellure-portal-hero">
          <div className="bellure-portal-title">Mijn afspraken</div>
          <div className="bellure-portal-sub">Overzicht van je bezoeken en geplande afspraken.</div>
          <div className="bellure-portal-actions">
            <button className="bellure-portal-logout" onClick={handleLogout}>Uitloggen</button>
            <a className="bellure-portal-book" href="https://booking.bellure.nl">Nieuwe afspraak</a>
          </div>
        </div>

        <div className="bellure-portal-grid">
          <div className="bellure-section-card">
            <div className="bellure-section-title">Jouw gegevens</div>
            {profile ? (
              <div className="bellure-portal-profile">
                <input className="bellure-form-input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                <input className="bellure-form-input" value={profile.email} readOnly />
                <input className="bellure-form-input" placeholder="Telefoon" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                <button className="bellure-btn bellure-btn-primary" onClick={handleProfileSave} disabled={profileSaving}>{profileSaving ? 'Opslaan...' : 'Gegevens opslaan'}</button>
                {profileMessage && <div className="bellure-login-note">{profileMessage}</div>}
              </div>
            ) : (
              <div className="bellure-portal-profile">Geen profiel gevonden.</div>
            )}
          </div>

          <div className="bellure-section-card">
            <div className="bellure-section-title">Filter</div>
            <div className="bellure-portal-filters">
              <div className="bellure-filter-group">
                <button className={`bellure-filter ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Aankomend</button>
                <button className={`bellure-filter ${filter === 'history' ? 'active' : ''}`} onClick={() => setFilter('history')}>Geschiedenis</button>
                <button className={`bellure-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Alles</button>
              </div>
              <input className="bellure-filter-input" placeholder="Zoek salon, behandeling, stylist" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="bellure-filter-select" value={salonFilter} onChange={(e) => setSalonFilter(e.target.value)}>
                <option value="all">Alle salons</option>
                {salons.map(([slug, name]) => (
                  <option key={slug} value={slug}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bellure-section-card">Laden...</div>
        ) : grouped.length === 0 ? (
          <div className="bellure-section-card">Geen afspraken gevonden.</div>
        ) : (
          grouped.map(([month, items]) => (
            <div key={month} className="bellure-portal-group">
              <div className="bellure-portal-month">{month}</div>
              <div className="bellure-portal-list">
                {items.map((a) => {
                  const date = new Date(a.start_at);
                  const time = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
                  const dateStr = date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
                  const services = a.services.length > 0 ? a.services.join(', ') : 'Behandeling';
                  const bookingUrl = a.salon?.slug ? `https://booking.bellure.nl/${a.salon.slug}` : '#';
                  const cancelUrl = a.cancel_token ? `https://api.bellure.nl/api/cancel?token=${a.cancel_token}` : null;

                  return (
                    <div key={a.id} className="bellure-portal-card">
                      <div>
                        <div className="bellure-portal-salon">{a.salon?.name || 'Salon'}</div>
                        <div className="bellure-portal-service">{services}</div>
                        <div className="bellure-portal-meta">{dateStr} · {time} · {a.staff?.name || 'Geen voorkeur'}</div>
                        {isAfter(date, new Date()) && (
                          <div className="bellure-portal-countdown">{getCountdown(a.start_at)}</div>
                        )}
                      </div>
                      <div className="bellure-portal-actions">
                        <a className="bellure-portal-btn" href={bookingUrl}>Opnieuw boeken</a>
                        {cancelUrl && (
                          <a className="bellure-portal-btn danger" href={cancelUrl} target="_blank" rel="noopener">Annuleren</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
