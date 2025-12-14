/**
 * PrimaryButton - The single, strong call-to-action
 * Used for the one primary action per page
 */

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  fullWidth = false,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${fullWidth ? "w-full" : ""}
        px-6 py-3
        bg-neutral-900 dark:bg-white
        text-white dark:text-neutral-900
        text-sm font-medium tracking-wide
        rounded-lg
        transition-opacity
        hover:opacity-90
        disabled:opacity-40 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-2
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Saving...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
