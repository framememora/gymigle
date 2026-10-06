-- Push-up Battle MVP schema. Run once in the Supabase SQL editor.
-- All access goes through the Next.js server with the service-role key,
-- so RLS is enabled with no policies (locks out the anon key entirely).

create table if not exists players (
  id          uuid primary key,
  nickname    text,
  is_founder  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists queue (
  pid        uuid primary key references players(id),
  joined_at  timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  battle_id  uuid  -- set when someone else matches this player
);

create table if not exists battles (
  id            uuid primary key default gen_random_uuid(),
  player_a      uuid not null references players(id),
  player_b      uuid not null references players(id),
  a_joined_at   timestamptz not null,  -- queue join times, for wait-time diagnostics
  b_joined_at   timestamptz not null,
  created_at    timestamptz not null default now(),
  room_name     text,
  room_url      text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  a_reps        int,
  b_reps        int,
  -- matched -> scoring -> done | reported | error
  status        text not null default 'matched',
  disputed      boolean not null default false,
  completed_at  timestamptz
);
create index if not exists battles_player_a on battles(player_a);
create index if not exists battles_player_b on battles(player_b);

create table if not exists events (
  id          bigserial primary key,
  pid         uuid,
  name        text not null,
  battle_id   uuid,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_name on events(name, created_at);

create table if not exists signups (
  email       text primary key,
  created_at  timestamptz not null default now()
);

create table if not exists reports (
  id          bigserial primary key,
  battle_id   uuid not null references battles(id),
  reporter    uuid not null,
  reported    uuid not null,
  created_at  timestamptz not null default now()
);

alter table players enable row level security;
alter table queue   enable row level security;
alter table battles enable row level security;
alter table events  enable row level security;
alter table signups enable row level security;
alter table reports enable row level security;

-- Atomic matchmaking. Called on join and on every queue poll.
-- Returns the battle id once this player is matched, else null.
create or replace function join_queue(p_pid uuid) returns uuid
language plpgsql as $$
declare
  me  queue%rowtype;
  opp queue%rowtype;
  bid uuid;
begin
  insert into queue(pid) values (p_pid) on conflict (pid) do nothing;

  -- Blocks if another transaction is matching us right now.
  select * into me from queue where pid = p_pid for update;
  if me.battle_id is not null then
    delete from queue where pid = p_pid;
    return me.battle_id;
  end if;

  update queue set last_seen = now() where pid = p_pid;

  -- Oldest live waiter (polled in the last 6s, so closed tabs are skipped).
  select * into opp from queue
   where pid <> p_pid
     and battle_id is null
     and last_seen > now() - interval '6 seconds'
   order by joined_at
   limit 1
   for update skip locked;
  if not found then
    return null;
  end if;

  insert into battles(player_a, player_b, a_joined_at, b_joined_at)
  values (opp.pid, p_pid, opp.joined_at, me.joined_at)
  returning id into bid;

  update queue set battle_id = bid where pid = opp.pid;
  delete from queue where pid = p_pid;
  return bid;
end $$;
