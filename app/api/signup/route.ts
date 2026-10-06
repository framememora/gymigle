import { db } from "@/lib/supabase";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return fail("Enter a valid email");
  await db().from("signups").upsert({ email: email.trim().toLowerCase() }, { onConflict: "email" });
  return Response.json({ ok: true });
}
