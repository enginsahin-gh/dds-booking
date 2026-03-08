import type { ReactNode } from 'react';

interface AdminFabProps {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export function AdminFab({ label, onClick, icon }: AdminFabProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed right-4 bottom-24 w-12 h-12 rounded-full bg-gray-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.28)] flex items-center justify-center z-40"
      aria-label={label}
    >
      {icon || (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
}
