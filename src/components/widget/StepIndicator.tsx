import type { BookingStep } from '../../lib/types';

interface StepIndicatorProps {
  currentStep: BookingStep;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 5 }: StepIndicatorProps) {
  return (
    <div className="bellure-steps">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        let cls = 'bellure-step-dot';
        if (step === currentStep) cls += ' bellure-step-dot--active';
        else if (step < currentStep) cls += ' bellure-step-dot--completed';
        return <div key={step} className={cls} />;
      })}
    </div>
  );
}
