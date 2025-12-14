/**
 * PageContainer - Consistent page wrapper with proper spacing
 * Provides max-width constraint and vertical rhythm
 */

interface PageContainerProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function PageContainer({
  children,
  size = "md",
}: PageContainerProps) {
  const maxWidth = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  };

  return (
    <main className={`${maxWidth[size]} mx-auto px-4 sm:px-6 py-8 sm:py-12`}>
      {children}
    </main>
  );
}
