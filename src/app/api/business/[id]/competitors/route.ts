import { NextResponse } from "next/server";
import { z } from "zod";

import { FREE_PLAN_MAX_COMPETITORS, PRO_PLAN_MAX_COMPETITORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { selectCompetitorsSchema } from "@/lib/validations/competitors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("id", id).maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body: unknown = await request.json();
  const parsed = selectCompetitorsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const planMax = subscription?.plan === "pro" ? PRO_PLAN_MAX_COMPETITORS : FREE_PLAN_MAX_COMPETITORS;

  if (parsed.data.candidates.length > planMax) {
    return NextResponse.json({ error: "plan_limit_exceeded", planMax }, { status: 422 });
  }

  const { error: deleteError } = await supabase.from("competitors").delete().eq("business_id", business.id);

  if (deleteError) {
    console.error("Failed to clear existing competitors:", deleteError);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("competitors")
    .insert(
      parsed.data.candidates.map((c) => ({
        business_id: business.id,
        google_place_id: c.google_place_id,
        name: c.name,
        rating: c.rating,
        review_count: c.review_count,
      })),
    )
    .select();

  if (insertError) {
    console.error("Failed to insert competitors:", insertError);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ competitors: inserted }, { status: 201 });
}
