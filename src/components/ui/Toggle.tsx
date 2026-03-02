interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, description, disabled, size = 'md' }: ToggleProps) {
  const handleClick = () => {
    if (!disabled) onChange(!checked);
  };

  const trackSize = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const thumbSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]';
  const thumbTranslate = size === 'sm' ? 'translate-x-[16px]' : 'translate-x-[20px]';
  const thumbOff = 'translate-x-[3px]';

  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleClick(); } }}
      className={`
        flex items-start gap-3 select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div
        className={`
          relative flex-shrink-0 inline-flex items-center rounded-full
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] mt-0.5
          ${trackSize}
          ${checked
            ? 'bg-violet-600'
            : 'bg-gray-300'
          }
          ${!disabled && !checked ? 'hover:bg-gray-400' : ''}
          ${!disabled && checked ? 'hover:bg-violet-700' : ''}
        `}
      >
        <span
          className={`
            ${thumbSize} rounded-full bg-white
            transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${checked ? thumbTranslate : thumbOff}
          `}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.08)' }}
        />
      </div>
      {(label || description) && (
        <div className="flex-1 min-w-0 pt-px">
          {label && <span className="text-[14px] font-medium text-gray-800 leading-snug block">{label}</span>}
          {description && <p className="text-[13px] text-gray-500 leading-snug mt-0.5">{description}</p>}
        </div>
      )}
    </div>
  );
}
