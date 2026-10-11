-- Chess Analyzer — Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run once on a fresh project.

-- ============================================================
-- 1. Tables
-- ============================================================

-- One row per signed-up user; auto-created by trigger on signup.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now()
);

-- One row per saved game analysis. per_move / counts / summary are JSONB
-- so the frontend code shape (a.perMove, a.counts, a.summary) stays identical.
create table if not exists public.analyses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  date timestamptz,
  pgn text,
  sans jsonb,
  opening text,
  depth int,
  counts jsonb,
  per_move jsonb,
  summary jsonb,
  favorite boolean not null default false,
  author text,
  created_at timestamptz not null default now()
);

create table if not exists public.openings (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  eco text,
  moves text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text default 'dark',
  depth int default 20,
  board_orientation text default 'white',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. Row Level Security — every user sees only their own rows
-- ============================================================

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.openings enable row level security;
alter table public.preferences enable row level security;

drop policy if exists "profiles: own rows" on public.profiles;
create policy "profiles: own rows"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "analyses: own rows" on public.analyses;
create policy "analyses: own rows"
  on public.analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "openings: own rows" on public.openings;
create policy "openings: own rows"
  on public.openings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "preferences: own rows" on public.preferences;
create policy "preferences: own rows"
  on public.preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 3. Auto-create a profiles row when a user signs up
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
