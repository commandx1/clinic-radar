"use client";

import {
  CreditCard,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Stethoscope,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const TAB_PATHS = [
  { href: "/business", key: "overview", icon: LayoutDashboard },
  { href: "/business/tasks", key: "tasks", icon: ListTodo },
  { href: "/business/competitors", key: "competitors", icon: Users },
  { href: "/business/reviews", key: "reviews", icon: MessageSquare },
  { href: "/business/themes", key: "themes", icon: Tags },
  { href: "/business/treatments", key: "treatments", icon: Stethoscope },
  { href: "/business/trend", key: "trend", icon: TrendingUp },
  { href: "/business/billing", key: "billing", icon: CreditCard },
] as const;

export function NavTabs() {
  const t = useTranslations("business.tabs");
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {TAB_PATHS.map((tab) => {
        const isActive = tab.href === "/business" ? pathname === tab.href : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
