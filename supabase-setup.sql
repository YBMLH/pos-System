-- ============================================================
-- Shop mirror — database setup
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- ============================================================

-- One row per record in the shop. The shop PC upserts into it; nobody else
-- writes. `doc` is the record exactly as the shop app holds it.
create table if not exists public.shop_rows (
  shop_id    text        not null,
  store      text        not null,
  row_id     text        not null,
  doc        jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (shop_id, store, row_id)
);

create index if not exists shop_rows_feed
  on public.shop_rows (shop_id, updated_at desc);

-- Who may see which shop, and who is allowed to write to it.
-- role 'device' = the shop PC (read + write).  role 'owner' = read only.
create table if not exists public.shop_members (
  shop_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null check (role in ('device','owner')),
  primary key (shop_id, user_id)
);

alter table public.shop_rows    enable row level security;
alter table public.shop_members enable row level security;

-- Membership is readable only by the person it is about.
drop policy if exists "see own membership" on public.shop_members;
create policy "see own membership" on public.shop_members
  for select using (user_id = auth.uid());

-- Anyone listed for the shop can read it.
drop policy if exists "members read" on public.shop_rows;
create policy "members read" on public.shop_rows
  for select using (exists (
    select 1 from public.shop_members m
    where m.shop_id = shop_rows.shop_id and m.user_id = auth.uid()));

-- Only the shop PC can write, and only to its own shop. This is what makes
-- the owner's page read-only no matter what anybody types into it.
drop policy if exists "device writes" on public.shop_rows;
create policy "device writes" on public.shop_rows
  for insert with check (exists (
    select 1 from public.shop_members m
    where m.shop_id = shop_rows.shop_id and m.user_id = auth.uid() and m.role = 'device'));

drop policy if exists "device updates" on public.shop_rows;
create policy "device updates" on public.shop_rows
  for update using (exists (
    select 1 from public.shop_members m
    where m.shop_id = shop_rows.shop_id and m.user_id = auth.uid() and m.role = 'device'));

-- Only used by "Re-upload everything" after a restore or a reset.
drop policy if exists "device clears" on public.shop_rows;
create policy "device clears" on public.shop_rows
  for delete using (exists (
    select 1 from public.shop_members m
    where m.shop_id = shop_rows.shop_id and m.user_id = auth.uid() and m.role = 'device'));


-- ============================================================
-- AFTER creating the two accounts in Authentication → Users,
-- run this once, with your own values:
-- ============================================================
--
--   insert into public.shop_members (shop_id, user_id, role)
--   select 'stylebyib', id, 'device' from auth.users where email = 'pc@stylebyib.local'
--   on conflict (shop_id, user_id) do update set role = excluded.role;
--
--   insert into public.shop_members (shop_id, user_id, role)
--   select 'stylebyib', id, 'owner'  from auth.users where email = 'yasser@example.com'
--   on conflict (shop_id, user_id) do update set role = excluded.role;
--
-- Replace 'stylebyib' with your shop name and the two emails with the ones
-- you created. The shop name must match what you type into the app exactly.
--
-- To check it worked:  select * from public.shop_members;
-- ============================================================
