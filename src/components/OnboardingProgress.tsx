"use client";

interface Step {
  label: string;
  description: string;
}

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: Step[];
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  steps,
}: OnboardingProgressProps) {
  return (
    <div className="mb-10">
      {/* Step counter */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs text-neutral-500">
          {steps[currentStep - 1]?.label}
        </span>
      </div>

      {/* Progress bar - minimal */}
      <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-neutral-900 dark:bg-white transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex justify-between mt-4">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div
              key={step.label}
              className={`flex flex-col ${
                index === 0
                  ? "items-start"
                  : index === steps.length - 1
                    ? "items-end"
                    : "items-center"
              }`}
            >
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
                  ${
                    isCompleted
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                      : isCurrent
                        ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white ring-1 ring-neutral-900 dark:ring-white"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                  }
                `}
              >
                {isCompleted ? (
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`
                  mt-2 text-xs hidden sm:block
                  ${
                    isCurrent
                      ? "text-neutral-900 dark:text-white font-medium"
                      : "text-neutral-400"
                  }
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
