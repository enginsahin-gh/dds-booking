import type { BookingStep } from '../../lib/types';

interface StepIndicatorProps {
  currentStep: BookingStep;
  totalSteps?: number;
  labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps = 5, labels = [] }: StepIndicatorProps) {
  const label = labels[currentStep - 1] || '';

  return (
    <div className="bellure-steps">
      <div className="bellure-steps-dots">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          let cls = 'bellure-step-dot';
          if (step === currentStep) cls += ' bellure-step-dot--active';
          else if (step < currentStep) cls += ' bellure-step-dot--completed';
          return <div key={step} className={cls} />;
        })}
      </div>
      {label && <div className="bellure-step-label">{label}</div>}
    </div>
  );
}
