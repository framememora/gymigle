import "server-only";
import { cookies } from "next/headers";
import { db } from "./supabase";

const COOKIE = "pid";

/** Returns this browser's player id, creating the cookie + players row if needed. */
export async function getOrSetPid(): Promise<string> {
  const jar = await cookies();
  let pid = jar.get(COOKIE)?.value;
  if (!pid || !/^[0-9a-f-]{36}$/.test(pid)) {
    pid = crypto.randomUUID();
    jar.set(COOKIE, pid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  await db().from("players").upsert({ id: pid }, { onConflict: "id", ignoreDuplicates: true });
  return pid;
}

export async function getPid(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}
