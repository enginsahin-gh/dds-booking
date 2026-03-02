import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, hint, icon, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-semibold text-gray-700 tracking-tight">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full rounded-xl text-[14px] text-gray-900 placeholder:text-gray-400
            bg-white border border-gray-200
            transition-all duration-200 ease-out
            hover:border-gray-300
            focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:hover:border-gray-200
            ${icon ? 'pl-10 pr-4' : 'px-4'}
            py-3
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-[12px] text-red-600 font-medium flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</p>}
      {hint && !error && <p className="text-[12px] text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-semibold text-gray-700 tracking-tight">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`
          w-full rounded-xl text-[14px] text-gray-900 placeholder:text-gray-400 px-4 py-3
          bg-white border border-gray-200 resize-none
          transition-all duration-200 ease-out
          hover:border-gray-300
          focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[12px] text-red-600 font-medium flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</p>}
      {hint && !error && <p className="text-[12px] text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string | number; label: string }[];
}

export function Select({ label, error, hint, options, className = '', id, ...props }: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-semibold text-gray-700 tracking-tight">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={inputId}
          className={`
            w-full appearance-none rounded-xl text-[14px] text-gray-900 pl-4 pr-10 py-3
            bg-white border border-gray-200
            transition-all duration-200 ease-out
            hover:border-gray-300
            focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}
      {hint && !error && <p className="text-[12px] text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  );
}
