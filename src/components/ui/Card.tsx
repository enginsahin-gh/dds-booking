import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hover, onClick, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3 lg:p-4',
    md: 'p-4 lg:p-5',
    lg: 'p-5 lg:p-6',
  };

  return (
    <div
      className={`
        bg-white rounded-2xl border border-gray-200/60
        shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]
        ${hover ? 'transition-all duration-200 hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] hover:border-gray-200 hover:-translate-y-px cursor-pointer' : ''}
        ${paddings[padding]}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardSectionProps {
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function CardSection({ title, description, children, className = '', action }: CardSectionProps) {
  return (
    <div className={`${className}`}>
      {(title || description || action) && (
        <div className="flex items-start justify-between mb-5">
          <div>
            {title && <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>}
            {description && <p className="text-[13px] text-gray-500 mt-1">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: { value: string; positive: boolean };
  color?: 'default' | 'green' | 'amber' | 'violet';
}

export function StatCard({ icon, value, label, trend, color = 'default' }: StatCardProps) {
  const iconBg = {
    default: 'bg-gray-100 text-gray-500',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="text-[12px] text-gray-500 mt-0.5 font-medium">{label}</p>
    </Card>
  );
}
