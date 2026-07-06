import { NextResponse, type NextRequest } from "next/server";

import { createCheckout } from "@/lib/billing/lemonsqueezy-client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const checkoutUrl = await createCheckout({ userId: user.id, email: user.email! });
    return NextResponse.redirect(checkoutUrl, 307);
  } catch {
    return NextResponse.redirect(new URL("/business/billing?checkout_error=1", request.url));
  }
}
