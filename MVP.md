# Push-up Battle: MVP Design

## Core assumption (the only thing this MVP tests)
**People will voluntarily come back to do live workout battles against strangers.**
If that's false, there's no product: the leaderboard, matchmaking and AI rep counting don't matter.
Everything else (concurrency, rep-count accuracy, monetization) is a solvable growth or engineering
problem that only matters if this one is true.

## Minimum feature set
1. Join: nickname, 18+ checkbox, camera check, "Find opponent"
2. Pairing: first two in the queue go into a 1:1 video room
3. Battle: push-ups only, 12-second get-ready countdown, 60-second timer, both video feeds
4. Score: each player types in their own reps; the opponent watched live (peer verification). "Dispute" flags a battle.
5. Result: shows the winner, plus a one-tap **Battle again** button

Liquidity: there's a daily **Battle Hour** (default 8:00–8:30pm ET) instead of 24/7 matching.
If someone waits more than 45s, the founder joins as their opponent (watch `/admin`).

Safety baseline: 18+ gate, an always-visible **End & Report** button, the founder watching every Battle Hour.

## Cut (no exceptions)
AI rep counting · sit-ups/squats · leaderboard · Elo matchmaking · accounts/profiles · native apps ·
24/7 matching · chat/friends/invites · payments · push notifications (founder emails the signup list by hand).

## Test criteria (behavioral only, from `supabase/metrics.sql`)
Sample: at least 50 unique (non-founder) players who complete a first battle.

| Metric | Pass | Kill |
|---|---|---|
| Played a 2nd battle within 2h of their first | ≥ 40% | < 15% |
| **Battled again on a different day within 7 days** | ≥ 25% | < 10% |
| Players who battled on 3+ different days | ≥ 5 | 0 |

In between pass and kill: run another 2 weeks and change exactly one variable.
Ignored: surveys, compliments, waitlist size.

## 14-day plan
**Week 1: build + recruit in parallel**
- D1: landing page live; post in r/bodyweightfitness, r/pushups, fitness Discords; DM 20 people
- D2: post a TikTok/Reel of a mock battle
- D3: reply to every signup, ask each to bring a friend
- D4: contact 2 college or calisthenics clubs
- D5: second round of posts, with a demo clip
- D6: goal of 150+ emails
- D7: the only internal test: 4–6 friends on real phones; email the list "First Battle Hour tomorrow"

**Week 2: Battle Hour every night with real strangers (D8–D14)**
No feature work, only fixes for bugs that stop a battle from completing. Post clips (with consent) to keep new players coming.
D14: run `metrics.sql` and decide: **build** (leaderboard + CV rep counting), **iterate** (change one variable), or **kill/pivot**.
