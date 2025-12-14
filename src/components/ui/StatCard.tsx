/**
 * StatCard - Display a single metric with label
 * Numbers are visually strong, labels are subtle
 */

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
}

export default function StatCard({
  value,
  label,
  sublabel,
  size = "md",
  muted = false,
}: StatCardProps) {
  const valueSize = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-5xl",
  };

  return (
    <div className="text-center">
      <p
        className={`
          ${valueSize[size]}
          font-semibold tracking-tight tabular-nums
          ${muted ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-900 dark:text-white"}
        `}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          {sublabel}
        </p>
      )}
    </div>
  );
}
