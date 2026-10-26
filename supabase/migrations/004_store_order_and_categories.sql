-- Upgrade after 003_restaurants.sql. Existing items and sharing are preserved.
begin;
alter table public.lu_items add column if not exists category text not null default '' check(length(category)<=60);
grant update(store,category) on public.lu_items to authenticated;
create table if not exists public.lu_preferences (
 home_id uuid primary key references public.lu_homes(id) on delete cascade,
 store_order text[] not null default '{}' check(cardinality(store_order)<=200 and length(array_to_string(store_order,''))<=8000)
);
alter table public.lu_preferences enable row level security;
drop policy if exists preferences_read on public.lu_preferences;
create policy preferences_read on public.lu_preferences for select to authenticated using(home_id=public.lu_my_home());
drop policy if exists preferences_insert on public.lu_preferences;
create policy preferences_insert on public.lu_preferences for insert to authenticated with check(home_id=public.lu_my_home());
drop policy if exists preferences_update on public.lu_preferences;
create policy preferences_update on public.lu_preferences for update to authenticated using(home_id=public.lu_my_home()) with check(home_id=public.lu_my_home());
revoke all on public.lu_preferences from anon,authenticated;
grant select,insert on public.lu_preferences to authenticated;
grant update(store_order) on public.lu_preferences to authenticated;
-- Invoker rights preserve RLS and avoid granting permission to change home_id.
create or replace function public.lu_set_store_order(new_order text[]) returns void
language sql security invoker set search_path = '' as $$
 insert into public.lu_preferences(home_id,store_order) values(public.lu_my_home(),new_order)
 on conflict(home_id) do update set store_order=excluded.store_order;
$$;
revoke all on function public.lu_set_store_order(text[]) from public,anon;
grant execute on function public.lu_set_store_order(text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
