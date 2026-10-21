-- Run after 002_family_lists.sql. Existing items, accounts and sharing are preserved.
begin;
alter table public.lu_items drop constraint if exists lu_items_kind_check;
alter table public.lu_items add constraint lu_items_kind_check
 check(kind in ('shopping','todo','restaurants','watch','places'));
alter table public.lu_items
 add column if not exists cuisine text not null default '' check(length(cuisine)<=60),
 add column if not exists address text not null default '' check(length(address)<=240),
 add column if not exists notes text not null default '' check(length(notes)<=1000);
-- Existing household RLS applies to all fields; home_id remains non-editable.
grant update(title,cuisine,address,notes) on public.lu_items to authenticated;
notify pgrst, 'reload schema';
commit;
