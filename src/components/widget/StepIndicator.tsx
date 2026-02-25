import type { BookingStep } from '../../lib/types';

interface StepIndicatorProps {
  currentStep: BookingStep;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 5 }: StepIndicatorProps) {
  return (
    <div className="dds-steps">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        let cls = 'dds-step-dot';
        if (step === currentStep) cls += ' dds-step-dot--active';
        else if (step < currentStep) cls += ' dds-step-dot--completed';
        return <div key={step} className={cls} />;
      })}
    </div>
  );
}
