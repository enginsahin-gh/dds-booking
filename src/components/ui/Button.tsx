import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base = `
    inline-flex items-center justify-center font-semibold rounded-xl
    transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-1
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    active:scale-[0.98]
  `;

  const variants: Record<string, string> = {
    primary: `
      bg-violet-600 text-white
      hover:bg-violet-700 hover:shadow-[0_4px_12px_rgba(124,58,237,0.25)]
      focus-visible:ring-violet-500/30
    `,
    secondary: `
      bg-white text-gray-700 border border-gray-200
      shadow-[0_1px_2px_rgba(0,0,0,0.04)]
      hover:bg-gray-50 hover:border-gray-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06)]
      focus-visible:ring-gray-400/20
    `,
    danger: `
      bg-red-600 text-white
      hover:bg-red-700 hover:shadow-[0_4px_12px_rgba(220,38,38,0.25)]
      focus-visible:ring-red-500/30
    `,
    ghost: `
      bg-transparent text-gray-600
      hover:bg-gray-100 hover:text-gray-800
      focus-visible:ring-gray-400/20
    `,
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-[13px] gap-1.5',
    md: 'px-4 py-2.5 text-[13px] gap-2',
    lg: 'px-5 py-3 text-[14px] gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
