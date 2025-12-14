/**
 * PageHeader - Consistent page title and optional subtitle
 * Strong hierarchy with generous spacing
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </p>
      )}
    </header>
  );
}
