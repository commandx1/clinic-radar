"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TAB_PATHS = [
  { href: "/business", key: "overview" },
  { href: "/business/tasks", key: "tasks" },
  { href: "/business/competitors", key: "competitors" },
  { href: "/business/reviews", key: "reviews" },
  { href: "/business/themes", key: "themes" },
  { href: "/business/trend", key: "trend" },
] as const;

export function NavTabs() {
  const t = useTranslations("business.tabs");
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border">
      {TAB_PATHS.map((tab) => {
        const isActive = tab.href === "/business" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
