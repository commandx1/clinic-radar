import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createBusinessSchema } from "@/lib/validations/business";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = createBusinessSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      google_place_id: parsed.data.google_place_id,
      category: parsed.data.category ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_linked" }, { status: 409 });
    }

    console.error("Failed to insert business:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ business: data }, { status: 201 });
}
