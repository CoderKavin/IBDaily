/**
 * Card - Clean container with subtle border
 * No shadows - uses border for definition
 */

interface CardProps {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg";
}

export default function Card({ children, padding = "md" }: CardProps) {
  const paddingSize = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`
        ${paddingSize[padding]}
        bg-white dark:bg-neutral-800/50
        border border-neutral-200 dark:border-neutral-700/50
        rounded-xl
      `}
    >
      {children}
    </div>
  );
}
