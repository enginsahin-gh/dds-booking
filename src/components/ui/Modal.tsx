import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-lg',
    lg: 'md:max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      {/* Mobile: bottom sheet | Desktop: centered modal */}
      <div className="absolute inset-0 flex items-end md:items-center md:justify-center pointer-events-none">
        <div
          className={`
            pointer-events-auto relative bg-white w-full
            rounded-t-2xl md:rounded-2xl
            max-h-[85dvh] md:max-h-[90vh]
            overflow-hidden
            shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]
            animate-in slide-in-from-bottom md:fade-in md:zoom-in-95
            ${sizeClasses[size]}
          `}
        >
          {/* Handle bar (mobile only) */}
          <div className="md:hidden flex justify-center py-2.5">
            <div className="w-9 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 md:px-6 md:py-4 border-b border-gray-100">
            <h2 className="text-[16px] md:text-lg font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-1 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div
            ref={contentRef}
            className={`px-5 py-5 md:px-6 overflow-y-auto ${footer ? 'max-h-[calc(85dvh-140px)] md:max-h-[calc(90vh-140px)]' : 'max-h-[calc(85dvh-80px)] md:max-h-[calc(90vh-80px)]'}`}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-5 py-4 md:px-6 border-t border-gray-100 bg-gray-50/50">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
