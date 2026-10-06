# Push-up Battle

Live 1v1 push-up battles with random strangers. This is the MVP: see [MVP.md](MVP.md) for what it tests and why.

Stack: Next.js 16 (App Router) · Supabase (Postgres) · Daily.co (video) · Tailwind. Deploys to Vercel.

## Setup (about 15 minutes)

1. **Supabase**: create a free project at supabase.com. Open **SQL Editor**, paste in `supabase/schema.sql`, and run it.
   Copy the Project URL and the `service_role` key from **Project Settings → API**.
2. **Daily.co**: create a free account at daily.co and copy the API key from **Developers**.
3. Copy `.env.example` to `.env.local` and fill it in. Set `BATTLE_HOUR_ALWAYS_OPEN=true` for local testing.
4. `npm install`, then `npm run dev`, then open http://localhost:3000

## Testing a battle locally
Open the site in a normal window **and** an incognito window. They get different player cookies,
so they act as two strangers. Join from both and you'll be paired. Your webcam will appear in both feeds; that's expected.
To test on a phone, deploy first (camera access requires HTTPS).

## Deploy
Push to GitHub, import the repo in Vercel, add the same env vars (with `BATTLE_HOUR_ALWAYS_OPEN=false`), and deploy.

## Running Battle Hour
- Open `/admin?key=YOUR_ADMIN_KEY` on a laptop. Click **Mark this browser as founder** once, and do the same on
  the phone you'll play from, so your own battles aren't counted in the metrics.
- If a waiting row turns red (more than 45s), join from your phone and battle them.
- Reports show up in red. There's no ban feature yet, by design. If reports start coming in, a ban list
  (a `banned` flag on `players`, checked in `/api/queue/join`) is the first thing to add.
- Send the "starts in 15 min" email yourself to the addresses in the `signups` table.

## Reading the results
Paste `supabase/metrics.sql` into the Supabase SQL editor. The first query is the pass/kill verdict and the
rest are diagnostics. Thresholds are in [MVP.md](MVP.md).

## How it works
- `supabase/schema.sql` → `join_queue()` does matchmaking in one atomic transaction (`FOR UPDATE SKIP LOCKED`).
  The waiting page polls it every 1.5s. Tabs that stop polling for 6s are skipped.
- `lib/battle.ts` → battle state (`matched → scoring → done`, or `reported` / `error`) advances lazily on each poll,
  so no cron job is needed. The first poll creates the Daily room and sets a synced start time 12s later.
- Only the server talks to Supabase, using the service-role key. RLS is on with no policies, so the public anon key can't read anything.
- Events logged: `session_start`, `joined_queue`, `matched`, `battle_completed`, `battle_again_clicked`.
