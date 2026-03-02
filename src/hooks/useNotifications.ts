import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Interface used by NotificationCenter component
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  time: string;     // ISO timestamp
  read: boolean;
  bookingId?: string;
}

// Raw DB row
interface NotificationRow {
  id: string;
  salon_id: string;
  type: string;
  title: string;
  message: string | null;
  booking_id: string | null;
  read: boolean;
  created_at: string;
}

function toAppNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.message || '',
    time: row.created_at,
    read: row.read,
    bookingId: row.booking_id || undefined,
  };
}

export function useNotifications(salonId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Fetch initial notifications from DB
  useEffect(() => {
    if (!salonId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('salon_id', salonId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const mapped = (data as NotificationRow[]).map(toAppNotification);
        setNotifications(mapped);
        setUnreadCount(mapped.filter(n => !n.read).length);
      }
    };

    fetchNotifications();

    // Subscribe to realtime INSERT events
    const channel = supabase
      .channel(`notifications:${salonId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          const notif = toAppNotification(row);
          setNotifications(prev => [notif, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);

          // Show browser notification if permitted
          if (permissionState === 'granted' && 'Notification' in window) {
            try {
              new window.Notification(notif.title, {
                body: notif.body,
                icon: '/favicon.ico',
                tag: notif.id,
              });
            } catch { /* ignore */ }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId, permissionState]);

  const markAllRead = useCallback(async () => {
    if (!salonId) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('salon_id', salonId)
      .eq('read', false);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [salonId]);

  const clearAll = useCallback(async () => {
    if (!salonId) return;
    // Delete all notifications for this salon
    await supabase
      .from('notifications')
      .delete()
      .eq('salon_id', salonId);

    setNotifications([]);
    setUnreadCount(0);
  }, [salonId]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await window.Notification.requestPermission();
    setPermissionState(result);
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
