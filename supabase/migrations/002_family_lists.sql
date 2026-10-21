-- Run this upgrade in SQL Editor, not setup.sql. Existing lists are preserved.
begin;
alter table public.lu_items drop constraint if exists lu_items_kind_check;
alter table public.lu_items add constraint lu_items_kind_check
 check(kind in ('shopping','todo','watch','places'));
create table if not exists public.lu_stores (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.lu_homes(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 40)
);
create unique index if not exists lu_stores_name on public.lu_stores(home_id,lower(trim(name)));
alter table public.lu_stores enable row level security;
drop policy if exists stores_read on public.lu_stores;
create policy stores_read on public.lu_stores for select to authenticated
 using(home_id=public.lu_my_home());
drop policy if exists stores_insert on public.lu_stores;
create policy stores_insert on public.lu_stores for insert to authenticated
 with check(home_id=public.lu_my_home());
revoke all on public.lu_stores from anon,authenticated;
grant select,insert on public.lu_stores to authenticated;
notify pgrst, 'reload schema';
commit;
