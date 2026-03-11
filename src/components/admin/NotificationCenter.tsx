import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { AppNotification } from '../../hooks/useNotifications';

interface Props {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onRequestPermission: () => void;
  permissionState: NotificationPermission;
}

const typeIcons: Record<string, { icon: string; bg: string; color: string }> = {
  new_booking: {
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    bg: 'bg-violet-100',
    color: 'text-violet-600',
  },
  cancellation: {
    icon: 'M6 18L18 6M6 6l12 12',
    bg: 'bg-red-100',
    color: 'text-red-600',
  },
  payment: {
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    bg: 'bg-emerald-100',
    color: 'text-emerald-600',
  },
  no_show: {
    icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    bg: 'bg-amber-100',
    color: 'text-amber-600',
  },
};

export function NotificationCenter({
  notifications, unreadCount, onMarkAllRead, onClearAll, onRequestPermission, permissionState,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unreadCount > 0) {
      // Mark as read after a short delay (so user sees the unread state)
      setTimeout(onMarkAllRead, 2000);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-[70] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 w-[340px] sm:w-[380px] max-h-[480px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-[14px] font-bold text-gray-900">Meldingen</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Alles wissen
                </button>
              )}
            </div>
          </div>

          {/* Permission banner */}
          {permissionState === 'default' && (
            <div className="px-4 py-3 bg-violet-50 border-b border-violet-100">
              <div className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-600 flex-shrink-0 mt-0.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                <div>
                  <div className="text-[12px] font-semibold text-violet-900">Meldingen inschakelen?</div>
                  <div className="text-[11px] text-violet-700 mt-0.5">Krijg een melding bij nieuwe boekingen, ook als de tab op de achtergrond staat.</div>
                  <button
                    onClick={onRequestPermission}
                    className="mt-1.5 text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    Inschakelen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                </div>
                <p className="text-[13px] text-gray-400 font-medium">Geen meldingen</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Je ontvangt hier updates over boekingen</p>
              </div>
            ) : (
              <div>
                {notifications.map(notif => {
                  const typeInfo = typeIcons[notif.type] || typeIcons.new_booking;
                  const timeAgo = formatDistanceToNow(parseISO(notif.time), { addSuffix: true, locale: nl });

                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                        !notif.read ? 'bg-violet-50/30' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${typeInfo.bg} ${typeInfo.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={typeInfo.icon} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-gray-900">{notif.title}</span>
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{timeAgo}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
