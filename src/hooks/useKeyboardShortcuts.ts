import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutOptions {
  /** Callback to open the search bar */
  onOpenSearch?: () => void;
  /** Callback to close any open modal/overlay */
  onEscape?: () => void;
}

/**
 * Global keyboard shortcuts for admin panel.
 * - Ctrl/Cmd+K: open search
 * - Ctrl/Cmd+N: new booking (navigate to bookings page)
 * - Escape: close modals (handled via callback)
 */
export function useKeyboardShortcuts({ onOpenSearch, onEscape }: ShortcutOptions = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModKey = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl/Cmd+K: open search (works even in inputs)
      if (isModKey && e.key === 'k') {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Ctrl/Cmd+N: new booking (skip if typing in input)
      if (isModKey && e.key === 'n' && !isInput) {
        e.preventDefault();
        navigate('/admin/bookings?new=1');
        return;
      }

      // Escape: close modals
      if (e.key === 'Escape') {
        onEscape?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onOpenSearch, onEscape]);
}
