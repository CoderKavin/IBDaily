/**
 * WarningBanner - Calm, factual warning display
 * Used for at-risk states and important notices
 * No alarm colors - uses amber sparingly
 */

interface WarningBannerProps {
  children: React.ReactNode;
  emphasis?: string;
}

export default function WarningBanner({
  children,
  emphasis,
}: WarningBannerProps) {
  return (
    <div className="border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
          {children}
        </div>
        {emphasis && (
          <div className="flex-shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {emphasis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
