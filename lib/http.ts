export const fail = (error: string, status = 400) => Response.json({ error }, { status });

export function isAdmin(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}
