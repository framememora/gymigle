-- Push-up Battle: pass/kill metrics. Paste into the Supabase SQL editor.
-- A "completed" battle = status 'done' with both scores entered.
-- Founder accounts (players.is_founder) are excluded as subjects, but battles
-- against the founder still count for the other player.

with completed as (
  select id, player_a as pid, completed_at from battles
   where status = 'done' and a_reps is not null and b_reps is not null
  union all
  select id, player_b as pid, completed_at from battles
   where status = 'done' and a_reps is not null and b_reps is not null
),
subject as (
  select c.* from completed c join players p on p.id = c.pid where not p.is_founder
),
ranked as (
  select pid, completed_at,
         (completed_at at time zone 'America/New_York')::date as et_day,
         row_number() over (partition by pid order by completed_at) as n
    from subject
),
firsts as (select pid, completed_at as first_at, et_day as first_day from ranked where n = 1),
seconds as (select pid, completed_at as second_at from ranked where n = 2),
per_player as (
  select f.pid,
         (s.second_at is not null and s.second_at < f.first_at + interval '2 hours') as same_session_2nd,
         exists (
           select 1 from ranked r
            where r.pid = f.pid
              and r.et_day <> f.first_day
              and r.completed_at <= f.first_at + interval '7 days'
         ) as returned_other_day,
         (select count(distinct et_day) from ranked r where r.pid = f.pid) as distinct_days
    from firsts f left join seconds s on s.pid = f.pid
)
select
  count(*)                                                            as cohort_completed_first_battle,
  round(100.0 * avg(same_session_2nd::int), 1)                        as pct_2nd_battle_same_session,   -- pass >= 40, kill < 15
  round(100.0 * avg(returned_other_day::int), 1)                      as pct_returned_other_day_7d,     -- pass >= 25, kill < 10
  count(*) filter (where distinct_days >= 3)                          as players_3plus_days             -- pass >= 5, kill = 0
from per_player;

-- NOTE: the 7-day return rate undercounts players whose first battle was recent
-- (they haven't had 7 days to come back). For the fair number, change
--   `from firsts f`  to  `from (select * from firsts where first_at <= now() - interval '6 days') f`
-- and re-run. On Day 14 that's the Day 8 cohort.

-- ---------- Diagnostics ----------

-- Funnel: sessions -> queue -> matched -> completed (unique players, founder excluded)
select e.name, count(distinct e.pid) as players
  from events e join players p on p.id = e.pid
 where not p.is_founder
 group by e.name
 order by players desc;

-- Average and worst queue wait (seconds)
select round(avg(extract(epoch from created_at - least(a_joined_at, b_joined_at)))) as avg_wait_s,
       round(max(extract(epoch from created_at - least(a_joined_at, b_joined_at)))) as max_wait_s
  from battles;

-- Report and dispute rates
select count(*)                                            as battles,
       count(*) filter (where status = 'reported')         as reported,
       count(*) filter (where disputed)                    as disputed,
       count(*) filter (where status = 'done'
                          and (a_reps is null or b_reps is null)) as incomplete
  from battles;

-- Players per Battle Hour day
select (completed_at at time zone 'America/New_York')::date as day,
       count(distinct pid) as players, count(distinct id) as battles
  from (
    select id, player_a as pid, completed_at from battles where status = 'done'
    union all
    select id, player_b, completed_at from battles where status = 'done'
  ) x
 group by 1 order by 1;
