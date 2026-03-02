import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';

export interface AppNotification {
  id: string;
  type: 'new_booking' | 'cancellation' | 'payment' | 'no_show';
  title: string;
  body: string;
  time: string;
  read: boolean;
  bookingId?: string;
}

// Short notification sound (base64 encoded tiny MP3 beep)
const NOTIFICATION_SOUND_URL = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYMQfOkAAAAAAD/+1DEAAAGAAGn9AAAIiYWb/OYkRFwAADSAAAbAAE+Tn5+CAIAgDoP/BwfBx38oc/KHP4nB8H/5Q5//y5/lDn/Uf/9R/kAQBAEATdBB3/0HQdB0HQAAAABU2awhJ2e96Nh0HajQGBVLt63CIrZ8udCwsUxkLT0F7r/+1DEIAPFQBl3nJGAKJwDsj+SMSRQ5dlLLXL9XGNWlWldvvFZVrh2q6x/iq2Mcb5xc1L4z/////+P////4qWk5AAAAAA//tQxB0DwAABpBwAACAAADSAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    // Use a simple oscillator beep instead of loading audio
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // Silent fail — audio not critical
  }
}

function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'bellure-booking',
      });
    } catch {
      // Silent fail
    }
  }
}

const STORAGE_KEY = 'bellure_notifications';
const MAX_NOTIFICATIONS = 30;

function loadStored(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveStored(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* quota */ }
}

export function useNotifications(salonId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadStored);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const salonIdRef = useRef(salonId);
  salonIdRef.current = salonId;

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: crypto.randomUUID(),
      read: false,
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveStored(updated);
      return updated;
    });
    playNotificationSound();
    sendBrowserNotification(notif.title, notif.body);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveStored(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveStored([]);
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      setPermissionState(result);
    }
  }, []);

  // Realtime subscription for new/changed bookings
  useEffect(() => {
    if (!salonId) return;

    const channel = supabase
      .channel(`notifications-${salonId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salonId}` },
        (payload) => {
          const b = payload.new as any;
          if (!b) return;
          const timeStr = b.start_at ? format(parseISO(b.start_at), "EEEE d MMM 'om' HH:mm", { locale: nl }) : '';
          addNotification({
            type: 'new_booking',
            title: 'Nieuwe boeking',
            body: `${b.customer_name} heeft geboekt voor ${timeStr}`,
            time: new Date().toISOString(),
            bookingId: b.id,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salonId}` },
        (payload) => {
          const b = payload.new as any;
          const old = payload.old as any;
          if (!b || !old) return;

          // Cancellation
          if (b.status === 'cancelled' && old.status !== 'cancelled') {
            addNotification({
              type: 'cancellation',
              title: 'Afspraak geannuleerd',
              body: `${b.customer_name} heeft de afspraak geannuleerd`,
              time: new Date().toISOString(),
              bookingId: b.id,
            });
          }

          // Payment received
          if (b.payment_status === 'paid' && old.payment_status !== 'paid') {
            addNotification({
              type: 'payment',
              title: 'Betaling ontvangen',
              body: `€${((b.amount_paid_cents || 0) / 100).toFixed(2).replace('.', ',')} ontvangen van ${b.customer_name}`,
              time: new Date().toISOString(),
              bookingId: b.id,
            });
          }

          // No-show
          if (b.status === 'no_show' && old.status !== 'no_show') {
            addNotification({
              type: 'no_show',
              title: 'No-show',
              body: `${b.customer_name} is niet komen opdagen`,
              time: new Date().toISOString(),
              bookingId: b.id,
            });
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [salonId, addNotification]);

  // Request notification permission on first render (one-time)
  useEffect(() => {
    if (permissionState === 'default') {
      // Don't auto-request — let user trigger it
    }
  }, []);

  return {
    notifications,
    unreadCount,
    markAllRead,
    clearAll,
    requestPermission,
    permissionState,
  };
}
