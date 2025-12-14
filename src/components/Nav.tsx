"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Suspense } from "react";

function NavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");

  const navItems = cohortId
    ? [
        { href: `/submit?cohortId=${cohortId}`, label: "Submit" },
        { href: `/me?cohortId=${cohortId}`, label: "Progress" },
        { href: `/leaderboard?cohortId=${cohortId}`, label: "Rank" },
        { href: `/units?cohortId=${cohortId}`, label: "Units" },
        { href: "/cohort", label: "Cohorts" },
      ]
    : [{ href: "/cohort", label: "Cohorts" }];

  return (
    <div className="flex items-center justify-between h-12">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = pathname === item.href.split("?")[0];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors
                ${
                  isActive
                    ? "text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }
              `}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/auth" })}
        className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

export default function Nav() {
  return (
    <nav className="sticky top-0 z-40 bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Suspense fallback={<div className="h-12" />}>
          <NavContent />
        </Suspense>
      </div>
    </nav>
  );
}
