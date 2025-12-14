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
        { href: `/units?cohortId=${cohortId}`, label: "Units" },
        { href: `/me?cohortId=${cohortId}`, label: "Progress" },
        { href: `/leaderboard?cohortId=${cohortId}`, label: "Rank" },
        { href: "/cohort", label: "Cohorts" },
      ]
    : [{ href: "/cohort", label: "Cohorts" }];

  return (
    <div className="flex items-center justify-between h-14">
      <div className="flex items-center space-x-1 overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
              pathname === item.href.split("?")[0]
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/auth" })}
        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
      >
        Logout
      </button>
    </div>
  );
}

export default function Nav() {
  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-4xl mx-auto px-4">
        <Suspense fallback={<div className="h-14" />}>
          <NavContent />
        </Suspense>
      </div>
    </nav>
  );
}
