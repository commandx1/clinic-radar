"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CheckoutLinkButton({ href, label }: { href: string; label: string }) {
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <a
      href={href}
      aria-disabled={isNavigating}
      className={cn(buttonVariants({ className: "w-fit" }), isNavigating && "pointer-events-none opacity-50")}
      onClick={() => {
        setIsNavigating(true);
      }}
    >
      {isNavigating && <Loader2Icon className="size-4 animate-spin" />}
      {label}
    </a>
  );
}
